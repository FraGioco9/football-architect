# PLAYER-AUTH-01 — Account lifecycle and accessible UX policy

Status: implemented in Draft PR #329; final Worker/D1 and browser tests deferred.

## Email verification
- Email/password signup creates pending Player identities only when an approved server-only delivery adapter exists. Default configuration returns 503 without creating accounts.
- Email verification uses a 32-byte random token encoded as 64 lowercase hexadecimal characters. D1 stores only SHA-256 digests. A token expires after 24 hours and can activate only a pending unverified account.
- A conditional D1 batch guard checks token freshness and unconsumed state at commit, then consumes the token and activates the account atomically; simultaneous confirmations cannot both succeed.
- The verification page removes query-string tokens immediately, displays localized success, failure or unavailable states, and directs the user to login. Verification never signs users in automatically.

## Password recovery
- Reset requests use generic account-independent acceptance messaging. Delivery is unavailable (503) until explicitly approved, and no one-time token is returned publicly.
- Reset links expire after 30 minutes; the raw token is stripped from the browser URL before any submission. D1 verifies and consumes it atomically; successful password replacement revokes all active sessions.
- A wrong, expired or replayed token returns a generic invalid-token error. The reset flow does not bypass account verification.

## Account self-service
- Authenticated users can change password using the current password and CSRF, revoke all other sessions, sign out or request deletion with explicit textual confirmation.
- Changing passwords revokes sessions and recovery tokens. Accounts linked to a historical Admin operator cannot be deleted until the trusted Admin migration/transfer is handled.
- Neither ordinary Player signup nor browser input grants `admin.access` or world permissions.

## Accessibility and error states
- Registration, login, verification, recovery and account settings support EN/DE/ES/FR/IT through language-specific labels.
- Form controls have labels, required attributes and appropriate autocomplete hints. Loading and outcomes appear in `role="status"`, `aria-live="polite"` regions; actions disable during submission.
- Generic signup/recovery messaging avoids email enumeration. Throttling and service-unavailable errors have distinct user-friendly messaging; invalid or expired verification/reset tokens can be retried via a new request.
- Desktop and narrow-screen layouts use fluid width and responsive form structure; actual screen-reader, keyboard and Safari validation remains part of final QA.

## Deferred release gate
- Execute concurrency, token replay, CSRF, anonymous reads, session revocation, five-language and keyboard/mobile browser tests in the owner-requested final phase.
- Do not configure a provider, release, merge or touch remote D1 before explicit approval.
