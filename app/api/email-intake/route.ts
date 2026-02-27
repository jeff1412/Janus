// app/api/email-intake/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  GEMINI_TRIAGE_PROMPT,
  type GeminiTriageResult,
  type TicketType,
  type TicketUrgency,
  type TicketStatus,
  type RepairCategory,
} from '../../../lib/ai/geminiEmailTriage';
import nodemailer from 'nodemailer';
// @ts-ignore
import EmailReplyParser from 'email-reply-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role, server only
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const geminiClient =
  process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

const PM_EMAIL_FALLBACK = process.env.PM_EMAIL || 'pm.maple@janus.com';

async function getDynamicSmtp(buildingId?: number | null) {
  // 1) Attempt to fetch from Supabase (if table exists)
  try {
    const { data: settings } = await supabase
      .from('smtp_settings')
      .select('*')
      // Fetch either the specific building or the default system setting
      .or(buildingId ? `building_id.eq.${buildingId},is_default.eq.true` : 'is_default.eq.true')
      .order('building_id', { ascending: false }) // Specific building settings first
      .limit(1)
      .maybeSingle();

    if (settings) {
      return {
        transporter: nodemailer.createTransport({
          host: settings.host,
          port: settings.port,
          secure: settings.port === 465, // Usually SSL
          auth: {
            user: settings.username,
            pass: settings.password,
          },
        }),
        from: `"${settings.from_name || 'JANUS'}" <${settings.from_email || settings.username}>`,
      };
    }
  } catch (err) {
    // Gracefully fallback if table doesn't exist yet
  }

  // 2) Fallback to Environment Variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
      from: process.env.SMTP_FROM || `"${process.env.SMTP_USER}" <${process.env.SMTP_USER}>`,
    };
  }

  return null;
}

type EmailIntakeBody = {
  fromEmail: string;
  subject: string;
  bodyText: string;
};

// -------- Main route handler --------

