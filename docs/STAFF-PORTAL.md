# Staff, client reporting and researched products

Customer storefront: https://edgedirect2u.com/ . People can browse without an account and sign in at checkout.

Staff and client portal: https://edgedirect2u.com/staff . Sign in with an approved work email. Each person must register at `/register`, confirm their email and sign in to activate the approved access. No shared or generated staff passwords are used.

## Approved access

| Email | Role | Scope |
| --- | --- | --- |
| gm@edgedirect2u.com | Warehouse manager | Flagship inventory, stock movements, van custody transfers |
| it@edgedirect2u.com | IT manager | Full operational administration; separate platform ownership/MFA still applies |
| account@edgedirect2u.com | Accounts | Verified payment totals, refunds, settlements and van cash reconciliation |
| client@edgedirect2u.com | Client | Explicitly assigned PZ Cussons products, stock, online item sales and van sales; CSV export |

The owner can approve, change or disable access in Staff portal → Team & access. A client needs a supplier assignment. A van salesperson needs a confirmed approved account before warehouse staff can issue stock. Staff permissions are enforced by PostgreSQL RPCs. Warehouse, accounts and client roles are not added to the legacy broad `is_staff()` predicate. Private business tables deny direct authenticated access.

## Products and actual inventory

`data/fmcg-research-2026-10-15.json` contains 260 traceable public retailer offers across ten FMCG categories. Prices are observed retail offers in NGN, excluding delivery. This is not a market-average estimate, supplier cost or a promise of available Edge inventory. Ten Golden Mart rows provide additional retailer comparisons; one is unavailable and flagged. Manufacturer fields explicitly distinguish brand companies and unverified exact pack manufacturers.

Run `node scripts/import-fmcg.cjs` to review the import plan. `--apply` imports 250 Supermart product drafts with zero stock, inactive status, an owned placeholder image and source metadata. Re-running skips existing products without overwriting subsequent owner edits, publication or stock. It also approves the four specified staff emails without creating users or passwords. Database TLS verification is required. No development seed is involved.

If the direct PostgreSQL IPv6 endpoint is unavailable, `node --use-system-ca scripts/import-fmcg.cjs --apply --rest` uses the privately configured service key over verified HTTPS. This fallback stages each table independently and can be resumed with the same command. Existing records are preserved; products remain inactive throughout. It verifies all 250 product and research records after completion. It does not claim a cross-table transaction.

Before selling, the owner must check the exact pack, manufacturer, selling price and licensed product photo under `/admin/products`. Record physical receipts under `/staff` → Inventory. Product activation is an explicit owner decision. Supplier mappings control client inventory visibility; do not assign another supplier's product to PZ.

## Van sales and accounts

1. Administrator approves a confirmed salesperson as **Van sales**.
2. Warehouse staff load stock under Inventory → Transfer stock to a van. Positive quantities load; negative quantities return unsold stock. Reserved online stock cannot be removed. Warehouse and van balances remain separate.
3. The salesperson signs in at `/staff`, sees only their own issued stock and records a sale with a receipt reference. The catalogue supplies the price. Only active, reviewed products can be sold. Stock cannot go below zero.
4. Accounts confirms cash receipt only after actual collection and reconciliation. Reported sales are separate from confirmed cash. The app does not move money when recording this confirmation.
5. The PZ client sees only PZ-attributed sales and stock. Product-to-supplier assignment is snapshotted on new order items and van sales; changing a current mapping does not reassign previous sales. Historical orders without a captured supplier are excluded from client reports rather than guessed.

Stock transfers, receipts and sales use request IDs to make retries idempotent. Movements and access changes are audited. The portal reports Lagos calendar dates, with a maximum 366-day period. Online product sales are gross item values of paid orders created in that period, before order discounts, delivery and partial refunds. Fully refunded orders are excluded. Payment receipts use their verification date; refund totals use the refund request date with processed status. Settlement entries do not initiate transfers.

## Driver app

Driver Android APK and the browser driver workspace remain available from `/apps` and `/driver`. A driver must have an authorized confirmed driver account, a real driver record and assigned deliveries. Availability and assigned delivery status/proof are connected to the database. Background GPS, offline delivery synchronization and push notifications are not implemented. Van sales access is approved separately; a delivery driver is not automatically a van salesperson.

Primary host is edgedirect2u.com on Hostinger. Vercel remains the backup. Existing Nexzek Paystack webhook routing is preserved.
