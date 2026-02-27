# JANUS Development Task List

> **Status Tracking:** I will update this document as we complete each step. 
> 🔴 = Pending | 🟡 = In Progress | ✅ = Finished

## 1. SMTP & Dynamic Settings 📩
- [x] **Step 1.1: Database Setup** — Run the SQL script to create the `smtp_settings` table in Supabase. ✅
- [x] **Step 1.2: UI Connection** — Wire up the "Save Configuration" button in the Admin Email Settings tab to actually save to Supabase. ✅
- [x] **Step 1.3: Credential Verification** — Input your Gmail/SMTP App Password and test if the `smtpTransport` initializes correctly. ✅

## 2. Multi-Party Notification Testing 🔔
- [x] **Step 2.1: Resident Notification** — Verify the resident receives a "Ticket Created" email with the correct details. ✅
- [x] **Step 2.2: PM Notification** — Verify the Property Manager receives the alert containing the AI classification summary. ✅
- [x] **Step 2.3: Vendor Notification** — Ensure building #4's vendor (CoolAir/QuickFix) receives the assignment email. ✅

## 3. Real-World Trigger Implementation ⚡
- [x] **Step 3.1: Move Beyond "Curl"** — Connect the system to a real email trigger (transition from manual POST to automatic ingestion). ✅
- [ ] **Step 3.2: Formatting Robustness** — Ensure the `email-intake` route handles different email layouts (signature, historical threads, etc.) without breaking. 🔴



### Prerequisites for tomorrow:
- [ ] Ensure `next dev` is running.
- [ ] Have Gmail App Password ready.
- [ ] Run the SQL for `smtp_settings` table.