export async function POST(req: Request) {
  try {
    const { fromEmail, subject, bodyText } =
      (await req.json()) as EmailIntakeBody;

    if (!fromEmail || !subject || !bodyText) {
      return NextResponse.json(
        { error: 'Missing fromEmail, subject, or bodyText' },
        { status: 400 }
      );
    }

    const res = await processEmail({ fromEmail, subject, bodyText });
    return NextResponse.json(res, { status: res.error ? 500 : 200 });
  } catch (err) {
    console.error('Error in /api/email-intake:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function processEmail(params: {
  fromEmail: string;
  subject: string;
  bodyText: string;
}) {
  let { fromEmail, subject, bodyText } = params;

  // Cleanup bodyText: Remove signatures and technical threads
  try {
    const parser = new EmailReplyParser();
    const email = parser.read(bodyText);
    // Get only the visible (new) fragments
    const visibleFragments = (email as any).fragments.filter((f: any) => !f.hidden && !f.signature);
    if (visibleFragments.length > 0) {
      bodyText = visibleFragments.map((f: any) => f.content).join('\n').trim();
    }
  } catch (err) {
    console.warn('Email cleaning failed, falling back to original text:', err);
  }

  try {
    // 1) Verify sender: Only process emails from known residents/users
    const resident = await fetchResidentByEmail(fromEmail);
    if (!resident) {
      console.warn(`[INGEST] Ignoring email from unknown sender: ${fromEmail}`);
      return {
        ok: true,
        createdTicket: false,
        reason: 'Sender not found in users table.',
      };
    }

    // 2) Call Gemini (or dev shortcut) to classify/triage
    const aiResult = await callGeminiTriage({ fromEmail, subject, bodyText });

    // 2) Off-topic: send polite decline + stop
    if (!aiResult.is_relevant) {
      await sendOffTopicEmail({ to: fromEmail, reason: aiResult.reason });
      return { ok: true, createdTicket: false };
    }

    // 3) If this looks like a reply to an existing ticket, append message only
    const ticketIdFromSubject = extractTicketIdFromSubject(subject);

    if (ticketIdFromSubject) {
      const { error } = await appendMessageToExistingTicket({
        ticket_id: ticketIdFromSubject,
        fromEmail,
        bodyText,
      });

      if (error) {
        console.error('Error appending message to existing ticket:', error);
        return { error: 'Failed to append message to ticket' };
      }

      return {
        ok: true,
        createdTicket: false,
        ticketId: ticketIdFromSubject,
      };
    }

    // 4) New ticket flow
    const result = aiResult; // is_relevant = true

    const { ticket_id, error: ticketError } = await createTicketFromTriage({
      fromEmail,
      subject,
      bodyText,
      triage: result,
    });

    if (ticketError || !ticket_id) {
      console.error('Error creating ticket:', ticketError);
      return { error: 'Failed to create ticket' };
    }

    // 5) Auto-assign vendor (by building + category)
    const { assignedVendorId } = await autoAssignVendor({
      ticket_id,
      type: result.type,
      repair_category: result.repair_category,
    });

    // 6) Send notifications (vendor, PM, resident)
    await sendNotifications({
      ticket_id,
      triage: result,
      fromEmail,
      assignedVendorId,
    });

    return {
      ok: true,
      createdTicket: true,
      ticketId: ticket_id,
    };
  } catch (err: any) {
    console.error('Error in processEmail:', err);
    return { error: err.message || 'Unknown error' };
  }
}

// ------- Gemini triage (with dev shortcut) --------

async function callGeminiTriage(input: {
  fromEmail: string;
  subject: string;
  bodyText: string;
}): Promise<GeminiTriageResult> {
  const { fromEmail, subject, bodyText } = input;

  // DEV MODE: simple fixed triage so tickets are always created
  if (process.env.NODE_ENV === 'development') {
    const fullText = (subject + ' ' + bodyText).toLowerCase();
    let category: RepairCategory = 'other';
    let urgency: TicketUrgency = 'medium';

    if (fullText.includes('air cond') || fullText.includes('ac') || fullText.includes('hvac') || fullText.includes('heating')) {
      category = 'hvac';
    } else if (fullText.includes('leak') || fullText.includes('plumb') || fullText.includes('water') || fullText.includes('toilet') || fullText.includes('sink')) {
      category = 'plumbing';
    } else if (fullText.includes('power') || fullText.includes('electr') || fullText.includes('light') || fullText.includes('outlet')) {
      category = 'electrical';
    }

    if (fullText.includes('flood') || fullText.includes('burst') || fullText.includes('fire') || fullText.includes('emergency') || fullText.includes('urgent')) {
      urgency = 'high';
    }

    return {
      is_relevant: true,
      reason: 'Dev mode: treating all emails as repair tickets with simple keyword triage.',
      type: 'repair',
      urgency,
      status: 'new',
      estimated_cost: 150,
      repair_category: category,
      resident_name: null,
      building_name: null,
      unit_number: null,
      summary: `${subject} — ${bodyText.slice(0, 200)}`,
    };
  }

  const prompt = `
${GEMINI_TRIAGE_PROMPT}

Email metadata:
From: ${fromEmail}
Subject: ${subject}

Email body:
"""
${bodyText}
"""
`.trim();

  if (!geminiClient) {
    console.warn(
      'GEMINI_API_KEY is not set; treating email as not relevant by default.'
    );
    return {
      is_relevant: false,
      reason:
        'Gemini is not configured on the server. Email triage is disabled.',
    };
  }

  try {
    const model = geminiClient.getGenerativeModel({
      model: 'gemini-1.5-pro',
    });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.response.text();
    const parsed = JSON.parse(text);

    return normalizeTriage(parsed);
  } catch (error) {
    console.error('Error calling Gemini triage:', error);
    return {
      is_relevant: false,
      reason:
        'Gemini triage failed due to an internal error. Treating as not relevant.',
    };
  }
}

function normalizeTriage(raw: any): GeminiTriageResult {
  if (typeof raw !== 'object' || raw === null || typeof raw.is_relevant !== 'boolean') {
    return {
      is_relevant: false,
      reason: 'AI output was malformed; treating as not relevant.',
    };
  }

  if (raw.is_relevant === false) {
    return {
      is_relevant: false,
      reason: String(raw.reason || 'Not relevant to JANUS services.'),
    };
  }

  const allowedTypes: TicketType[] = [
    'repair',
    'complaint',
    'condo_reject',
    'general_inquiries_or_redesign',
  ];
  const allowedUrgency: TicketUrgency[] = ['high', 'medium', 'low'];
  const allowedStatus: TicketStatus[] = [
    'new',
    'in-progress',
    'pending-approval',
    'completed',
  ];
  const allowedRepairCategory: Exclude<RepairCategory, null>[] = [
    'electrical',
    'plumbing',
    'hvac',
    'appliance',
    'structural',
    'pest',
    'other',
  ];

  const safeType: TicketType =
    allowedTypes.includes(raw.type) ? raw.type : 'repair';
  const safeUrgencyVal: TicketUrgency = allowedUrgency.includes(raw.urgency)
    ? raw.urgency
    : 'medium';
  const safeStatus: TicketStatus =
    allowedStatus.includes(raw.status) ? raw.status : 'new';

  let safeRepairCategory: RepairCategory = null;
  if (raw.repair_category && allowedRepairCategory.includes(raw.repair_category)) {
    safeRepairCategory = raw.repair_category;
  }

  let estimatedCost =
    typeof raw.estimated_cost === 'number' && isFinite(raw.estimated_cost)
      ? raw.estimated_cost
      : null;

  if (raw.is_relevant === true && estimatedCost == null) {
    estimatedCost = 150;
  }

  return {
    is_relevant: true,
    reason: String(raw.reason || ''),
    type: safeType,
    urgency: safeUrgencyVal,
    status: safeStatus,
    estimated_cost: estimatedCost,
    repair_category: safeRepairCategory,
    resident_name: raw.resident_name ? String(raw.resident_name) : null,
    building_name: raw.building_name ? String(raw.building_name) : null,
    unit_number: raw.unit_number ? String(raw.unit_number) : null,
    summary: String(raw.summary || ''),
  };
}

// ------- Helpers: resident, building, PM -------

async function fetchResidentByEmail(email: string) {
  const { data: resident, error } = await supabase
    .from('users')
    .select('id, name, building_id, suite_number')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error fetching resident by email:', error);
  }

  return resident as
    | {
      id: string;
      name: string | null;
      building_id: number | null;
      suite_number: string | null;
    }
    | null;
}

