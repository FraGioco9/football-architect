# PLAYER-AUTH-01 — Session, CSRF and privilege isolation hardening

Implemented in Draft PR #329; execution of tests intentionally deferred until owner-authorized final QA.

## Server boundaries
1. Login return navigation permits only `/account/` and `/settings/`. Malformed, origin-relative, encoded or arbitrary destinations always fall back to `/account/`.
2. Login and recovery throttle by hashed account identity and trusted source, without accepting a client-supplied IP. Missing email-delivery configuration fails closed.
3. Personal account write operations require an active verified Player session plus Origin and CSRF. At the D1 mutation boundary, a guard rechecks credential version, session token digest, creation time, idle timeout (7 days), absolute expiry (30 days), status and email verification.
4. Changing the password invalidates all sessions and pending reset tokens. Revoking other sessions preserves only the currently authenticated bearer. Deleting an account is denied when linked to a historical Admin audit operator.
5. Logout checks the same session/account/CSRF identity and credential version before deleting the bearer.
6. Admin operations require separately granted D1 access and read/write permissions and explicit audit-operator linking. The Admin write guard runs in the same D1 batch as the sporting mutation.
7. Public competition/calendar/world endpoints are anonymous-readable and never obtain Player or Admin authority merely from cookie presence.

## Deferred validation matrix
- Account A's session cannot read or mutate account B's private records.
- Unauthenticated requests fail protected reads; authenticated non-admin requests fail Admin read/write regardless of browser UI state.
- Removing any Admin permission blocks fresh reads and atomic writes/replays; no sporting mutation commits.
- Missing or mismatched Origin and CSRF deny all protected mutations.
- Session invalidated by logout, password change, reset, account disable/delete or credential-version rotation cannot be reused.
- Session idle expiry, absolute expiry and clock skew fail closed.
- Return paths containing schemed URLs, encoded separators, backslashes or paths outside the allowlist never navigate away from the approved destination.
- Source/account throttles and generic unknown-email responses do not reveal existence of accounts.
- No secret, digest, password hash or raw verification/reset token is present in responses or logs.

All checks must run locally against Worker+D1 fixtures and in the final CI/browser QA before shipping. No real outbound email, remote D1 or deployment is authorized.
