# Supabase setup

Use separate staging and production projects. The app uses managed PostgreSQL, Auth and Storage; it does not depend on Hostinger filesystem persistence.

## Apply the database

Install the Supabase CLI on your development computer. Link the intended project, inspect the migration plan, then apply it:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

The eight SQL files in `supabase/migrations` create the relational schema, RLS, transactional RPCs, default theme, branding bucket and payment/refund recovery records. Production migrations create the company merchant and theme only. Do **not** include `supabase/seed.sql` in production: it contains development fixtures. On an isolated staging project, apply that file through SQL Editor after migrations if fixtures are wanted. [Official migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).

Copy the project URL and public anon or publishable key into the public environment variables. Store the service-role key only as `SUPABASE_SERVICE_ROLE_KEY` on the server.

## Auth and the first administrator

Set Auth Site URL to your canonical HTTPS origin and allow exact staging and production redirect URLs. Enable email/password accounts with confirmation and a minimum password length of 10. Configure business SMTP before inviting customers.

Register at `/register`, confirm the email, then use SQL Editor with a trusted database administrator:

```sql
update public.profiles set role='admin'
where id='REPLACE_WITH_YOUR_AUTH_USER_UUID';
```

Verify exactly the intended account changed. Subsequent role changes are available in Admin → Users & roles. Merchants apply at `/sell`; approval promotes the application owner to merchant. Drivers need the driver role and a linked driver record.

Products, categories and bags are public. Checkout requires a registered, non-anonymous Supabase user. Both the page/API and the database RPC enforce this; the internal reservation function cannot be called by clients. Anonymous sign-ins are not used for checkout. Configure Auth rate limits and hosting/proxy abuse controls.

Set Authentication → URL Configuration → Site URL to `https://edgedirect2u.vercel.app`. Allow the exact `/auth/confirm` and `/auth/confirm?next=/reset-password` callback URLs on Vercel and Hostinger; also allow `/auth/confirm?next=/checkout` for registration during checkout. Add the custom domain only after DNS and HTTPS work. See [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

The app exchanges PKCE codes on the issuing origin, recognizes recovery flows even when they land at `/`, and verifies legacy implicit recovery sessions before writing session cookies. Raw callback tokens are removed from the URL and are not returned in application responses or written to localStorage. The local preview forwards legacy localhost recovery landings to the trusted Vercel origin. This compatibility handling does not replace the dashboard URL correction; users on other devices cannot reach this computer's localhost.

For recovery links that work across browsers, configure the Recovery email template to link directly to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. The app verifies this single-use token server-side and opens the password form. The default PKCE email flow otherwise requires the browser that requested recovery to retain its verifier cookie. See [Supabase email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates). Do not put service credentials in email templates.

## Storage and permissions

Migration 004 creates public `brand-assets`: PNG, JPEG and WebP, maximum 5 MB. Only administrators upload through the app; file signatures and asset metadata are checked. SVG uploads are rejected. Supply safe raster replacements for SVG logos.

All public base tables enable RLS. Browser users read authorized rows and call approved RPCs. Payment application, refund claims/reconciliation and payment initialization finalization are service-role only. Public merchant discovery excludes account owners and commissions. Public reviews exclude customer IDs.

PGlite tests execute migrations on PostgreSQL in memory with mocked Auth/Storage schemas. Test real Supabase cookie sessions, Storage permissions and multiple simultaneous database connections in staging.

## Reservation expiry

Schedule a managed HTTPS request every five minutes:

```http
POST https://edgedirect2u.com/api/cron/expire
Authorization: Bearer YOUR_CRON_SECRET
```

Use a managed scheduler or Supabase Cron/Edge Function capable of sending the header. Store its secret securely. Checkout also releases expired reservations transactionally. No Hostinger background worker is assumed.

Before launch, verify PostgreSQL and asset backups and restoration. Add forward migrations rather than editing files already deployed.

## Verified TLS deployment tools

For this connected project, the owner supplied a database URL and CA certificate. Store them in ignored `.env.local` as `DATABASE_URL` (URL-encode the password) and `DATABASE_CA_PATH`. Run `npm run db:plan` before `npm run db:migrate`; the latter applies forward migrations transactionally under a deployment lock and tracks immutable checksums. Existing untracked schemas are rejected for manual reconciliation. The tool never runs development seed data. Follow `LAUNCH.md` for the connected project, administrator bootstrap and database-side reservation scheduler.
Applied migration files retain their original bytes in Git (`-text` attribute), including historical CRLF endings in the first four migrations. Do not reformat them: the deployment ledger verifies exact SHA-256 checksums. Add new forward migrations instead.
