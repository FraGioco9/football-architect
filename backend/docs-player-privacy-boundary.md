# PLAYER-AUTH-01 — Privacy and public projection boundary

## Data classification
- Private D1: `player_accounts` (email, password verifier, credential version, verification status), `player_sessions` (bearer token digest and CSRF digest), `player_one_time_tokens` (verification/reset digests), `player_auth_throttles` (hashed source/account keys), `account_permissions` and `player_admin_operator_links`.
- Only authenticated self-service endpoints may return the requesting account's own email, its explicit permissions and sanitized session metadata. Session tokens, their digests, password verifiers, recovery tokens and throttle keys are never included in JSON responses or console logs.
- `GET /api/player/sessions` selects solely the authenticated account ID and projects `current`, `createdAt`, `lastSeenAt`, `expiresAt`; the SQL digest is used only for equality comparison.
- `/api/admin/*` requires both a valid Player session and D1 permissions. Legacy linked-operator records are historical audit identifiers and never a source of privileges.
- The anonymous `/api/world`, competition-season and calendar routes operate solely on sport/world repositories. They never query Player identity, session or permission tables. `projectWorld` parses the published WorldV1 schema.
- Client-visible errors consist of stable error codes only. Do not stringify unexpected exceptions, request bodies, cookies, provider message payloads or database row contents into responses or production logs.

## Transport and storage
- All Player and Admin API responses (including errors) set `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, `Vary: Cookie`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`.
- Account/login/register/recovery/verify HTML also carries a no-referrer and no-index policy. **The static hosting layer must additionally set no-store HTTP headers for private HTML at release**; HTML meta elements are not a replacement for response headers.
- Login cookies remain HttpOnly, SameSite Strict and Secure with the __Host prefix in production; the client never reads bearer cookies.
- No email delivery provider is connected; outbound messages and secrets require a separate owner decision.

## Final acceptance (deferred)
Run Worker/D1 privacy regressions for anonymous sporting endpoints, private routes without credentials, two-account isolation, zero secrets in error bodies, all status-class headers, HTML hosting headers and Cloudflare cache policy. Verify structured logging does not include token-bearing query strings. No QA claim until these checks pass.
