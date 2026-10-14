# Implementation status and architecture

## Live deployment verified 14 October 2026

The storefront is published at https://edgedirect2u.vercel.app and connected to GitHub `main` for automatic deployments. The homepage, database health, app downloads and Android association file returned HTTP 200. The confirmed owner account has the admin role. Supabase service credentials and the owner's valid live Paystack key are set privately on Vercel. A correctly signed no-op event returned `received: true` from the deployed webhook without changing orders or charging money. The database reservation scheduler's latest three runs succeeded.

GitHub verification passed for commit `8775c37`: lint, types, 50 unit/database/provider tests, 13 browser flows, production dependency audit and standalone build. Native build run `38624044098` passed Android tests, emulator launch, Windows build/renderer smoke and release publication. Release v1.0.1 contains both signed APKs and the unsigned Windows x64 installer; all load the live Vercel origin.

Hostinger is also live at https://maroon-mink-604054.hostingersite.com. The successful build uses source commit `3869d29`, Node 24 and Webpack with the same Tailwind loader; archive paths and permissions are portable to Linux. Homepage, health, login, current downloads and app associations returned HTTP 200, signed no-op webhook returned 200, and unauthenticated management access returned 401. Desktop rendering was inspected in the browser. Both hosts share the database and have private server settings. Hostinger uses ZIP deployments; Vercel uses automatic GitHub deployments.

Published APK connectivity run `38627757860` verified the exact release checksums and rendered the live storefront and driver sign-in page in an emulator. Complete web verification also passed for `3869d29`, including the Hostinger Webpack build.

The current Supabase dashboard login shows different projects, so the owner must select the account that owns this project before email-link/SMTP configuration can be verified. Email confirmations are required and anonymous sign-in is disabled. Paystack dashboard webhook routing and real payment/refund acceptance remain unverified. No active products have been added. The requested custom domain was shown as available for purchase and is not serving the app. Earlier dated verification below describes the state on those earlier dates.

## Verification recorded 12 October 2026

Lint, standalone type checking and production compilation passed. Vitest passed **50 tests** across business logic, trusted provider handling and migration-backed PostgreSQL tests. Playwright passed **10 browser flows** against the isolated local sandbox, including mobile layouts, actual theme publication/rollback, recovery, saved addresses, cross-tab shopping state and injected-script blocking. No live payment or external app deployment was performed.

The packaged standalone server passed verification on loopback against the connected Supabase project. Live database health, storefront rendering, local fonts, nonce-based CSP, social image rendering and `/api/theme` returning 401 with private no-store headers were verified. Checkout returned 503 before creating a reservation while server/payment keys are absent. The verification server was stopped after these checks.

