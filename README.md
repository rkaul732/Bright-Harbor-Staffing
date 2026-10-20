# Bright Harbor Staffing

A mobile-first Next.js app for Bright Harbor employees and admins to manage time off requests, post eligible shift coverage, request shift pickup approvals, and monitor staffing activity across programs.

## What is included

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, Storage, Realtime-ready schema, and RLS policies
- Employee and Admin login paths
- Employee dashboard with time off requests, posted coverage shifts, and pickup requests
- Program-based access for shift exchange features
- Employee data visibility filtered to the programs selected on their profile
- My Calendar view with employee shifts, pickup requests, posted shifts, and time off requests
- Default monthly calendar with day-view switching
- Shift posting CRUD foundations and request workflow
- Approval routing to `bpataky@brightharbor.org`
- Employee profile setup with program, skills, availability, account info, and photo upload
- Messaging, reschedule, cancellation, saved shifts, profile moderation, analytics summary, ad slots, and monthly winners
- Demo mode when Supabase environment variables are not configured

## Program Rules

Employees choose one or more programs from the official Directors & Supervisors program list during account creation. Their dashboard, shift posting, open shift pickup, requests, and calendar are limited to those selected programs.

Acute Care Services (Crisis) offers CREST, Crisis Diversion, Crisis Stabilization, IOC, PACT I, and PACT II. The standalone legacy PACT value is not selectable. Run `015_replace_standalone_pact.sql` to expand existing PACT account and message-template assignments to both PACT I and PACT II. Its final query reports historical requests, shifts, ads, and email delivery records still labeled PACT. Review requests, shifts, and ads individually before assigning one of the two programs; delivery records are an audit trail of the original message.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

Without Supabase keys, the app opens in demo mode so you can click through the landing page, employee dashboard, admin dashboard, calendar views, request actions, time off requests, and monthly winners.

## Supabase Setup

1. Create a Supabase project.
2. Add these values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SHIFT_APPROVAL_SUPERVISOR_EMAIL=bpataky@brightharbor.org
```

3. Apply the SQL files in `supabase/migrations` in numeric order.
4. Load optional demo records from `supabase/seed.sql`.
5. Confirm the `profile-photos` storage bucket exists. The migration creates it and adds policies.
6. Enable email confirmation in Supabase Auth and allow the `/auth/callback` redirect URL for employee registration.

Employees can create an account from the landing page using a `@brightharbor.org` address and a password they choose. The registration migration checks the domain in the database, keeps self-service signups in the employee role, and limits employee time off visibility to their own requests.

Demo login accounts from the seed:

```text
employee@brightharbor.org / password123
morgan@brightharbor.org / password123
admin@brightharbor.org / password123
```

## Staff Account Invitations

Admins can create staff accounts from Admin View. This uses Supabase Auth invite emails, so `SUPABASE_SERVICE_ROLE_KEY` must be set in Netlify and Supabase Auth should allow this setup redirect URL:

```text
https://brightharborstaffing.netlify.app/auth/callback
```

Invited staff members are routed through `/auth/callback` and then create their password at `/auth/setup`, verify profile settings, and submit the profile for admin review. The app also creates an admin notification when setup is completed. Only super admins can invite new admins. Invited admins choose whole divisions or individual programs during setup; their access remains pending until a super admin approves the expanded program scope. Apply migration `009_employee_registration_privacy.sql` before enabling public registration and admin invitations so only trusted invitations can create admin roles.

## Admin Visibility

Regular admins see requests, calendars, reports, and profile reviews for the programs assigned to their admin profile. Their dashboard filter lists every assigned program under its division, including programs without current activity. Super admins see every program. The migration marks `rkaul@brightharbor.org` as a super admin when that user exists.

Super admins can delete employee accounts from Account Types after typing the employee's email to confirm. Migration `012_employee_account_deletion.sql` removes sign-in access, hides the employee from active lists, and retains staffing history with anonymized account details.

## Automated Messages

Super admins can open `/automated-messages` from the initials menu to edit rich text email templates for approved and declined time off requests. Approving or denying a time off or shift request sends a decision email to the employee through Resend, including the reviewer's comment and the same branded layout as the Supabase Auth templates. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Netlify's production environment, then redeploy; the sender address must use a domain verified in Resend. The Resend-to-Supabase integration configures Auth email delivery only and does not set these Netlify variables. Time off email delivery results are recorded in `automated_email_deliveries` when migration `004_automated_messages.sql` has been applied.

The message editor also includes **Your Request Has Been Submitted**. It sends to the employee after a new time off or shift coverage request is saved and includes the Eastern submission date and time plus a request summary. Run `013_request_submitted_event.sql` and `014_request_submitted_template.sql` separately, in that order, before editing or sending the new event. The email requires the same Netlify Resend settings as decision emails. A failed email leaves the request saved and reports the delivery problem to the employee.

## Approval Routing
Pending time off and shift requests appear only in the dashboards of approved supervisors and admins assigned to the request's program. Database triggers create individual in-app notifications for those reviewers. A program without an assigned supervisor routes to its assigned admin; no default supervisor is substituted. Migration `011_program_request_routing.sql` adds ISC to Meghan Corrigan's approved admin profile when present, routes existing pending requests, and routes still-pending requests when a reviewer is assigned later.

The edge function at `supabase/functions/route-shift-request/index.ts` is an email adapter stub. It does not send email; connect an email provider separately if email delivery is required.

## Product Rules

- Eligible employees can post a shift for coverage with only location, date, time frame, and a reason.
- Employee-created coverage posts are fixed at `$17.00 hourly`.
- Employees cannot create titles, mark emergency category, or set pay rates.
- Admins can create urgent and emergency posts.
- Standard posts stay at `$17.00 hourly`; emergency posts are `$19.00 hourly`.
- All employees can submit and track time off requests.

## Project Structure

```text
src/app                     Next.js routes and server actions
src/features                Role-specific dashboards, forms, and workflows
src/shared/components       Reusable UI components
src/shared/lib              Constants, dates, Supabase clients, data loading
src/shared/types            App domain and Supabase types
supabase/migrations         Database schema and policies
supabase/functions          Approval-routing edge function stub
```

## Verification

Recommended checks before deploying:

```bash
npm run typecheck
npm run build
```

## Future Mobile Wrapper

The role dashboards are intentionally separated from the web shell under `src/features`, and the domain types live in `src/shared/types`. That keeps the business model and UI workflows ready to share with a later React Native/Expo wrapper.
