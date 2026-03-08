# JANUS — Project Context Document

> **Purpose:** This document provides comprehensive context for the JANUS Property Management System. Use it when working with external LLMs, onboarding developers, or as a reference for project decisions.

---

## 1. Project Overview

**JANUS** is a Property Management System that combines:

1. **n8n Workflows** — Backend automation that ingests repair/complaint emails, classifies them with AI, and routes them through workflows
2. **Next.js Web App** — Frontend dashboard for property managers, staff, and vendors to view and manage tickets, buildings, and users

The system handles **repair requests** and **complaints** from residents/owners/agents, classifies them (initial vs. follow-up, repair vs. complaint vs. condo_reject vs. general_inquiries), and creates/updates tickets in a database.

---

## 2. What We're Building (n8n Workflows)

### 2.1 JANUS - Starting Line (Email Ingestion)

- **Trigger:** IMAP email read (Property Connect inbox)
- **AI Agent:** Analyzes incoming emails and determines if they contain **single** or **multiple** repair issues
  - **Single issue:** Copies entire email body to `Focus_Issues_in_Email`
  - **Multiple issues:** Extracts each issue separately and calls the tool multiple times
- **Tool:** `process_repair_request` — Calls **JANUS - Judgement Workflow** for each issue

**Tool input schema:**
```json
{
  "senderEmail": "Email address of the person sending the repair request",
  "senderName": "Full name of the sender",
  "subject": "Email subject line",
  "date": "Timestamp when email was received",
  "attachments": "Array of attachment information",
  "original_email_body": "Complete original email body",
  "Focus_Issues_in_Email": "The specific issue(s) — same as original_email_body if single issue"
}
```

### 2.2 JANUS - Judgement Workflow (Main Router)

**Flow summary:**

1. **Execute Trigger** — Receives data from Starting Line or direct execution
2. **Process attachments Code** — Normalizes data from orchestrator or IMAP (maps `Focus_Issues_in_Email` → `body`, etc.)
3. **Select Owner Resident Agent emails** — PostgreSQL: `SELECT * FROM users WHERE email = $1 AND role IN ('Owner', 'Resident', 'Agent')`
4. **If owner resident or agent** — Routes only if sender is a known resident/owner/agent
5. **Initial / Not Initial Agent** — AI classifies email as `initial` (new request) or `not_initial` (follow-up)
6. **Switch: Initial or Not Initial Email**
   - **Initial** → Main Router Agent
   - **Not Initial** → Extract Ticket ID, then route to existing ticket or unified workflow

7. **Main Router Agent** — Classifies:
   - `is_building_responsibility`: true/false
   - `type`: `repair` | `complaint` | `condo_reject` | `general_inquiries_or_redesign`
   - Building type (rental vs condo) affects routing — rental never gets `condo_reject`

8. **Building Responsibility?** — If true → Repair or Complaint; if false → Condo Reject or General Inquiries

9. **Repair route** → Repair Preparation → **JANUS - Repair Main WorkFlow**
10. **Complaint route** → Complaint Preparation → Complaint workflow
11. **Not Initial** → Extract Ticket ID from subject/body (`ticket-XXXXXXXX`), lookup ticket, route to appropriate workflow

**Referenced sub-workflows:**
- `JANUS - Repair Main WorkFlow`
- `JANUS - Unified Not Initial workflow Without Ticket Id`
- `JANUS - Complaint Workflow` (implied from docs)

### 2.3 Database Tables (Inferred from n8n)

| Table          | Key Fields |
|---------------|------------|
| `users`       | `email`, `role` (Owner, Resident, Agent, PropertyManager), `building_id`, `name`, `suite_number` |
| `buildings`   | `id`, `building_type` (condo/rental), `property_manager_email`, `property_manager_name` |
| `tickets`     | `ticket_id`, `state` (e.g. Completed), `building_id`, sender info, etc. |
| `vendors`     | `email`, etc. |
| `ticket_messages` | `ticket_id`, `sender_email`, `sender_name`, `body`, `is_internal`, `created_at` (conversation history for each ticket) |
| `building_rules`  | `building_id`, `ai_text`, `rule_category`, `effective_date` (AI-readable rules per building) |
| `smtp_settings`   | `building_id`, `host`, `port`, `username`, `password`, `is_default` (Dynamic SMTP config) |

