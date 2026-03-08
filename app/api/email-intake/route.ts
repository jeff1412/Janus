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

    const baseUrl = new URL(req.url).origin;
    const res = await processEmail({ fromEmail, subject, bodyText, baseUrl });
    return NextResponse.json(res, { status: res.error ? 500 : 200 });
  } catch (err) {
    console.error('Error in /api/email-intake:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
function cleanEmailBody(text: string): string {
  if (!text) return '';

  // 1) Use the EmailReplyParser
  const parsed = new EmailReplyParser().read(text);
  let visibleText = parsed.getVisibleText();

  // 2) Manual Fallback for common patterns the parser might miss
  // Many clients use "On [Date], [Name] <[Email]> wrote:"
  const replyMarkers = [
    /^On\s.*wrote:$/im,
    /^On\s.*wrote:\s*$/im,
    /^-+\s*Original Message\s*-+/im,
    /________________________________/m,
    /^From:\s.*$/im,
    /^Date:\s.*$/im,
    /^-+ Forwarded message -+/im,
    /Sent from my iPhone/i,
    /Sent from my Android/i
  ];

  const lines = visibleText.split('\n');
  let cutIndex = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (replyMarkers.some(marker => marker.test(line))) {
      cutIndex = i;
      break;
    }
  }

  const cleaned = lines.slice(0, cutIndex).join('\n').trim();

  // Final safeguard: if cleaning resulted in an empty string, fallback to original 
  // (to avoid the "blank message" issue again)
  return cleaned || visibleText.trim() || text.trim();
}

// Simple in-memory cache to prevent duplicate processing within the same server session
const processedMessageIds = new Set<string>();

export async function processEmail(params: {
  fromEmail: string;
  subject: string;
  bodyText: string;
  messageId?: string;
  baseUrl?: string;
}) {
  let { fromEmail, subject, bodyText, messageId, baseUrl: providedBaseUrl } = params;

  if (messageId && processedMessageIds.has(messageId)) {
    console.log(`[INGEST] Skipping duplicate messageId: ${messageId}`);
    return { ok: true, createdTicket: false, reason: 'Duplicate messageId' };
  }
  if (messageId) processedMessageIds.add(messageId);

  // We explicitly clean the bodyText to keep only the latest message portion
  bodyText = cleanEmailBody(bodyText);
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

  try {
    // 1) Verify sender (Resident, Vendor, or PM)
    const [user, vendor] = await Promise.all([
      fetchUserByEmail(fromEmail),
      fetchVendorByEmail(fromEmail)
    ]);

    const isPm = user?.role?.toLowerCase() === 'propertymanager';
    const isResident = user && !isPm;

    console.log(`[INGEST] Email from: ${fromEmail}`);
    console.log(`[INGEST] Sender detection: userRole=${user?.role}, isVendor=${!!vendor}`);

    if (!user && !vendor) {
      console.warn(`[INGEST] Ignoring email from unknown sender: ${fromEmail}`);
      return { ok: true, createdTicket: false, reason: 'Sender not found in users or vendors table.' };
    }

    // 2) Check for Explicit Ticket ID (Replying to thread)
    const ticketIdFromSubject = extractTicketIdFromSubject(subject);
    console.log(`[INGEST] extracted ticketIdFromSubject: ${ticketIdFromSubject}`);
    if (ticketIdFromSubject) {

      // Fetch ticket to pass as context for status updates
      console.log(`[INGEST] Fetching ticket: ${ticketIdFromSubject}`);
      const { data: currentTicket, error: fetchTicketErr } = await supabase
        .from('tickets')
        .select('ticket_id, type, subject, damage_description, state, estimated_cost')
        .eq('ticket_id', ticketIdFromSubject)
        .maybeSingle();

      if (fetchTicketErr) console.error(`[INGEST] Error fetching ticket ${ticketIdFromSubject}:`, fetchTicketErr);
      if (!currentTicket) console.warn(`[INGEST] Ticket ${ticketIdFromSubject} not found in DB!`);

      const { error } = await appendMessageToExistingTicket({
        ticket_id: ticketIdFromSubject,
        fromEmail,
        bodyText,
        senderName: user?.name || vendor?.company_name || fromEmail
      });

      if (!error) {
        // Call Gemini for status/cost updates even for explicit IDs
        const aiResult = await callGeminiTriage(
          { fromEmail, subject, bodyText, senderType: isPm ? 'pm' : vendor ? 'vendor' : 'resident' as any },
          currentTicket ? [currentTicket] : []
        );

        // Escalation for failed Self-Help
        if (aiResult.is_relevant && isResident && currentTicket?.type === 'self_help') {
          const lowerBody = bodyText.toLowerCase();
          const helpKeywords = ['cant', 'can\'t', 'cannot', 'elderly', 'help', 'professional', 'vendor', 'send someone', 'fix it for me', 'ruined', 'messed', 'difficult', 'too hard'];
          if (aiResult.is_self_help_failed || helpKeywords.some(k => lowerBody.includes(k))) {
            console.log(`[INGEST] Self-Help failed for ticket ${ticketIdFromSubject}. Escalating current ticket.`);
            return await escalateSelfHelpTicket({
              ticketId: ticketIdFromSubject,
              reason: 'Resident requested professional help or indicated self-help failed. Automatically escalating.',
              manualUpdateBody: `Update from resident: ${bodyText}`
            });
          }
        }


        // VENDOR SPECIFIC: Extract Price and Update Estimated Cost
        if (vendor) {
          const costCalculation = await extractCostFromMessage(bodyText);
          if (costCalculation !== null) {
            let finalCost = costCalculation.amount;
            if (costCalculation.isMaterialOnly) {
              const currentEstimate = (currentTicket?.estimated_cost != null && currentTicket.estimated_cost > 0)
                ? currentTicket.estimated_cost
                : 150;
              finalCost += currentEstimate;
            }

            console.log(`[INGEST] Extracted cost config from vendor reply. Final cost: $${finalCost}`);
            await supabase
              .from('tickets')
              .update({ estimated_cost: finalCost })
              .eq('ticket_id', ticketIdFromSubject);

            const costMsg = costCalculation.isMaterialOnly
              ? `System: Vendor mentioned a material cost of $${costCalculation.amount}. Added to previous estimate. New final cost: $${finalCost}.`
              : `System: Vendor mentioned a total/final cost of $${finalCost}. Estimated cost updated.`;

            // Deduplicate system cost msg
            const { data: existingSys } = await supabase
              .from('ticket_messages')
              .select('id')
              .eq('ticket_id', ticketIdFromSubject)
              .eq('sender_email', 'system@janus')
              .eq('body', costMsg)
              .gte('created_at', thirtySecondsAgo)
              .limit(1);

            if (!existingSys || existingSys.length === 0) {
              await supabase.from('ticket_messages').insert({
                ticket_id: ticketIdFromSubject,
                sender_name: 'System',
                sender_email: 'system@janus',
                body: costMsg,
                is_internal: true
              });
            }
          }
        }

        // Handle Lifecycle Status Updates (e.g., in-progress, completed)
        await handleFollowUpStatusUpdate(ticketIdFromSubject, aiResult, !!vendor);

        await sendFollowUpNotification({
          ticket_id: ticketIdFromSubject,
          fromEmail,
          bodyText,
          isVendor: !!vendor,
          isPm,
          senderName: user?.name || vendor?.company_name || fromEmail
        });
        return { ok: true, createdTicket: false, ticketId: ticketIdFromSubject, isFollowUp: true };
      }
    }

    // 3) Only Residents or PMs can create new tickets or trigger smart follow-up
    // Vendors must reply to existing ticket threads.
    if (!isResident && !isPm) {
      console.warn(`[INGEST] Ignoring non-resident/non-PM email with no ticket ID: role=${user?.role}, email=${fromEmail}`);
      return { ok: true, createdTicket: false, reason: 'Only residents or property managers can initiate new tickets or smart follow-ups.' };
    }

    // 4) Fetch open tickets for smart follow-up detection (Residents/PMs ONLY)
    // Residents see only their own, PMs see everything in their building
    let openTicketsQuery = supabase
      .from('tickets')
      .select('ticket_id, type, subject, damage_description, state, estimated_cost')
      .not('state', 'eq', 'completed')
      .not('state', 'eq', 'cancelled');

    if (isPm && user?.building_id) {
      openTicketsQuery = openTicketsQuery.eq('building_id', user.building_id);
    } else {
      openTicketsQuery = openTicketsQuery.eq('sender_email', fromEmail);
    }

    const { data: openTickets } = await openTicketsQuery;

    // 5) Call Gemini for Triage (Smart Follow-up Detection)
    const aiResult = await callGeminiTriage({ fromEmail, subject, bodyText, senderType: isPm ? 'pm' : 'resident' }, openTickets || []);

    if (!aiResult.is_relevant) {
      console.warn(`[INGEST] Irrelevant email: ${aiResult.reason}`);
      return { ok: true, createdTicket: false, reason: aiResult.reason };
    }

    // Safety Override: If it's an open self-help ticket and resident replies with failure/help keywords, force escalation
    if (aiResult.is_follow_up && aiResult.ticket_id && isResident) {
      const targetTicket = openTickets?.find(t => t.ticket_id === aiResult.ticket_id);
      if (targetTicket?.type === 'self_help') {
        const lowerBody = bodyText.toLowerCase();
        const failureKeywords = ['cant', 'can\'t', 'cannot', 'elderly', 'help', 'professional', 'vendor', 'send someone', 'fix it for me', 'ruined', 'messed', 'difficult'];
        if (failureKeywords.some(k => lowerBody.includes(k))) {
          console.log(`[INGEST] Safety Override: Forcing self-help escalation for ticket ${aiResult.ticket_id}`);
          aiResult.is_self_help_failed = true;
        }
      }
    }

    // 6) Handle Smart Follow-up (No ID in subject, but AI found match)
    if (aiResult.is_follow_up && aiResult.ticket_id) {
      console.log(`[INGEST] AI identified smart follow-up for ticket: ${aiResult.ticket_id}`);
      const { error } = await appendMessageToExistingTicket({
        ticket_id: aiResult.ticket_id,
        fromEmail,
        bodyText,
        senderName: user?.name || fromEmail
      });
      if (error) {
        console.error('Error appending message to existing ticket:', error);
        return { error: 'Failed to append message to ticket' };
      }

      if (aiResult.is_self_help_failed && isResident) {
        console.log(`[INGEST] Self-Help failed for ticket ${aiResult.ticket_id} (Smart Match). Escalating current ticket.`);
        return await escalateSelfHelpTicket({
          ticketId: aiResult.ticket_id,
          reason: 'Resident indicated self-help failed via smart follow-up email. Automatically escalating request to a designated vendor.',
          manualUpdateBody: `Update from resident (Smart Match): ${bodyText}`
        });
      }

      await handleFollowUpStatusUpdate(aiResult.ticket_id, aiResult);
      await sendFollowUpNotification({
        ticket_id: aiResult.ticket_id,
        fromEmail,
        bodyText,
        isVendor: false,
        isPm,
        senderName: user?.name || fromEmail
      });
      return { ok: true, createdTicket: false, ticketId: aiResult.ticket_id, isFollowUp: true };
    }

    // 7) Create New Ticket (Resident or PM ONLY)

    // ---- SELF-HELP BRANCH ----
    if (aiResult.is_relevant && (aiResult.is_self_help || aiResult.type === 'self_help') && isResident) {
      console.log(`[INGEST] Self-Help request detected. Creating self_help ticket.`);

      const { ticket_id: selfHelpTicketId, error: selfHelpError } = await createTicketFromTriage({
        fromEmail,
        subject,
        bodyText,
        triage: aiResult as any,
      });

      if (selfHelpError || !selfHelpTicketId) {
        console.error('Error creating self-help ticket:', selfHelpError);
        return { error: `Failed to create self-help ticket: ${selfHelpError?.message || 'Unknown error'}` };
      }

      // Auto-assign vendor on standby (they won't be emailed yet)
      const { assignedVendorId } = await autoAssignVendor({
        ticket_id: selfHelpTicketId,
        type: 'self_help',
        repair_category: aiResult.repair_category,
      });

      // Fetch vendor name for PM notification
      let standbyVendorName = 'a designated vendor';
      if (assignedVendorId) {
        const { data: vd } = await supabase.from('vendors').select('company_name').eq('id', assignedVendorId).maybeSingle();
        if (vd?.company_name) standbyVendorName = vd.company_name;
      }

      const residentName = user?.name || fromEmail;
      const baseUrl = providedBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const yesUrl = `${baseUrl}/api/self-help/action?ticket_id=${selfHelpTicketId}&action=yes`;
      const noUrl = `${baseUrl}/api/self-help/action?ticket_id=${selfHelpTicketId}&action=no`;

      // Fetch ticket details for a full summary
      const { data: ticket } = await supabase.from('tickets').select('building_id').eq('ticket_id', selfHelpTicketId).maybeSingle();
      const smtp = await getDynamicSmtp(ticket?.building_id);

      const selfHelpHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">Confirmation — <span style="color:#f5a623;">Self-Help</span></h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:20px;">Hi ${residentName},</h2>
          <p style="color:#555;line-height:1.6;">Thank you for reaching out to JANUS regarding: <strong>${aiResult.summary || subject}</strong>. We understand this can be a bit frustrating.</p>
          <p style="color:#555;line-height:1.6;">We would like to offer you a <strong style="color:#f5a623;">self-help</strong> option. If you're comfortable, we can guide you through a few steps to potentially resolve this issue on your own!</p>

          <h3 style="border-bottom:2px solid #f5a623;padding-bottom:8px;">What <span style="color:#f5a623;">Self-Help</span> Would Involve:</h3>
          <ul style="color:#555;line-height:2;">
            <li>Tools &amp; items will be listed in the instructions we send you.</li>
            <li>Step-by-step safety instructions will be included.</li>
          </ul>
          <p style="color:#555;line-height:1.6;">Of course, if you would prefer having a professional assist you, that option is still available. Opting for <strong style="color:#f5a623;">self-help</strong> will not affect your right to request professional help later if needed.</p>
          <p style="color:#555;line-height:1.6;">Let us know if you would like to try fixing it yourself, or if you prefer we send a maintenance professional.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
            <tr>
              <td align="center" style="padding-right:8px;">
                <a href="${noUrl}" style="display:inline-block;padding:14px 32px;background:#fff;color:#333;border:2px solid #ccc;border-radius:5px;font-size:15px;font-weight:bold;text-decoration:none;">Seek Professional</a>
              </td>
              <td align="center" style="padding-left:8px;">
                <a href="${yesUrl}" style="display:inline-block;padding:14px 32px;background:#f5a623;color:#fff;border-radius:5px;font-size:15px;font-weight:bold;text-decoration:none;">Confirm (Yes, I'll try!)</a>
              </td>
            </tr>
          </table>
          <p style="color:#999;font-size:12px;margin-top:24px;text-align:center;">Ticket ID: ${selfHelpTicketId}</p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;text-align:center;color:#aaa;font-size:12px;">
          Best regards, JANUS Maintenance System
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      // Send HTML email to resident
      if (smtp?.transporter) {
        await smtp.transporter.sendMail({
          from: smtp.from,
          to: fromEmail,
          subject: `Ticket ${selfHelpTicketId} - Confirmation: Self-Help Option Available`,
          html: selfHelpHtml,
          text: `Hi ${residentName},\n\nWe noticed your request may be something you can fix yourself.\nClick YES to get instructions: ${yesUrl}\nClick NO to have a vendor sent: ${noUrl}\n\nJANUS Support`,
        });
      }

      // Notify PM
      const pmEmail = await fetchPmEmailForBuilding(ticket?.building_id ?? null);
      const pmNotifyText = `Hi PM,\n\nA Self-Help offer was sent to resident ${residentName} (${fromEmail}) for their request: "${aiResult.summary || subject}".\n\nTicket ID: ${selfHelpTicketId}\nStandby Vendor: ${standbyVendorName}\n\nIf the resident declines, a new standard ticket will be created automatically.\n\nJANUS System`;

      if (smtp?.transporter) {
        await smtp.transporter.sendMail({
          from: smtp.from,
          to: pmEmail,
          subject: `Ticket ${selfHelpTicketId} - Self-Help Offer Sent to Resident`,
          text: pmNotifyText,
        });
      }

      // Save exact email content in ticket history
      await supabase.from('ticket_messages').insert([
        {
          ticket_id: selfHelpTicketId,
          sender_name: 'JANUS to Resident',
          sender_email: 'system@janus',
          body: `Subject: Ticket ${selfHelpTicketId} - Confirmation: Self-Help Option Available\n\nHi ${residentName},\n\nWe noticed your request may be something you can fix yourself.\n\nOption 1: Try Fixing it (Get instructions immediately)\nOption 2: Seek Professional help\n\nAwaiting your selection...`,
          is_internal: false,
        },
        {
          ticket_id: selfHelpTicketId,
          sender_name: 'JANUS to PM',
          sender_email: 'system@janus',
          body: pmNotifyText,
          is_internal: false,
        }
      ]);

      return { ok: true, createdTicket: true, ticketId: selfHelpTicketId, isSelfHelp: true };
    }
    // ---- END SELF-HELP BRANCH ----

    const { ticket_id: createdTicketId, error: ticketError } = await createTicketFromTriage({
      fromEmail,
      subject,
      bodyText,
      triage: aiResult as any,
    });

    if (ticketError || !createdTicketId) {
      console.error('Error creating ticket:', ticketError);
      return { error: 'Failed to create ticket' };
    }

    // 8) Auto-assign and notify Property Manager/Vendor
    const { assignedVendorId } = await autoAssignVendor({
      ticket_id: createdTicketId,
      type: aiResult.type || 'repair',
      repair_category: aiResult.repair_category,
    });

    await sendNotifications({
      ticket_id: createdTicketId,
      triage: aiResult as any,
      fromEmail,
      bodyText, // Pass the original content
      assignedVendorId,
    });

    return { ok: true, createdTicket: true, ticketId: createdTicketId };


  } catch (err: any) {
    console.error('Error in processEmail:', err);
    return { error: err.message || 'Unknown error' };
  }
}

async function handleFollowUpStatusUpdate(ticketId: string, aiResult: GeminiTriageResult, isVendor: boolean = false) {
  if (!aiResult.is_relevant) return;

  const { data: ticket } = await supabase
    .from('tickets')
    .select('state')
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (!ticket) return;

  let newStatus: TicketStatus | null = aiResult.status || null;

  // RULE: If vendor replies to a "new" ticket, it MUST move to "in-progress"
  if (isVendor && ticket.state === 'new') {
    newStatus = 'in-progress';
  }

  if (newStatus && ticket.state !== newStatus) {
    console.log(`[INGEST] Updating ticket ${ticketId} status: ${ticket.state} -> ${newStatus}`);
    await supabase
      .from('tickets')
      .update({ state: newStatus })
      .eq('ticket_id', ticketId);

    await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_name: 'JANUS System',
      sender_email: 'system@janus',
      body: `[STATUS UPDATE] Ticket marked as ${newStatus} based on ${isVendor ? 'Vendor' : 'Resident'} conversation.`,
      is_internal: true
    });
  }
}

