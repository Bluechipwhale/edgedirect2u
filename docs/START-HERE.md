# Start your Edgedirect2u store

The web app is live at https://edgedirect2u.vercel.app. Sign in at https://edgedirect2u.vercel.app/login to begin uploading. GitHub is connected for automatic Vercel deployments. Hostinger setup and custom-domain registration remain separate steps.

## Add a Hostinger deployment

1. In Hostinger, open **Websites → Create Website → Web App → Import Git Repository**.
2. Choose `https://github.com/Bluechipwhale/edgedirect2u`, branch `main`, root directory. Connect your GitHub account for automatic updates on future pushes.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Node version | 24 |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build:hostinger` |
| Output directory, if requested | `.next` |
| Start command, if requested | `node --use-system-ca .next/standalone/server.js` |
| Entry file, if requested | `.next/standalone/server.js` |
| Environment variable | `HOSTNAME=0.0.0.0` |

Keep Hostinger's assigned `PORT`. The approved public Supabase connection is already included in the build configuration. No database import is needed. Use Hostinger Business or Cloud hosting with Node.js support.

4. Set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS origin Hostinger assigns before building. This is necessary for sign-in and protected submissions. Deploy and check `/api/health`; `status: "ok"` means the server can read Supabase.
5. Register and attach `edgedirect2u.com` before using it as the canonical origin. The domain was shown as available for purchase during setup; it is not serving this app. Until then, use the live Vercel address above. In Supabase Authentication URL settings, use that live address as the Site URL and allow `/auth/confirm`, following [LAUNCH.md](LAUNCH.md).

The website is already live on Vercel. A Hostinger deployment reads the same Supabase database; no database copy is needed.

## Add your first product

Open https://edgedirect2u.vercel.app/login. Sign in as **olasodechukwudi@gmail.com** using the password you registered. This confirmed account already has administrator access; successful sign-in opens the admin workspace.

Open `/admin/products`, choose **Add record**, enter the name, select a category and inventory owner, enter the price in **naira**, upload the photo and save. Open `/admin/inventory` to receive actual stock. Products start with zero stock. Use `/admin/theme` to preview and publish branding changes.

You can start uploading before deployment: run `npm run dev` on your computer and open `http://127.0.0.1:3000/login`. Its configured Supabase project is the same project the hosted app uses.

## Enable payments

The Supabase service key and live Paystack key are configured privately on Vercel. A signed connectivity event reached the live handler successfully; no payment or refund was performed. Add the required server settings privately to Hostinger before enabling checkout there. Complete payment/refund acceptance using test mode and a staging database first. This app's current webhook endpoint is `https://edgedirect2u.vercel.app/api/payments/webhook`. The existing WordPress webhook on `nexzektechnology.com` belongs to that separate integration; decide how the Paystack account is shared before replacing it.

Ordinary authenticated admin work and raster photo uploads already use Supabase access policies and do not need the service-role key.

## Install the apps

The [GitHub release](https://github.com/Bluechipwhale/edgedirect2u/releases/tag/v1.0.1) contains the store APK, driver APK, Windows x64 installer and SHA-256 checksums. The website's `/apps` page links to them and also offers browser installation. Version 1.0.1 native clients load the live website at `edgedirect2u.vercel.app`; they also trust the future custom origin.

The Windows installer is unsigned. Android packages use the project's release signing certificate. Driver users need an authorized driver account and assigned deliveries. Merchant sign-in opens its own workspace. Administrator privileges remain checked on the server in every client.

See [APPS.md](APPS.md) for installation, signing backups and future releases, and [HOSTINGER.md](HOSTINGER.md) for detailed deployment settings.