**Ticket ID format:** `ticket-XXXXXXXX` (e.g. `ticket-1`, `ticket-123`)

---

## 3. Documentation Files (Reference)

Located in `documents/`:

| File | Description |
|------|-------------|
| `JANUS - Starting Line.json` | n8n workflow: email ingestion + AI separation |
| `JANUS - Judgement Workflow.json` | n8n workflow: main routing logic |
| `Property Management Repair Workflow System Documentation.docx` | Detailed repair workflow docs |
| `Property Management Complaint Workflow - Complete Documentation.docx` | Detailed complaint workflow docs |

---

## 4. Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database / Auth:** Supabase (PostgreSQL + Auth) — requires `@supabase/supabase-js`
- **UI:** Tailwind CSS, Radix UI, shadcn/ui components, Lucide icons
- **Forms:** React Hook Form, Zod
- **Backend automation:** n8n (separate deployment, uses Postgres)

---

## 5. Project Structure

```
Janus/
├── app/
│   ├── api/
│   │   └── email-intake/
│   │       └── route.ts         # Main intake API: receives emails, classifies with AI, creates tickets
│   ├── page.tsx                 # Root → redirects to /login
│   ├── layout.tsx               # Root layout (fonts, Vercel Analytics, global styles)
│   ├── globals.css              # App-level styles (Tailwind)
│   ├── hooks/
│   │   └── useAuthUser.ts       # Client hook: loads Supabase auth user + metadata (role, building, etc.)
│   ├── login/
│   │   └── page.tsx             # Supabase Auth login (email/password)
│   └── dashboard/
│       ├── layout.tsx           # Protected layout, checks auth, renders Sidebar, listens for auth changes
│       ├── page.tsx             # Dashboard home (ticket stats + recent tickets from Supabase)
│       ├── tickets/
│       │   ├── page.tsx         # Tickets list with status/urgency/type filters (Supabase-backed)
│       │   ├── new/page.tsx     # New ticket form (inserts into Supabase `tickets`)
│       │   └── [id]/page.tsx    # Ticket detail + conversation + vendor assignment (all Supabase-backed)
│       ├── buildings/page.tsx   # Buildings list (mock data from `lib/mock-data.ts`)
│       ├── vendors/page.tsx     # Vendors list (mock vendors from `lib/mock-data.ts`)
│       └── admin/page.tsx       # Users + Buildings admin tabs (Supabase `users` + `buildings`)
├── components/
│   ├── sidebar.tsx              # Main nav (Dashboard, Tickets, Buildings, Vendors, Admin) + logout
│   ├── theme-provider.tsx
│   └── ui/                      # shadcn/ui primitives (button, card, input, tabs, etc.)
├── lib/
│   ├── supabase.ts              # Supabase client (browser, persisted session)
│   ├── mock-data.ts             # Mock users, buildings, tickets (used by some UI pages)
│   └── utils.ts
├── types/
│   └── index.ts                 # TypeScript domain/interfaces (Building, User, Ticket, TicketMessage, etc.)
├── scripts/                     # Backend automation and utility scripts
│   ├── email-listener.js        # REAL-TIME LISTENER: Pulls IMAP settings from Supabase and monitors inbox
│   ├── load-env.js              # Shared environment loader for scripts
│   └── (various helpers)        # check-ticket.js, list-tickets.js, debug-notifications.js, etc.
├── CONTEXT.md                   # This file
└── TASKLIST.md                  # Current project roadmap
```

---

## 6. TypeScript Types (`types/index.ts`)

**Supabase / Domain types:**