// ------- Gemini triage (with dev shortcut) --------

async function callGeminiTriage(input: {
  fromEmail: string;
  subject: string;
  bodyText: string;
  senderType: 'resident' | 'vendor' | 'pm';
}, openTickets: any[] = []): Promise<GeminiTriageResult> {
  const { fromEmail, subject, bodyText, senderType } = input;

  // DEV MODE: simple fixed triage so tickets are always created (only if no API key is provided)
  if (process.env.NODE_ENV === 'development' && !process.env.GEMINI_API_KEY) {
    const fullText = (subject + ' ' + bodyText).toLowerCase();

    let urgency: TicketUrgency = 'medium';
    let ticketId = null;
    let isFollowUp = false;
    let status: TicketStatus | null = null;
    let category: RepairCategory = 'other'; // Consolidated category declaration

    // Category guessing (Mocked keyword matching for Dev Mode)
    if (fullText.includes('bulb') || fullText.includes('electr') || fullText.includes('light') || fullText.includes('power')) {
      category = 'electrical';
    } else if (fullText.includes('air cond') || fullText.includes('ac') || fullText.includes('hvac') || fullText.includes('cooling') || fullText.includes('heating')) {
      category = 'hvac';
    } else if (fullText.includes('leak') || fullText.includes('plumb') || fullText.includes('sink') || fullText.includes('water') || fullText.includes('toilet')) {
      category = 'plumbing';
    } else if (fullText.includes('outlet')) {
      category = 'electrical'; // Added for completeness
    }

    // Dev Mode Keyword for Self-Help Testing
    let typeResult: TicketType = 'repair';
    let is_self_help = false;
    const selfHelpKeywords = ['bulb', 'smoke detector', 'door handle', 'knob', 'battery', 'clog', 'plunger'];
    if (selfHelpKeywords.some(keyword => fullText.includes(keyword)) && !fullText.includes('wire') && !fullText.includes('leak')) {
      typeResult = 'self_help';
      is_self_help = true;
    }


    if (openTickets.length > 0) {
      const isStatusIntent = fullText.includes('follow up') || fullText.includes('update') || fullText.includes('status') || fullText.includes('accept') || fullText.includes('done');

      // Smart follow up: only match if it's the same category OR an explicit status intent
      const matchingTicket = openTickets.find(t =>
        (t.repair_category?.toLowerCase() === category && category !== 'other') ||
        isStatusIntent
      );

      if (matchingTicket) {
        ticketId = matchingTicket.ticket_id;
        isFollowUp = true;

        if (senderType === 'vendor' && (fullText.includes('accept') || fullText.includes('scheduled'))) {
          status = 'in-progress';
        } else if (senderType === 'resident' && (fullText.includes('done') || fullText.includes('fixed'))) {
          status = 'completed';
        }
      }
    }

    return {
      is_relevant: true,
      reason: 'Dev mode: simple keyword triage.',
      type: typeResult,
      urgency,
      status: status || 'new',
      estimated_cost: is_self_help ? 0 : 150,
      repair_category: category,
      resident_name: null,
      building_name: null,
      unit_number: null,
      summary: `${subject} — ${bodyText.slice(0, 200)}`,
      is_follow_up: isFollowUp,
      ticket_id: ticketId,
      is_self_help,
    };
  }

  const openTicketsContext = openTickets.length > 0
    ? `\n\nExisting Open Tickets for this resident/building:\n${openTickets.map(t => `- ID: ${t.ticket_id}, Type: ${t.type}, Subject: ${t.subject}, State: ${t.state}, Description: ${t.damage_description}`).join('\n')}`
    : '';

  const prompt = `
${GEMINI_TRIAGE_PROMPT}

Email metadata:
From: ${fromEmail}
Subject: ${subject}
Sender Role: ${senderType.toUpperCase()}
${openTicketsContext}

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
      model: 'gemini-1.5-flash',
    });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.response.text();

    // Clean up markdown formatting sometimes returned by Gemini
    const cleanedText = text.replace(/```json\n?/i, '').replace(/```\n?/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON output. Raw text:', text);
      throw parseError; // Caught below to trigger fallback
    }

    const triage = normalizeTriage(parsed);

    // Sanity check: If AI missed a very obvious self-help case
    if (triage.is_relevant && !triage.is_self_help && senderType === 'resident') {
      const fullText = (subject + ' ' + bodyText).toLowerCase();
      const isEscalation = fullText.includes('escalated') || fullText.includes('vendor') || fullText.includes('professional');
      const selfHelpKeywords = ['bulb', 'smoke detector', 'door handle', 'knob', 'battery', 'clog', 'plunger', 'replacement', 'fixture', 'maintenance'];
      if (selfHelpKeywords.some(kw => fullText.includes(kw)) && !fullText.includes('wire') && !fullText.includes('leak') && !fullText.includes('renov') && !isEscalation) {
        console.log(`[INGEST] AI missed self-help detection. Forcing via keywords.`);
        triage.is_self_help = true;
        triage.type = 'self_help';
        triage.estimated_cost = 0;
      }
    }

    return triage;
  } catch (error: any) {
    console.error('CRITICAL: Gemini triage API failed. Falling back to keyword matching. Error:', error?.message || error);

    // Fallback logic so the system doesn't send an "off-topic" email just because AI failed
    const fullText = (subject + ' ' + bodyText).toLowerCase();
    let isFollowUp = false;
    let ticketId = null;
    let fallbackStatus: TicketStatus | null = null;

    // Very permissive fallback logic so residents don't get punished by API failures
    const isReplyIntent = fullText.includes('follow') || fullText.includes('update') || fullText.includes('status') ||
      fullText.includes('accept') || fullText.includes('done') || fullText.includes('fix') ||
      fullText.includes('thank') || fullText.includes('when') || fullText.includes('hello');

    // If we strongly suspect it's a follow up (intent keywords) OR if it's an extremely short confirmation (like "ok", "thanks")
    if (openTickets && openTickets.length > 0 && (isReplyIntent || fullText.length < 15)) {
      ticketId = openTickets[0].ticket_id;
      isFollowUp = true;

      if (senderType === 'vendor' && (fullText.includes('accept') || fullText.includes('scheduled'))) {
        fallbackStatus = 'in-progress';
      } else if (senderType === 'resident' && (fullText.includes('done') || fullText.includes('fixed'))) {
        fallbackStatus = 'completed';
      }
    }

    const fallbackCategory = detectCategoryFromKeywords(fullText);

    // Fallback Self-Help Detection
    const selfHelpKeywords = ['bulb', 'smoke detector', 'door handle', 'knob', 'battery', 'clog', 'plunger'];
    const isEscalation = fullText.includes('escalated') || fullText.includes('vendor') || fullText.includes('professional');
    const isSelfHelpFallback = selfHelpKeywords.some(kw => fullText.includes(kw)) &&
      !fullText.includes('wire') &&
      !fullText.includes('leak') &&
      !isEscalation;

    return {
      is_relevant: true,
      reason: 'AI Unavailable - Fallback successful',
      type: isSelfHelpFallback ? 'self_help' : 'repair',
      urgency: 'medium',
      status: fallbackStatus || 'new',
      estimated_cost: isSelfHelpFallback ? 0 : 150,
      repair_category: fallbackCategory,
      resident_name: null,
      building_name: null,
      unit_number: null,
      summary: subject ? subject.slice(0, 100) : 'New Ticket via Fallback',
      is_follow_up: isFollowUp,
      ticket_id: ticketId,
      is_self_help: isSelfHelpFallback,
      is_self_help_failed: false,
    };
  }
}

/**
 * Helper to detect category from text when AI is unavailable
 */
function detectCategoryFromKeywords(text: string): RepairCategory {
  const t = text.toLowerCase();
  if (t.includes('bulb') || t.includes('electr') || t.includes('light') || t.includes('power') || t.includes('outlet') || t.includes('faulty') || t.includes('wire') || t.includes('smoke detector') || t.includes('battery')) return 'electrical';
  if (t.includes('leak') || t.includes('plumb') || t.includes('sink') || t.includes('water') || t.includes('faucet') || t.includes('clog') || t.includes('pipe') || t.includes('shower') || t.includes('drain') || t.includes('plunger')) return 'plumbing';
  if (t.includes('air cond') || t.includes('ac') || t.includes('hvac') || t.includes('cooling') || t.includes('freezer') || t.includes('cold air') || t.includes('refriger')) return 'hvac';
  if (t.includes('renov') || t.includes('furnit') || t.includes('construct')) return 'construction';
  if (t.includes('wall') || t.includes('floor')) return 'structural';
  return 'other';
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
    'self_help',
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
    'construction',
    'pest',
    'other',
  ];

  const safeType: TicketType | null =
    allowedTypes.includes(raw.type) ? raw.type : null;
  const safeUrgencyVal: TicketUrgency | null = allowedUrgency.includes(raw.urgency)
    ? raw.urgency
    : null;
  let safeStatus: TicketStatus | null =
    allowedStatus.includes(raw.status) ? raw.status : null;

  let safeRepairCategory: RepairCategory = null;
  if (raw.repair_category) {
    const rawCat = String(raw.repair_category).toLowerCase() as any;
    if (allowedRepairCategory.includes(rawCat)) {
      safeRepairCategory = rawCat;
    }
  }

  let estimatedCost =
    typeof raw.estimated_cost === 'number' && isFinite(raw.estimated_cost)
      ? raw.estimated_cost
      : null;

  // Enforce construction rules
  if (safeRepairCategory === 'construction') {
    safeStatus = 'pending-approval';
    estimatedCost = null;
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
    is_follow_up: !!raw.is_follow_up,
    ticket_id: raw.ticket_id ? String(raw.ticket_id) : null,
    is_self_help: !!raw.is_self_help,
    is_self_help_failed: !!raw.is_self_help_failed,
  };
}

// ------- Helpers: resident, building, PM -------


async function fetchUserByEmail(email: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, building_id, suite_number, role')
    .ilike('email', email.trim())
    .maybeSingle();

  if (error) {
    console.error('Error fetching user by email:', error);
  }

  return user as
    | {
      id: string;
      name: string | null;
      building_id: number | null;
      suite_number: string | null;
      role: string | null;
    }
    | null;
}

async function fetchVendorByEmail(email: string) {
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('id, company_name, email')
    .ilike('email', email.trim())
    .limit(1);

  if (error) {
    console.error('Error fetching vendor by email:', error);
    return null;
  }

  const vendor = vendors && vendors.length > 0 ? vendors[0] : null;
  console.log(`[INGEST] fetchVendorByEmail("${email}") => ${vendor ? vendor.company_name : 'not found'}`);

  return vendor as
    | {
      id: string;
      company_name: string;
      email: string;
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
  senderName?: string;
}) {
  const { ticket_id, fromEmail, bodyText, senderName } = params;

  let finalSenderName = senderName;
  if (!finalSenderName) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('email', fromEmail)
      .maybeSingle();

    finalSenderName = userProfile?.name ?? fromEmail;
  }

  // Check for duplicate message in the last 30 seconds
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('ticket_messages')
    .select('id')
    .eq('ticket_id', ticket_id)
    .eq('sender_email', fromEmail)
    .eq('body', bodyText)
    .gte('created_at', thirtySecondsAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[INGEST] Duplicate message detected in DB for ticket ${ticket_id}. Skipping insert.`);
    return { error: null }; // Return success so parent keeps moving, but silent skip
  }

  const { error } = await supabase.from('ticket_messages').insert([
    {
      ticket_id,
      sender_email: fromEmail,
      sender_name: finalSenderName,
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

  const resident = await fetchUserByEmail(fromEmail);
  const buildingRecord = await fetchBuilding(resident?.building_id ?? null);

  const ticket_id = `ticket-${Date.now()}`;

  let estimated_cost: number | null =
    triage.estimated_cost != null && Number.isFinite(triage.estimated_cost)
      ? (triage.type === 'self_help' ? triage.estimated_cost : Math.max(triage.estimated_cost, 150))
      : (triage.type === 'self_help' ? 0 : 150);

  let state = triage.status || 'new';

  if (triage.repair_category === 'construction') {
    estimated_cost = null; // Enforce no cost for construction
    state = 'pending-approval'; // Enforce pending approval
  }

  const ticketInsert = {
    ticket_id,
    type: triage.type || 'repair',
    state,
    urgency: triage.urgency || 'medium',
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
    // FALLBACK: If the database doesn't support the 'self_help' type yet
    if (ticketInsert.type === 'self_help' && ticketError?.message?.includes('violates check constraint')) {
      console.warn('[INGEST] DB does not support "self_help" type. Falling back to "repair" type with prefix.');
      const fallbackInsert = {
        ...ticketInsert,
        type: 'repair' as TicketType,
        subject: `[SELF-HELP] ${subject}`
      };
      const { data: retryTickets, error: retryError } = await supabase
        .from('tickets')
        .insert([fallbackInsert])
        .select('ticket_id')
        .single();

      if (retryError || !retryTickets) {
        return { ticket_id: null as string | null, error: retryError || new Error('Fallback failed') };
      }
      return { ticket_id: retryTickets.ticket_id as string, error: null };
    }

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

  // Only auto-assign for repair or self-help tickets with a category
  if ((type !== 'repair' && type !== 'self_help') || !repair_category) {
    return { assignedVendorId: null as string | null };
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('building_id, subject, damage_description')
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
  const bidStr = String(building_id);

  // 1. Try to find vendor by specific category first
  let vendor = null;
  if (normalizedCategory && normalizedCategory !== 'Other') {
    const { data: catVendors } = await supabase
      .from('vendors')
      .select('id, company_name, email, building_ids, category')
      .eq('category', normalizedCategory);

    vendor = catVendors?.find(v =>
      v.building_ids?.split(',').map((s: string) => s.trim()).includes(bidStr)
    );
  }

  // 2. Fallback: If no vendor found for category (or category is Other), pick BEST match from all building vendors
  if (!vendor) {
    console.log(`[ASSIGN] Category match failed for ${normalizedCategory}. Asking AI to pick best from building ${building_id}...`);
    const { data: allBuildingVendors } = await supabase
      .from('vendors')
      .select('id, company_name, email, building_ids, category');

    const buildingVendors = allBuildingVendors?.filter(v =>
      v.building_ids?.split(',').map((s: string) => s.trim()).includes(bidStr)
    ) || [];

    if (buildingVendors.length > 0) {
      const ticketContext = `${ticket.subject}: ${ticket.damage_description}`;
      vendor = await pickBestVendorWithAI(ticketContext, buildingVendors);
    }
  }

  if (!vendor) {
    console.warn(`[ASSIGN] No vendors at all found for building_id=${building_id}`);
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
      body: `System: Auto-assigned vendor ${vendor.id} (${vendor.company_name}) for building ${building_id}. (Category: ${normalizedCategory || 'Uncategorized'})`,
      is_internal: true,
      attachments: null,
    },
  ]);

  return { assignedVendorId: vendor.id as string };
}

async function pickBestVendorWithAI(ticketDesc: string, vendors: any[]): Promise<any> {
  if (!vendors || vendors.length === 0) return null;
  if (vendors.length === 1) return vendors[0];

  const vendorList = vendors.map(v => `- ID ${v.id}: ${v.company_name} (Category: ${v.category})`).join('\n');

  const prompt = `
    You are a maintenance dispatcher for JANUS.
    A resident reported this issue: "${ticketDesc}"
    
    GUIDELINES:
    - Electrical/changing bulbs -> Bright Spark Electrical
    - Plumbing/leaks/clogs -> QuickFix Plumbing
    - AC/Freezer/Cool air -> CoolAir HVAC
    - Renovation/Furniture -> BuildRight Contractors
    
    We have these available vendors for this building:
    ${vendorList}
    
    Which vendor is the best fit for this job? Respond ONLY with the ID of the best vendor.
  `.trim();

  if (!geminiClient) {
    const fallbackCat = detectCategoryFromKeywords(ticketDesc);
    const categoricalMatch = vendors.find(v => v.category?.toLowerCase() === fallbackCat?.toLowerCase());
    return categoricalMatch || vendors[0];
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const bestIdMatch = text.match(/\d+/);
    if (bestIdMatch) {
      const bestId = parseInt(bestIdMatch[0]);
      return vendors.find(v => v.id === bestId) || vendors[0];
    }
    return vendors[0];
  } catch (err) {
    console.error('[AI] pickBestVendorWithAI failed:', err);
    return vendors[0];
  }
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
  bodyText: string;
  assignedVendorId: string | null;
}) {
  const { ticket_id, triage, fromEmail, bodyText, assignedVendorId } = params;
  const historyEntries: any[] = [];

  const [{ data: ticket }, { data: vendor }] = await Promise.all([
    supabase
      .from('tickets')
      .select(
        'type, subject, building, unit_number, resident_name, resident, sender_email, building_id'
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

  let vendorBody: string | null = vendorEmail
    ? `Hi ${vendorName},

You have been assigned a new request from JANUS.

Resident: ${residentName} (${fromEmail})
Building: ${finalBuilding}
Unit: ${unit}

The resident emailed about:
"""
${bodyText}
"""

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

  let pmBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: white;">
      <div style="padding: 24px;">
        <h2 style="color: #333; margin-top: 0;">Hi PM,</h2>
        <p style="color: #555; line-height: 1.5;">Handled a new maintenance request from <strong>${residentName}</strong>.</p>
        
        <div style="background: #f9f9f9; padding: 16px; border-radius: 4px; margin: 20px 0; border: 1px solid #eee;">
          <p style="margin: 0; font-size: 14px; color: #444;"><strong>Ticket ID:</strong> ${ticket_id}</p>
          <p style="margin: 4px 0; font-size: 14px; color: #444;"><strong>Subject:</strong> ${subjectLine}</p>
          <p style="margin: 4px 0; font-size: 14px; color: #444;"><strong>Building/Unit:</strong> ${finalBuilding} / ${unit}</p>
        </div>

        <div style="border-left: 4px solid #2196F3; padding-left: 16px; margin: 20px 0;">
          <p style="color: #666; font-size: 14px; margin-bottom: 8px;">Resident Message:</p>
          <p style="font-style: italic; color: #333; margin: 0;">"${bodyText}"</p>
        </div>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #555;">
          ${vendorEmail
      ? `<span style="color: #4CAF50;">●</span> The designated vendor <strong>${vendorName}</strong> has been notified.`
      : `<span style="color: #f44336;">●</span> <strong>No vendor assigned yet.</strong> Please review and assign one in the dashboard.`
    }
        </div>

        <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">— Generated by JANUS Intelligence</p>
      </div>
    </div>
  `.trim();

  let residentBody = `Hi ${residentName},

We’ve received your email and created a ticket in the JANUS system. We have already informed the Property Manager of your request.

We understand that your request is about:
${triage.summary || subjectLine}

Ticket details:
- Ticket ID: ${ticket_id}
- Subject: ${subjectLine}
- Type: ${triage.type}
- Urgency: ${triage.urgency}
- Status: ${triage.status}

${assignedVendorId && vendorName
      ? `We have already contacted and informed our designated vendor (${vendorName}). They will follow up with you regarding scheduling.`
      : 'A property manager will review your request and follow up with you.'
    }

If any of the details above are incorrect, please reply to this email with additional information.

Best regards,
JANUS Support`;

  historyEntries.push({
    ticket_id,
    sender_name: 'JANUS to PM',
    sender_email: 'system@janus',
    body: pmBody,
    is_internal: false,
  });

  historyEntries.push({
    ticket_id,
    sender_name: 'JANUS to Resident',
    sender_email: 'system@janus',
    body: residentBody,
    is_internal: false,
  });

  if (vendorEmail && vendorBody) {
    historyEntries.push({
      ticket_id,
      sender_name: 'JANUS to Vendor',
      sender_email: 'system@janus',
      body: vendorBody,
      is_internal: false,
    });
  }

  // Self-Help specific overrides (Apply ONLY if the ticket is currently a self_help ticket)
  if (triage.type === 'self_help' && ticket?.type === 'self_help') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // We explicitly do NOT notify the vendor yet for a NEW Self-Help offer.
    vendorBody = null;

    // STYLED PM NOTIFICATION
    pmBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="padding: 24px;">
          <h2 style="color: #333; margin-top: 0;">Hi PM,</h2>
          <p style="color: #555; line-height: 1.5;">A resident has sent a request identified as <strong>Self-Help</strong>.</p>
          <div style="background: #f9f9f9; padding: 16px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #777;"><strong>Resident:</strong> ${residentName} (${fromEmail})</p>
            <p style="margin: 4px 0; font-size: 14px; color: #777;"><strong>Building:</strong> ${finalBuilding || 'N/A'}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #777;"><strong>Ticket ID:</strong> ${ticket_id}</p>
          </div>
          <div style="border-left: 4px solid #ff9800; padding-left: 16px; margin: 20px 0;">
            <p style="font-style: italic; color: #555; margin: 0;">"${bodyText}"</p>
          </div>
          <p style="color: #555; font-size: 14px;">The resident has been offered a DIY guide. If they decline or fail, you will be notified and a vendor will be dispatched.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #999;">— JANUS System</p>
        </div>
      </div>
    `.trim();

    // Reset history for self-help specific entries
    historyEntries.length = 0;
    historyEntries.push({
      ticket_id,
      sender_name: 'JANUS to PM',
      sender_email: 'system@janus',
      body: `[Self-Help Offer Notification]\n\nResident ${residentName} was offered a DIY guide for their request: "${bodyText}"`,
      is_internal: false,
    });
    historyEntries.push({
      ticket_id,
      sender_name: 'JANUS to Resident',
      sender_email: 'system@janus',
      body: residentBody, // Styled HTML
      is_internal: false,
    });

    // STYLED RESIDENT NOTIFICATION (MATCHING SCREENSHOT)
    residentBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: white;">
        <div style="padding: 30px; text-align: left;">
          <h2 style="color: #333; margin-top: 0;">Hi ${residentName},</h2>
          <p style="color: #555; line-height: 1.6;">Thank you for reaching out to JANUS regarding: <strong>${subjectLine}</strong>. We understand this can be a bit frustrating.</p>
          <p style="color: #555; line-height: 1.6;">We would like to offer you a <span style="color: #ff9800; font-weight: bold;">self-help</span> option. If you're comfortable, we can guide you through a few steps to potentially resolve this issue on your own!</p>
          
          <h3 style="color: #333; border-bottom: 2px solid #ff9800; padding-bottom: 8px; margin-top: 30px;">What <span style="color: #ff9800;">Self-Help</span> Would Involve:</h3>
          <ul style="color: #555; line-height: 1.6; padding-left: 20px;">
            <li>Tools & items will be listed in the instructions we send you.</li>
            <li>Step-by-step safety instructions will be included.</li>
          </ul>
          
          <p style="color: #555; font-size: 14px; margin-top: 20px;">Of course, if you would prefer having a professional assist you, that option is still available. Opting for <strong>self-help</strong> will not affect your right to request professional help later if needed.</p>
          <p style="color: #555; font-size: 14px;">Let us know if you would like to try fixing it yourself, or if you prefer we send a maintenance professional.</p>

          <div style="margin-top: 40px; display: flex; gap: 20px; justify-content: center; text-align: center;">
            <a href="${baseUrl}/api/self-help/action?ticket_id=${ticket_id}&action=no" 
               style="flex: 1; padding: 14px 24px; border: 1px solid #d0d0d0; border-radius: 6px; color: #333; text-decoration: none; font-weight: bold; background: white; display: inline-block; min-width: 150px;">
               Seek Professional
            </a>
            <a href="${baseUrl}/api/self-help/action?ticket_id=${ticket_id}&action=yes" 
               style="flex: 1; padding: 14px 24px; border: 1px solid #ff9800; border-radius: 6px; color: white; text-decoration: none; font-weight: bold; background: #ff9800; display: inline-block; min-width: 150px;">
               Confirm (Yes, I'll try!)
            </a>
          </div>

          <p style="margin-top: 50px; text-align: center; font-size: 11px; color: #bbb;">Ticket ID: ${ticket_id}</p>
        </div>
      </div>
    `.trim();
  }

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
      subject: (triage.type === 'self_help' && ticket?.type === 'self_help')
        ? `[Self-Help Offer] Ticket ${ticket_id} - ${subjectLine}`
        : `Ticket ${ticket_id} - New resident request: ${subjectLine}`,
      html: pmBody,
    })
  );

  sendOps.push(
    smtp.transporter.sendMail({
      from: smtp.from,
      to: fromEmail,
      subject: `We received your request - Ticket ${ticket_id}`,
      html: residentBody,
    })
  );

  await Promise.allSettled(sendOps);

  if (historyEntries.length > 0) {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    for (const entry of historyEntries) {
      // Check for duplicate to prevent noise
      const { data: existingNotif } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('ticket_id', ticket_id)
        .eq('body', entry.body)
        .gte('created_at', thirtySecondsAgo)
        .limit(1);

      if (!existingNotif || existingNotif.length === 0) {
        const { error: historyErr } = await supabase.from('ticket_messages').insert(entry);
        if (historyErr) {
          console.error(`[NOTIFY] Error logging email history for ticket ${ticket_id}:`, historyErr);
        }
      } else {
        console.log(`[NOTIFY] Skipping duplicate history entry for ticket ${ticket_id}`);
      }
    }
  }
}

