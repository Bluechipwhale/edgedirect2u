# WhoGoHost deployment guide

**Conditional runbook, not an executed deployment.** The purchased service is Deluxe 30GB DA Web Hosting (DirectAdmin), and the owner confirmed keeping edgedirect2u.com. The legacy .com.ng domain remains untouched. Complete [WHOGOHOST_COMPATIBILITY.md](WHOGOHOST_COMPATIBILITY.md) first. The account's Node runner, hostname, paths, port, limits and staging certificate are still unknown. Do not assume cPanel menus on this DirectAdmin account; a supported startup method still needs verification.

## Recommended layout

On a compatible account, use a private application area such as `/home/<hosting-user>/apps/edgedirect2u/`, with separate `source`, `releases/<release-id>` and private configuration areas. This is a proposed layout, **not a discovered account path**. Confirm it is outside every public/document root, including DirectAdmin per-domain public directories and web-accessible aliases. Do not overwrite current website files while staging.

The release root contains generated `server.js`, its traced dependencies, `.next` and `public`. The provider's reverse proxy forwards the app's hostname/base URL `/` to the managed Node process. Static exposure, if configured separately, is limited to intended `public` assets and `.next/static`; `.next/server`, environment files, source, Git metadata and dependencies are private. Do not apply a blanket static-site rewrite to the server application.

## Build on Linux

Use the account's verified Node 24 environment activation command; it is provider-specific and has not been obtained. Build in a new private source directory, never over the current release. The following commands are exact repository commands **after** navigating to that clean checkout and privately setting the public build variables described in `ENVIRONMENT_VARIABLES.md`:

```bash
node --version
npm --version
npm ci --include=dev
npm run lint
npm run typecheck
npm test
npm run check:hosting -- build
npm run build:whogohost
```

Supply production execution mode, disabled local demo, the operator-confirmed staging origin in both origin settings, and the intended Supabase public configuration. Do not run `build:hostinger` or `build:vercel` for the new origin: their existing defaults target `.com`. The new command runs preflight, the existing Webpack production build and the existing standalone asset packager. It does not change production hosting defaults or database migrations. Never run seeds, imports, `db:migrate`, role provisioning or `operations.cjs` for this web-host move.

Build first with public configuration; service-role and payment credentials belong in the target runtime. A configuration check is not evidence the runner works. Next's standalone output/native dependencies must be built for the target Linux architecture/libc. Do not upload this Windows computer's `.next` or `node_modules`, or assume any Linux CI artifact matches an unverified target. Do not build inside the active release.

## Confirmed account configuration

The service is DirectAdmin on da42.host-ww.net, Linux x86_64/glibc 2.28, with CloudLinux Setup Node.js App. The selector offers 24.21.0; select it explicitly rather than the default 20.20.2. The visible limits are 30 GB disk, 60 GB bandwidth and, in resource history, CPU 200%, PMEM 2G, IO 16 MB/s, IOPS 1024, EP 40 and NPROC 100. Build timeouts, upload limits and sustained app performance still need testing. The ordinary terminal has no node on PATH until the manager-provided virtual environment is activated. Do not guess an activation path.

For a source-checkout application, choose a private root such as apps/edgedirect2u-preview, production mode, startup filename server.js and a private Passenger log path. Register only an approved staging hostname; exact public DNS and TLS provisioning are separate review steps. The new repository-root server.js is a small loader for Next's generated standalone server, not a custom router/server. Existing Hostinger/Vercel startup paths are unchanged. Its production smoke test is included in Linux CI.

## Startup and environment

For a verified normal-process runner, the entry point is generated `server.js`, with its release root as working directory. For a root-level source checkout, the equivalent startup command is:

```bash
node --use-system-ca .next/standalone/server.js
```

For an extracted standalone release, run `node --use-system-ca server.js`. For a source checkout, `npm run start:whogohost` uses the root loader, while the manager startup filename is `server.js`. Register that command/file in the provider's manager, not a foreground SSH terminal. Configure all required runtime variables privately; public build/runtime values must match. Let the runner assign its supported port/bind address and provide TLS/Host forwarding. Do not put keys in startup command arguments.

Passenger's default `app.js` discovery differs from a normal Node service. If that is the actual runner, get the provider's supported startup-file and socket/port procedure, then prove generated `server.js`, `src/proxy.ts` and restart work. Do not rename generated internals, add a custom Next server or mix standalone with custom-server mode speculatively. Stop that step if provider access or configuration is insufficient.

## Upload without SSH

If there is an approved compatible Linux builder but no SSH, transfer the verified **standalone runtime artifact** to the private release area using the actual panel's File Manager. Inspect hidden files and scan for known privileged values before creating/uploading the archive. Include all hidden `.next` assets, `public` and traced dependencies; exclude dotenv files, Git, local SQLite, exports, private configuration and logs. Check SHA-256 before and after transfer. Preserve symlinks and filesystem permissions; ZIP extraction behavior must be verified on the account. Register the resulting release directory and `server.js` with the verified runner.

No ready-to-upload Linux runtime artifact has been produced because the account's platform and runner are unknown. The local pre-migration ZIP is a private source backup, not a public upload package. If neither a compatible builder nor a runner exists, retain the current deployment. A panel Git feature can fetch source but does not establish build/runtime support; do not create automatic `.cpanel.yml` deployments before the method is accepted.

## Staging, TLS and acceptance

1. Obtain the exact staging hostname and destination from WhoGoHost. Do not invent an IP, use a public production hostname to create a competing live app, or modify existing web/email DNS automatically. A new staging DNS record also needs review. A provider temporary hostname must genuinely route to this app.
2. Obtain a trusted certificate before credentials, secure-cookie, checkout or GPS tests. A hosts-file/curl resolve test requires the exact provider IP, correct TLS SNI and a valid certificate; never use `--insecure` or browser-warning bypasses. Root-domain `/~user` previews do not prove same-origin paths work.
3. Add only approved exact staging Auth callbacks while preserving production values. The Supabase recovery template uses `SiteURL`; test its real email behavior with the owner, and do not change the global site URL during staging. Never send customer broadcasts or unsolicited email.
4. Run all applicable checks in `MIGRATION_TEST_PLAN.md`; use isolated data/test payments for mutations. This app can access live Supabase, so a staging hostname is not data isolation.
5. Verify a provider-managed restart and idle wake: health, catalogue, authenticated session, callback, private headers, field GPS, static assets and uploads must still work afterward. Record time, release hash, logs and test evidence.

## Logs, future releases and cutover

Use the actual runner's log viewer/path; classic cPanel Application Manager commonly places Node logs under the application's `logs` area. Do not assume that path for CloudLinux or Meridian. Inspect only relevant time windows, redact tokens, cookies, query strings and customer details before sharing logs. A 503 requires runner/startup/env diagnostics; a failed build requires logs/resource-limit checks. Avoid repeated unbounded rebuilds.

Keep a verified previous release. Build each update in a fresh directory with a fixed Git hash, test it, switch the manager to that release, restart and verify again. Do not assume symlink swaps are supported by the purchased runner. Keep old releases/configurations for rollback and never overlay an active `.next` while it is serving requests.

Only after all staging gates pass, prepare the production-origin build, review exact DNS/auth/callback/native implications, and obtain explicit cutover approval. Rebuild when the origin changes; approve the production build through a provider-supported preview before switching DNS. See `DNS_CUTOVER_PLAN.md` and `ROLLBACK_PLAN.md`.
