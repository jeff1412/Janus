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

| Table       | Key Fields |
|------------|------------|
| `users`    | `email`, `role` (Owner, Resident, Agent, PropertyManager), `building_id`, `name`, `suite_number` |
| `buildings`| `id`, `building_type` (condo/rental), `property_manager_email`, `property_manager_name` |
| `tickets`  | `ticket_id`, `state` (e.g. Completed), `building_id`, sender info, etc. |
| `vendors`  | `email`, etc. |

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
│   ├── page.tsx                 # Root → redirects to /login
│   ├── layout.tsx               # Root layout
│   ├── globals.css
│   ├── login/
│   │   └── page.tsx             # Supabase Auth login
│   └── dashboard/
│       ├── layout.tsx           # Protected layout, checks auth, renders Sidebar
│       ├── page.tsx             # Dashboard home (stats + recent tickets)
│       ├── tickets/
│       │   ├── page.tsx         # Tickets list with filters
│       │   └── [id]/page.tsx    # Ticket detail + conversation
│       ├── buildings/page.tsx   # Buildings list
│       ├── vendors/page.tsx     # Vendors list
│       └── admin/page.tsx       # Users + Buildings admin tabs
├── components/
│   ├── sidebar.tsx              # Main nav (Dashboard, Tickets, Buildings, Vendors, Admin)
│   ├── theme-provider.tsx
│   └── ui/                     # shadcn components
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── mock-data.ts            # Mock users, buildings, tickets (used by UI)
│   └── utils.ts
├── types/
│   └── index.ts                # TypeScript interfaces (Building, User, Ticket, etc.)
├── documents/                  # n8n workflows + docs
├── middleware.disabled.ts      # Middleware for protected routes (currently disabled)
└── CONTEXT.md                  # This file
```

---

## 6. TypeScript Types (`types/index.ts`)

**Supabase / Domain types:**

- `BuildingType`: `'condo' | 'rental' | 'housing-co-op'`
- `UserRole`: `'Resident' | 'Owner' | 'Agent' | 'PropertyManager'`
- `TicketType`: `'repair' | 'complaint' | 'Self-Help' | 'general'`
- `TicketState`: `'new' | 'in-progress' | 'completed' | 'escalated' | 'pending-approval'`
- `TicketUrgency`: `'low' | 'medium' | 'high'`
- `VendorType`: `'vendor' | 'contractor'`

**Interfaces:** `Building`, `User`, `Vendor`, `Ticket`, `BuildingRule`, `AuthUser`

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
| Add role detection + redirect based on role | ⭕ Not done |

### Phase 4 — Real Data in Pages

| Item | Status |
|------|--------|
| Dashboard real ticket counts | ⭕ Mock data |
| Tickets list page real tickets | ⭕ Mock data |
| Ticket detail page real ticket + history | ⭕ Mock data |
| Admin page real buildings + users | ⭕ Mock data |

### Phase 5 — Ticket Submission

| Item | Status |
|------|--------|
| New Ticket form + insert into Supabase | ⭕ Not done |

**Summary:** Basic Supabase login + protected dashboard via layout is working. Middleware, role-based redirects, and all real-data pages (Phases 4–5) are still ahead.

---

## 8. Auth Flow (Current)

1. **Root (`/`)** → Redirects to `/login`
2. **Login (`/login`)** → Form calls `supabase.auth.signInWithPassword()` → On success, `window.location.href = '/dashboard'`
3. **Dashboard layout** → `useEffect` checks `supabase.auth.getSession()`; if no session → redirect to `/login`
4. **Logout** (Sidebar) → Currently clears `sessionStorage` and redirects; should be updated to call `supabase.auth.signOut()` for proper Supabase logout

**Middleware:** `middleware.disabled.ts` exists with cookie-based session check but is **disabled** (file renamed). When re-enabled, it would protect routes server-side.

---

## 9. Key Code Files

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client; uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `app/login/page.tsx` | Login form, Supabase Auth |
| `app/dashboard/layout.tsx` | Auth check, Sidebar, wraps all dashboard pages |
| `app/dashboard/page.tsx` | Stats cards + recent tickets (mock) |
| `app/dashboard/tickets/page.tsx` | Ticket list with status/urgency filters (mock) |
| `app/dashboard/tickets/[id]/page.tsx` | Ticket detail + conversation thread (mock) |
| `app/dashboard/buildings/page.tsx` | Buildings grid (mock) |
| `app/dashboard/vendors/page.tsx` | Vendors list (mock) |
| `app/dashboard/admin/page.tsx` | Users + Buildings tabs (mock) |
| `components/sidebar.tsx` | Nav links; logout handler |
| `lib/mock-data.ts` | Mock users, buildings, tickets |

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

**Sidebar hrefs:** Currently use `/tickets`, `/buildings`, `/vendors`, `/admin`. These may need to be updated to `/dashboard/tickets`, `/dashboard/buildings`, etc., depending on whether the dashboard layout is the parent. With the current structure, all dashboard pages are under `/dashboard/*`, so sidebar links should be `/dashboard/tickets`, `/dashboard/buildings`, `/dashboard/vendors`, `/dashboard/admin`.

---

## 11. Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 12. Data Flow (Target State)

1. **n8n** ingests emails → AI classifies → Creates/updates tickets in Postgres (Supabase)
2. **Next.js app** reads tickets, buildings, users from Supabase
3. **Property managers** view dashboard, tickets, assign vendors, update status
4. **Residents** (future) may submit tickets via form or email

---

## 13. Next Steps (Suggested)

1. Re-enable and fix middleware for protected routes
2. Add role detection after login; redirect by role (e.g. PropertyManager → dashboard, Resident → limited view)
3. Replace mock data with Supabase queries in dashboard, tickets, buildings, admin pages
4. Implement New Ticket form with Supabase insert
5. Align Sidebar logout with `supabase.auth.signOut()`
6. Fix Sidebar nav links to use correct `/dashboard/*` paths if needed

---

*Last updated: Based on codebase and documents as of creation.*

