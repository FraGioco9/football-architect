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

**Identity-scope decision (owner, 2026-10-16):** permit the owner **and explicitly approved collaborators**, rather than owner-only access. Grant access individually under least privilege; require an explicit per-user, server-enforced allowlist (or a dedicated access group whose membership is individually approved). **General Vercel team membership must never grant Debug access.** Remove access promptly when a collaborator is revoked. Do not create accounts, invite collaborators, or change Vercel permissions as part of this documentation update.

**Individual-selection decision (owner, 2026-10-16):** only individually selected collaborators may access the protected Debug runtime. Do not authorize the whole Vercel team. Verify the chosen Vercel protection configuration actually supports this narrower per-user boundary; if not, require an additional server-side authorization layer before enabling access.

**Decisions still pending:** the specific approved user identities, protected hostname class, session/revocation policy, and independent security acceptance.

## Access-group verification status (2026-10-16)

A read-only Vercel API query for access groups scoped to the Football Architect project returned **403 Forbidden** (`GET /v1/access-groups`). Consequently, no access-group membership or project enforcement configuration has been verified. Do not infer that an access group exists or that Vercel Authentication alone enforces individual selection.

Before selecting Vercel-native groups as the implementation, obtain authorized read access to the project's access-group configuration and verify that it gates requests to the actual protected deployment. If that is not supported, design a separate server-side allowlist gateway. No permissions or deployment settings were changed during this check.

## Plan constraint and revised design (2026-10-16)

The owner reports that Vercel's Access Groups UI prompts an **Enterprise upgrade** on the current team. Do not depend on Access Groups, assume an Enterprise subscription, or broaden access to all team members.

**Revised candidate:** an application-controlled server-side authorization gateway in front of the protected artifact, backed by a per-identity allowlist. Authenticate identities using a provider whose verified identity claims can be checked server-side, then enforce the allowlist on **every** protected request before serving any bytes. Prefer existing supported identity infrastructure over a new password store. Deny requests when identity verification, membership lookup, or gateway execution fails.

Architecture selection remains provisional until the deployment topology is verified: a static artifact alone cannot enforce a server-side allowlist, and Vercel Authentication must not be assumed to pass a suitable verified identity claim to the application. Assess supported Vercel Functions/middleware and identity integration before choosing the implementation. Maintain the protected publication block and require separate G10 approval.

## Owner architecture decision — Cloudflare Access (2026-10-16)

The owner selected **Cloudflare Access** instead of Vercel Enterprise Access Groups or a custom login. Keep Vercel as the hosting provider and retain the existing public site unchanged.

**Proposed protected path:** Cloudflare Zero Trust Access application for a dedicated Debug hostname; email one-time PIN as the initial identity method, with an explicit per-email allow policy (owner and individually approved collaborators). Deny everyone else. The protected application must cover all paths and resources, including assets and direct navigation.

**Mandatory origin-bypass gate:** Cloudflare Access on a custom hostname does not, by itself, prevent direct requests to a Vercel-generated deployment URL. Before any G10 publication, demonstrate an enforceable origin-side restriction that denies unauthenticated direct-origin access, or adopt a deployment topology with equivalent independently tested guarantees. Do not rely on hostname secrecy, DNS, robots.txt, or client-side checks. Verify interactions with Vercel deployment protection and custom-domain exclusions.

**Pre-implementation checks:** confirm the available Cloudflare Zero Trust plan limits and identity policy features; verify DNS/hostname ownership, Vercel project deployment-protection behavior, exact origin routing, and whether a server-side Access JWT validation gateway is needed. Never put a Cloudflare service token in a public static artifact.

No Cloudflare application, DNS change, identity policy, deployment, or Vercel setting is authorized by this design decision alone. Existing G10 rejection remains active.

## Supabase consolidation decision (2026-10-17)

The owner subsequently selected **Supabase for authentication, authorization, and application data**, replacing the earlier Cloudflare Access proposal. Public visitors can browse the landing, guides, and competition pages anonymously; entering the game requires an account authenticated with **email and password**. Include email verification, password reset, and session handling in the public-auth design.

The protected Debug runtime uses the same Supabase identity system but requires a **separate, explicit, per-user server-side authorization check**. A valid player account must not grant Debug access. Public game authorization and protected artifact authorization remain distinct security boundaries. Every protected asset request must be enforced server-side, including direct Vercel origin URLs; RLS alone does not protect static HTML/JS files.

**Supersession:** Cloudflare Access and Vercel Access Groups are no longer the selected approach. Previous sections document historical evaluation only. Do not configure Cloudflare or deploy Debug. A dedicated Supabase project for Football Architect is required; no existing unrelated project should be reused. The G10 block remains in force.
