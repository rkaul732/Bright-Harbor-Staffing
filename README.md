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

Demo login accounts from the seed:

```text
employee@example.com / password123
morgan@example.com / password123
admin@example.com / password123
```

## Staff Account Invitations

Admins can create staff accounts from Admin View. This uses Supabase Auth invite emails, so `SUPABASE_SERVICE_ROLE_KEY` must be set in Netlify and Supabase Auth should allow this setup redirect URL:

```text
https://brightharborstaffing.netlify.app/auth/callback
```

Invited staff members are routed through `/auth/callback` and then create their password at `/auth/setup`, verify profile settings, and submit the profile for admin review. The app also creates an admin notification when setup is completed.

## Admin Visibility

Regular admins see requests, calendars, reports, and profile reviews for the programs assigned to their admin profile. Super admins see every program. The migration marks `rkaul@brightharbor.org` as a super admin when that user exists.

## Approval Routing
When an employee requests to pick up a shift, a `requests` row is created with:

```text
status = pending_supervisor_approval
supervisor_email = bpataky@brightharbor.org
```

The database trigger creates a notification. The edge function at `supabase/functions/route-shift-request/index.ts` is ready to connect to an email provider such as Resend, SendGrid, or SMTP.

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
