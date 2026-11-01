# PLAYER-AUTH-01 — registration and email verification boundary

This PR includes the complete **backend registration and verification mechanism**, but it is not ready to enable for real users until owner-approved outbound email is configured. Nothing is deployed.

## Routes
- `POST /api/player/register` accepts only `{email,password}`; validates the existing password policy and normalized email, reserves source/account throttles, hashes the password using Worker Argon2id, creates a pending account and an expiring 24-hour verification token. Returns only generic `{accepted:true,verificationRequired:true}` with HTTP 202. Existing email addresses receive the same response and no token.
- `POST /api/player/verify-email` accepts only `{token}`, checks a stored digest, purpose, expiration and pending account, then consumes the token and activates the account in a D1 batch. Replay fails. No session is issued by verification.
- The token never appears in API responses, logs or database in plaintext. A delivery callback is passed only from trusted Worker configuration.
- Absent delivery callback => HTTP 503 `verification_unavailable` before any new account is created. Do not configure a live delivery callback or expose user onboarding before explicit provider approval.

## Security gate
Origin checking, JSON size limits, account/source registration throttling, pending-user login denial and password hashing share the existing Worker infrastructure. Client-submitted permissions are refused. Only a separately authorized provisioning path may grant `account_permissions`.

## Final verification (deferred by owner)
Run `cd backend && npx vitest run tests/player-registration-runtime.test.ts tests/player-auth-runtime.test.ts` against the local Worker+D1 fixture, then test replay, simultaneous verification, transport failures, cookie/CSRF, malicious inputs and browser i18n. Align legacy Admin contract tests with unified login before complete CI. No remote D1, deployment or real credentials.
