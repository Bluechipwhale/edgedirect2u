# Counter sales — implementation and acceptance

Implemented on 30 October 2026 at /admin/pos for administrator and operations accounts. Only published in-house stock is eligible. Buyer details and the clerk are recorded separately; no customer Auth account is fabricated.

Server catalogue prices and shared product reservations determine the final amount. The counter has zero delivery charge. Receipt posting, stock consumption, reservation release and audit events are transactional and idempotent. Cash records tender and change. Bank transfers remain pending until an administrator confirms actual receipt and supplies a unique reference. Paystack charges are independently verified for reference, amount, currency and status; the shared external webhook setting is unchanged.

Counter receipts and refunds form a separate subledger rather than fake online orders or processor receipts. Reports include all matching sales, receipt-date totals, refunded amounts and CSV exports; receipts can be printed. The existing online checkout retains its delivery charges and verification behavior.

Unpaid cancellation and expiry release reservations once. A late provider payment requires reconciliation and does not release goods automatically. Cash/bank refunds are recorded only after an administrator checks a completed external refund. Paystack refunds require an already processed provider ID that the server verifies. Recording refunds never automatically restocks goods; use a separately audited return adjustment when appropriate.

Isolated acceptance covers unauthorized access, private-helper denial, exact options, insufficient stock, idempotent reservations/captures, bank reference duplication, late payment rejection, expiry, refund bounds, provider refund identity and unchanged online shipping. No live charges, refunds, fictitious customers or test sales were inserted by the release.

Owner-operated business acceptance of a real sale is pending. Historical wallet/loyalty liabilities remain inactive until reconciled balances are supplied.