`npm audit --omit=dev` reports zero production vulnerabilities. Full audit reports five high development dependency findings originating in the unpatched `braces <=3.0.3` advisory through the Next ESLint plugin. The suggested automatic fix downgrades the Next lint configuration across major versions and was not applied. This toolchain finding is unresolved; review upstream updates before a release pipeline accepts untrusted glob patterns. [Published advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

## Architecture and business invariants

A modular Next.js application owns rendering and APIs. Supabase supplies production persistence and identity; Paystack holds payment credentials and processing. No managed hosting process owns durable commerce data on disk. SQLite is an intentionally loopback-only development adapter.

Published themes are loaded and validated on the server before the storefront renders. Invalid or unavailable settings fall back to typed defaults. Drafts and immutable published versions are separate. Theme preview messages require the expected origin and iframe source. Published data is currently read per request, so publication does not rely on a stale settings cache.

Checkout locks products in a stable order, revalidates options and stock, prices from authoritative rows, aggregates duplicate lines, creates a parent order/owner allocations and reserves units in one transaction. Money is integer kobo. Reservation expiry releases units; paid sale consumes them exactly once. Cached cart prices are estimates only. Inventory changes use a signed ledger adjustment and cannot remove reserved units.

Payment initialization claims are persisted. Ready URLs can be resumed; uncertain attempts require reconciliation. Charge application verifies amount/currency/success and deduplicates reference. Late paid references require a support reconciliation procedure. Refund claims are at most once; finalization independently validates the provider record and flags merchant finance entries for review. A timeout cannot safely trigger an automatic duplicate refund.

RLS and RPC checks protect customer records, merchant private accounts/allocations, assigned driver data and global theme publication. Admin/operations roles are separate from merchants and drivers. Service-role operations are not callable by browser roles. Auth user metadata never assigns privileged roles.

## Configuration work needed for launch

- Eight migrations are now applied to the supplied Supabase project. The selected confirmed account has administrator access. Configure Auth email templates and SMTP; verify authenticated Storage acceptance after adding service credentials.
- Configure Paystack test keys and HTTPS webhook; complete real payment/refund acceptance, then configure live keys.
- Validate multiple concurrent PostgreSQL connections, cookie session refresh, cross-merchant browser access and Storage upload policies against the real services.
- Configure Hostinger Node 24, canonical domain/HTTPS, environment values, backups and operational monitoring. Reservation expiry is scheduled inside Supabase; inspect its executions before launch.
- Supply approved product data/photography, accurate delivery fees, business policies and support contacts. Fixture photography is not a representation of stocked business goods.

Complete the remaining dashboard configuration and business acceptance against the actual services. Presence of credentials in Settings is not a readiness certification.

## Explicit scope boundaries

| Area | Current behavior | Further work |
| --- | --- | --- |
| Warehouse inventory | Product/owner stock and reservation ledger; location and procurement records | Per-location balances, transfers, itemized PO receipt automation, reorder alerts and reconciliation batches |
| Merchant fulfilment | Allocated order visibility; company operations coordinates readiness and dispatch | Per-allocation merchant fulfilment controls, staff invitations and merchant-scoped returns/performance reports |
| Finance | Commission ledger, refund processing/verification, external settlement records | Automated payout transfers, settlement balancing and refund commission reversals |
| Messaging | Editable notification configuration | Email/SMS provider, transactional sending, delivery receipts and retry queue |
| Customer accounts | Auth, display name, addresses, order status, returns and verified reviews | Device-synchronized cart/wishlist (saved-address autofill and email/password recovery are now implemented) |
| Driver shell | Installable manifest/icons, online jobs, availability, call/maps, recipient proof and timeline | Photo proof, GPS tracking, offline mutation queue and pickup-location modelling |
| Theme/CMS | Single editable hero, preset/style/layout/links, two scheduled home banners, text policies | Dark-mode rendering, hero carousel, richer page builder, maintenance mode and custom font uploading (social-sharing images are now implemented) |
| Reporting | Whole-database dashboard totals; recent orders/operational lists | Date-range reports, exports, complete pagination for operational records and role lists |
| Scale | Public catalogue paginates 12, management products 25, wishlist 100 | Sitemap splitting above 49,000 products and large public merchant directories |
| Abuse protection | Supabase Auth limits and database validation/RLS | CAPTCHA token UI for anonymous checkout and deployment-specific request limits |

The reusable management forms persist real records but do not imply that every advanced operational automation exists. No fabricated popularity, ratings, sales performance or shipping guarantees are displayed.

## Connected project update

The premium visual refinements preserve Theme Studio tokens and improve typography, product cards, forms, mobile spacing and reduced-motion behavior. Recovery and email confirmation routes, saved-address checkout, validated browser storage, cross-tab cart updates, per-request CSP nonces, social-sharing images, live database health, administrator readiness checks and CI verification are now included. The public Supabase API checks pass and no development products were inserted. See `LAUNCH.md` for the exact external steps that remain.

On 13 October 2026, the confirmed administrator was granted access and the Hostinger ZIP was updated with a generated public-only `.env.production`. Loading that exact archived environment through Next.js's environment loader successfully read the connected project's theme, six categories and catalogue. Anonymous private profiles and dashboard access remained denied. No active products exist yet. The source ZIP excludes all server secrets and the database password; it is ready for direct upload, but no Hostinger deployment or live payment acceptance has occurred.