- `BuildingType`: `'condo' | 'rental' | 'housing-co-op'`
- `UserRole`: `'Resident' | 'Owner' | 'Agent' | 'PropertyManager'`
- `TicketType`: `'repair' | 'complaint' | 'condo_reject' | 'general_inquiries_or_redesign'`
- `TicketState`: `'new' | 'in-progress' | 'completed' | 'pending-approval'`
- `TicketUrgency`: `'low' | 'medium' | 'high'`
- `VendorType`: `'vendor' | 'contractor'`

**Interfaces:** `Building`, `User`, `Vendor`, `Ticket`, `TicketMessage`, `BuildingRule`, `AuthUser`

- `TicketMessage` maps to the `ticket_messages` table (per-ticket conversation history, including `is_internal` notes).
- `BuildingRule` maps to a `building_rules` table (AI-readable building rules and categories).
- `AuthUser` represents the authenticated Supabase user + basic profile/role fields used by the app.

**Note:** `lib/mock-data.ts` uses different types (`admin`, `staff`, `vendor` roles; `TicketStatus`, `Urgency`) — these are for mock data only. Real Supabase data should align with `types/index.ts`.

---

## 7. Current Implementation Status

### Phase 1 — Supabase Setup

| Item | Status |
|------|--------|
| Run SQL to create tables (tickets, users, buildings, etc.) | ✅ Done |
| Run SQL to insert seed/test data | ✅/⭕ Depends on what was run |
| Create test user in Supabase Auth | ✅ Done |

### Phase 2 — Connect Code to Supabase

| Item | Status |
|------|--------|
| Add `.env.local` with Supabase keys | ✅ Done |
| Create `lib/supabase.ts` client | ✅ Done |
| Create `types/index.ts` with interfaces | ✅ Done |

### Phase 3 — Auth

| Item | Status |
|------|--------|
| Replace login page with Supabase Auth | ✅ Done (`supabase.auth.signInWithPassword`) |
| Add middleware for protected routes | ⭕ Not done (middleware disabled) |
| Add role detection + redirect based on role | ⭕ Partially done (role stored in Supabase user metadata and read via `useAuthUser`, but no per-role redirects yet) |

### Phase 4 — Real Data in Pages

| Item | Status |
|------|--------|
| Dashboard real ticket counts | ✅ Done (Supabase `tickets` table) |
| Tickets list page real tickets | ✅ Done (Supabase `tickets` table + filters) |
| Ticket detail page real ticket + history | ✅ Done (ticket from Supabase `tickets`; conversation from `ticket_messages`; managers can change state and assign vendors from `vendors`) |
| Admin page real buildings + users | ✅ Done (Supabase `users` + `buildings` tables) |

### Phase 5 — Ticket Submission

| Item | Status |
|------|--------|
| New Ticket form + insert into Supabase | ✅ Done (`/dashboard/tickets/new` inserts into `tickets`) |

### Phase 6 — Email Intake & Automation

| Item | Status |
|------|--------|
| Email intake API (`/api/email-intake`) | ✅ Done (AI classification + initial message) |
| Multi-vendor auto-assignment | ✅ Done (based on category + building) |
| Dynamic SMTP Configuration | ✅ Done (Admin UI + `smtp_settings` table) |
| Real-time Email Listener (`email-listener.js`) | ✅ Done (IMAP-based auto-ingestion) |
| Message Deduplication & Threads | ✅ Done (History cleaning + Ticket ID extraction) |
| Sender Verification | ✅ Done (Only known residents can create tickets) |
| Real SMTP Notification Delivery | ✅ Done (Dynamic delivery via Supabase settings) |

**Summary:** The system is now fully automated. A real-time listener monitors the inbox (via Supabase settings), ingests emails into the AI triage route, creates tickets for known residents, and automatically notifies the PM, Vendor, and Resident using dynamic SMTP credentials.

---

## 8. Auth Flow (Current)

