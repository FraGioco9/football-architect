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
