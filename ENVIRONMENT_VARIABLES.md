# Environment variables

Names and descriptions only. Existing private values stay in the approved secret store/control-panel environment. Never commit or serve dotenv files. Do not run `printenv`, copy environment listings into logs, or place privileged keys under `NEXT_PUBLIC_`.

| Name | Scope | Purpose |
|---|---|---|
| `NODE_ENV` | Build + server | Production execution mode. Use an explicit development environment only in local development |
| `LOCAL_DEMO` | Build + server | Must disable local fixture administration for all hosted deployments |
| `DEPLOYMENT_APP_ORIGIN` | Deployment checks | Operator-confirmed HTTPS origin; migration preflight compares it with the application's configured origin. It does not select DNS or prove hosting ownership |
| `NEXT_PUBLIC_SITE_URL` | Public build + server | Exact canonical HTTPS origin for the particular release; same-origin guard, payment callbacks, Auth links, sitemap and metadata depend on it |
| `NEXT_PUBLIC_SUPABASE_URL` | Public build + server | Existing hosted Supabase project URL, or a separately approved isolated testing project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public build + server | Intended publishable key or legacy anon-role JWT; RLS still enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged payment verification, refunds, staff invitation and other approved service operations. Never expose it to client bundles |
| `PAYSTACK_SECRET_KEY` | Server only | Paystack server API calls and raw-body webhook signature verification. Financial staging requires test credentials and isolated data |
| `PAYSTACK_PUBLIC_KEY` | Server only / optional | Retained privately by owner request; the current redirect checkout does not read it. Do not add a public-prefixed variant |
| `CRON_SECRET` | Server only / optional | Authenticates the optional HTTP reservation-expiry endpoint. Not needed when existing Supabase Cron is healthy; presence is not scheduling evidence |
| `NODE_OPTIONS` | Provider runtime / optional | Allows the existing system-CA Node flag when the manager starts a filename directly; do not use debug/inspect options on the public server |
| `RUNTIME_ENV_FILE` | Managed-host startup / optional | Absolute path to an owner-only private dotenv file outside every document root and outside the checkout; only the managed root loader reads it. Used because this CloudLinux manager writes its own environment table into document-root `.htaccess` |
| `PORT` | Provider runtime | Runner-assigned listening port where its deployment model uses a TCP port. Preserve the provider contract; do not assume port 3000 or override a reserved port |
| `HOSTNAME` | Provider runtime | Bind interface required by the verified runner; never use an internal bind address as the public site URL |
| `NEXT_DIST_DIR` | Build tooling / optional | Existing output directory override; standalone packaging expects the standard directory and preflight rejects other values |
| `DATABASE_URL` | Private maintenance only | Direct database tools; not required by ordinary Next.js production requests. Do not provision it to WhoGoHost merely for hosting |
| `DATABASE_CA_PATH` | Private maintenance only | Official CA file for verified direct database tooling |
| `DATABASE_HOST_ADDRESS` | Private maintenance only | Optional connection-address override in existing maintenance helpers, retaining certificate hostname verification |
| `LOCAL_DATABASE_PATH` | Local development only | SQLite fixture file; never migrate it as the production database |

SMTP settings belong to Supabase Auth's existing SMTP configuration, not this app's runtime. Keep the current mailbox credentials and sender unchanged. Android signing and Windows build credentials remain private CI concerns and are not WhoGoHost runtime variables.

The owner instructed that `edgedirect2u.vercel.app` remain untouched as a backup. This migration must not update its environment, settings or production deployment.

Set public values explicitly **before** building and keep them equal at runtime. Next inlines public values during builds; restart alone is insufficient to change them. Use a clean checkout without local/private dotenv files when running `build:whogohost`; it deliberately does not load this computer's `.env.local`. Inspect all artifact contents before upload, including hidden files. Set privileged values privately on the target only after verifying its identity and isolation. Never copy production secrets into a public build artifact.