async function fetchOpenTicketsForResident(senderEmail: string) {
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('ticket_id, subject, damage_description, created_at, state')
    .eq('sender_email', senderEmail)
    .neq('state', 'completed')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching open tickets:', error);
    return [];
  }

  return tickets || [];
}

/**
 * Escalates a self-help ticket to a normal repair ticket.
 * Updates the existing ticket instead of creating a new one.
 */
export async function escalateSelfHelpTicket(params: {
  ticketId: string;
  reason?: string;
  manualUpdateBody?: string;
}) {
  const { ticketId, reason, manualUpdateBody } = params;

  console.log(`[ESCALATE] Escalating self-help ticket ${ticketId}. Reason: ${reason || 'User choice'}`);

  // 1. Fetch ticket and assigned vendor
  const { data: ticket, error: fetchErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (fetchErr || !ticket) {
    console.error(`[ESCALATE] Could not find ticket ${ticketId}`, fetchErr);
    return { ok: false, error: 'Ticket not found' };
  }

  // 2. Update ticket to normal repair
  const cleanSubject = (ticket.subject || 'Maintenance').replace(/ticket-\d+/gi, '').replace(/^Re:\s*/i, '').trim();
  const newSubject = `Escalated Repair: ${cleanSubject}`;

  const { error: updateErr } = await supabase
    .from('tickets')
    .update({
      type: 'repair',
      state: 'new',
      subject: newSubject,
      estimated_cost: 150 // Reset to basic labor cost on escalation
    })
    .eq('ticket_id', ticketId);

  if (updateErr) {
    console.error(`[ESCALATE] Error updating ticket ${ticketId}:`, updateErr);
    return { ok: false, error: 'Failed to update ticket' };
  }

  // 3. Log escalation message in history
  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    sender_name: 'JANUS System',
    sender_email: 'system@janus',
    body: reason || 'Resident indicated self-help failed or declined. Automatically escalating request to a designated vendor.',
    is_internal: false
  });

  // 4. Trigger standard notifications
  // Mock a triage result to reuse sendNotifications
  const triage: any = {
    is_relevant: true,
    type: 'repair',
    urgency: 'medium',
    status: 'new',
    repair_category: ticket.repair_category,
    summary: ticket.damage_description,
    is_follow_up: false,
    is_self_help: false,
    estimated_cost: 150
  };

  await sendNotifications({
    ticket_id: ticketId,
    triage: triage,
    fromEmail: ticket.sender_email,
    bodyText: manualUpdateBody || ticket.damage_description,
    assignedVendorId: ticket.assigned_vendor_id
  });

  return { ok: true, createdTicket: false, ticketId: ticketId, isFollowUp: true };
}

