# DNS cutover plan — review required

Date: 26 October 2026. **Production website and mail DNS are unchanged. The owner approved only the staging A record: preview → 102.68.97.69, TTL 300. That record is saved in Hostinger and resolves publicly. No production cutover is approved.**

## Observed current records

These are public recursive observations, not a complete authoritative zone export. Private evidence: `.data/migration-20261026/dns-before.json` and `dns-address-ttl.json`. Obtain both complete zones, configured TTLs, all subdomains, verification records, mail dependencies, DKIM selectors, CAA and DNSSEC/DS state before approval.

| Zone/name | Type | Observed value | Treatment |
|---|---|---|---|
| `edgedirect2u.com` | NS | `lunar.dns-parking.com`, `solar.dns-parking.com` | Preserve |
| `.com` apex | A/AAAA | Hostinger CDN returns changing address sets; observed address TTL 60 seconds | Do not replace dynamic CDN configuration with a sampled IP |
| `www.edgedirect2u.com` | CNAME | `www.edgedirect2u.com.cdn.hstgr.net` | Preserve |
| `.com` | MX | priority 5 `mx1.hostinger.com`; priority 10 `mx2.hostinger.com` | Preserve email service and routing |
| `.com` | TXT SPF | `v=spf1 include:_spf.mail.hostinger.com ~all` | Preserve |
| `_dmarc.edgedirect2u.com` | TXT | `v=DMARC1; p=none` | Preserve |
| `edgedirect2u.com.ng` | NS | `ns1.sv1stlincoln.com`, `ns2.sv1stlincoln.com` | Preserve; these identify the currently delegated DNS, not the new purchased plan's capabilities |
| `.com.ng` apex | A | `199.241.136.37`; observed TTL 3600 seconds | Existing website rollback reference; configured zone TTL must be confirmed |
| `www.edgedirect2u.com.ng` | A | `199.241.136.37`; observed TTL 3600 seconds; no CNAME observed | Existing website rollback reference |
| `.com.ng` apex and `www` | AAAA | No answer observed | Do not invent IPv6; reconfirm authoritative records before cutover |
| `.com.ng` | MX | priority 10 `mail.edgedirect2u.com.ng` | Preserve |
| `mail.edgedirect2u.com.ng` | A | `199.241.136.37`; observed TTL 3600 seconds | **Preserve even if the website moves** |
| `.com.ng` | TXT SPF | `v=spf1 a mx ip4:199.241.136.37 ip6:2602:ff16:3:0:1:13e:0:1 include:zeptomail.net ~all` | Preserve pending mail-provider review; its `a` mechanism depends on the website apex |
| `_dmarc.edgedirect2u.com.ng` | TXT | Name not found by this resolver | Not proof that all mail/security records are absent; inspect the full zone |

DKIM and unknown TXT/verification subdomains cannot be enumerated reliably by guessing selectors. Export from the authoritative DNS account. Changing only A/AAAA records can still affect mail when MX targets the apex, SPF uses `a`, or clients use the apex for SMTP/IMAP; audit those dependencies first. Existing `.com.ng` MX uses a separate `mail` name whose address can be preserved.

## Authenticated Hostinger zone review

The signed-in zone editor was inspected on 26 October. Its 12 visible records are recorded in `.data/migration-20261026/hostinger-dns-zone-before.json`, captured before the file-download permission refusal. The exact current website mapping is **ALIAS @ to edgedirect2u.com.cdn.hstgr.net, TTL 300**, and **CNAME www to www.edgedirect2u.com.cdn.hstgr.net, TTL 300**. Preserve these exact targets for rollback rather than sampled CDN IPs. The three verified DKIM CNAMEs are hostingermail-a._domainkey, hostingermail-b._domainkey and hostingermail-c._domainkey, pointing to their corresponding hostingermail-a/b/c.dkim.mail.hostinger.com targets, each TTL 300. MX priorities remain 5/10 with configured TTL 14400; SPF and DMARC TTLs are 3600. The provider export-file download was declined by the browser permission gate and was stopped; the owner must obtain that file manually. DNSSEC/DS status still needs confirmation. No records were added or edited.

## Approved staging and proposed production changes

| Name | Change to review | New value |
|---|---|---|
| `preview.edgedirect2u.com` | Owner-approved A record added; separate Node 24 app registered on WhoGoHost | `102.68.97.69`, TTL 300; trusted TLS and actual-app acceptance pending |
| `edgedirect2u.com` apex | After accepted staging, replace only the exported Hostinger website/CDN mapping with the provider-supported target | WhoGoHost zone identifies `102.68.97.69`; **BLOCKED until staging and explicit production approval** |
| `www.edgedirect2u.com` | Replace the current CDN CNAME only with the approved website destination; preserve canonical redirect and certificate coverage | **BLOCKED — exact target/redirect unconfirmed** |
| `.com` website AAAA | Update/remove only if an existing address would misroute IPv6 traffic; use only provider-supplied IPv6 | **BLOCKED — authoritative zone review** |
| All NS, MX, mail-host addresses, SPF/DKIM/DMARC, verification records | No migration change | Preserve |
| All `edgedirect2u.com.ng` records and the Vercel backup | No migration change | Preserve the legacy domain, email and backup app |

Do not use any observed old address as the new WhoGoHost IP. Do not assume a nameserver switch is required. Retaining authoritative DNS and changing only approved website records keeps unrelated zones/services under the same authority. A nameserver switch moves the entire zone's authority and can break email, verification and DNSSEC; it requires a separate complete-zone review and explicit approval.

## Cutover sequence

1. Export current complete DNS and hosting configuration, save exact old website records/TTLs and obtain the new provider's exact destination. Recheck immediately before cutover; today's samples may age.
2. Verify staging on Node 24, trusted TLS, restart, Auth/email, roles, stock, test checkout/refund, raw webhook handling, uploads and field clock-in. Resolve the security patch and all applicable failed/blocked tests. Shared Paystack routing must have an approved solution before claims of full payment readiness.
3. The owner confirmed keeping `.com`. This is a same-domain hosting move: preserve its Auth identity, native trust and browser storage scope. The legacy `.com.ng` domain is outside this cutover. A separate staging hostname still needs its own approved callbacks and cookie tests.
4. If practical, ask the DNS owner to lower only the website-record TTL to 300 seconds in advance, and wait at least the previous configured TTL. This is a proposed manual change, not performed. Existing 60-second CDN answers are not proof of the underlying configured TTL.
5. Present the completed old/new record table, production-origin build evidence, authentication changes and rollback trigger to the owner for explicit approval. DNS remains unchanged until approved.
6. After approval, the owner applies only reviewed website changes. Keep mail DNS, Hostinger installation, existing legacy site and Vercel available. Monitor IPv4/IPv6 and several resolvers; test TLS and the actual browser, not just DNS lookup results.
7. Record order/payment IDs privately during observation. Never merge or restore an old Supabase snapshot over new transactions. Raise TTLs after stability is accepted.

Public DNS propagation and cached answers make rollback non-instantaneous. Maintain both routes during that window.
