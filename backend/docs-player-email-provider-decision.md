# PLAYER-AUTH-01 — #12 transactional email provider decision (PROPOSED / NOT APPROVED)

Date: 30 October 2026. Scope: registration verification and password recovery only. This document is a decision proposal, not approval for real delivery, secrets, DNS changes, remote D1 or deployment.

## Approved provider / current Draft implementation — 30 October 2026
- Owner approved **Cloudflare Email Service** as the provider **for implementation in Draft/HOLD only**, with no credentials, DNS, real email or deployment.
- `src/cloudflare-email-delivery.ts` implements the documented native Workers binding `EMAIL.send({to,from,subject,html,text})`. The Worker injects the callbacks only when all gates are present: `PLAYER_EMAIL_DELIVERY_ENABLED=cloudflare`, `PLAYER_MODE=production`, a strict HTTPS `PLAYER_ORIGIN`, a valid `PLAYER_EMAIL_FROM`, and an `EMAIL` binding exposing `send`. **No binding or activation variables are added to local Wrangler configuration.**
- The fake-binding suite `tests/cloudflare-email-delivery.test.ts` checks missing configuration, disallowed origins, canonical verification/recovery links, rejected malformed tokens and delivery failures. These tests must pass on exact HEAD; there are no real deliveries.
- Existing explicitly injected test callbacks remain supported and take precedence. Live activation/onboarding, sender verification, DNS changes and real sends are **separate blocked work**. Implementation alone does not satisfy end-to-end #12 acceptance.
- Security rule: email URLs derive solely from fixed `PLAYER_ORIGIN`, never request Host or user-supplied redirects. Avoid logging token-bearing URLs or provider responses.

## Recommendation
**Preferred: Cloudflare Email Service (native Workers binding).** A Workers binding avoids introducing an external runtime SDK or API key for email delivery, and is naturally aligned with the existing Workers deployment. The service is beta as of 30 October 2026; arbitrary recipient sending requires Workers Paid, onboarded sender domain, and appropriate quotas.

**Fallback: Resend** via a Worker-side server secret and HTTP API/official Workers-compatible SDK if Cloudflare Email Service is not eligible or fails onboarding/operational requirements.

References (consulted 30 October 2026):
- https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
- https://developers.cloudflare.com/email-service/get-started/send-emails/
- https://developers.cloudflare.com/email-service/platform/limits/
- https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/

## Existing application contract
- `PLAYER_VERIFICATION_DELIVERY` and `PLAYER_RESET_DELIVERY` are injected server-side callback functions, each `(recipientEmail, oneTimeToken) => Promise<void>`. Do not alter Player account/session schemas or leak raw tokens to client responses/logs.
- Unconfigured callbacks must continue to fail closed with HTTP 503; no fake success, account creation or reset delivery.
- Verification token validity is 24 hours; password-reset token validity is 30 minutes. Preserve existing one-time redemption and anti-enumeration behavior.
- Email links must be built only from a separately approved fixed public app origin and canonical routes; reject untrusted Host/Origin headers, open redirects and arbitrary callback URLs.
- Delivery errors must not expose email address, token, provider response body, credentials or whether an account exists.
- Support both text/plain and HTML with equivalent links, localized EN/DE/ES/FR/IT templates, accessibility and escaped dynamic content. Use a verified branded sender and authenticated domain (SPF/DKIM/DMARC as supported).

## Pre-activation acceptance / STOP criteria
1. Owner explicitly approves the provider and confirms Workers Paid/domain eligibility or chooses Resend.
2. Owner approves the sending domain, From/Reply-To identity, retention/data processing terms, quotas and abuse limits; confirm DNS requirements independently.
3. No production secrets in GitHub, browser bundles, CI output, user data or repository commits. Prefer server bindings; any external provider key must be configured only in approved secrets storage.
4. Inject fake delivery in disposable Worker+D1 tests: verify link generation, expiry, one-time consumption, password-reset anti-enumeration, error/timeout handling, duplicate attempts, no external calls and no credential leakage.
5. Only after the above gates and separate owner authorization may an operator provision a sender or real credentials. Require isolated smoke test with an approved destination before allowing public registration.
6. A provider outage must never grant verified status or a password reset. Keep explicit error handling, no delivery from CI and no automatic switch to a different provider without separate approval.

## Decision requested
Approve **Cloudflare Email Service**, select **Resend**, or retain **HOLD**. No provider integration, DNS, live sending, production environment configuration or remote D1 operation is authorized by this proposal.
