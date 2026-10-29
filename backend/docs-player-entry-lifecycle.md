# PLAYER-AUTH-01 — Unified Player entry lifecycle

Implemented on PR #329, pending final QA.

## Registration and activation
- /account/register/ posts the five-locale form to /api/player/register.
- Worker normalizes email, validates passwords, enforces per-source and per-email throttling and creates a pending account with a digest-only, one-use verification token. Duplicate identities receive generic acceptance.
- /account/verify-email/ consumes a live token and activates the identity before sign-in. Actual outbound delivery requires the separately approved provider in checklist item 12; without it registration fails closed with HTTP 503 and a localized unavailable state.

## Sign-in, restore and sign-out
- /account/login/ posts email and password and accepts only /account/ or /settings/ as a return destination.
- The login view probes /api/player/session and restores an existing valid session without repeating authentication. A pending login submission takes precedence over an in-flight restore response to avoid navigation races.
- /account/ restores its own session via the same authenticated Worker endpoint; a missing or invalid session redirects to unified login with a safe return path.
- Sign-out posts /api/player/logout with the derived CSRF token, revokes the current D1 session, clears the cookie and navigates back to unified login.
- Password change, all-device revocation and account deletion follow separate authenticated self-service controls.

## Trust and release constraints
- Server-issued HttpOnly SameSite cookies, separate local/production cookie names, durable Player identity and per-request D1 session validity are enforced in Worker.
- Account pages provide EN/DE/ES/FR/IT copy, labeled fluid forms and accessible status regions. No player registration grants Admin rights.
- No gameplay engine, club management, new world or new storage is introduced.
- Final Worker/D1, browser, mobile and accessibility tests are consolidated into the original final verification checklist criterion. Neither actual email delivery nor a production roll-out is claimed here.
