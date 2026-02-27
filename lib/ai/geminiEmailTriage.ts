export type TicketType =
  | 'repair'
  | 'complaint'
  | 'condo_reject'
  | 'general_inquiries_or_redesign';

export type TicketUrgency = 'high' | 'medium' | 'low';

export type TicketStatus = 'new' | 'in-progress' | 'pending-approval' | 'completed';

export type RepairCategory =
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'appliance'
  | 'structural'
  | 'pest'
  | 'other'
  | null;

export type GeminiTriageResult =
  | {
    is_relevant: false;
    reason: string;
  }
  | {
    is_relevant: true;
    reason: string;
    type: TicketType;
    urgency: TicketUrgency;
    status: TicketStatus;
    estimated_cost: number | null;
    repair_category: RepairCategory;
    resident_name: string | null;
    building_name: string | null;
    unit_number: string | null;
    summary: string;
  };

export const GEMINI_TRIAGE_PROMPT = `
You are an assistant for JANUS, a property management platform.

Your task is to analyze an incoming email and triage it. 

CRITICAL: 
- Emails often contain historical conversation threads (lines starting with > or containing "From: ... Sent: ..."), signatures, and "Sent from my iPhone" noise. 
- You MUST focus ONLY on the LATEST message (the newest content at the top).
- IGNORE previous replies, historical threads, and legal disclaimers/signatures.
- If the latest content is just a short follow-up like "Thanks" or "Okay" but refers to an existing issue discussed in the thread, classify it based on the context of the newest information.

JANUS handles ONLY:
- Building maintenance and repairs (plumbing, electrical, HVAC, appliances, structural, pest, etc.).
- Resident complaints about the building, staff, neighbours, or services.
- Condo application rejections or issues related to condo board decisions.
- General inquiries or redesign questions related to the building or units.

If the email is NOT about these topics (for example: spam, marketing, unrelated personal matters, job applications, sales pitches, newsletters, etc.):
- You MUST return JSON with ONLY:
  {
    "is_relevant": false,
    "reason": "Short explanation why this email is not about maintenance/complaints/resident services."
  }

If the email IS about JANUS services, return JSON with:
{
  "is_relevant": true,
  "reason": "Short explanation of why this is relevant.",
  "type": "repair | complaint | condo_reject | general_inquiries_or_redesign",
  "urgency": "high | medium | low",
  "status": "new | in-progress | pending-approval | completed",
  "estimated_cost": number or null,
  "repair_category": "electrical | plumbing | hvac | appliance | structural | pest | other | null",
  "resident_name": "Full resident name or null",
  "building_name": "Building name or null",
  "unit_number": "Unit or suite number or null",
  "summary": "1–2 sentence summary of the issue"
}

Rules:
- Always respond with STRICT, valid JSON only. No extra text.
- Choose "repair" if the resident is asking for something to be fixed, replaced, inspected, or installed.
- Choose "complaint" for noise issues, neighbour issues, staff issues, cleanliness, service complaints, etc.
- Choose "condo_reject" when the email is about a condo board rejecting an application or decision.
- Choose "general_inquiries_or_redesign" for questions, information requests, or design/redesign related topics.
- Use "urgency" = "high" only if there is risk of damage, safety, water leaks, no power, no heat in winter, etc.
- If you are unsure of estimated_cost, use null.
- If name/building/unit are not clearly given, use null.
`;