1. **Root (`/`)** → Redirects to `/login`
2. **Login (`/login`)** → Form calls `supabase.auth.signInWithPassword()` → On success, `window.location.href = '/dashboard'`
3. **Dashboard layout** → `useEffect` checks `supabase.auth.getSession()`; if no session → redirect to `/login`. Also subscribes to `supabase.auth.onAuthStateChange()` to redirect if the user signs out or the session is lost.
4. **Logout** (Sidebar) → Calls `supabase.auth.signOut()` and then redirects to `/login`

**Middleware:** `middleware.disabled.ts` exists with cookie-based session check but is **disabled** (file renamed). When re-enabled, it would protect routes server-side.

---

## 9. Key Code Files

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client; uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `app/login/page.tsx` | Login form, Supabase Auth |
| `app/dashboard/layout.tsx` | Auth check, Sidebar, wraps all dashboard pages |
| `app/dashboard/page.tsx` | Stats cards + recent tickets (Supabase `tickets`) |
| `app/dashboard/tickets/page.tsx` | Ticket list with status/urgency filters (Supabase `tickets`) |
| `app/dashboard/tickets/new/page.tsx` | New ticket form that inserts into Supabase `tickets` |
| `app/dashboard/tickets/[id]/page.tsx` | Ticket detail + Supabase-backed conversation thread (`ticket_messages`) and vendor assignment (`vendors`) |
| `app/dashboard/buildings/page.tsx` | Buildings grid (mock data from `lib/mock-data.ts`) |
| `app/dashboard/vendors/page.tsx` | Vendors list (mock users filtered as vendors from `lib/mock-data.ts`) |
| `app/dashboard/admin/page.tsx` | Users + Buildings + SMTP Settings tabs |
| `app/api/email-intake/route.ts` | AI Triage + Ticket Creation + Dynamic Notifications + Sender Verification |
| `scripts/email-listener.js` | Standalone script that connects to IMAP and triggers the intake API |
| `lib/ai/geminiEmailTriage.ts` | AI classification logic using Google Gemini |
| `lib/mailer.ts` | Shared notification delivery logic |

---

## 10. Routing & Sidebar

**Actual routes (Next.js App Router):**

- `/` → redirect to `/login`
- `/login` → Login page
- `/dashboard` → Dashboard home
- `/dashboard/tickets` → Tickets list
- `/dashboard/tickets/[id]` → Ticket detail
- `/dashboard/buildings` → Buildings
- `/dashboard/vendors` → Vendors
- `/dashboard/admin` → Admin (users + buildings)

**Sidebar hrefs:** Use `/dashboard`, `/dashboard/tickets`, `/dashboard/buildings`, `/dashboard/vendors`, `/dashboard/admin`, matching the App Router structure. Active state is based on `usePathname()` and `startsWith(href)` for non-root dashboard links.

---

## 11. Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
GEMINI_API_KEY=AIzaSy...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="JANUS <your-email@gmail.com>"
```

---

## 12. Data Flow (Target State)

1. **n8n** ingests emails → AI classifies → Creates/updates tickets in Postgres (Supabase)
2. **Next.js app** reads tickets, buildings, users from Supabase
3. **Property managers** view dashboard, tickets, assign vendors, update status
4. **Residents** (future) may submit tickets via form or email

---

## 13. Next Steps (Suggested)

1. Re-enable and fix middleware for protected routes so auth is enforced server-side (in addition to the client-side dashboard layout check).
2. Finish role-based behavior: use `useAuthUser` / Supabase user metadata to redirect by role and gate features (e.g. only PropertyManagers can assign vendors or change ticket state).
3. Replace remaining mock data in `buildings` and `vendors` pages with Supabase-backed tables and CRUD flows.
4. Integrate n8n workflows so email replies and automation steps write into the `ticket_messages` table, keeping the in-app conversation thread in sync with email.
5. Add basic admin UIs for creating/editing/deleting buildings, users, and vendors behind the Admin tab.

---

*Last updated: Based on codebase and documents as of creation.*

