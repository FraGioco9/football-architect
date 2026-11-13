# DEV-ENV-01 — Canonical local startup and ownership map (#380)

> **Living contract — REPO-04 #358, 2026-11-06.** The current section describes reviewed repository source at `main@f9b595636d02d4a1ebfdbd967e1a97c18f2dd41d`. Dates, SHA baselines, Draft/HOLD labels and gates in the following original record are **historical evidence**, not today's release state. No merge/deploy/remote D1 authorization is implied.

## Canonical DEV command and boundary (current)

PowerShell from repository root, Node 22: `npm --prefix backend ci` once, then `node tools/dev.mjs`. **Default shared DEV:** current Worker runs locally at `127.0.0.1:8787` using `backend/wrangler.shared-dev.toml` with **D1 remote = true** pointed at the existing `football-architect-dev` nonproduction database; the frontend also runs locally and proxies API requests to that Worker. There is no dependency on the hosted Preview code version and no new API deployment per commit. **LAN frontend-only:** `node tools/dev.mjs --lan <PC-owned-private-IPv4>` keeps the shared remote D1 for localhost while exposing only public frontend pages to Safari on the trusted LAN (no private/authenticated API). **Isolated local DEV:** `node tools/dev.mjs --local` starts a local Wrangler Worker/local D1 using separate `backend/wrangler.toml`; `node tools/dev.mjs --local --lan <PC-owned-private-IPv4>` keeps trusted Wi-Fi Safari frontend-only QA isolated. Hosted Preview continues to read the same D1 but needs a separate approved publish when its web UI or endpoints change. Wrangler remote bindings require account authentication and network access. No mode automatically migrates, deploys, grants permissions or copies DBs; default shared DEV may write real online nonproduction data through authorized API calls. [Architecture](overview.md), [local auth](../../backend/docs-player-local-dev.md), [README](../../README.md).

## Historical implementation audit (retained)

## Decision and boundary

- **One canonical full-stack command:** `node tools/dev.mjs` (from the repository root after `npm --prefix backend ci`; Node 22). It starts the local Wrangler Worker/D1 using `npm run dev --prefix backend` and the existing site/app DEV server using `node tools/dev-app-preview.mjs`. The backend script explicitly uses `wrangler dev --local`.
- **Explicit Safari physical-device QA:** `node tools/dev.mjs --lan <owned-private-IPv4>` starts a **second frontend-only** listener on that specific assigned interface (for example `http://192.168.1.90:2000/dashboard`) alongside unchanged localhost site/app. LAN routes use one IP host and path-based URLs; no DNS suffix `app.<IP>`. The backend always binds loopback, the existing API proxy rejects non-loopback clients/hosts (Admin/Player/world/inbox), and no remote DB, deploy, or user-account access is enabled. Only trusted private Wi-Fi, no port forwarding. The default command is unchanged.
- **Loopback only (default):** `http://localhost:2000/` is the site; `http://app.localhost:2000/` is the app; the Worker is `http://127.0.0.1:8787`. `GET /api/world` is served through the existing local API proxy when the Worker is running. A bare static server cannot supply deep links or APIs.
- **Local-only explicit environment:** the new launcher forces `FA_ADMIN_API_TARGET=http://127.0.0.1:8787`, `FA_ADMIN_API_POOL=''` and `FA_DEV_LAN=''` for both subprocesses, overriding inherited remote/shared-pool values. Only the validated `--lan <owned-private-IPv4>` flag is accepted; the backend child always clears LAN variables and retains loopback-only API access.
- **Compatibility:** `dev-auth-local.mjs` is a thin alias to the common orchestrator; `dev-app-preview.mjs` is a supported *frontend-only* fixture with no Worker; `dev-standings-preview.mjs` keeps its isolated LAN opt-in and exported server factory. No server router, worker, publication allowlist or shared-proxy behavior is changed.
- **No automatic DB maintenance:** the launcher does not migrate, reset, seed, prepare, approve or write a remote DB. Existing local Worker/D1 storage and explicit owner-only Admin permission tooling remain separate. The Worker may write local test state only in response to authorized local user requests.

## Complete inventory of `tools/dev-*.mjs` on starting main