async function extractCostFromMessage(message: string): Promise<{ amount: number; isMaterialOnly: boolean } | null> {
  if (!geminiClient) return null;

  const prompt = `
Analyze the following vendor email message and extract any mentioned costs.

RULES:
1. Determine if the cost mentioned is ONLY for materials ("faucet cost $200", "materials are $50"), or if it is a total/final cost that includes labor/everything ("total is $500", "labor and materials are $300").
2. If the email explicitly breaks down both material AND labor costs, add them together to return the TOTAL cost, and mark it as NOT material only.
3. If no price or cost is mentioned, return exactly 'null'.
4. If a price is found, return strict JSON in this format:
{
  "amount": 200,
  "isMaterialOnly": true // true if they ONLY mentioned material costs, false if they mentioned total or labor + material
}

Message:
"""
${message}
"""
`.trim();

  try {
    const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    // Check if the response was a literal 'null' from the prompt instruction
    const text = response.response.text().trim();
    if (text.toLowerCase() === 'null') return null;

    // Remove markdown formatting if Gemini included it
    const cleanedText = text.replace(/```json\n?/i, '').replace(/```\n?/i, '').trim();

    const parsed = JSON.parse(cleanedText);
    if (typeof parsed.amount === 'number' && !isNaN(parsed.amount)) {
      return {
        amount: parsed.amount,
        isMaterialOnly: !!parsed.isMaterialOnly
      };
    }
    return null;
  } catch (err) {
    console.error('Error extracting cost with Gemini:', err);
    return null;
  }
}

