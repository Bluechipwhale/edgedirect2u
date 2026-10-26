# WhoGoHost account compatibility

Date: 26 October 2026. **The signed-in service is Active, DA Web Hosting — Deluxe 30GB DA Web Hosting, attached to `edgedirect2u.com`. It offers DirectAdmin, not cPanel.** The owner confirmed keeping `.com`. Public preview build, startup and HTTPS are verified; private runtime and authenticated acceptance remain incomplete. The filename is retained from the requested deliverable; use the actual panel's controls, not assumed cPanel menus.

## Account acceptance record

Record account-specific evidence, not a product marketing claim:

| Check | Required evidence | Current result |
|---|---|---|
| Plan/server identity | Actual plan/server | PASS: Deluxe 30GB DirectAdmin at da42.host-ww.net; terminal reports x86_64 and glibc 2.28 |
| Node runtime availability | Actual selector and activated terminal | PASS: Node 24.21.0 activated; npm 11.19.0, Git 2.43.7 and `--use-system-ca` verified. Default 20.20.2 must not be used |
| Runner interface | Actual selector controls | PASS: CloudLinux Node.js preview created at private `/home/edgedire/apps/edgedirect2u-preview`, production mode, separate preview hostname, startup and private Passenger log controls. Actual Next lifecycle acceptance pending |
| Startup | Generated Next standalone `server.js` is accepted; startup filename, working directory and env injection confirmed | PASS for public runtime: manager startup `source/server.js` delegates to generated Next output; privileged private-file startup pending manual upload |
| Process management | Automatic start/restart, idle wake, managed lifecycle, no detached terminal process required | PASS for managed start/restart and following requests; long idle wake and authenticated-session persistence pending |
| Port/proxy | Exact assigned port/socket behavior and HTTPS/Host forwarding; no guessed port | PASS for actual managed Passenger transport and public HTTPS/security headers; no manual port. Authenticated cookies and financial callbacks pending |
| Build/install | npm + dev dependencies, lockfile install, allowed build time, native Linux modules and outbound package-registry access | PASS: on-server clean npm install and Webpack standalone build at 9e64245. Full Linux CI also passed at that commit; later startup safety additions have their own CI record |
| Limits | Actual account quotas | PASS: 30 GB disk / 60 GB bandwidth; resource history shows CPU 200%, PMEM 2G, IO 16 MB/s, IOPS 1024, EP 40, NPROC 100. Live Current usage unavailable; build/upload/time limits and app-specific performance still pending |
| App directories | Private source/runtime root outside all domain document roots; only public assets accessible | PASS for configured paths: app under `/home/edgedire/apps`, source checkout in `source/`; preview document root `/home/edgedire/domains/preview.edgedirect2u.com/public_html`. Public-path denial tests pending |
| Connectivity | Outbound HTTPS to the intended Supabase project, Storage, Paystack and required image hosts with certificate validation | PASS for live Supabase public catalogue/health and rendered public assets. Authorized uploads and Paystack checks pending private runtime/test credentials |
| TLS/staging | Provider-approved test hostname or hosts-file method; valid trusted certificate before sign-in/GPS/payment tests | PASS: preview.edgedirect2u.com, owner-approved A record, trusted automatically renewed certificate verified without bypass |
| Operations | Shell, deployment and logs | PASS for authenticated browser terminal, Git and successful public repository clone; external SSH and active Next app log/restart acceptance pending |
| Scheduling | Existing Supabase jobs remain authoritative; verify recent successful runs | See migration test record |
| WebSockets/workers | Not required by the inspected application; reconsider only if new evidence appears | NOT APPLICABLE |

`package.json` requires Node 24; Next.js's lower framework minimum does not override this project's runtime, built-in SQLite import or CLI flags. Do not downgrade Node, Next or security controls to fit a plan.

## Decision rules

- **Managed Node 24 + normal HTTP process:** use the existing standalone architecture in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). Confirm settings, then test the actual runner.
- **Passenger/CloudLinux only:** obtain evidence that this version can start the generated standalone file, including Next proxy behavior and restart. Default Passenger `app.js` examples are not proof that Next's generated `server.js` works. Ask the provider to configure the startup filename if the account cannot. Do not fabricate a `require('next')` custom server inside standalone output or install root-level Apache modules yourself.
- **Meridian/container Web Apps:** follow that account's displayed build/start commands and assigned port; availability in new cPanel releases does not establish WhoGoHost enabled it.
- **No supported Node/process runner:** NO-GO. Leave the complete app on Hostinger/Vercel with Supabase. A static file upload to `public_html` cannot provide the existing SSR/API/Auth/checkout behavior. A new VPS or plan is a separate purchase decision.

There is no measured app-specific RAM minimum yet. Ask for separate build and runtime limits; run a Linux build and representative staged requests under those limits. Existing CI uses 2 cores/8 GB on Vercel, but that is not a verified requirement for this application.

## Exact questions to send to support yourself

> Does my purchased plan support a maintained Node.js 24.x release and managed persistent Next.js 16.4 standalone applications? On this DirectAdmin plan, which Node runner/version is enabled, and can I choose `server.js` as the startup file outside `public_html`? How are the application working directory, process environment, PORT/socket, HTTPS forwarding and restart/idle wake handled? Please provide my CPU/RAM/process/inode/build-time limits; npm build and SSH/Terminal/Git availability; native Linux module support; upload/request/response timeouts; runtime log location; and the exact staging URL, SSL method, website destination IP/CNAME and document root. Can the supplied app be tested without modifying existing website or mail DNS?

No support message has been sent. Provide the actual answers or open the authenticated DirectAdmin panel; keep passwords, tokens and environment values out of screenshots/chat.

References: [WhoGoHost Node hosting](https://www.whogohost.com/node-js-hosting), [cPanel Node application setup](https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/), [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/), [Meridian Node app management](https://docs.cpanel.net/cpanel/meridian/websites/manage-a-nodejs-app/). These describe possible interfaces, not verified account features.
