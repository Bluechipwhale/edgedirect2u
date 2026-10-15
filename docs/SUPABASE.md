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

Authentication → URL Configuration is set to `https://edgedirect2u.com`. The exact `/auth/confirm`, `/auth/confirm?next=/reset-password`, and `/auth/confirm?next=/checkout` callbacks are allowed on the primary domain and the Vercel backup. The temporary Hostinger hostname was retired when the custom domain was connected. See [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

The app exchanges PKCE codes on the issuing origin, recognizes recovery flows even when they land at `/`, and verifies legacy implicit recovery sessions before writing session cookies. Raw callback tokens are removed from the URL and are not returned in application responses or written to localStorage. The local preview forwards legacy localhost recovery landings to the trusted Vercel origin. This compatibility handling does not replace the dashboard URL correction; users on other devices cannot reach this computer's localhost.

The saved Recovery email template links directly to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`, allowing it to open in another browser. Its source is versioned at `supabase/templates/recovery.html`; dashboard template changes are applied separately from database migrations. Opening a token link shows a confirmation form without consuming the token. An explicit same-origin POST verifies it server-side and opens the password form with a success message. This prevents ordinary email-scanner GET requests from using the link before the recipient. The token is removed from the visible URL on the confirmation page; auth pages use no-store and no-referrer headers. Confirmation redirects use the configured public HTTPS origin, never Hostinger's internal `0.0.0.0:3000` request origin. Sign-up confirmations show an explicit success page with a safe checkout/account return. The default PKCE email flow otherwise requires the browser that requested recovery to retain its verifier cookie. See [Supabase email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates). Do not put service credentials in email templates.

Custom SMTP is enabled with sender `E-Edge Direct 2U <info@edgedirect2u.com>`, host `smtp.hostinger.com`, port `465`, full email address as username and a 60-second minimum interval per user. The owner supplied the mailbox password directly in Supabase; it is not stored in this repository. Public DNS has Hostinger MX/SPF, three DKIM CNAMEs and DMARC. A live recovery request returned success and Hostinger recorded successful SMTP authentication. Confirm inbox placement separately. The email trial expires on **14 November 2026**; renew it before expiry to keep customer emails working. See [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp). No paid upgrade or renewal was purchased.

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
