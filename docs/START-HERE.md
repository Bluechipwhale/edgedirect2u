# Use your E-Edge Direct 2U website

The primary website is **https://edgedirect2u.com**, hosted on Hostinger. The backup is https://edgedirect2u.vercel.app. Both use the same Supabase database. GitHub `main` automatically deploys Vercel; Hostinger currently uses the prepared source ZIP. Do not create a second database or re-import the customer file for a website deployment.

## Administrator access

Sign in at https://edgedirect2u.com/login?next=/admin using **olasodechukwudi@gmail.com** and your own working password. Use the site's Forgot password flow if needed. The password cannot be retrieved from the database.

- `/admin/products`: search the complete catalogue by name, brand, slug or ID; filter published, draft and deleted products; edit any inventory owner's product, photo, price, description, variants or publication status. Delete is reversible and retains order/stock history. Restore appears in the Deleted filter.
- `/admin/inventory`: receive or remove real stock through an audited adjustment. Reserved stock cannot be removed.
- `/admin/customers`: search and export the **3,456** contacts imported from the previous `.com.ng` store. Imported contacts are private. Each returning customer chooses their own password and independently confirms their email to claim an eligible record. Old passwords, payment records and historical order totals were not imported into new-site financial reports.
- `/admin/reports`: filter reporting dates and export new-site sales, payment, refund, store, customer and delivery figures as CSV. Legacy sales remain separate until transaction records are reconciled.
- `/staff`: role-scoped stock, accounts and van-sales workspaces. PZ client access is limited to its configured product scope.
- `/admin/theme`: preview and publish website branding changes.

The researched catalogue contains **250 inactive product drafts**. Review each selling price, photo, variant and pack before publication, then record physical stock. Retailer availability is not your warehouse inventory. Public visitors can browse published products; checkout requires sign-in.

The separate platform-owner control plane at `/platform` requires your own verified authenticator session through `/platform/security`. Company settings include the business address. Never share your authenticator QR or codes.

## Customer research workbook

The editable workbook is `outputs/fmcg-2026-10-15/Nigeria-FMCG-Retail-Prices-2026-10-15.xlsx`. It contains 260 retailer listings across ten categories, 75 brands, exact packs, source URLs, observed availability and verification dates. Its summary formulas, filters and category counts were checked. Observed retail offers can change after the stated research date.

## Install the apps

Open https://edgedirect2u.com/apps or the [v1.0.2 GitHub release](https://github.com/Bluechipwhale/edgedirect2u/releases/tag/v1.0.2) for the store APK, driver APK, Windows x64 installer and checksums. These clients load the live web application and retain server-side permissions. The Windows installer is unsigned. Android packages use the project's release signing certificate.

Driver users need an authorized driver account and assigned jobs. Native GPS execution and offline synchronization are outstanding; the installer alone does not prove a completed real delivery. See [PHASE-1-RELEASE.md](PHASE-1-RELEASE.md) and [APPS.md](APPS.md) for their verified scope.

## Deployment and remaining commissioning

Recreate `artifacts/hostinger-source.zip` with `powershell -NoProfile -File scripts/package-hostinger.ps1`. In hPanel, open **Websites → edgedirect2u.com → Deployments → Redeploy → Upload new files**, select the newly generated ZIP, and save/redeploy. Using **Use previous files** rebuilds the previous archive. Verify the customer directory and product controls after every release, in addition to `/api/health`.

Hostinger settings are Next.js, Node 24, build command `npm run build:hostinger`, output `.next`, and `HOSTNAME=0.0.0.0`. Keep Hostinger's assigned port and existing private server keys. Read [HOSTINGER.md](HOSTINGER.md) before changing deployment settings.

Hostinger SMTP for `info@edgedirect2u.com` is configured; the owner confirmed recovery email delivery. The shared Paystack webhook still points to the existing Nexzek WooCommerce integration. Shared routing and real payment/refund acceptance remain outstanding. The four additional staff mailboxes remain pending at the owner's request; do not buy a subscription without approval.

Full legacy feature parity is still in progress. The detailed function checklist is [LEGACY-PARITY.md](LEGACY-PARITY.md). Wallet balances, loyalty liabilities and historical sales must be reconciled before they are presented as new-site financial data.