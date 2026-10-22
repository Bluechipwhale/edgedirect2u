# Operational access and commissioning

Use https://edgedirect2u.com/workspaces to open the tools permitted for the signed-in account.

| Portal | Purpose |
| --- | --- |
| `/` | Public product browsing; sign-in is required at checkout. |
| `/admin/products` | Search all owners and drafts, edit product details, Naira prices, previous prices, photos, gallery and structured variant options; delete reversibly and restore. |
| `/admin/inventory` | Record stock adjustments with a reason and preserve reserved stock and ledger history. |
| `/admin/customers` | Private imported account history and links to the operational outlet editor. |
| `/admin/outlets` | Company-authorized customer names, contact details, addresses, approved GPS positions, routes and visits. Imported account history remains a separate record. |
| `/admin/team` | Approve staff access and send setup links to working email addresses. Recipients choose their own passwords. |
| `/staff` | Role-scoped warehouse, accounts, van sales and supplier-client tools. |
| `/field/e-edge-direct-2u` | Assigned outlet visits, GPS verification, task reports and field exports. |
| `/driver` | Assigned delivery work; van salespeople are directed to their field workspace. |
| `/company/e-edge-direct-2u` | Company team, policies, field operations and branding. |
| `/platform` | Separate platform-owner access protected by MFA. |
| `/apps` | Current Android and Windows installers. |

The owner can edit operational outlets only with an active company administrator or supervisor membership. Opening an admin URL never grants permission. Supplier clients retain their supplier-only reporting scope. Stock is adjusted through the ledger rather than overwriting historical quantities in the product form.

## Verified clock-in

1. Open the assigned field workspace in the Driver app or Android Chrome.
2. Select the correct outlet and stand at its entrance, preferably outside.
3. Enable phone Location. In Android Settings → Apps → Chrome → Permissions → Location, allow access while using the app and enable precise location. Allow Location in Chrome’s permissions for this website as well. For the installed Driver app, use that app’s Android permissions instead.
4. Tap **Use my location & clock in** and wait for confirmation. Temporary GPS acquisition errors are retried within the 30-second capture window.
5. The flagship boundary is 100 metres. GPS accuracy must be 50 metres or better, and reported distance plus uncertainty must fit inside the boundary. A ±400-metre reading cannot verify presence at the outlet.
6. If accurate GPS places the driver outside the saved outlet position, submit a location for manager review. This does not clock in or move the outlet automatically. Managers must check and approve corrections.
7. Complete the visit report before starting another visit. An unfinished visit from an earlier day remains available through **Continue visit**, including when it is older than the recent-history window. Test outlets are excluded from performance figures.

Location is captured on request; the app does not use background tracking or invented fallback coordinates. The controlled browser tests use sample coordinates and never create live attendance.

## Slow or interrupted connections

Admin catalogue changes, field actions, inventory/delivery actions and driver availability have bounded save requests. A timeout can occur after a server has saved the request: refresh and check the current record before retrying. The app never automatically repeats a mutation. Product editing stays disabled while refreshed records arrive, preventing an immediate re-open of stale values.

## Acceptance still required

Technical checks do not replace a real phone GPS visit, a commissioned paid checkout/payment confirmation/refund, and a registered delivery driver's completed delivery. Pending staff must accept their invitation using working mailboxes. Outlets with missing GPS require verified capture before clock-in. Configuration presence alone does not prove these business workflows have been commissioned.

The production database, authentication and uploaded assets remain on Supabase. Hostinger serves the web app, with Vercel as the backup web deployment. Public GitHub backups exclude customer records, authentication secrets and private signing keys.
