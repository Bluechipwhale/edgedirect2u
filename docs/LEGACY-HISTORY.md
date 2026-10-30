# Former-store business history

On 29 October 2026, the owner's fresh DirectAdmin export of
`edged1r3ct2_directed` was parsed as data without executing its SQL.
Source SHA-256: `ab7b18861f5ad0e4d644441540cc02dee99d7e527bc10ddfaee1517206825abf`.

The isolated archive contains **67,861 records across 72 business tables**,
including empty tables. Important counts: 3,456 customers, 3,445 shipping
addresses, 51,844 order headers, 5,709 order lines, 241 inventory headers,
860 inventory lines, 656 driver-route rows, 31 route definitions, 39 pickups,
24 delivery staff records, 27 contact messages and 120 historical subscriber
records. Old subscribers were not enrolled in a new mailing list.

## Access and exports

Administrators can use `/admin/history`, choose a source table, search and page
through its records, expand all retained fields, and export matching rows to CSV.
Exports pin the verified snapshot and stream bounded pages. Missing or inconsistent
pages fail the download. Signed-out visitors are directed to sign-in; other staff,
supplier clients and anonymous users cannot read this archive. Browser roles have
no direct table grants. The SQL function checks the administrator role itself.

## Reconciliation and preservation

The original database has **49,043 order headers without item lines**, **19
orphan item lines**, and **256 orders referencing absent customers**. Only 2,801
headers have matching lines. The 5,709 lines refer to 2,814 distinct IDs, including
13 absent headers. These source gaps were retained, not repaired with invented
sales. There are no `order_transactions` processor receipts in the export.

Historical payment labels and balances are source claims. They do not become
current verified revenue, payments, wallet balances, refunds or liabilities.
No old order was replayed, no stock was deducted, and no login or email was created.
The existing 3,456 live imported contacts, 3,457 outlets (including the GPS test
outlet), 231 catalogue mappings, current product edits and new-site orders were
preserved. Import verification compared complete archived field values and the
protected live-table fingerprints in one consistent transaction.

Passwords, access/reset tokens, payment-card fields, staff identity/bank details,
authentication tables and runtime credentials were excluded. Old settings and PHP
code do not replace the new application's configuration or role system.

A separate, owner-only WhoGoHost archive under
`/home/edgedire/.cache/business-data-migration-20261029/` holds checksummed JSON,
a read-only-queryable SQLite copy and **599 business images** from the former
product, brand, category, company, banner, notification and shop folders. Original
filenames and bytes are retained (315 JPEG, 232 PNG, 52 WebP despite their `.png`
filenames). These images are privately archived and do not replace current logos
or administrator-selected catalogue photographs. Old source data remains intact.

Private receipts and destination backups are ignored by Git under
`.data/business-data-migration-20261029/`. Do not place exports, database backups
or mail data in public folders, Git, or source-release archives. The Vercel
project/deployment and website/email DNS are not part of this operation.
