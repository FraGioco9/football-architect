# PLAYER-AUTH-01 — Provider-neutral email handoff

## Implementation
- `backend/src/account-email-content.ts` builds subject and text-only message templates for verification and password reset in EN/DE/ES/FR/IT. It validates token shape and a trusted origin. It does **not** send email or make network requests.
- Verification URLs target `/account/verify-email/?token=...` (24 hours), and reset URLs target `/account/recover/?token=...` (30 minutes); the frontend scrubs the token from its location.
- Existing Worker hooks `PLAYER_VERIFICATION_DELIVERY` and `PLAYER_RESET_DELIVERY` remain server-injected optional callbacks. Without a callback, the HTTP handlers fail closed with 503; there is deliberately no automatic provider selection.
- The local `backend/wrangler.toml` is now aligned to `PLAYER_MODE` and `PLAYER_ORIGIN`; no remote D1 or production configuration is changed.

## Owner decision still needed
Choose and approve an outbound email provider, sender/domain, verified sending identity, destination/environment allowlist, appropriate secrets and sending limits. Only then implement a specific transport, connect it to the existing callbacks and test actual delivery. Provider credentials must stay out of the repository.

## Release acceptance (not executed)
Check link origin, locales and token safety, provider failure cleanup, retries, no raw secrets in logs, one-time token consumption, anti-enumeration, local Worker+D1 and browser workflows. No CI, deployment or merge before the agreed final phase.
