# Migration acceptance and execution record

Date: 26 October 2026. Allowed outcomes: **PASS**, **FAIL**, **BLOCKED**, **NOT APPLICABLE**. Baseline results apply to existing hosts, not the unprovisioned WhoGoHost environment. Keep raw responses/logs/customer identifiers private.

## Executed baseline and preparation checks

| Check | Status | Evidence / limit |
|---|---|---|
| GitHub source/clean starting tree | PASS | Both main and prior branch at `84f5704`; isolated migration branch created |
| Local source/config/development DB backup | PASS | Private manifest, seven files; Git bundle verifies. Not a remote server/Supabase backup |
| Existing-host route checks | PASS with retry | 144 distinct requests across Hostinger/Vercel; 143 initial passes, one transport error. The same product page then returned 200 on both hosts. Raw baseline and targeted retry record retained privately |
| Supabase public theme/categories/catalogue | PASS | `node --use-system-ca scripts/check-services.cjs`; 19 categories, 137 active products |
| Supabase anonymous private profiles/dashboard RPC denial | PASS | Existing public-client access checks; not an exhaustive review of every policy |
| Supabase scheduled jobs | PASS | Dedicated read-only audit: reservation expiry every five minutes and location retention daily; both active, latest statuses succeeded. No schedule was changed |
| Current business readiness | BLOCKED for full launch acceptance | Read-only counts: 128 purchasable products, zero registered delivery drivers, one active field agent, 2,003 active outlets missing GPS; most approved staff roles remain unregistered. Migration does not fix or fabricate these records |
| Production dependency advisory check before patch | FAIL | npm audit reports critical Next 16.4.0 advisories; isolated 16.4.3 candidate patch is being prepared. Existing live versions remain unchanged |
| New hosting preflight / lint / types / patched production dependency audit | PASS | Six preflight tests pass on installed Next 16.4.3; lint/types pass; npm audit reports zero vulnerabilities |
| Legacy .com.ng domain | NOT APPLICABLE to cutover | Its homepage timed out during an initial read; owner subsequently confirmed it is outside this migration. No change will be made |
| Complete provider DNS export file | BLOCKED | Exact 12-record inventory, DKIM and configured TTLs inspected in authenticated Hostinger UI. The separate export download was declined; owner must obtain it manually. DNSSEC/DS status pending |
| WhoGoHost deployment acceptance | BLOCKED | Separate Node 24.21.0 production-mode preview app created; activated npm/Git, private source clone and clean dependency install pass. CPU 200%, RAM 2G verified. Actual build/start/restart/trusted HTTPS acceptance pending |
| Physical phone clock-in baseline | PASS (historical) | Owner confirmed “Clock-in confirmed” on Timothy's Android Chrome on 22 October 2026. Does not verify a new host/origin |
| Custom WebSocket server / background queue worker | NOT APPLICABLE | None found in application source; existing scheduled tasks run in Supabase |

| Full local suite after patch | BLOCKED by local resources | 133/159 tests completed before four worker out-of-memory exits while lint/types ran concurrently. No assertion failure was reported. A complete isolated/Linux run is required before acceptance |
| Source rollback rehearsal | PASS | Separate private Git clone reproduces the saved package file hash; development snapshot quick_check is OK |
| Authoritative website/mail record inventory | PASS for inspected zone | Twelve records, exact ALIAS/CNAME/TTLs and three DKIM records recorded from authenticated Hostinger UI; separate export-file download was declined and remains manual |
| Full patched Linux CI | PASS | Final application-code commit `091c49a`, Actions run `40372928179`: clean install, lint, types, 163 unit tests, zero production dependency vulnerabilities, 29 browser tests, Webpack standalone build and root-entry smoke all pass. Earlier optional-lockfile, editable-copy smoke and test-only environment typing failures were corrected |
| Preview-only DNS | PASS | Owner explicitly approved preview A → 102.68.97.69, TTL 300. Saved record and public resolution verified; main domain, www, nameservers and mail records preserved |
| Actual WhoGoHost Linux build | PASS | Private checkout at `9e64245`; locked installation and Webpack standalone build completed within the purchased account's limits, public-only build environment |
| Trusted preview TLS / public routes | PASS | Automatically renewed valid certificate for preview; 72/72 preview requests pass, including catalogue, product/category pages and portal sign-in routes. A provider placeholder masking `/` was moved into a private backup |
| Private credential placement | BLOCKED | Owner approved private runtime keys, but the browser upload security gate declined transfer. No key was uploaded or entered into the panel table. Owner-only destination exists with mode 700; manual upload, mode 600/hash verification and path configuration remain |
| Managed restart and anonymous security | PASS | New-host app survived manager restart; 36/36 targeted checks pass for public rendering/health, CSP/TLS headers, private file denials, protected APIs, portal sign-in guards, anonymous checkout denial and client assets without the supplied server keys. This is not authenticated/financial acceptance |
| Actual browser bag and sign-in | PASS | Product added locally, quantity changed 1→2, subtotal recalculated, refresh retained two items, checkout opened same-origin `/login?next=/checkout` with saved-bag message. Temporary browser bag then cleared. Staff opened same-origin sign-in. No order/reservation or account created |
| Preview startup-entry rollback rehearsal | PASS with limited scope | Previous `9e64245` startup entry restored temporarily through private backup, managed restart returned health 200, current `5de82f6` entry then restored byte-for-byte with clean source diff, restarted, health and homepage 200. No full release-bundle or database rollback claimed |