async function sendFollowUpNotification(params: {
  ticket_id: string;
  fromEmail: string;
  bodyText: string;
  isVendor?: boolean;
  isPm?: boolean;
  senderName?: string;
}) {
  const { ticket_id, fromEmail, bodyText, isVendor, isPm, senderName } = params;

  // 1) Fetch ticket info
  const { data: ticket } = await supabase
    .from('tickets')
    .select('subject, building_id, assigned_vendor_id, sender_email')
    .eq('ticket_id', ticket_id)
    .maybeSingle();

  if (!ticket) return;

  const pmEmail = await fetchPmEmailForBuilding(ticket.building_id);
  const displayName = senderName || fromEmail;

  // 2) Prepare notification content
  const subject = `Follow-up received: Ticket ${ticket_id} - ${ticket.subject}`;
  const senderType = isPm ? 'Property Manager' : isVendor ? 'Vendor' : 'Resident';

  const notificationText = `Hello, this is JANUS. A new follow-up message has been received from ${senderType} ${displayName} regarding Ticket ${ticket_id}.

Message Content:
"""
${bodyText}
"""

You can review the full thread and respond via the JANUS dashboard.`;

  const pmNotifyHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: white;">
      <div style="padding: 24px;">
        <h2 style="color: #333; margin-top: 0;">Hi PM,</h2>
        <p style="color: #555; line-height: 1.5;">New update received for <strong>Ticket ${ticket_id}</strong> (${ticket.subject}).</p>
        
        <div style="border-left: 4px solid #ff9800; padding-left: 16px; margin: 20px 0; background: #fffcf5; padding-top: 8px; padding-bottom: 8px;">
          <p style="color: #856404; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">From ${senderType}:</p>
          <p style="font-style: italic; color: #333; margin: 0;">"${bodyText}"</p>
        </div>

        <p style="color: #777; font-size: 13px;">The assigned vendor and resident have been updated where applicable.</p>
        <p style="margin-top: 30px; font-size: 11px; color: #bbb; text-align: center;">— JANUS Status Update</p>
      </div>
    </div>
  `.trim();

  const smtp = await getDynamicSmtp(ticket.building_id);
  if (!smtp?.transporter) {
    console.log('SMTP not configured for follow-up notification');
    return;
  }

  const emailsToSend: { to: string; subject: string; text: string; html?: string }[] = [];
  const historyEntries = [];

  // Prepare PM Notification
  emailsToSend.push({ to: pmEmail, subject, html: pmNotifyHtml, text: notificationText });
  historyEntries.push({
    ticket_id,
    sender_name: 'JANUS to PM',
    sender_email: 'system@janus',
    body: `[Follow-up Notification to PM]\n\nFrom ${senderType}: "${bodyText}"`,
    is_internal: false,
  });

  // Notifications for Resident Response
  if (!isVendor) {
    if (ticket.assigned_vendor_id) {
      const { data: vendor } = await supabase.from('vendors').select('company_name, email').eq('id', ticket.assigned_vendor_id).maybeSingle();
      if (vendor?.email) {
        emailsToSend.push({ to: vendor.email, subject, text: `Hi ${vendor.company_name || 'Vendor'},\n\nUpdate for Ticket ${ticket_id}: ${displayName} (${fromEmail}) has sent a message:\n\n"${bodyText}"\n\nPlease check the JANUS portal for details.` });
        historyEntries.push({
          ticket_id,
          sender_name: 'JANUS to Vendor',
          sender_email: 'system@janus',
          body: `[Follow-up Notification to Vendor]\n\nResident Update: "${bodyText}"`,
          is_internal: false,
        });
      }
    }
    const residentAckText = `Hi ${displayName},\n\nWe have received your recent message regarding Ticket ${ticket_id} (${ticket.subject}).\n\nYour message has been securely added to your ticket thread. The Property Manager and your assigned Vendor (if any) have been notified and will review your message shortly.\n\nBest regards,\nJANUS Team`;
    emailsToSend.push({ to: fromEmail, subject: `Re: Ticket ${ticket_id} - Follow-up received`, text: residentAckText });
    historyEntries.push({
      ticket_id,
      sender_name: 'JANUS to Resident',
      sender_email: 'system@janus',
      body: residentAckText,
      is_internal: false,
    });
  }

  // Notifications for Vendor Response
  if (isVendor) {
    if (ticket.sender_email) {
      const residentUpdateText = `The designated vendor has replied to your request:\n\n"""\n${bodyText}\n"""\n\nBest regards,\nJANUS Team`;
      emailsToSend.push({ to: ticket.sender_email, subject: `Ticket ${ticket_id} - Update on your maintenance request: ${ticket.subject}`, text: residentUpdateText });
      historyEntries.push({
        ticket_id,
        sender_name: 'JANUS to Resident',
        sender_email: 'system@janus',
        body: residentUpdateText,
        is_internal: false,
      });
    }
    const vendorAckText = `Hi ${displayName},\n\nThank you for the update. We have securely recorded your message and notified both the Property Manager and the Resident.\n\nBest regards,\nJANUS Team`;
    emailsToSend.push({ to: fromEmail, subject: `Re: Ticket ${ticket_id} - Update received`, text: vendorAckText });
    historyEntries.push({
      ticket_id,
      sender_name: 'JANUS to Vendor',
      sender_email: 'system@janus',
      body: vendorAckText,
      is_internal: false,
    });
  }

  // 4. Notifications for PM Response
  if (isPm) {
    if (ticket.sender_email) {
      const residentUpdateText = `The Property Manager has requested an update regarding your maintenance request:\n\n"""\n${bodyText}\n"""\n\nBest regards,\nJANUS Team`;
      emailsToSend.push({ to: ticket.sender_email, subject: `Ticket ${ticket_id} - Building Management Update: ${ticket.subject}`, text: residentUpdateText });
      historyEntries.push({
        ticket_id,
        sender_name: 'JANUS to Resident',
        sender_email: 'system@janus',
        body: residentUpdateText,
        is_internal: false,
      });
    }
    if (ticket.assigned_vendor_id) {
      const { data: vendorData } = await supabase.from('vendors').select('company_name, email').eq('id', ticket.assigned_vendor_id).maybeSingle();
      if (vendorData?.email) {
        emailsToSend.push({ to: vendorData.email, subject: `Management Follow-up: Ticket ${ticket_id}`, text: `Hi ${vendorData.company_name || 'Vendor'},\n\nThe Property Manager has sent an update regarding Ticket ${ticket_id}:\n\n"${bodyText}"\n\nPlease review in the JANUS dashboard.` });
        historyEntries.push({
          ticket_id,
          sender_name: 'JANUS to Vendor',
          sender_email: 'system@janus',
          body: `[Management Follow-up Notification]\n\nPM Message: "${bodyText}"`,
          is_internal: false,
        });
      }
    }
    const pmAckText = `Hi ${displayName},\n\nWe have received your message regarding Ticket ${ticket_id}. The Resident and Vendor (if any) have been notified of your request.\n\nBest regards,\nJANUS Team`;
    emailsToSend.push({ to: fromEmail, subject: `Re: Ticket ${ticket_id} - Management Update Recorded`, text: pmAckText });
    historyEntries.push({
      ticket_id,
      sender_name: 'JANUS to PM',
      sender_email: 'system@janus',
      body: pmAckText,
      is_internal: false,
    });
  }

  // Deduplicate emails by recipient address to prevent "double send"
  const finalEmailBatch = Array.from(new Map(emailsToSend.map(e => [e.to, e])).values());

  await Promise.allSettled(
    finalEmailBatch.map(email =>
      smtp.transporter.sendMail({
        from: smtp.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html
      })
    )
  );

  if (historyEntries.length > 0) {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    for (const entry of historyEntries) {
      const { data: existingNotif } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('ticket_id', ticket_id)
        .eq('sender_email', entry.sender_email)
        .eq('sender_name', entry.sender_name)
        .eq('body', entry.body)
        .gte('created_at', thirtySecondsAgo)
        .limit(1);

      if (!existingNotif || existingNotif.length === 0) {
        await supabase.from('ticket_messages').insert(entry);
      } else {
        console.log(`[INGEST] Skipping duplicate system notification entry for ${entry.sender_email}`);
      }
    }
  }
}

function formatRepairCategory(category: RepairCategory): string | null {
  if (!category) return null;
  const cat = category.toLowerCase();
  switch (cat) {
    case 'hvac': return 'HVAC';
    case 'plumbing': return 'Plumbing';
    case 'electrical': return 'Electrical';
    case 'appliance': return 'Appliance';
    case 'structural': return 'Structural';
    case 'construction': return 'Construction';
    case 'pest': return 'Pest';
    case 'other': return 'Other';
    default: return 'Other';
  }
}
