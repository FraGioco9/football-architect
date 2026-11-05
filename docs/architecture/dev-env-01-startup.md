# DEV-ENV-01 — Canonical local startup and ownership map (#380)

## Decision and boundary

- **One canonical full-stack command:** `node tools/dev.mjs` (from the repository root after `npm --prefix backend ci`; Node 22). It starts the local Wrangler Worker/D1 using `npm run dev --prefix backend` and the existing site/app DEV server using `node tools/dev-app-preview.mjs`. The backend script explicitly uses `wrangler dev --local`.
- **Loopback only:** `http://localhost:2000/` is the site; `http://app.localhost:2000/` is the app; the Worker is `http://127.0.0.1:8787`. `GET /api/world` is served through the existing local API proxy when the Worker is running. A bare static server cannot supply deep links or APIs.
- **Local-only explicit environment:** the new launcher forces `FA_ADMIN_API_TARGET=http://127.0.0.1:8787`, `FA_ADMIN_API_POOL=''` and `FA_DEV_LAN=''` for both subprocesses, overriding inherited remote/shared-pool values. No flags or remote DB activation are accepted.
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
node tools/dev.mjs
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
- **Host resolution:** `app.localhost` should resolve to loopback on the same computer. On Windows inspect local resolution/browser proxy settings; never replace canonical binding with `0.0.0.0` to bypass a DNS problem.
- **Security and data isolation:** canonical startup never targets the shared Dev/Preview HTTPS pool, Production, a remote DB or publishing APIs. Account/email semantics stay local; Player/Admin checks, Debug injections and public artifact guards remain owned by their existing modules. LAN preview and explicitly authorized shared Preview sessions remain separate specialized workflows.

## Coordination

Scope touches only DEV launch tools, related tests, README and local-operations documentation. #351 season lifecycle, #350 D1 repository and #354 renderer refactoring are deliberately untouched. Any future consolidation of HTTP/Worker semantics belongs to those owners, not this issue.
