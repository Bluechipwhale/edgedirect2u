# Paystack configuration and reconciliation

Use a staging Supabase project and Paystack test key first. Configure `PAYSTACK_SECRET_KEY` on the server and set `NEXT_PUBLIC_SITE_URL` to the canonical origin.

Set the webhook URL in Paystack to `https://YOUR_DOMAIN/api/payments/webhook`. The return URL is `/checkout/confirmation?reference=…`. The webhook must be reachable over HTTPS. A redirect never marks an order paid.

For the current live deployment, use `https://edgedirect2u.vercel.app/api/payments/webhook`. A signed no-op connectivity check passed; actual payment/refund acceptance remains outstanding. Use the requested custom domain only after it is registered and serving the app. The supplied `https://nexzektechnology.com/wc-api/Tbz_WC_Paystack_Webhook/` follows the Paystack WooCommerce plugin's endpoint; it does not call this Next.js application's signed webhook handler. Do not overwrite an existing WooCommerce store's payment settings without deciding how those businesses share the Paystack account. A webhook URL is an event destination, not a Paystack secret key. [Official WooCommerce handler](https://github.com/PaystackOSS/woo-paystack/blob/master/includes/class-wc-gateway-paystack.php).

The server calculates prices, shipping, discounts and allocations in integer kobo. Inventory is reserved for 30 minutes. Successful payment initialization URLs are stored and reused on retries; ambiguous initialization is locked for reconciliation. The browser retains its checkout intent across refreshes in the same tab during that window.

`charge.success` handling checks the raw-body SHA-512 HMAC and independently verifies the transaction through Paystack. PostgreSQL rechecks reference, amount, currency and success before consuming inventory and creating commissions. Duplicate events return the existing order. A payment after reservation expiry requires reconciliation and cannot silently oversell released stock.

## Refunds

Admin → Orders → Request refund creates a bounded finance request. Finance → Refunds → Submit refund sends it after confirmation. The database claims it once. Provider acceptance initially means processing, not completed reimbursement.

**Verify status** fetches the provider refund and transaction, validates identity, currency and amount, and stores the outcome. After a timeout, find the refund in Paystack and enter its provider ID to reconcile. Never repeat an ambiguous submission. Refund finalization uses the administrator verification control; refund webhooks do not finalize money movements. [Refund API](https://paystack.com/docs/api/refund/).

Processed refunds flag merchant ledger entries for finance review. Full refunds mark the order refunded; partial refunds appear in the refund records while payment status stays paid. Dashboard net receipts subtract processed refunds. Receive returned stock through the stock ledger after inspection. Settlement reversals require finance action. Settlements record external transfers; automatic payouts are not implemented.

## Staging acceptance

Test single-merchant and mixed-merchant checkout. Confirm the customer session survives the return and check stock, payment and commissions. Replay a signed webhook: there must be one sale and one ledger entry per allocation. Test declined/pending payments, abandoned checkout and expiry. Refund a test payment, verify twice and check the order/dashboard. Establish a support procedure for expired paid references.

Provider unit tests use deterministic responses and never charge an account. Live processing has not been validated without business credentials. Consult [transaction API](https://paystack.com/docs/api/transaction/) and [webhook guidance](https://paystack.com/docs/payments/webhooks/) when commissioning.
