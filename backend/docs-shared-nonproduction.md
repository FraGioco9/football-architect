# Shared Dev/Preview backend

Owner decision (31 October 2026): Dev and Preview share accounts **and the entire nonproduction world**, including competitions, seasons, calendar, matches and results. Production has its own Worker/D1 and accounts. Each frontend requires a separate sign-in. This is implemented as opt-in code; no hosted resources or live data have been changed.

## Topology and safety

Dev's `http://app.localhost:2000` frontend sends allowlisted `/api` requests through the local development server to the same HTTPS application origin used by Preview. Preview routes `/api` to the shared Worker. That one Worker's `DB` contains accounts, session/permission data and world tables. Existing authorization joins remain in the same atomic D1 mutation batch. A Dev world change is therefore immediately a Preview change, including reset/archive/calendar operations; exercise those commands only on intended shared test data.

The Worker uses `PLAYER_MODE=preview`, one exact HTTPS `PLAYER_ORIGIN`, trusted Cloudflare transport and an existing immutable `dev-preview` pool marker. Preview fails closed without that marker. `/api/environment` reports only the pool/origin/protocol contract; it exposes no account IDs, tokens or world payload. The Dev server validates that contract **before forwarding credentials**, and sends `X-FA-Expected-Pool: dev-preview` on every API request. Production rejects that header before dispatch; changing the backend after the handshake cannot turn the next request into a Production command.

Known pool mismatches also block anonymous world/competition/calendar reads. Unmarked legacy local/Production configurations retain compatibility; this does not establish or certify their eventual environment separation. Actual activation must bind separate resources, initialize the intended pool under separate approval and verify the exact deployed configuration.

The bridge is loopback-only, uses a server-configured canonical HTTPS origin, native TLS verification, no redirects, bounded bodies/timeouts and exact local Origin checks. Only `app.localhost` may use private Player/Admin APIs. Client source/forwarded headers and authorization are stripped; public world/season/calendar reads strip all credentials. Cloudflare supplies the real transport source. Each API dispatch performs a fresh handshake.

The Preview cookie remains `__Host-fa_player` (Secure, HttpOnly, Strict, host-only). Dev translates only this validated session cookie to its own host-only `fa_player_local` (HttpOnly, Strict) for HTTP loopback. Login mints separate session tokens; no SSO or cross-origin cookie sharing. Logout ends only that session; explicit account-wide session revocation remains account-wide. Admin grants apply to the common account, while every command still checks current permissions and CSRF.

## Local opt-in after approved setup

Prerequisite: an approved shared Preview application origin serves both frontend and Worker `/api` routes, the Worker has the configuration above, all existing data is preserved and the nonproduction D1 is already stamped `dev-preview`. The example TOML is documentation, not an activation script. Existing `wrangler.toml`, publication guards and `vercel.json` remain local/unchanged.

PowerShell, in the repository root:

```powershell
$env:FA_ADMIN_API_TARGET = 'https://REPLACE-approved-preview-app.invalid'
$env:FA_ADMIN_API_POOL = 'dev-preview'
node tools/dev-standings-preview.mjs
```

Open `http://app.localhost:2000` and sign in independently from Preview. Shared mode disables fictional Dev season/calendar/standings/stats overlays and uses the same authoritative sporting loaders as Preview, retaining local app/site navigation. Remove both environment variables to return to the existing disabled bridge; the prior `http://127.0.0.1:8787` local Worker target continues to work without a pool option. Restart the Dev server after changing target/pool. Do not select the Production application as the target.

## Owner command and activation boundaries

`admin:permissions` remains **local only**, with dry-run default and explicit account confirmation. See [owner command](docs-owner-permissions.md). It operates on an existing verified site account; it does not create accounts, copy databases, synchronize pools or execute remote grants. No remote adapter is provided by this block.

The mailbox and intended account are still to be created. Preview cannot activate the existing native real-email adapter, even with an accidental binding/opt-in; registration/recovery fail closed without an explicit delivery implementation. Approving the topology does not approve sender configuration, delivery, DNS, Cloudflare provisioning, remote D1 migration/initialization/rebinding, live grants, deployment or merge. Hosted activation and acceptance require a separate authorized operational block with concrete resources and preservation checks.

Tests use disposable local Worker/D1 and a synthetic HTTPS transport boundary: same account with independent sessions, shared world mutation, immediate permission revocation, strict pool/Origin/CSRF checks and bridge credential/cookie isolation. Hosted routing/TLS/Cloudflare configuration are not certified by these tests. Issue #170 remains **13/15 (86.7%)** until actual authorized cutover and final live acceptance.
