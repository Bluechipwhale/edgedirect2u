# Reversible deployment and rollback

Date: 26 October 2026. Production **website** cutover has not occurred. Hostinger's live app, Vercel backup and payment settings remain unchanged. The preview A record was added, and a later owner-requested email repair separately routed incoming mail to WhoGoHost. See [EMAIL_ROUTING_UPDATE.md](EMAIL_ROUTING_UPDATE.md). Preserve that current mail routing during any website rollback; restoring historical Hostinger MX would revive recipient-not-found failures for new staff mailboxes. A failed staging deployment needs no production website DNS rollback. The owner explicitly instructed that edgedirect2u.vercel.app remain untouched.

## Prepared recovery material

Private, ignored location: `.data/migration-20261026/private/`. Do not upload this directory to a public repository or document root; it contains configuration credentials and a development SQLite snapshot.

- Verified all-ref Git bundle and source archive at production-source commit `84f57046de04cc28eb7ad0c4346234830e7a3335`.
- Saved existing local private runtime configuration and previous deployment records; SHA-256 manifest in the parent directory. The eight actual Hostinger runtime values were additionally exported privately from the authenticated panel; remote filesystem restoration remains untested.
- Consistent SQLite backup through Node's database backup API. It is a development fixture and must never replace Supabase.
- Public DNS observations for both domains, with complete zone/provider backup still pending.

## Safe source recovery rehearsal

Only restore into a **new private directory**; never reset or overwrite this working checkout. Verify the bundle and clone its history, select the recorded commit, and compare key file hashes with the source archive/manifest. The private rehearsal result belongs in `.data/migration-20261026/rollback-rehearsal.json`. This validates source recoverability only, not account access, a remotely restorable runtime, database recovery or live DNS rollback.

## Staging rollback

1. Stop new staging changes and save redacted build/runtime diagnostics with release hash/time.
2. Disable or return only the **staging** app to its previous accepted release through the provider's supported runner, then verify it. Preserve failed release evidence privately.
3. Do not touch the production `.com` application, Supabase records, shared Paystack webhook or email DNS. Remove a test-only staging record/app only through a separately approved reversible action if needed.

## After an approved website cutover

1. Trigger rollback on unresolved 5xx/startup, failed TLS/Auth/payment verification, role/RLS regression, broken field clock-in, inventory inconsistency, or failed email routing. Stop further release changes and new test transactions.
2. Restore **only the exact saved website records** at the existing authoritative DNS provider, including prior AAAA/CNAME/alias behavior and reviewed TTLs. Preserve all mail/security records and nameservers. The approved target is `.com`: restore its exported Hostinger CDN/alias and IPv4/IPv6 configuration. Never substitute sampled CDN addresses. The `.com.ng` zone is unchanged and needs no migration rollback.
3. Keep the existing Hostinger `.com` installation and Vercel backup available throughout cutover and rollback; changing DNS is not permission to cancel hosting or remove files.
4. Restore any explicitly changed Auth site URL/callback configuration from its saved values while retaining required old callback paths; do not invalidate users, reset passwords or rotate keys. If no Auth change occurred, do nothing.
5. Verify restored website health, catalogue, real owner session, checkout initialization/verification using approved test data, existing order access, stock, driver/field pages and mail receipt. Check IPv4 and IPv6, multiple resolvers and cached clients. DNS caches may continue routing some traffic to the new host until expiry, so preserve both deployments during recovery.
6. Both apps share live Supabase. Reconcile transactions/stock/events created during the interval by their existing IDs. **Never restore an older database snapshot over newer orders**. An uncertain refund/payment requires provider reconciliation, not retry or data deletion.
7. Record cause, scope, timeline, corrective action and conditions for another attempt. Resume cutover work only after the owner reviews the incident and new staging evidence.

## Untested dependencies

The preview startup entry was rehearsed separately: restore the previously working `9e64245` entry, restart through the manager, verify health 200, restore the current `5de82f6` entry byte-for-byte, restart, then verify health and homepage 200. Private evidence is `preview-startup-rollback.json`. This proves the entry-file/runner recovery path only; no full runtime-bundle, authenticated-session, financial or database rollback is claimed.

Remote Hostinger file restoration and target-provider environment restoration, actual DNS changes, new-runner release switching, mailbox delivery and end-to-end checkout rollback are **BLOCKED** until account access and an approved rehearsal environment exist. Supabase backup/PITR availability has not been independently confirmed this session; no database migration/restore is proposed. Do not label the full production rollback tested merely because the Git bundle verifies.
