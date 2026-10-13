# Connected marketplace handoff

The supplied Supabase project is connected. Eight forward migrations are applied, with a checksum ledger in the private `edge_deploy` schema. Six editorial categories are available; no sample products, merchant businesses, orders or customer accounts were inserted. The public API can read published settings and categories, while anonymous private profile reads and dashboard RPC calls are denied.

The CA certificate supplied by the owner matches Supabase's official certificate. The database URL is correctly encoded and stored only in ignored `.env.local`. Deployment tools use verified TLS. `DATABASE_URL` and `DATABASE_CA_PATH` are deployment-machine values; the web application uses Supabase's HTTPS API.

## Administrator

The owner selected `olasodechukwudi@gmail.com`. Register this account through `/register` and confirm its email. A trusted database owner then runs:

```sh
node scripts/operations.cjs --admin-email olasodechukwudi@gmail.com
```

The command requires exactly one matching, confirmed, non-anonymous Auth user and records the elevation in the audit log. It will not create an unconfirmed privileged account. On 13 October 2026, the selected confirmed account was successfully granted administrator access. Sign in using its existing account password, then open `/admin`.

## Payments and uploads

Set `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` in the hosting environment and in `.env.local` for local service acceptance. Keep both server-only. The publishable key cannot perform service-role operations. Checkout remains unavailable until both secrets are present, and creates no reservation in that state.

Configure the Paystack webhook at `/api/payments/webhook`, run a test payment and refund using Paystack test keys, and verify amount/currency, duplicate delivery and stock consumption. See `PAYSTACK.md`. Store approved support contacts, policies, actual product descriptions, stock and photography before launch.

## Auth email links

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

The owner confirmed Hostinger and the canonical domain `edgedirect2u.com`. The prepared source archive is `artifacts/hostinger-source.zip`; its SHA-256 checksum is alongside it. The ZIP now includes a generated `.env.production` containing only the approved HTTPS origin, Supabase public URL/publishable key and `LOCAL_DEMO=false`. Hostinger's Next.js build automatically loads those values, so the uploaded application reads the same Supabase database. No data import or PostgreSQL credentials are needed on Hostinger. Server secrets remain excluded. No usable hosting account access has been supplied, so the app has not been published. See `HOSTINGER.md` for upload steps and add server keys before payment/upload acceptance. The local build does not certify business launch readiness.

Verification on 12 October 2026: lint, types, 50 unit/database tests, all 10 browser flows, final standalone packaging and the live-database production smoke test passed. Launch configuration still correctly reports missing service-role/payment keys and the local HTTP origin. Local `.env.local` deliberately retains the loopback origin; the host must use the canonical HTTPS origin.
