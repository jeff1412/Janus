// types.ts

export type TicketState =
  | 'new'
  | 'in-progress'
  | 'completed'
  | 'pending-approval';

export type TicketUrgency = 'high' | 'medium' | 'low';

export type TicketType =
  | 'repair'
  | 'complaint'
  | 'condo_reject'
  | 'general_inquiries_or_redesign';

export type Ticket = {
  id: string;
  ticket_id: string;

  // core ticket info
  subject?: string | null;
  damage_description?: string | null;

  // location / property context
  building?: string | null;
  unit_number?: string | null;

  // resident / reporter context
  resident?: string | null;
  sender_email?: string | null;

  // NEW: denormalized resident name at time of ticket
  resident_name?: string | null;

  // lifecycle
  state: TicketState;
  urgency: TicketUrgency;
  type: TicketType;

  // NEW: estimated cost for this ticket
  estimated_cost?: number | null;

  // timestamps
  created_at?: string;
  updated_at?: string;
};
