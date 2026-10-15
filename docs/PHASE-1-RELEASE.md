# E-Edge Direct 2U — foundation release, 15 October 2026

## Deployed

- Vercel: https://edgedirect2u.vercel.app
- Hostinger: https://maroon-mink-604054.hostingersite.com
- GitHub main: https://github.com/Bluechipwhale/edgedirect2u; pull request #1 merged at `c73d283`.
- Supabase: migrations 009–011 applied with verified TLS and migration checksums. No development catalogue or test accounts were inserted.
- Installers: https://github.com/Bluechipwhale/edgedirect2u/releases/tag/v1.0.2. The signed Android packages retain their original identities and certificate. The Windows installer is unsigned.

Both web hosts use the same live database. Hostinger currently uses the validated source ZIP; Vercel deploys GitHub main automatically. The requested custom domain is not registered or connected by this release.

## What is complete

The supplied official logo and orange, black and white palette are live. Storefront, admin shell, web app manifests, offline recovery and native client branding were refreshed. Theme Studio history is retained; flagship branding synchronizes with company branding transactionally.

The company kernel includes separate memberships, packages, activation, brand drafts/publication/history, field policies and audited mutations. Company-scoped foreign keys and row policies isolate stores, assignments, shifts and visits. Direct client table writes are revoked; fixed RPCs perform authorized changes. New-company commerce and delivery remain gated until their legacy domains have complete company isolation.

The field web workflow supports store registration, daily assignments, shift clock-in/out, policy-controlled location check-in, supervisor exceptions, evidence submission and visit history. Defaults are a 100-metre radius and 30-store daily target. Check-in never completes a visit. Location must be fresh, reported accuracy must be 50 metres or better, and the full uncertainty radius must fit within the store geofence. Task evidence becomes immutable after completion. Exact visit coordinates expire after 90 days through an active daily database job.

Company members can discover their authorized workspaces at `/workspaces`; sign-in preserves an explicitly selected workspace. Daily totals come from row-policy-protected database aggregates, while list downloads remain bounded and today's work is prioritized.

## Access and daily use

The confirmed account `olasodechukwudi@gmail.com` retains company administration and now has a separate, audited platform-owner grant. Platform permissions require verified MFA; the grant alone cannot open the control plane with a password-only session.

1. Sign in at https://edgedirect2u.vercel.app/login?next=/platform/security using your existing account password.
2. Continue securely, scan the private QR with your own authenticator, and enter its current code. Keep the setup QR and codes private.
3. Platform owner: `/platform`. Flagship company: `/company/e-edge-direct-2u`. Field work: `/field/e-edge-direct-2u`.
4. Upload actual products at `/admin/products`, then receive stock at `/admin/inventory`. There are no active products yet; production was not populated with sample merchandise.
5. For field work, add confirmed team accounts, register store coordinates, and assign stores for the required Lagos date. Agents clock in and submit completed task reports. Browser check-in remains disabled until a company admin explicitly permits it.

Native launchers do not implement GPS execution. Use a policy-approved browser for the current web location workflow, or a documented supervisor exception where justified. An exception still requires the agent's completed task report.

## Verification

- 66 unit/database tests and 14 browser tests passed for the final application tree, including hostile requests across two isolated companies, MFA authorization boundaries, fresh/accuracy-aware geofences, supervisor exceptions, immutable evidence, retention and sign-in destinations.
- Lint, TypeScript, production dependency audit and Hostinger production build passed in GitHub run `38690924956`. Vercel production and Hostinger deployment completed successfully.
- Both live hosts returned successful storefront, database health, official-logo, installer hub and protected workspace pages. Unauthenticated platform mutation and MFA APIs returned 401. Private pages return no-store headers; geolocation is allowed only on the field surface.
- Live database checks confirmed the company-admin membership, blocked platform access at AAL1, revoked direct writes, aggregate counts, both active database jobs, and no pending migrations.
- Native build run `38690218111` passed Android unit/lint/signature/emulator tests and the Windows build/renderer check. Local installer downloads match GitHub SHA-256 digests.

## Work still required

This is the foundation and initial operational release, not completion of all seven applications in the master directive. Native GPS and device integrity, offline synchronization, photographs/signatures/OTP for field visits, routing optimization, push notifications and iOS builds are not implemented. Company-scoped catalogue/orders/inventory/payments, domains, billing, entitlement management and the remaining enterprise modules need subsequent phases. Existing flagship commerce remains available with its existing merchant isolation.

The owner must complete authenticator setup personally. Supabase dashboard ownership recovery and email-link/SMTP commissioning remain unresolved. The shared Paystack webhook still points to Nexzek's WooCommerce endpoint; it was not changed. Callback verification exists for E-Edge, but shared background webhook routing and a real charge/refund acceptance test remain outstanding. No real payment or refund was initiated during this release.

Read [PLATFORM-ARCHITECTURE.md](PLATFORM-ARCHITECTURE.md) for module dependencies and the migration boundary.
