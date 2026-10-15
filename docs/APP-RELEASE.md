Version 1.0.2 connects E-Edge Store for Android, E-Edge Driver for Android, and the Windows store installer to the live application at https://edgedirect2u.vercel.app. The custom edgedirect2u.com domain remains trusted for future domain activation. Both Android packages retain the original package IDs and signing certificate, so they can update earlier versions.

This release applies the official orange, black and white palette, retains the supplied storefront logo, and adds company and field web workspaces. Field work includes shifts, assigned stores, justified supervisor exceptions, task evidence and visit history. Browser check-in is disabled by default and requires company policy approval. These launchers do not add native GPS, background location, offline synchronization or iOS distribution.

- Installable store web app, app download hub and clear offline recovery.
- Separate Android store and driver packages with verified release signatures, secure navigation, persistent sessions and driver account authorization.
- Windows x64 store launcher with an Admin shortcut and WebView2 runtime setup.
- Improved product editor: category and inventory-owner choices, prices in naira, automatic slugs and authenticated photo uploads.
- Administrator onboarding and role-specific destinations after sign-in.

The hosted website is live. Sign in at https://edgedirect2u.vercel.app/login using olasodechukwudi@gmail.com, then open https://edgedirect2u.vercel.app/admin/products to add products. Add actual stock through https://edgedirect2u.vercel.app/admin/inventory.

Android packages are signed for direct installation; Google Play publication is separate. The Windows installer is unsigned because no Windows code-signing certificate has been supplied. Windows may show a SmartScreen prompt. Compare the installer SHA-256 with SHA256SUMS.txt from this release.

Orders, payment verification and delivery updates require a connection. No offline mutation queue, background GPS tracking or push-delivery service is claimed. Live payment credentials are configured on the hosted app, but a real charge/refund acceptance test remains outstanding. The shared Paystack webhook continues to serve the existing Nexzek store.
