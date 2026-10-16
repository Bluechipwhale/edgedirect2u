# Former-store customer migration

The owner authorized copying customer records from `edgedirect2u.com.ng` into the new Supabase app. The old admin's customer export did not start, so the authorized customer list was collected page by page into an ignored, private JSON file. Each record contains the former ID, name as displayed, email, phone, route, old order count, and the old site's verification flag. The old list visibly shortened 770 names with `...`; those records are flagged for review rather than inventing a full name from the email. One old name is blank. No password or payment credential is included.

Migration `018_customer_migration.sql` creates a private `legacy_customers` directory. Browser roles have no direct table privileges. Administrators can search and page through it at `/admin/customers` and download a CSV there; other staff and customers cannot list or export the imported contacts. The CSV escapes spreadsheet formulas and is served with private, no-store headers. Old account status and order counts are marked as historical data. The migration does not create a new Auth user, paid order, wallet balance, or notification.

After applying the migration, dry-run the private import with:

```powershell
node scripts/import-legacy-customers.cjs --file=.data/legacy-customers.json --expect=3456
```

Check the aggregate counts, then add `--apply`. The importer requires the full expected number of distinct former IDs, refuses conflicting duplicate IDs, preserves existing rows without overwriting them, and inserts under one PostgreSQL transaction with a deployment lock. If direct PostgreSQL is unavailable, append `--rest` to use resumable verified HTTPS batches through the private Supabase service key; those batches are independently committed, so rerun the same command if an interruption occurs. It logs only counts and a SHA-256 of the source file. The raw export stays under the ignored `.data` directory and must never be committed.

On a later sign-in, a customer can link one imported record only when the former store marked that record verified **and** the person independently confirms ownership of the same unique email in Supabase. Ambiguous, missing or formerly unverified emails remain unlinked for administrator review. A complete old address is copied into that customer's saved addresses only after this verified match. Former-store status alone never grants new-site sign-in. Existing passwords cannot be transferred; customers choose their own password on this site.

Reconcile the imported total and representative records against the former admin list before calling the transfer complete. Old orders, historical payments, and old password hashes are outside this customer directory transfer.

On 16 October 2026, all 3,456 collected records were inserted under one transaction. An independent database check matched all 3,456 source-row checksums and confirmed the admin directory and CSV each contain 3,456 records. Of these, 3,200 were marked verified on the old site and 256 unverified; 770 displayed names were shortened, one was blank, and four emails were missing or unusable. No new Auth users or messages were created. The applied migration ledger has no pending files.
