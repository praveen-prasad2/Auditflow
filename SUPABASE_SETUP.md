# Supabase setup for AuditFlow

## Current status

Implemented: dedicated registration, login, confirmation callback, password recovery/update, sign-out, server-verified cookie sessions, Supabase PostgreSQL storage for all existing workflows, owner row-level security, atomic crawl claim/save functions, and a narrowly scoped share-report function. Requires a Supabase project to connect. No Supabase project has been created or connected by this change. Live auth, email delivery, RLS and database operations remain unverified until configuration is supplied.

The application does not need a database password or service-role key. All authenticated database operations use the user's Supabase session and are subject to RLS. Existing D1 data remains on disk and is not deleted or silently migrated. New Supabase accounts start with an empty workspace. The original ChatGPT identity headers are no longer used by the application APIs.

## 1. Create or select a project

Visit https://supabase.com/dashboard and create a project or select your existing one. Choose the organization and region appropriate for your data, and keep the generated database password in your password manager. Copy the **Project URL** and **publishable key** from the Connect dialog / API settings. A legacy anon key also works. Do not use a secret or service-role key.

## 2. Set local variables

Add these to `.dev.vars` (already ignored by Git):

```env
APP_ORIGIN=http://localhost:5173
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Keep existing Google credentials and TOKEN_ENCRYPTION_KEY unchanged. For production use HTTPS APP_ORIGIN and store variables in the hosting environment. Restart the dev server after changing variables. The Supabase URL/key are read server-side; no NEXT_PUBLIC build-time configuration is required.

## 3. Apply the database migration

In your project's SQL Editor, run the complete `supabase/migrations/20260927_auditflow.sql` file **once**. It creates namespaced AuditFlow tables and functions, RLS policies, owner indexes and a unique active-audit constraint. It does not alter existing unrelated tables or data. Do not apply the older SQLite `drizzle/*.sql` files to Supabase.

## 4. Configure email authentication

In Authentication → Providers, enable Email with email confirmation. Set minimum password length to at least 12 characters. In URL Configuration set:

- Site URL: `http://localhost:5173`
- Allowed redirect URLs: `http://localhost:5173/auth/confirm` and `http://localhost:5173/auth/confirm?next=reset`

For confirmation links that also work across browsers, configure the email template URLs:

**Confirm signup:**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your account</a>
```

**Reset password:**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Use separate development and production projects when possible. Production Site URL and allowlisted redirects must use the real HTTPS domain. If using default PKCE code links instead, open the email link in the same browser that requested it. The callback supports both approved token-hash email links and PKCE codes.

Configure your SMTP provider for delivery to real customers; Supabase's built-in email service has testing restrictions and quotas. Configure Supabase Auth rate limits and bot protection before public signup at scale. The app uses generic login/reset messages and never stores passwords in its records table.

## 5. Verify

1. Open `/register`, create your own account, and confirm the email.
2. Sign in at `/login`; add a client, run a crawl, edit a task and report, then refresh.
3. Sign out in Settings; verify workspace APIs deny anonymous access.
4. Test `/forgot-password`, follow the email link, choose a new password, and sign in again.
5. Use a second test account to confirm it cannot read the first account's records, including direct Supabase Data API requests (RLS).
6. Verify sharing, expiry and revocation. Hosted Site access restrictions still apply independently of a report token.

Compile/build and unconfigured-state tests can run before credentials exist. Full live integration tests require the project, applied migration, and email delivery.

## Architecture

- `lib/supabase/server.ts`: per-request server client, HttpOnly cookies and runtime config.
- `app/api/auth/route.ts`: sign-up, sign-in, recovery, password update, sign-out.
- `app/auth/confirm/route.ts`: PKCE exchange or token-hash confirmation with fixed redirect targets.
- `app/auth-form.tsx`: responsive account forms with validation and honest setup states.
- `lib/store.ts`: Supabase queries with explicit owner filters plus database RLS.
- SQL RPCs: atomic audit leases and cancellation-safe writes; a security-definer report function returns only one unexpired shared report.

Session refresh occurs in API route handlers, where cookie writes are supported; the workspace shell does not read user sessions in Server Components. Background crawls receive the initiating request's database client rather than opening a new cookie context after response completion. Public shared reports use the publishable client and only the dedicated share RPC.

## Verified locally

- TypeScript validation and production build pass.
- Login, registration, forgot-password, and reset-password routes return HTTP 200.
- Unconfigured auth reports configured=false without inventing a connection.
- Cross-origin/missing-origin auth POSTs are rejected.
- `node tests/supabase-database.mjs` executes the real migration in embedded PostgreSQL and verifies owner isolation, spoofed-owner rejection, anonymous denial, lease claim/release, cancellation safety, report sharing, expiry and revocation. This is not a substitute for testing the actual Supabase project and email service.
