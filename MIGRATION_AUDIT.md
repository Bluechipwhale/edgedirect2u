# Edgedirect2u migration audit

Research date: **26 October 2026 (Africa/Lagos)**. Status: **WhoGoHost public preview deployed; NO-GO for production DNS cutover** until private runtime and authenticated acceptance are complete.

## Source and domains

- Repository: `Bluechipwhale/edgedirect2u`; GitHub `main` and the former working branch both resolve to `84f57046de04cc28eb7ad0c4346234830e7a3335`, verified this session. The working tree was clean before migration preparation.
- Migration branch: `codex/whogohost-cpanel-migration`, created from that commit. Production branches are unchanged.
- Current application: `https://edgedirect2u.com` on Hostinger; backup: `https://edgedirect2u.vercel.app`.
- **Owner clarification on 26 October: keep `edgedirect2u.com` as the final domain.** The pasted prompt named `.com.ng`, but that distinct legacy domain is outside this migration and remains untouched.
- The authenticated new service is **DA Web Hosting — Deluxe 30GB DA Web Hosting**, Active, attached to `edgedirect2u.com`. DirectAdmin's CloudLinux manager supplies verified Node 24.21.0, npm 11.19.0 and Git 2.43.7 on Linux x86_64/glibc 2.28. The preview builds and runs there; do not assume cPanel menus.
- The owner approved only `preview.edgedirect2u.com` A → `102.68.97.69`, TTL 300. Trusted HTTPS, private source checkout, public catalogue and managed restart are verified. Main-domain, www, mail and nameserver records are preserved.
- Additional owner instruction: **leave edgedirect2u.vercel.app untouched as the backup**. No migration merge to `main`, Vercel project/configuration/environment update or production redeploy is authorized.
- Hostinger deployment was freshly rechecked in hPanel: Completed/Current, 22 October 2026, 21:33:10. Its eight current environment values were exported privately from the visible table and then hidden again. Last recorded Vercel deployment: `dpl_FzN6K1BgpcoGh5SwRoctqbU3yf8P`, Ready. Today's GitHub source hash is verified; the current server filesystem/build hash still requires a remote file backup.

## Detected architecture

| Layer | Verified implementation |
|---|---|
| Web/server | Original Next.js **16.4.0**, migration candidate **16.4.3**; App Router, React/React DOM **19.3.0**, TypeScript 5; server components, `src/proxy.ts`, authenticated Route Handlers |
| Runtime | `package.json` requires Node **24.x**; local verification uses 24.11.0. Existing commands use `--use-system-ca`; use a maintained 24.x release supporting this flag, at least 24.6 |
| Build | npm, committed lockfile v3, Tailwind 4. Hostinger uses Webpack because of shared-host worker constraints. `experimental.cpus=2` limits workers, not total required memory |
| Output | `output: 'standalone'`; generated `.next/standalone/server.js`; existing asset packager copies `public` and `.next/static` |
| Backend | Existing hosted Supabase PostgreSQL, Auth, Storage, SQL functions/triggers and RLS; migrations 001–026 remain untouched |
| Development persistence | `node:sqlite` under `.data`, guarded by non-production + localhost + missing Supabase configuration. This is not the production database |
| Commerce | Catalogue/cart, registered checkout, stock reservations, Paystack redirect checkout, verified payments, refund requests/reconciliation, merchant and operational records |
| Staff | Admin, staff/client, company, field visits/routes and delivery portals. Existing role and company scope live in Supabase |
| Media | Shipped logos/fonts/icons plus external HTTPS product images. Admin uploads go to Supabase `brand-assets`, with `branding_assets` metadata; no production local upload directory was found |
| Native/PWA | Android Store/Driver and Windows WebView shell point to `.com`, allow the Vercel backup, and do **not** currently trust `.com.ng`. PWA caches an offline shell, not private pages/data |

This is neither PHP nor a static frontend. Static export would remove required server behavior. There is no separate Express backend to move; the Next.js process serves pages and APIs. No application-owned WebSocket server, queue worker, or active Realtime subscription was found in `src`; the bundled Supabase SDK alone is not evidence of Realtime use.

## Hosting-sensitive behavior

1. The verified CloudLinux-managed Node process starts `source/server.js`, which delegates to generated standalone output. Trusted HTTPS, core proxy/security headers and managed restart work. Authenticated sessions, private runtime credentials and sustained/idle behavior need their own acceptance. Do not introduce a custom Next server.
2. `NEXT_PUBLIC_SITE_URL` controls same-origin mutation checks, payment return URLs, Auth verification redirects, metadata, robots and sitemap. Build and runtime values must agree with the actual staged origin. Runtime changes alone do not replace public values already built into assets.
3. `config/hostinger-public.json` and `build:hostinger`/`build:vercel` intentionally default to `.com`. Use the new, explicit `build:whogohost` path; do not change existing production build defaults.
4. Preserve the existing www.edgedirect2u.com to apex redirect and certificate coverage on the new proxy. The owner retained .com; .com.ng routing is excluded.
5. Preserve forwarded HTTPS/origin headers, cookie headers, CSP nonces, no-store on private/API pages, 5 MB image uploads plus multipart overhead, streaming responses and raw webhook bodies. The field portal requires HTTPS and its existing geolocation Permissions-Policy. Do not broaden geolocation policy sitewide.
6. The approved production hostname stays `.com`, preserving native-app trust and browser storage scope. A separate staging hostname still has separate cookies/cart/geolocation permissions. No `.com.ng` allowlist/native change or new APK/EXE is required merely for this same-domain host move.
7. `supabase/templates/recovery.html` uses Supabase `SiteURL`. Merely adding a staging redirect allowlist does not prove recovery email opens staging. Inspect actual dashboard templates/settings; preserve the working `.com` recovery path until an approved identity cutover.
8. Keep Supabase Cron jobs in Supabase. Repository scheduling provisions five-minute reservation expiry and daily location retention. `vercel.json` contains no cron definition. The optional HTTP expiry endpoint requires a private `CRON_SECRET`; do not create a duplicate job.
9. No production customer data needs copying into cPanel/MySQL. Next cache/log directories may need writable space, but business records and uploaded media remain in Supabase. Do not upload SQLite fixtures or historic customer exports.

