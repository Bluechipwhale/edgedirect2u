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

Legacy customer source integrity: 3,456 distinct IDs and matching per-record checksums were verified after import. The old list shortened 770 displayed names, has one blank name and four unusable/missing email addresses. These facts are marked in the private records; they are not silently filled with invented values. The old site's *VERIFIED* label is retained as historical data. Only an old-verified record with a unique email can link after that person confirms the same email in Supabase. Old orders, payment details, addresses not exposed in the list, and passwords were not migrated.

The outstanding rows are planned work, not live capabilities. Do not advertise full old-site parity until each workflow is implemented and tested against the old portal's behavior.
