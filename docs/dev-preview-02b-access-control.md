# DEV-PREVIEW-02B — Protected Debug access-control design

Status: **Design proposal only; not implemented or authorized for deployment.**

## Security boundary

The `protected_debug` artifact contains fictional competition data and DEV-only JavaScript. Treat its HTML, modules, JSON, manifest, and every static asset as protected resources. A distinct hostname, obscure path, robots exclusion, CORS, client-side password, or JavaScript redirect is **not** an access-control boundary.

## Proposed architecture

1. Serve the protected artifact only behind an authenticated, server-side access gateway. The gateway must run **before** static-file resolution and before any response body is sent.
2. Authenticate with an established identity provider and enforce an explicit owner-approved identity allowlist server-side. Deny by default; do not accept identity asserted by a browser header or query parameter.
3. Require authorization for **every** request, including `/`, deep links, `/index.html`, `/__fa_dev__/*`, CSS, JS, JSON, the manifest, and unknown paths. Unauthenticated and unauthorized requests must not disclose protected content.
4. Use secure, HttpOnly, SameSite cookies over HTTPS with bounded sessions; prevent caching of authenticated HTML/data at shared intermediaries. Apply appropriate cache controls to all protected responses.
5. Keep the public Vercel artifact, domain, routing, and existing manual public Preview workflow unchanged. Never put DEV files in the public publication allowlist.
6. Store identity-provider configuration and gateway secrets only in server-side secret storage. Do not embed credentials, access tokens, or static secrets in the artifact or repository.
7. Log authorization decisions without credentials or sensitive response bodies; provide a revocation path and rate limiting appropriate to the chosen provider.

## Threats and acceptance checks

- Anonymous direct navigation, refresh, and guessed DEV asset URLs: denied before bytes are served.
- Authenticated but unapproved identity: denied for every resource.
- Approved identity: allowed only on the protected host; deep links, reloads, module imports and settings persistence work.
- Session expiration/revocation: subsequent protected requests fail closed.
- Public host: never references, contains, or serves DEV-only files, including via redirects, fallback routes, or source maps.
- No public/protected cross-origin cookie leakage; no protected resource indexed or cached publicly.
- Unknown paths and missing assets: fail closed without falling back to a public document root.

## Required decisions before implementation

- Select the identity provider and gateway enforcement point; independently verify that enforcement covers all static assets and preview URLs.
- Define approved identities, session lifetime, revocation, and audit retention.
- Validate the provider's protection behavior on the exact proposed host with a separate security review.

## G10 gate

This document does **not** approve implementation, publishing, deployment, DNS/alias changes, or bypassing the existing `protected_debug` workflow rejection. Keep that rejection in place. A future G10 requires a separate explicit authorization and independently verified access-control evidence.

## Relationship to work packages

- **02B:** proposed access-control design for review; completion requires owner approval of the mechanism.
- **02C:** independently verify deterministic manifests, byte-level isolation and fail-closed source handling.
- **02D:** run exact-head automated tests including protected access negative cases once an enforcement implementation exists.
- **02E:** independent G10 review and explicit deployment authorization remain outstanding.

## Read-only Vercel configuration audit (2026-10-16)

The existing `football-architect` Vercel project reports `ssoProtection.enabled=true` with `deploymentType=all_except_custom_domains`. Password protection and trusted-IP protection are disabled. This is evidence of Vercel Authentication being configured for covered deployment URLs, **not** proof that custom domains, every protected asset, or the proposed identity allowlist are secured.

**Preferred candidate:** Vercel Authentication on an independently verified protected deployment URL, subject to the following conditions:

- Use a hostname that falls within the enforced deployment-protection scope; never assume a custom alias is covered by `all_except_custom_domains`.
- Confirm actual membership/access rules for the chosen project and environment; do not assume that every authenticated Vercel user is an approved Debug user.
- Test anonymous, unauthorized, and authorized requests against direct HTML routes, refresh, `/__fa_dev__/*`, JSON, CSS and JS, including unknown paths and redirects.
- Keep the existing workflow-level G10 denial active throughout evaluation. Do not create or expose a protected artifact merely to test protection.
- If the intended hostname or identity scope is not enforceable with the current project settings, revise the design before implementation; do not silently disable or broaden protection.

**Decision still pending:** owner approval of the exact identity scope, protected hostname class, and session/revocation policy, followed by independent security acceptance.
