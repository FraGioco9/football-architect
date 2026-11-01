# Football Architect — Cloudflare environments and email activation blueprint

**Status: DRAFT / HOLD.** These are review-only configuration examples, not active Wrangler files. No Cloudflare account, resource, domain, secret, DNS, email or deployment is created. The current `backend/wrangler.toml` remains **local only** and unchanged.

## Local
- Run the existing loopback Worker with `PLAYER_MODE=local` and `PLAYER_ORIGIN=http://app.localhost:2000` against an isolated local D1.
- **No EMAIL binding** and no `PLAYER_EMAIL_DELIVERY_ENABLED`. Registration/recovery must fail closed (503) unless a test intentionally injects fake callbacks.
- Never set `remote = true` in local email bindings. Cloudflare warns that remote bindings send real email from local development.

## Preview (future, isolated)
- Use a separate Worker name, separate disposable Preview D1 ID and an explicitly trusted Preview HTTPS app origin. Do not reuse production D1, sessions, user data, secrets or domains.
- Preserve `PLAYER_EMAIL_DELIVERY_ENABLED` **unset**, and omit `EMAIL` entirely until a separately authorized simulated/dedicated Preview delivery strategy exists.
- No preview environment should be able to send real email or mutate production data. Keep publication guard and existing manual Preview policies unchanged.

## Production (example only; **never paste into an active Wrangler config without authorization**)
```toml
# REFERENCE ONLY — NOT AN ACTIVE CONFIGURATION
# These are individual snippets; real deployment requires separate authorized review.
[vars]
PLAYER_MODE = "production"
PLAYER_ORIGIN = "https://app.REPLACE_WITH_APPROVED_DOMAIN"
PLAYER_TRUSTED_SOURCE = "cloudflare"
PLAYER_EMAIL_FROM = "noreply@REPLACE_WITH_ONBOARDED_DOMAIN"
# Add PLAYER_EMAIL_DELIVERY_ENABLED = "cloudflare" only after external approval.

[[send_email]]
name = "EMAIL"
# Optionally restrict to an approved sender address (must be onboarded).
# allowed_sender_addresses = ["noreply@REPLACE_WITH_ONBOARDED_DOMAIN"]
# Never use remote bindings in local/Preview tests.
```

A separately approved production manifest must also bind the **correct** production D1 (never copy the local reserved UUID). Validate exact origin, domain ownership, SPF/DKIM/DMARC and DNS onboarding, Workers Paid eligibility for arbitrary recipients, email quotas, alerting and abuse handling before activating. No secrets or API tokens belong in a repository file.

## Activation checklist and stop rules
1. Confirm #170 code review, all full Worker/security/sporting migrations and both Chromium/WebKit suites GREEN on **exact HEAD**.
2. Verify provider entitlement and domain onboarding through approved Cloudflare administration; sender and `From` identity approved explicitly.
3. Verify no public email sends from Preview, local or CI; test all email flows with injected fake bindings.
4. Inspect and approve target D1 identity, migration sequence, backup/restore and world-safe rollback with named operators.
5. Configure production resources and `EMAIL` binding **only after a separate explicit authorization**; keep delivery disabled until an authorized isolated smoke test succeeds.
6. If any gate fails, keep delivery disabled, return 503 for unconfigured register/recovery, revoke operator privileges as needed, and never enable legacy Admin login.

## Relevant authoritative documents
- https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
- https://developers.cloudflare.com/email-service/configuration/send-bindings/
- https://developers.cloudflare.com/email-service/observability/local-development/sending/
- https://developers.cloudflare.com/email-service/get-started/send-emails/

The installed adapter's `EMAIL.send({from,to,subject,text,html})` shape matches the native Email Service Worker API; **its live use has not been tested**. Email templates support EN/DE/ES/FR/IT. For language selection, the request currently supplies `Accept-Language` and defaults to English if unsupported.
