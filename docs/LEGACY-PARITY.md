# Legacy admin feature inventory

The old `edgedirect2u.com.ng/admin` menu was audited on 16 October 2026. This is the release checklist for the new `edgedirect2u.com` app. A matching menu label alone is not feature parity; each row describes the working behavior and the remaining gap. Old sales, wallet balances and loyalty liabilities are **not** included in new-site financial totals without verified transaction migration.

| Old portal function | New app status | New location / remaining work |
| --- | --- | --- |
| Dashboard | Working for new-site data | `/admin` shows live marketplace metrics. Historical old-site figures remain separate. |
| POS | Missing | Build an authorized counter-sale flow with stock and payment reconciliation. |
| Order queues: all, pending, confirmed, packaging, out for delivery, delivered, returned, failed, canceled | Partial | `/admin/orders` and `/admin/dispatch` handle new-site orders and delivery events. Add full status filters and the old exception workflows. |
| Refund requests and refund transactions | Partial | `/admin/refunds` and `/admin/reports` show new-site requests; complete approval/processor reconciliation and all queue filters. |
| Categories, subcategories, sub-subcategories | Partial | `/admin/categories` supports parent categories; add the third level and reordering. |
| Brand registry | Partial | Products retain brand names; add managed brand records and logo editing. |
| Product attributes | Partial | Product variant options are editable JSON; add a structured attribute editor. |
| In-house products, seller products, approvals | Working for new-site catalogue | `/admin/products` searches all owners, edits all rows, and provides reversible, audited delete/restore. `/admin/merchants` manages merchant approval. |
| Product bulk import | Missing | Add a validated preview-and-import workflow with row errors and duplicate handling. |
| Banners | Working | `/admin/banners` supports scheduled homepage campaigns. |
| Coupons | Working | `/admin/coupons` validates discounts at checkout. |
| Flash deals, deal of the day, featured deals | Partial | Featured flag and banners exist; timed deal pricing and merchandising slots remain. |
| Push notifications | Partial | `/admin/notifications` stores configuration; delivery provider and opt-in pipeline remain. |
| Announcements, customer messages, support tickets | Missing | Add public contact submission, staff inbox, ticket states and replies. |
| Earning, in-house and seller sales reports | Partial | `/admin/reports` has new-site payment, product, store and customer figures with CSV; add complete settlement/commission and historical views. |
| Order transactions and refund reports | Partial | Verified receipts and refund requests are exportable from `/admin/reports`; add ledger-level reconciliation and complete pagination. |
| Wishlisted products | Partial | Customer wishlist works; admin aggregation report remains. |
| Order and stock reports | Partial | `/admin/reports`, `/admin/inventory` and `/staff` show new-site data; add complete filters, low-stock thresholds and exports. |
| Customer list and export | Working for staged legacy contacts | `/admin/customers` has 3,456 private old records, search, paging and owner-only CSV. Customers regain access through independently confirmed new sign-in; no old password was copied. |
| Customer reviews | Working for new-site paid purchases | `/admin/reviews` moderates verified-purchase reviews. |
| Customer wallet and loyalty points | Missing | Requires reconciliation of old balances and liabilities before activation. |
| Seller add/list and withdrawals | Partial | `/admin/merchants` handles stores and approval; withdrawals/payout requests remain. |
| Subscribers | Missing | Build opt-in and unsubscribe records before any messaging. |
| Delivery staff add/list, pickups, feedback, schedules, sales by customer/product | Partial | `/admin/drivers`, `/admin/dispatch`, `/driver` and `/staff` cover authenticated drivers, jobs and van sales; scheduling, feedback and the old detail reports remain. |
| Delivery staff chat, withdrawals, emergency contacts | Missing | Add role-scoped messaging and contact records; no payout is initiated by this release. |
| Employees and custom role setup | Partial | `/admin/roles` and `/staff` assign predefined roles; granular custom permissions remain. |
| Business setup | Partial | `/admin/theme`, `/admin/settings` and company workspace cover branding, address and readiness; audit remaining legacy settings individually. |
| Third-party SMS configuration | Missing | Add a provider, credential storage and message audit when a service is chosen. |
| Pages, social links and gallery | Partial | `/admin/policies`, theme and media uploads exist; dedicated social-link and gallery managers remain. |
| System setup | Partial | `/admin/settings` checks production readiness; deployment configuration remains managed through Hostinger, Vercel and Supabase. |

