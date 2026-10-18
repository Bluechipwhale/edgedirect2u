Version 1.0.3 opens the primary website at https://edgedirect2u.com. Vercel remains a trusted backup origin. Android package IDs and the original signing certificate are retained so these installers update previous versions.

- Driver Android app: foreground location permission is requested only when the trusted field workspace asks for a GPS check. Permission denial returns to the page without granting location access. Navigating away cancels pending requests. The Store APK does not request location permissions.
- Driver web entry: approved van salespeople open their customer-visit workspace; delivery drivers retain their assigned delivery queue. Sign-in preserves the driver destination.
- Password fields: login, registration, staff setup and recovery support accessible show/hide buttons without submitting or changing the password.
- Windows store app: the primary domain is used for shopping and administration.

Use /apps for the current installers and SHA-256 checksums. Driver access requires an approved, confirmed account and assigned customers or deliveries. GPS check-in also requires location permission, a sufficiently accurate device location, a saved outlet location and company authorization. Device permission alone does not bypass those checks.

The apps require an internet connection. No background tracking, offline mutation queue, SMS delivery or push-notification service is claimed. APK compilation, unit tests, lint and emulator launch checks run before publication; an actual device visit and a real payment/refund acceptance test must still be commissioned by the business. Catalogue drafts require approved selling prices and real stock before purchases can start.

Android installers are signed for direct installation. Google Play publication is separate. The Windows installer remains unsigned; compare its checksum with SHA256SUMS.txt. The shared Paystack webhook for the existing Nexzek store is preserved.