## Payment and email dependencies

The shared Paystack account's last verified webhook destination is the Nexzek WooCommerce endpoint documented in `docs/PAYSTACK.md`. Preserve it. This application's endpoint is `/api/payments/webhook`; the return/verification flow is separate. Shared automatic event routing and complete financial acceptance remain pre-existing commissioning work. Do not treat a signed no-op test as a purchase/refund test. Stage with a test key and isolated test data for financial mutations; never switch the shared live dashboard to test or replace its webhook as part of this migration.

SMTP is configured in Supabase, using the existing `info@edgedirect2u.com` mailbox. SMTP credentials do not need to be added to this Next.js runtime. Preserve Hostinger email hosting and all MX/SPF/DKIM/DMARC records. Current `.com.ng` MX targets its own `mail` hostname; its address and SPF also need preservation.

## Protection and evidence

Private evidence is ignored by Git under `.data/migration-20261026/`:

- `backup-manifest.json`: verified all-ref Git bundle, source ZIP, private runtime-setting copies, previous deployment records and a consistent **development-only** SQLite backup. The Git bundle can be restored in a separate directory.
- `dns-before.json`: read-only public DNS snapshot; `hostinger-dns-zone-before.json` adds the 12 authenticated original records, including website ALIAS/CNAME, DKIM and configured TTLs. A separate provider export download was declined and remains manual; DNSSEC/DS review is pending.
- `baseline-http.json`: 144 existing-host route checks; 143 initial passes and one transport failure, followed by successful targeted HTTP 200 checks on both hosts. See the test plan for scope and limits.

The live Hostinger environment export is additionally saved as `private/hostinger-live-runtime.json`; do not publish it. Remote Hostinger filesystem backup and Supabase backup/PITR availability still need provider verification. Local backups are not substitutes for those provider backups. The legacy `.com.ng` site is excluded and must not be changed. No database changes are proposed; no schema export, restore, credential rotation or storage mutation was performed.

## Decision and outstanding requirements

### Security finding and migration-branch changes

The 26 October production-dependency audit reports critical advisories for the original Next 16.4.0 pin. The maintainer's [image-optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Cache Components advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), and [Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) justify a patch. This is a version/advisory finding, not evidence of exploitation or proof all affected features are enabled. The migration branch pins Next 16.4.3 and updates its lockfile. No forced broad dependency upgrade, production redeploy or credential rotation is part of this preparation. Post-patch verification is tracked in the test record.

| Files | Reason |
|---|---|
| `package.json`, `package-lock.json` | Isolated security patch plus new opt-in WhoGoHost preflight/build commands; existing Hostinger/Vercel commands preserved |
| `scripts/hosting-preflight.cjs` | Reject incompatible Node, wrong/local public origin, public privileged keys and private dotenv build files; no provider writes/network calls |
| `tests/hosting-preflight.test.ts` | Validate unsafe deployment inputs are rejected without logging credential values |
| `server.js`, `scripts/smoke-production.cjs`, `.github/workflows/verify.yml`, `eslint.config.mjs` | Standard managed-host startup loader plus a Linux production smoke test; existing default startup preserved |
| `tests/managed-startup.test.ts` | Four startup safety cases: optional private file, correct absolute file loading, relative-path rejection and sanitized unreadable-file errors |
| The seven root migration Markdown files | Audit, account checklist, conditional deployment, variable inventory, mail-safe DNS plan, rollback and explicit acceptance record |

Application UI, route behavior, existing migrations, production environment values, payment dashboard, native binaries and mail configuration are unchanged. The only approved DNS addition is the isolated preview A record. Existing website records and Vercel backup remain intact.

The owner approved private runtime credentials, but the browser's file-upload security gate declined the transfer. The prepared local private file has not been uploaded; do not work around this denial through another browser, terminal payload or indirect transfer. The owner must upload it manually into the verified owner-only destination. Then verify its hash/mode, configure only its path and perform authenticated, email and isolated payment acceptance. Dedicated test fixtures/credentials, complete provider backups, DNSSEC review and explicit production cutover approval remain outstanding. Creating a paid plan, changing nameservers or cancelling hosting is not authorized automatically.

Complexity is **moderate**. The purchased plan demonstrably builds and runs the existing public app on Node 24. The same production domain avoids an unnecessary identity/native-app migration. A split static frontend/API deployment would require changes to this server-rendered same-origin application; it is not a drop-in alternative.

Use the confirmed setup in [WHOGOHOST_COMPATIBILITY.md](WHOGOHOST_COMPATIBILITY.md) and complete its remaining authenticated/private-runtime acceptance. Keep the live Hostinger app and untouched Vercel backup available. No purchase or live rewrite is authorized by this report.

Sources checked: [WhoGoHost Node hosting](https://www.whogohost.com/node-js-hosting) advertises Node hosting but lists legacy versions; it does not verify this account. [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/) requires host-enabled features. [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and installed Next.js 16.4.0 docs describe the Node/reverse-proxy deployment model.