## Remaining WhoGoHost acceptance cases

### Separate email routing repair

On 26 October 2026 the owner reported a Hostinger `550 5.1.1` bounce for a staff mailbox already created on WhoGoHost and requested direct delivery. The email-only A/MX/SPF/DKIM repair is saved and verified at the authoritative nameserver, Google DNS and Cloudflare DNS. WhoGoHost local delivery is enabled; SMTP 465 and IMAP 993 TLS certificates verify. Approved Olawale-to-info delivery passed with actual Inbox receipt, and Olawale-to-owner-Gmail delivery passed with relay logs plus the owner's confirmation of receipt. The owner replied from Gmail; actual incoming receipt remains pending as of 23:57 Lagos. Do not mark the incoming direction PASS based only on DNS or the owner's send action. See [EMAIL_ROUTING_UPDATE.md](EMAIL_ROUTING_UPDATE.md). Website cutover remains blocked independently.

Create a row per case with release hash, target origin, time, evidence and corrective action. Do not mark these PASS using the old site's result:

| Area | Cases and required evidence |
|---|---|
| Public store | Home/nav; list/details; search/sort/filter/category/pagination; images/fonts/icons; product deep links and refresh; desktop/mobile browser screenshots and no console/network errors |
| Cart | Add/change/remove; refresh persistence on the same origin; unavailable stock; checkout sign-in requirement; isolated test checkout intent retained after return |
| Auth | Owner/customer/staff sign-in and sign-out; session refresh and restart; email confirmation; password recovery form and success state; callback origin; MFA under account owner's control |
| Permissions | Admin can edit/archive/restore product and edit real outlet details; merchant scope; warehouse/accounts/IT role scope; PZ client sees/exports only PZ; one driver's/agent's assignments cannot leak to another |
| Commerce | Test-mode success/decline/pending/abandonment/expiry; single and mixed-merchant allocations; stock reservations/release; order status; duplicate callback/webhook idempotence; amount/currency/reference validation |
| Refunds | Isolated test refund, ambiguous submission handling and repeated status verification; no duplicate reimbursement or silent stock return |
| Notifications | Owner-approved test recipient only; registration/recovery emails received; inspect actual Supabase template destination and same-origin session completion |
| Media | Authorized PNG/JPEG/WebP upload into test namespace, size/type failures, asset download after restart; anonymous upload and SVG denied |
| Field/driver | Android Chrome and installed apps if affected; 100 m rule with accurate fresh GPS; outside-radius/stale/poor-accuracy denial; continue unfinished visit; clock-out; assigned/visited metrics and exports; delivery assignment/status with a registered test driver |
| Hosting | Linux native modules; public assets; proxy TLS/Host/Origin; secure-cookie behavior; raw-body webhook; requests under upload/time limits; managed restart/idle wake; writable cache/logs; representative load within measured quotas |
| Security | Anonymous API denials; every tested role scope; HTTP-to-HTTPS behavior; private no-store/CSP/geolocation headers; no public `.env`, Git/config, source or dependency files; supplied private keys absent from HTML/JS/artifact/logs; production dependency audit |
| Recovery | Previous staged release restored through actual runner; repeat core tests; preserve data written during trial; exact DNS rollback table reviewed |

Live Supabase behind a staging host is still production data. Financial, invitation, upload, stock and CRUD mutations require isolated test fixtures or an approved separate test project. Do not copy production customer data into a test project merely for convenience. Do not create live charges, unsolicited emails, role grants, customer modifications or fake GPS records during baseline checks. No staging Paystack test key or dedicated test accounts were supplied in this task.

## Go/no-go checklist

- [x] Actual WhoGoHost plan supports the project's Node 24 runtime and accepted standalone startup method for the public preview.
- [x] Maintained patched release builds on matching Linux, production audit is clean and 163 unit/29 browser tests pass. Public client assets pass the supplied-key scan; repeat checks after private runtime configuration.
- [ ] Private app directories, managed lifecycle, correct origin/port, limits, trusted TLS and restart verified.
- [ ] Complete old server/config/zone backups and source recovery rehearsal recorded.
- [ ] Every applicable staging case above is PASS or an explicitly accepted, documented limitation; no FAIL or unreviewed BLOCKED item is hidden.
- [ ] Payment shared-event routing/acceptance, mail receipt and native-domain behavior are explicitly resolved for the chosen scope.
- [ ] Exact old/new website DNS records, mail dependencies, Auth callback/template settings and rollback triggers reviewed.
- [ ] Owner explicitly approves production cutover; existing Hostinger, legacy site and Vercel remain available.

Current decision: **NO-GO for cutover. Continue safe preparation; verify the actual DirectAdmin Node runtime and staging facts. Keep edgedirect2u.com as the final domain, per owner confirmation; leave .com.ng untouched.**
