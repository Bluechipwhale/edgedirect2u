# Admin and operations guide

In local development, open `/admin` from the labelled sandbox strip. Production requires an authenticated administrator. Operations accounts can manage orders, stock and dispatch but cannot publish branding or administer roles.

## Website & Branding → Theme Studio

Use the tabs for identity, colors, typography/style, layout/navigation, homepage/hero and announcement settings. Change the name, logos, favicon, contact details, social links and footer copyright. Upload PNG/JPEG/WebP under 5 MB to persistent Supabase Storage; use HTTPS image URLs in the local sandbox. Upload progress and replacement/removal controls are provided. SVG uploads are rejected.

The main/light logo displays in the header and footer; mobile logo switches on smaller viewports. Dark-logo storage is provided for future dark appearance support; this release renders a light storefront and does not automatically switch to the dark logo.

Presets populate editable fields. Colors, fonts, type scale, width, spacing, header, buttons, cards and product grids update in the actual storefront iframe. Desktop, tablet and phone controls change the iframe viewport. Edit headline, images, CTA links, overlay, alignment, height and homepage section order. Edit navigation and footer links in the layout tab.

**Save draft** persists work without updating the public storefront. **Publish changes** validates the schema and text/button contrast and requests confirmation. Open the public storefront to check the result. **Version history → Restore** publishes a previous version and creates a new history entry. Reset changes editor values; save/publish separately. Unsaved work triggers a navigation warning.

## Products, categories and campaigns

Sign in at `/login` as `olasodechukwudi@gmail.com` using your registered password, then open `/admin/products`. Create categories first when you need new ones. The product editor offers category and approved inventory-owner choices, suggests a URL slug, and accepts prices in naira (stored as integer kobo on the server). Upload a valid PNG/JPEG/WebP under 5 MB through your authenticated administrator session, or paste an HTTPS image URL. The company owner ID is `edge`. Products start with zero units; receive stock through Inventory with a reason. Uncheck visibility to archive a product. The management list includes unpublished items and paginates 25 per page.

Variant options use JSON such as `{"Size":["S","M","L"],"Color":["Black","White"]}`. Checkout requires a valid option for every configured dimension. Gallery URLs may be stored through the product schema; the standard editor exposes the main photo and variants.

Category parent IDs create subcategories. Brands use product brand names and have pages at `/brands/NAME`. Search supports category, brand, price, stock and sorting; merchant storefronts scope discovery to one seller. Sales/popularity/rating claims are omitted when supporting data is unavailable.

Banners support desktop/mobile image URLs, copy, CTA, active toggle and optional ISO timestamps (for example `2026-12-01T09:00:00+01:00`). The first two active home campaigns display within the enabled banners section. Image previews appear in the editor. Coupons are validated on the server for code, percentage, active state and expiry.

Policies publish plain text to Help pages; add the actual business terms, privacy, delivery and returns policies before launch. Notification records store configuration only; they do not send email or SMS.

## Inventory and delivery

Inventory shows on-hand, reserved and available units. **Adjust** accepts signed whole units and requires a reason. Reference a purchase order for receipts, or an inspection/incident for returns and damaged stock. You cannot remove reserved units. Every change creates a stock ledger entry.

Warehouse records describe locations; this release tracks quantity per product/owner, without per-warehouse balances or transfer workflows. Purchase orders record procurement status; marking received does not create stock. Receive the actual units through the ledger.

After provider-verified payment, orders enter processing. Operations marks ready for dispatch and assigns an available authenticated driver. Drivers see only assigned jobs, authorized recipient details, calling/navigation links and event history. Status proceeds assigned → picked up → in transit → delivered. Delivery requires recipient confirmation; failure requires a reason. Driver records control availability. The installed driver shell requires an online connection for customer data and updates.

## Merchants, accounts and finance

Customers register and apply to sell at `/sell`. Admin reviews pending merchants, sets commission basis points and approves. 1,000 basis points = 10%. Merchant workspaces manage their product/stock records, store profile, HTTPS logo/cover URLs, allocated orders, commission statements and settlement history. Merchants cannot publish global branding or read customer addresses/other allocations. Fulfilment is coordinated by company operations in this release.

Customers can update display names, save addresses, track orders, request returns for paid orders and submit purchase-verified reviews. Reviews await admin moderation. Cart/wishlist are stored on the device; wishlist holds 100 items and changes synchronize between tabs on that device. Signed-in customers can select a saved address to autofill checkout. Password recovery is available from the sign-in page.

Finance uses verified sales and commission records. Record external bank settlements with their real references; there is no automatic merchant payout. Request and process refunds using the Paystack guide. Refunded ledger entries require finance review before settlement.

Use Users & roles to assign customer, operations, driver or administrator roles. Self-demotion is blocked. Merchant roles are assigned through approval. Audit logs record sensitive administrative actions; protect database administrator access separately.