| Module | Purpose / owner | Callers and constraints |
| --- | --- | --- |
| `dev-app-preview.mjs` | Site/app loopback CLI | Canonical `dev.mjs`, frontend-only use, app-subdomain and browser tests; delegates to `createPreviewServer({subdomains:true})` |
| `dev-standings-preview.mjs` | HTTP server/router, static files, injected fictional DEV view | Imported by app launcher and Site/Browser/security tests; direct CLI retained for opt-in LAN; uses `publication-guard`, route registry and proxy |
| `dev-admin-api-proxy.mjs` | Bounded local Worker bridge | Invoked per request by preview server; tested in `dev-admin-api-proxy.test.mjs` and `shared-nonproduction-proxy.test.mjs`; not a standalone listener |
| `dev-auth-local.mjs` | Legacy combined launcher | Remains a compatibility alias to `dev.mjs`; used by older Player/Admin setup instructions |
| `dev-auth-admin.mjs` | Owner-only local Admin permissions CLI | Invokes backend operator tooling against local persistence; not a web server; remains deliberately separate |
| `dev-competition-stats-client.mjs` | DEV browser Stats and club-summary adapter | Served by virtual `/__fa_dev__/stats-client.mjs`; imports standings preview data and stats provider |
| `dev-competition-stats-data.mjs` | Fictional DEV Stats aggregation | Served by virtual `/__fa_dev__/stats-data.mjs`, used by Stats client and Stats DEV checks |
| `dev-debug-config.mjs` | DEV-only control limits | Virtual `/__fa_dev__/dev-debug-config.mjs`, preview client and test contracts |
| `dev-debug-settings.mjs` | Protected DEV module bootstrap | Virtual `/__fa_dev__/debug-settings.mjs`; imports the virtual standings client |
| `dev-debug-widget.mjs` | Browser Debug Settings UI | Virtual `/__fa_dev__/debug-widget.mjs`, imported by standings browser client |
| `dev-fictional-provider.mjs` | Isolated fictional data-provider adapter | DEV provider tests; not a canonical or remote match-result source |
| `dev-preview-artifact.mjs` | Protected Debug artifact staging and injected bootstrap | Server injection and publication-isolation tests; never part of public stage |
| `dev-standings-preview-client.mjs` | Browser DEV season/day/standings adapter | Virtual `/__fa_dev__/standings-client.mjs`, imported by debug bootstrap and client tests |
| `dev-standings-preview-data.mjs` | Deterministic fictional fixtures/standings | Virtual `/__fa_dev__/standings-data.mjs`, Stats adapters and DEV standings tests |
| `dev-world-clock.mjs` | Fictional local session/world clock | Virtual `/__fa_dev__/dev-world-clock.mjs`, standings browser client and world-clock tests |

The main dependency chain is `dev.mjs` → frontend `dev-app-preview.mjs` → `createPreviewServer` in `dev-standings-preview.mjs` → `proxyAdminApi` in `dev-admin-api-proxy.mjs` → fixed local Worker, plus a separate `npm --prefix backend run dev` child. The shared HTTPS nonproduction proxy remains an explicitly opted-in, separately secured alternative; it must never be selected by the canonical launcher.

## Tests, commands and operational checks

```powershell
npm --prefix backend ci
node tools/dev.mjs --local
```

From a second terminal, `Invoke-WebRequest http://app.localhost:2000/api/world` should return the local Worker's JSON after readiness; `/competitions/it-1/standings?season=1` must load on direct navigation and refresh. Site/app links retain separate origins; Player endpoints require `app.localhost` and operator state is governed by the Worker.

```powershell
node --test tests/dev-env-01-smoke.test.mjs tests/app-subdomain-preview.test.mjs tests/app-canonical-routes.test.mjs tests/dev-admin-api-proxy.test.mjs tests/shared-nonproduction-proxy.test.mjs
node tools/generate-app-pages.mjs --check
```

Optional after Playwright is installed and the canonical server is running: `node tests/dev-env-01-browser.mjs` (set `FA_BROWSER_ENGINE=webkit` for WebKit). The existing Site/Browser/Admin/exact-head workflow checks remain the authoritative CI evidence; do not infer browser PASS from HTTP tests alone.

## Troubleshooting and safety

- **404 on `/competitions/.../standings` or `/api/world`:** a generic static server is not supported. Use the canonical command. If the route loads but `/api/world` fails, inspect Worker startup on port 8787; the frontend cannot synthesize an official world.
- **Port in use / missing Worker:** inspect only your own listeners on 2000 and 8787; install backend dependencies with `npm --prefix backend ci`; inspect Wrangler's local log and persistence configuration. Do not kill unrelated processes or run remote migration commands.
- **Host resolution:** `app.localhost` should resolve to loopback on the same computer. On Windows inspect local resolution/browser proxy settings; never replace canonical binding with `0.0.0.0` to bypass a DNS problem; the explicit LAN QA option binds only a validated, locally assigned private IPv4 address.
- **Security and data isolation:** canonical startup never targets the shared Dev/Preview HTTPS pool, Production, a remote DB or publishing APIs. Account/email semantics stay local; Player/Admin checks, Debug injections and public artifact guards remain owned by their existing modules. LAN preview and explicitly authorized shared Preview sessions remain separate specialized workflows.

## Coordination

Scope touches only DEV launch tools, related tests, README and local-operations documentation. #351 season lifecycle, #350 D1 repository and #354 renderer refactoring are deliberately untouched. Any future consolidation of HTTP/Worker semantics belongs to those owners, not this issue.