async function fetchBuilding(building_id: number | null) {
  if (!building_id) return null;

  const { data: building, error } = await supabase
    .from('buildings')
    .select('id, name, property_manager_email')
    .eq('id', building_id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching building by id:', error);
  }

  return building as
    | { id: number; name: string; property_manager_email: string | null }
    | null;
}

async function fetchPmEmailForBuilding(building_id: number | null) {
  if (!building_id) return PM_EMAIL_FALLBACK;

  const building = await fetchBuilding(building_id);
  return building?.property_manager_email || PM_EMAIL_FALLBACK;
}

// ------- Ticket + messages helpers --------

function extractTicketIdFromSubject(subject: string): string | null {
  const match = subject.match(/ticket-(\d{6,})/i);
  return match ? `ticket-${match[1]}` : null;
}

async function appendMessageToExistingTicket(params: {
  ticket_id: string;
  fromEmail: string;
  bodyText: string;
}) {
  const { ticket_id, fromEmail, bodyText } = params;

  const { data: userProfile } = await supabase
    .from('users')
    .select('name')
    .eq('email', fromEmail)
    .maybeSingle();

  const sender_name = userProfile?.name ?? fromEmail;

  const { error } = await supabase.from('ticket_messages').insert([
    {
      ticket_id,
      sender_email: fromEmail,
      sender_name,
      body: bodyText,
      is_internal: false,
      attachments: null,
    },
  ]);

  return { error };
}