Legacy customer source integrity: 3,456 distinct IDs were verified after import. On 17 October 2026, the owner's original database export restored the 770 shortened names and original address fields. It recovered three additional usable GPS pairs, giving 1,453 saved outlet locations; 2,003 outlets still need location verification. Every imported name and GPS pair was compared against the source with zero mismatches. One source name remains blank and four email addresses remain unusable/missing. Earlier saved locations and supervisor corrections are preserved. The private compressed export is checksummed and excluded from Git, builds and downloads; `scripts/inspect-legacy-export.cjs` reads data without executing MySQL statements. `scripts/enrich-legacy-customers.cjs` applies audited, transactional enrichment and creates no passwords or Auth users.

The old site's *VERIFIED* label is retained as historical data. Only an old-verified record with a unique email can link after that person confirms the same email in Supabase. Historical orders and payment records are not included in current revenue. The original export contains 51,844 order headers but only 2,814 distinct orders with detail rows, so historical financial import requires reconciliation. Old customer passwords are never copied.

The outstanding rows are planned work, not live capabilities. Do not advertise full old-site parity until each workflow is implemented and tested against the old portal's behavior.
## Daily VSR reporting and catalogue cutover — 18 October 2026

The field overview now separates assigned outlet visits, started visits, completed task reports, remaining stops, visit coverage and sales. Reports use Africa/Lagos dates, paginate all assignments and restrict field agents to their own company and identity. Managers can filter by agent and period. A daily target never creates visits: assign a regular route or one-day customer visits first.

CSV exports cover the complete filtered VSR report and outlet directory, all filtered admin products, orders with item lines, inventory, operational resources, stock movements, merchant ledger, refund requests, staff invitations/members and a delivery driver's own jobs. Exports retain authorization, neutralize spreadsheet formulas and reject detected pagination changes. Existing supplier-scoped business exports remain separate. Browser history cards still show only recent records; use the full report for complete filtered visit exports.

`scripts/import-legacy-products.cjs` plans and imports the owner's checksummed original catalogue only after explicit count validation. It retains exact Naira-to-kobo prices, independent per-SKU opening stock, pack qualifiers and old active/draft states. It creates one opening ledger entry per nonzero new SKU; re-runs preserve later admin edits and stock movements. Research benchmark drafts stay inactive. Four already-inactive products whose original category was deleted are labelled for category review. Unsupported minimum-order records remain inactive with original metadata retained privately. Original thumbnail or same-product gallery URLs are checked; missing images use a visible placeholder. No historical orders, passwords, revenue or wallet balances are replayed.

GPS route rollout, 18 October 2026: the owner authorized geographic grouping and Timothy Nuru's Ikeja allocation. Local distance clustering formed 62 named routes with 10–32 stops, covering 1,353 saved-GPS outlets, with pairwise diameter capped at 4 km. The other 2,103 outlets remain unassigned for location/sparse-area review (2,003 missing coordinates, 100 without a compact viable group). Shared coordinates are flagged for review; no location is invented or moved. The chosen `Ikeja — GPS Route 08` contains 25 stops, a 1.98 km maximum straight-line span and no large shared-coordinate group. Only this route was assigned to the confirmed salesperson; all other new routes await staffing. A source snapshot and previous route labels are retained in private platform audit. Numbered stop order uses nearest-neighbour plus 2-opt over saved GPS distances, not road travel time. Manual route/GPS edits clear stale ordering. Route summary, ordered stop and review CSVs are private local exports, excluded from Git and source deployments.

Catalogue reconciliation after cutover: 231 source products, zero price/stock/publication mismatches, 137 published, 128 purchasable. The 209 nonzero opening movements total 204,443 original SKU units; pack records remain independent, with no carton-to-piece conversions. All 250 benchmark research drafts remain inactive. Merchandising categories were assigned from explicit product names, retaining original categories as provenance. Photo preservation copies only verified original product images into the existing Supabase asset bucket and preserves later administrator edits. Product inventory is a cutover snapshot, not a continuous synchronization with the old portal.
