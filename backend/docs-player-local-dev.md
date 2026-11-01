# PLAYER-LOCAL-DEV-01 — local-only auth acceptance (#334)

## Audit
The merged #170 backend uses one `handlePlayer` for login, registration, verification and reset. Delivery is injected via `PLAYER_VERIFICATION_DELIVERY` and `PLAYER_RESET_DELIVERY`; Gmail is Preview-only and Cloudflare Email is Production-only. Local D1 does not share accounts, sessions or permissions with Preview. The local origin policy allows only exact HTTP loopback hosts. Owner-only `backend/tools/admin-permissions.mts` already provides local grant/revoke without remote D1.

## Implementation plan
- Introduce an explicitly opted-in, local-only email sink backed by separate local storage. It must never activate with Preview/Production.
- Provide a bounded private local DEV inbox for verification and reset links, accessible only via loopback and exact origin, with no-store, expiry, and cleanup. Never log tokens or expose this endpoint on hosted Preview.
- Reuse existing localized templates and canonical URLs; account registration never grants Admin.
- Reuse local owner-only permission grant/revoke and add a guarded one-command local startup path after verifying Wrangler persistence.
- Run registration→verification→login→recovery→reset, invalidated sessions, Admin deny/grant/revoke, five locales, Chromium/WebKit and security isolation at one final test gate.

## Safety
No Gmail credentials in local config, no copy of remote D1, no Production/Preview deploy or remote writes. PR Draft/HOLD; tests only at final phase. This initial document is planning/audit only and does not claim the inbox is already implemented.

## Local launch (implementation pending final QA)

Use Node.js 22 and install backend dependencies first. From the repository root:

```powershell
npm --prefix backend install
node tools/dev-auth-local.mjs
```

Visit `http://app.localhost:2000/account/register`, register a throwaway LOCAL identity, then use the link shown in the form to open `http://app.localhost:2000/api/local-dev/inbox` and verify it. Login at `/account/login`; recover at `/account/recover`. The launcher starts the localhost static site plus the loopback Worker with `FA_ADMIN_API_TARGET=http://127.0.0.1:8787`. The proxy forwards only allowlisted API routes; the inbox remains restricted to `app.localhost`, exact `PLAYER_ORIGIN`, and local Worker mode. No remote D1 or Gmail connection is performed.

**First-run database prerequisite:** local D1 migrations must have been initialized under the SAME Wrangler persistence directory used by the Worker. Owner-only `npm --prefix backend run admin:permissions -- init --apply` can initialize the local account pool, but its Miniflare layout must be verified against Wrangler before treating Admin grants as working. Never grant Admin via registration or public HTTP. Until that persistence compatibility is verified under A05/A07, Admin bootstrap is not accepted.

The inbox endpoint serves HTML when browser navigation sends `Accept: text/html`, and JSON when called with `Accept: application/json`. This page contains one-time local tokens; do not take screenshots, forward its URL externally, or copy its database. Links are removed by token expiry; the inbox is not an outbound mailer.

**Current limitation:** this guide describes the new code but is not evidence of completed local first-run DB setup or an end-to-end PASS. Those are part of the final gate.

## Local Admin commands (stop the Worker first)

All commands are owner-only local processes. They use the *same explicit* persistence directory `backend/.wrangler/state` as the default local Wrangler config, and never accept a remote database URL.

```powershell
node tools/dev-auth-admin.mjs init
node tools/dev-auth-admin.mjs status local-player@example.test
node tools/dev-auth-admin.mjs grant local-player@example.test
node tools/dev-auth-admin.mjs status local-player@example.test
node tools/dev-auth-admin.mjs revoke local-player@example.test
```

First complete the LOCAL Player signup and verification, then stop `node tools/dev-auth-local.mjs`. Initialize the pool once with `init`, inspect the verified identity via `status` and explicitly confirm grant/revoke as prompted by the underlying owner CLI. Restart the launcher and sign in again after each grant/revoke because the CLI revokes prior sessions. Registration never assigns Admin automatically.

**Important:** The Wrangler/Miniflare shared-file layout and real live browser grant/revoke flow are still subject to A07. Never use these commands with Preview/Production identities or while Wrangler is running on the same SQLite file.
