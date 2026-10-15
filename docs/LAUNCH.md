# Connected marketplace handoff

**15 October 2026:** the company foundation, official branding and installer release 1.0.2 supersede the earlier launch entries below. Read [PHASE-1-RELEASE.md](PHASE-1-RELEASE.md) for current deployment, administrator access, verification and outstanding work.

**14 October 2026:** the app is live at https://edgedirect2u.vercel.app and https://maroon-mink-604054.hostingersite.com. Vercel automatically deploys GitHub `main`; Hostinger uses the verified source ZIP. Both hosts have private Supabase service and live Paystack keys. Live health, protected management and signed no-op webhook checks passed; no payment or refund has been performed. Signed v1.0.1 APKs and the unsigned Windows installer are published; both APKs passed live-page checks. Supabase email-link/SMTP configuration and Paystack dashboard routing remain unverified. The requested custom domain needs registration. See [START-HERE.md](START-HERE.md) for current access. Earlier dated records describe the predeployment state.

The supplied Supabase project is connected. Eight forward migrations are applied, with a checksum ledger in the private `edge_deploy` schema. Six editorial categories are available; no sample products, merchant businesses, orders or customer accounts were inserted. The public API can read published settings and categories, while anonymous private profile reads and dashboard RPC calls are denied.

The CA certificate supplied by the owner matches Supabase's official certificate. The database URL is correctly encoded and stored only in ignored `.env.local`. Deployment tools use verified TLS. `DATABASE_URL` and `DATABASE_CA_PATH` are deployment-machine values; the web application uses Supabase's HTTPS API.

## Administrator

The owner selected `olasodechukwudi@gmail.com`. This account is already confirmed and has administrator access. Sign in at https://edgedirect2u.vercel.app/login using its registered password. For a new project, register and confirm the chosen owner before a trusted database owner runs:

```sh
node scripts/operations.cjs --admin-email olasodechukwudi@gmail.com
```

The command requires exactly one matching, confirmed, non-anonymous Auth user and records the elevation in the audit log. It will not create an unconfirmed privileged account. On 13 October 2026, the selected confirmed account was successfully granted administrator access. Sign in using its existing account password, then open `/admin`.

## Payments and uploads

Set `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` in the hosting environment and in `.env.local` for local service acceptance. Keep both server-only. The publishable key cannot perform service-role operations. Checkout remains unavailable until both secrets are present, and creates no reservation in that state.

Configure the Paystack webhook at `/api/payments/webhook`, run a test payment and refund using Paystack test keys, and verify amount/currency, duplicate delivery and stock consumption. See `PAYSTACK.md`. Store approved support contacts, policies, actual product descriptions, stock and photography before launch.

## Auth email links

The connected project reference is `itdpkfnuyxzqswctlsar`; its dashboard display name may differ. Open https://supabase.com/dashboard/project/itdpkfnuyxzqswctlsar while signed in with the Supabase account that owns or has access to it. Store administrator access and Supabase dashboard access are separate. The current dashboard account lists other project references and redirects away from the connected project. Its database/public API remain available, so keep the existing application configuration. If another person or website builder supplied this project's credentials, recover access through that owner or Supabase support before changing authentication settings. Database credentials and the project's service-role key do not provide dashboard organization membership.

Configure Supabase Auth's Site URL and redirect allowlist for the intended canonical HTTPS domain. The app supports PKCE code exchange and token-hash links through `/auth/confirm`.

For links that also work when opened on another device, configure these Supabase email templates:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
<!-- Recover password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>
```

Expired links return to `/forgot-password`. Configure business SMTP and verify actual email delivery. Anonymous checkout remains an optional Supabase Auth setting; require sign-in when it is disabled.

## Reservation expiry

The Supabase job `edgedirect2u-expire-reservations` runs `select public.expire_reservations();` every five minutes. It runs inside the database and requires no hosting worker or HTTP call. Inspect the job and recent executions with:

```sh
npm run ops:status
```

For another Supabase project, apply migrations first and then run `npm run ops:schedule`. This deliberately uses the managed pg_cron extension outside the portable migrations. The administrator's Settings page inspects the active schedule and requires a recent successful run before marking the scheduler ready. The protected `/api/cron/expire` HTTP endpoint remains available for hosts that use an external scheduler; avoid configuring a duplicate scheduler.

## Verification and deployment

```sh
npm run db:plan
npm run check:services
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build:hostinger
npm run check:production
npm run check:env
```

Browser tests launch a separate loopback server on port 3100, use `.data/e2e.sqlite`, explicitly blank Supabase and payment credentials, and stop their own server. They cannot mutate the connected project. Keep the normal app on port 3000. The production smoke test briefly starts the standalone server on an available loopback port and stops it after checking live database health, private API access, checkout gating, CSP, fonts and social image rendering.

The source includes a CI workflow for lint, types, unit/database tests, production dependency audit, browser flows and standalone packaging. The five development dependency audit findings in the existing Next lint toolchain remain unresolved; there is no compatible upstream fix reported by npm. Production dependency audit reports no vulnerabilities.

The owner confirmed Hostinger and the intended domain `edgedirect2u.com`. The prepared source archive is `artifacts/hostinger-source.zip`; its checksum is alongside it. The ZIP uses portable paths/directory permissions and includes only public `.env.production` settings. Hostinger overrides `NEXT_PUBLIC_SITE_URL` with its actual HTTPS address; service/payment keys were imported separately through its private environment settings. Both published hosts read the same Supabase database, with no data import or PostgreSQL credentials needed on Hostinger. See `HOSTINGER.md` for subsequent deployments. Business acceptance remains necessary before taking customer payments.

Verification on 12 October 2026: lint, types, 50 unit/database tests, all 10 browser flows, final standalone packaging and the live-database production smoke test passed. Launch configuration still correctly reports missing service-role/payment keys and the local HTTP origin. Local `.env.local` deliberately retains the loopback origin; the host must use the canonical HTTPS origin.