async function createTicketFromTriage(params: {
  fromEmail: string;
  subject: string;
  bodyText: string;
  triage: Extract<GeminiTriageResult, { is_relevant: true }>;
}) {
  const { fromEmail, subject, bodyText, triage } = params;

  const resident = await fetchResidentByEmail(fromEmail);
  const buildingRecord = await fetchBuilding(resident?.building_id ?? null);

  const ticket_id = `ticket-${Date.now()}`;

  const estimated_cost =
    triage.estimated_cost != null && Number.isFinite(triage.estimated_cost)
      ? Math.max(triage.estimated_cost, 150)
      : 150;

  const ticketInsert = {
    ticket_id,
    type: triage.type,
    state: triage.status,
    urgency: triage.urgency,
    subject,
    damage_description: triage.summary || bodyText,

    resident_name: resident?.name || triage.resident_name || fromEmail,
    resident: resident?.name || triage.resident_name || fromEmail,
    sender_email: fromEmail,

    building_id: resident?.building_id ?? null,
    building:
      buildingRecord?.name ??
      (resident?.building_id ? null : triage.building_name ?? null),

    unit_number: resident?.suite_number ?? triage.unit_number ?? null,

    repair_category: formatRepairCategory(triage.repair_category),
    estimated_cost,
    conversation_history: null,
    attachments: null,
  };

  const { data: tickets, error: ticketError } = await supabase
    .from('tickets')
    .insert([ticketInsert])
    .select('ticket_id')
    .single();

  if (ticketError || !tickets) {
    return { ticket_id: null as string | null, error: ticketError };
  }

  const { error: msgError } = await supabase.from('ticket_messages').insert([
    {
      ticket_id: tickets.ticket_id,
      sender_email: fromEmail,
      sender_name: ticketInsert.resident_name || fromEmail,
      body: bodyText,
      is_internal: false,
      attachments: null,
    },
  ]);

  if (msgError) {
    console.error('Error inserting initial ticket message:', msgError);
  }

  return { ticket_id: tickets.ticket_id as string, error: null };
}

