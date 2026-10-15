# E-Edge Direct 2U

A responsive ecommerce marketplace built with Next.js 16, React 19, TypeScript, Supabase PostgreSQL/Auth/Storage and Paystack. The storefront, administration, Theme Studio, inventory reservations, merchant allocations and delivery workflow share one application.

**Owner setup:** [Start here](docs/START-HERE.md) for Hostinger's GitHub connection, administrator sign-in, product uploads and app installation.

**15 October release:** [Foundation release report](docs/PHASE-1-RELEASE.md) covers the deployed company/field workspaces, platform-owner MFA, official branding, verified installers, tests and remaining integrations. New-company commerce and delivery remain gated until their complete tenant migration.

## Run locally

Use Node 24 and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000 for the storefront and http://127.0.0.1:3000/admin/theme for Theme Studio. Without Supabase credentials, development on loopback uses a labelled SQLite sandbox administrator. Data persists in `.data/edgedirect2u.sqlite`; the eight catalogue products and merchant images are development fixtures. Local demo mode never initializes live payments. Login and persistent uploads clearly request service configuration.

Copy `.env.example` to `.env.local` when connecting services. Never commit real credentials. `LOCAL_DEMO=false` disables the sandbox; production always disables it, regardless of this value. The dev server binds to loopback. Production without services exposes an empty setup state and denies administration.

## Implemented

- Responsive discovery, autocomplete, categories/subcategories, filters, product galleries/options, brand and merchant pages, device-local wishlist/cart, checkout and account screens.
- Theme Studio with actual storefront iframe previews, editable presets, design tokens, branding uploads, draft isolation, confirmed publication, version history, rollback and unsaved-change protection.
- Validated management forms for products, categories, merchants, campaigns, coupons, policies, suppliers, procurement records, warehouses, drivers, returns, reviews and settlement records.
- Transactional stock reservations, integer-kobo totals, server prices/options, idempotent checkout, multi-owner allocations and audited adjustments. Product editing cannot overwrite inventory.
- Server Paystack initialization and trusted verification, signed/idempotent charge webhooks, persisted payment initialization recovery, bounded refund requests, provider refund processing and status reconciliation.
- Merchant-isolated products, stock, store profiles, orders, commissions and settlement history; authenticated driver dispatch, recipient confirmation, failure reasons, availability, navigation and event timelines.
- RLS on every base table, scoped RPCs, secure cookie refresh, private no-store responses, SEO metadata/sitemap, installable online driver shell and offline reconnect screen.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Run the isolated browser verification:

```sh
npm run test:e2e
```

Browser tests start their own isolated sandbox on port 3100 and explicitly disable live service credentials. They use installed Chrome locally and Playwright Chromium in CI. To use Playwright Chromium instead, change `channel` in `playwright.config.ts` and install that browser. Tests cover storefront/search/variants/wishlist, reservation checkout, theme draft/publish/rollback, mobile overflow, admin screens, recovery screens, saved-address autofill, cross-tab cart updates, CSP enforcement and service/access errors. They mutate the local sandbox and restore theme state; use a disposable development database, not production credentials.

The 50 business/provider/PostgreSQL/storage/auth tests execute all migrations and cover RLS, stock, allocations, duplicate webhooks, refund claims, driver proof and payment initialization. PGlite simulates Auth/Storage schemas; provider responses are mocked. Real hosted sessions, Storage, Paystack and cross-connection load testing still require staging acceptance.

## Guides

- [Web app, Android APKs, Windows installer and administrator access](docs/APPS.md)

Deploy this repository from Hostinger's GitHub integration using the `main` branch, Next.js, Node 24, install `npm ci --include=dev`, build `npm run build:hostinger`, and start `node --use-system-ca .next/standalone/server.js`. The build prepares public Supabase/domain defaults from `config/hostinger-public.json`. Private service/payment keys remain host environment settings. See the Hostinger guide for domain, authentication and acceptance checks.

- [Connected project and remaining launch steps](docs/LAUNCH.md)
- [Supabase and migrations](docs/SUPABASE.md)
- [Paystack and finance](docs/PAYSTACK.md)
- [Hostinger Business, domain and HTTPS](docs/HOSTINGER.md)
- [Administrator and operations guide](docs/ADMIN.md)
- [Architecture, verified scope and remaining work](docs/STATUS.md)

`npm run check:env` validates required launch values. `npm run build:hostinger` builds and packages standalone assets when that Hostinger workflow is needed. `npm run check:production` verifies that package against the configured services. On Windows, `powershell -NoProfile -File scripts/package-hostinger.ps1` prepares a verified source ZIP for Hostinger upload without local secrets or generated output. `npm run seed:generate` regenerates the development seed from typed fixtures and refuses to overwrite an existing default-theme migration; do not change deployed migration history.

## Source layout

`src/app` contains server pages and APIs; `src/components` contains shared storefront and workspace UI; `src/lib` separates validation, tokens, data access, local transactions and provider integrations. `supabase/migrations` owns production schema/RLS/RPCs. `supabase/seed.sql` is development-only. `tests` includes business, PostgreSQL and browser verification. `public` contains locally served fonts and driver shell assets.

## Launch status

**14 October 2026:** live at https://edgedirect2u.vercel.app and https://maroon-mink-604054.hostingersite.com, sharing Supabase data. Vercel automatically deploys GitHub `main`; Hostinger currently uses the verified source ZIP. Server-only Supabase and live Paystack keys are configured privately on both hosts. Live database health, protected management APIs and signed no-op webhooks passed; no real payment or refund has been performed. The confirmed owner can sign in at `/login`, upload products at `/admin/products` and receive stock at `/admin/inventory`. Signed driver/store APKs and an unsigned Windows x64 store installer are published in v1.0.1 and load the live Vercel app. Both APKs passed a live-page emulator check. Supabase email-link settings, Paystack dashboard routing and business acceptance remain commissioning steps. The requested custom domain needs registration. Use [START-HERE.md](docs/START-HERE.md) for access.

The supplied Supabase project has eight applied migrations and a working reservation-expiry schedule. The confirmed account `olasodechukwudi@gmail.com` has administrator access, with role-specific sign-in destinations. Hostinger's build includes the public connection to the same database; server secrets must be set privately on each host. Add actual product data and business policies before accepting orders. Advanced warehouse transfers, automated payouts, notification delivery, dark appearance and merchant staff workflows are outside this release; details are explicit in the status guide.
