# Football Architect

Football Architect is an in-development football-world application with generated, multilingual pages and a Cloudflare Worker/D1 backend. Player account registration/verification/recovery and unified Admin authorization are **implemented in source**, but this is **not yet a complete playable football-management career**. Implemented code does not prove that a hosted Production service or email provider is live. Protected fictional DEV/Debug results must never be treated as approved historical results.

## Implemented world and interface

Eight countries, 16 domestic divisions, two international cups (Sovereign and Federation), 320 club identities (256 provisional active domestic participants and 64 others). Landing, Guide, Dashboard, Calendar, Settings, Competitions, Clubs, Account and authorized Admin pages. EN default plus DE, ES, FR and IT; dark/light themes; keyboard navigation and localized Skip to main content. Season 0 is unstarted, the sporting calendar spans 56 days and D1 owns verified world state. Player-generation trials and career features remain in development.

[Documentation index](docs/README.md) · [Architecture and source ownership](docs/architecture/overview.md)

## Windows 11 / PowerShell DEV startup

Use Node.js **22**. From the repository root:

```powershell
npm --prefix backend ci
node tools/dev.mjs
```

**Default = local Worker code + shared Cloudflare D1:** the frontend and Worker execute on your PC at `http://app.localhost:2000` and `http://127.0.0.1:8787`; the Worker connects directly to the **existing** nonproduction D1 (`football-architect-dev`) through Wrangler's `remote = true` binding. The hosted Preview uses the same database but can run older code independently. New backend APIs can be tested locally **without deploying Preview**. Shared data changes are real; avoid destructive testing, and sign in separately from the hosted Preview. The launcher never migrates, deploys or copies data. Wrangler login/network access is required for remote D1.

**Important:** The shared database already has its own verified accounts. An account created only in the old isolated local D1 will not log into the shared D1 until separately migrated or registered/verified via hosted Preview. A 401 from `/api/player/permissions` before signing in is expected; check the **POST `/api/player/login`** status to diagnose a failed login. Clear obsolete `app.localhost` site cookies if switching DBs leaves stale sessions; do not repeat logins into a 429 throttle.

**Explicit isolated local mode** for offline QA, disposable experiments and operator tooling:

```powershell
node tools/dev.mjs --local
```

This mode starts a local-only Wrangler Worker/D1 at `http://127.0.0.1:8787`, fully isolated from Cloudflare. Local migrations and owner-only permissions remain manual. The legacy `node tools/dev.mjs --shared https://preview.football-architect.workers.dev` invocation remains available to explicitly **proxy the hosted Preview Worker**, but requires its deployed API version to be up to date. This is not needed for normal development. Ctrl+C stops either mode.

Optional frontend-only iPhone Safari QA on trusted Wi-Fi (replace with the PC's own private IPv4 from `ipconfig`):

```powershell
node tools/dev.mjs --local --lan 192.168.1.90
```

Open `http://192.168.1.90:2000/dashboard` on the phone. The old command `node tools/dev.mjs --lan 192.168.1.90` is also supported and uses the **shared D1** for localhost while exposing only the static site over LAN. Use `--local --lan` when testing with isolated data. LAN `/api/*` is denied; **login and authenticated API access on the phone are not supported**. This does not expose Player/Admin, local inbox or D1. Never port-forward or bind to all interfaces. [Full DEV guidance](docs/architecture/dev-env-01-startup.md).

## Source and contracts

| Area | Authoritative source |
| --- | --- |
| Static shell and generation | `templates/app-page.html`, `tools/generate-app-pages.mjs` |
| Competition and club rendering | `tools/render-competition-page.mjs`, `tools/generate-club-pages.mjs` |
| Canonical routes and sporting rules | `assets/routes-registry.js`, `assets/sporting-contract.js`, `assets/rules-registry.js` |
| World and protected Debug | [SH-03](docs/state/sh-03.md) and validated Worker/DEV provider coordination |
| Public API, Player and Admin | `backend/src/index.ts`, `backend/src/http-player.ts`, `backend/src/http-admin.ts` |
| D1 persistence | `backend/src/world-repository.ts`, `backend/migrations/` |
| Hosting/publication | `vercel.json`, `tools/publication-guard.mjs` |

Never edit generated HTML/manifests by hand. Read-only consistency check:

```powershell
node tools/generate-app-pages.mjs --check
```

Domestic competitions use `/competitions/<id>/<view>`; clubs `/clubs/<country>/<clubId>/<view>`. International cups have explicit supported views, not invented Overview pages. Do not restore removed `/app/` routes. Viewed `season`/round is presentation state, not D1 authority. [Routing contract](docs/architecture/routes-contract.md), [sporting rules](docs/architecture/sh-01-sporting-contracts.md), [HTTP API](backend/docs-http-contracts-be-02.md).

## Verification and operating rules

```powershell
node tools/ci-discovery.mjs
node tools/generate-app-pages.mjs --check
node --test --test-concurrency=1 (Get-ChildItem .\tests\*.test.mjs | Select-Object -ExpandProperty FullName)
```

The broad Node command is **not necessary on every local documentation edit**; see [CI/QA guide](docs/ci/README.md). Backend commands after dependency installation include `npm --prefix backend run typecheck` and `npm --prefix backend run test:contracts`. FAST/TARGETED does not certify FULL, and physical Safari/VoiceOver is not certified by emulation.

**Default shared DEV/Preview** runs the current Worker source locally with the **remote nonproduction D1** binding; hosted Preview independently runs its last published Worker against that same DB. **Isolated --local** Worker/D1/inbox remain loopback-specific. **Production** needs distinct Worker/D1/accounts, secrets, domain and owner approval. The manual Preview workflow and repository publication allowlist are not deployment authorization. [Auth](backend/docs-auth-security-be-05.md), [shared nonproduction](backend/docs-shared-nonproduction.md), [Preview](docs/manual-preview.md).

Authorized workflow: current `main` → one task branch / grouped commit → Draft/HOLD PR in English → exact-head CI → review → **separately authorized squash merge** → verify post-merge. Deploy, remote DB, branch deletion and secret changes need independent approval. #357 removed only proven dead guards/bindings (**zero files**); #370 renamed **private identifiers only**, leaving public filenames and routes unchanged. Preserve historical snapshots, migration receipts and discarded pre-#347 branches solely as audit evidence. Remote integrations and physical accessibility are **UNKNOWN** until independently verified.