async function autoAssignVendor(params: {
  ticket_id: string;
  type: TicketType;
  repair_category: RepairCategory;
}) {
  const { ticket_id, type, repair_category } = params;

  // Only auto-assign for repair tickets with a category
  if (type !== 'repair' || !repair_category) {
    return { assignedVendorId: null as string | null };
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('building_id')
    .eq('ticket_id', ticket_id)
    .maybeSingle();

  if (ticketError) {
    console.error('Error fetching ticket for auto-assign:', ticketError);
    return { assignedVendorId: null };
  }

  const building_id = ticket?.building_id;
  if (!building_id) {
    console.warn('No building_id on ticket; skipping auto-assign vendor.');
    return { assignedVendorId: null };
  }

  const normalizedCategory = formatRepairCategory(repair_category);
  if (!normalizedCategory) return { assignedVendorId: null };

  // building_ids is a string like "1,2,3"; we do a simple contains match.
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('id, company_name, email, building_ids, category')
    .eq('category', normalizedCategory);

  if (error) {
    console.error('Error fetching vendors for auto-assign:', error);
    return { assignedVendorId: null };
  }

  const bidStr = String(building_id);
  const vendor = vendors?.find(v =>
    v.building_ids?.split(',').map((s: string) => s.trim()).includes(bidStr)
  );

  if (!vendor) {
    console.warn(
      `No vendor found for building_id=${building_id} and category=${normalizedCategory}`
    );
    return { assignedVendorId: null };
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({ assigned_vendor_id: vendor.id })
    .eq('ticket_id', ticket_id);

  if (updateError) {
    console.error('Error updating ticket with assigned vendor:', updateError);
  }

  await supabase.from('ticket_messages').insert([
    {
      ticket_id,
      sender_name: 'System',
      sender_email: 'system@janus',
      body: `System: Auto-assigned vendor ${vendor.id} (${vendor.company_name}) for building ${building_id} and category ${normalizedCategory}.`,
      is_internal: true,
      attachments: null,
    },
  ]);

  return { assignedVendorId: vendor.id as string };
}

// ------- Email notifications --------

async function sendOffTopicEmail(params: { to: string; reason: string }) {
  const { to, reason } = params;
  const smtp = await getDynamicSmtp();

  const subject = 'Your request to JANUS';
  const text = `Hi,

Thank you for contacting JANUS. Based on an automated review, your email appears to be outside the maintenance, complaints, or resident services that JANUS handles.

Reason: ${reason}

If you believe this is incorrect, please reply with more details.

Best regards,
JANUS Support`;

  if (!smtp?.transporter) {
    console.log(
      'SMTP is not configured; would have sent off-topic email:',
      JSON.stringify({ to, subject, text, from: smtp?.from }, null, 2)
    );
    return;
  }

  await smtp.transporter.sendMail({
    from: smtp.from,
    to,
    subject,
    text,
  });
}

async function sendNotifications(params: {
  ticket_id: string;
  triage: Extract<GeminiTriageResult, { is_relevant: true }>;
  fromEmail: string;
  assignedVendorId: string | null;
}) {
  const { ticket_id, triage, fromEmail, assignedVendorId } = params;

  const [{ data: ticket }, { data: vendor }] = await Promise.all([
    supabase
      .from('tickets')
      .select(
        'subject, building, unit_number, resident_name, resident, sender_email, building_id'
      )
      .eq('ticket_id', ticket_id)
      .maybeSingle(),
    assignedVendorId
      ? supabase
        .from('vendors')
        .select('company_name, email')
        .eq('id', assignedVendorId)
        .maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  let buildingName = ticket?.building ?? triage.building_name ?? null;
  if (!buildingName && ticket?.building_id) {
    const b = await fetchBuilding(ticket.building_id);
    if (b?.name) buildingName = b.name;
  }
  const finalBuilding = buildingName ?? 'Unknown building';

  const unit = ticket?.unit_number ?? triage.unit_number ?? 'Unknown unit';
  const residentName =
    ticket?.resident_name ??
    ticket?.resident ??
    triage.resident_name ??
    fromEmail;
  const subjectLine =
    ticket?.subject ?? `New JANUS Ticket ${ticket_id} — ${triage.type}`;

  const vendorName = vendor?.company_name ?? 'Vendor';
  const vendorEmail = vendor?.email ?? null;
  const pmEmail = await fetchPmEmailForBuilding(ticket?.building_id ?? null);

  const vendorBody = vendorEmail
    ? `Hi ${vendorName},

You have been assigned a new request from JANUS.

Resident: ${residentName} (${fromEmail})
Building: ${finalBuilding}
Unit: ${unit}

The resident emailed about:
${triage.summary || '(no summary available)'}

Ticket details:
- Ticket ID: ${ticket_id}
- Type: ${triage.type}
- Urgency: ${triage.urgency}
- Category: ${triage.repair_category ?? 'n/a'}
- Estimated cost (AI): ${triage.estimated_cost != null ? `₱${triage.estimated_cost}` : 'n/a'
    }

Please contact the resident and proceed with inspection/repair as appropriate.
You can log into the JANUS portal for full details and to update the ticket status.

Thanks,
JANUS`
    : null;

  const pmBody = `Hi PM,

A resident has emailed JANUS with a new request.

Resident: ${residentName} (${fromEmail})
Building: ${finalBuilding}
Unit: ${unit}

Their email was about:
${triage.summary || '(no summary available)'}

We have created Ticket ID: ${ticket_id}
Subject: ${subjectLine}

AI classification:
- Type: ${triage.type}
- Urgency: ${triage.urgency}
- Status: ${triage.status}
- Category: ${triage.repair_category ?? 'n/a'}
- Estimated cost: ${triage.estimated_cost != null ? `₱${triage.estimated_cost}` : 'n/a'
    }

${vendorEmail
      ? `The designated vendor (${vendorName} <${vendorEmail}>) has already been notified about this issue.`
      : 'No vendor has been notified yet; please assign a vendor in the JANUS dashboard.'
    }

You can review the full email content and update the ticket in the JANUS dashboard.

Best,
JANUS System`;

  const residentBody = `Hi ${residentName},

We’ve received your email and created a ticket in the JANUS system.

We understand that your request is about:
${triage.summary || subjectLine}

Ticket details:
- Ticket ID: ${ticket_id}
- Subject: ${subjectLine}
- Type: ${triage.type}
- Urgency: ${triage.urgency}
- Status: ${triage.status}

${assignedVendorId && vendorName
      ? `We have contacted our designated vendor (${vendorName}). They will follow up with you regarding scheduling.`
      : 'A property manager will review your request and follow up with you.'
    }

If any of the details above are incorrect, please reply to this email with additional information.

Best regards,
JANUS Support`;

  const smtp = await getDynamicSmtp(ticket?.building_id);

  if (!smtp?.transporter) {
    console.log(
      'SMTP is not configured; would have sent notifications:',
      JSON.stringify(
        {
          from: smtp?.from || 'FALLBACK',
          toVendor: vendorEmail
            ? {
              to: vendorEmail,
              subject: `Ticket ${ticket_id} - New request from JANUS`,
              body: vendorBody,
            }
            : null,
          toPM: {
            to: pmEmail,
            subject: `Ticket ${ticket_id} - New resident email`,
            body: pmBody,
          },
          toResident: {
            to: fromEmail,
            subject: `We received your request - Ticket ${ticket_id}`,
            body: residentBody,
          },
        },
        null,
        2
      )
    );
    return;
  }

  const sendOps: Promise<any>[] = [];

  if (vendorEmail && vendorBody) {
    sendOps.push(
      smtp.transporter.sendMail({
        from: smtp.from,
        to: vendorEmail,
        subject: `Ticket ${ticket_id} - New request from JANUS`,
        text: vendorBody,
      })
    );
  }

  sendOps.push(
    smtp.transporter.sendMail({
      from: smtp.from,
      to: pmEmail,
      subject: `Ticket ${ticket_id} - New resident email`,
      text: pmBody,
    })
  );

  sendOps.push(
    smtp.transporter.sendMail({
      from: smtp.from,
      to: fromEmail,
      subject: `We received your request - Ticket ${ticket_id}`,
      text: residentBody,
    })
  );

  await Promise.allSettled(sendOps);

  // Insert notification records into ticket_messages for visibility in history
  const historyEntries = [];

  if (vendorEmail && vendorBody) {
    historyEntries.push({
      ticket_id,
      sender_name: 'JANUS System',
      sender_email: 'system@janus',
      body: `[Email to Vendor: ${vendorEmail}]\n\n${vendorBody}`,
      is_internal: false, // Make visible in history
    });
  }

  historyEntries.push({
    ticket_id,
    sender_name: 'JANUS System',
    sender_email: 'system@janus',
    body: `[Email to PM: ${pmEmail}]\n\n${pmBody}`,
    is_internal: false,
  });

  historyEntries.push({
    ticket_id,
    sender_name: 'JANUS System',
    sender_email: 'system@janus',
    body: `[Email to Resident: ${fromEmail}]\n\n${residentBody}`,
    is_internal: false,
  });

  if (historyEntries.length > 0) {
    await supabase.from('ticket_messages').insert(historyEntries);
  }
}

/**
 * Normalizes lowercase RepairCategory to Title Case / DB format.
 * (e.g. 'hvac' -> 'HVAC', 'plumbing' -> 'Plumbing')
 */
function formatRepairCategory(category: RepairCategory): string | null {
  if (!category) return null;
  const cat = category.toLowerCase();
  switch (cat) {
    case 'hvac': return 'HVAC';
    case 'plumbing': return 'Plumbing';
    case 'electrical': return 'Electrical';
    case 'appliance': return 'Appliance';
    case 'structural': return 'Structural';
    case 'pest': return 'Pest';
    case 'other': return 'Other';
    default: return 'Other';
  }
}
