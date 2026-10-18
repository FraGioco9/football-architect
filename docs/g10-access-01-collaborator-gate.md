# G10-ACCESS-01 — Protected Debug collaborator access gate

Status: **DESIGN ONLY — BLOCKED / NOT AUTHORIZED FOR PUBLICATION**.

## Decision and scope

The owner wants the protected Debug Preview accessible to the owner and explicitly authorized collaborators, not the general public. Reuse Vercel's existing identity and deployment-protection capabilities where they can be verified; do not implement a custom login or assume all project/team members are implicitly approved. Access to the public application is separate from access to Debug.

This document records a candidate security contract and acceptance criteria. It **does not** select a proven provider configuration, authorize collaborator invitations, authorize Vercel configuration changes, or lift the protected publication guard.

## Current evidence and limitations

- `tools/dev-preview-artifact.mjs` stages a separately verified `protected_debug` artifact; `tools/publication-guard.mjs` forbids Debug resources in the public artifact.
- `.github/workflows/manual-vercel-preview.yml` is manual-only and deliberately terminates the `protected_debug` path before deployment. **Keep this unconditional rejection in place.**
- The project's reported Vercel SSO setting is enabled for `all_except_custom_domains`; this setting alone is **not** proof that the required collaborators are individually authorized, all deployment URLs are guarded, or direct resource requests cannot bypass access checks.
- Existing `docs/dev-preview-02e-final-review.md` leaves access-control implementation and interactive browser acceptance deferred. G10 remains BLOCKED.

## Mandatory fail-closed release gates

1. **Identity and authorization:** approve an explicit list of identities separately from project/team membership. Confirm an authenticated owner and one authorized collaborator can access the intended protected deployment; verify a different authenticated but unauthorized team/project user cannot.
2. **Anonymous denial:** requests without a valid session are denied *server-side* before protected HTML, scripts, data, manifests, source maps or other private bytes are delivered. A hidden button, query parameter, browser storage flag, unguessable URL or robots restriction is not access control.
3. **All origins and paths:** test the immutable deployment hostname and any intended alias, including direct requests to `/app/competitions/it-1/`, `/__fa_dev__/debug-settings.mjs`, `/__fa_dev__/standings-client.mjs`, `/__fa_dev__/stats-data.mjs`, and `/__fa_dev__/artifact-manifest.json`. Redirect responses alone do not establish non-disclosure; check that no Debug bytes are returned to unauthorized clients.
4. **Provider protection:** independently inspect effective Vercel protection settings and identity grants **at deployment time**; refuse publication for UNKNOWN, disabled/bypassed protection or unverified custom domains, share links, protection bypass tokens, and project-level exceptions. Prefer a separately isolated protected deployment/project if public and Debug cannot be independently protected.
5. **Artifact integrity:** stage and assert the exact `protected_debug` manifest and complete browser module import closure; reject any missing/extra/tampered file or symlink. Verify the corresponding `public` artifact independently and confirm that it excludes all `/__fa_dev__/` references and resources.
6. **Browser acceptance:** complete direct navigation/refresh, Debug control changes and persistence, fixtures/standings/stats, initial paint, keyboard accessibility, and responsive 320px/390px checks. Record actual observed outcomes, not inferred PASS.
7. **Release authorization:** require exact source SHA, green exact-head Site checks, a separate documented G10 security sign-off, and separate owner authorization for one protected Preview deployment. Never authorize production, automatic triggers, a stable alias change, or collaborator invitations by inference.

## Negative cases to enforce

- Anonymous requests, expired sessions and unauthenticated direct module URLs must be denied.
- A logged-in but non-approved collaborator must be denied.
- A public deployment or custom domain cannot inherit Debug files, even when a Debug Preview is protected.
- A share link, temporary protection-bypass token, or unchecked provider setting cannot silently broaden access.
- A moving main SHA, missing exact-head CI, malformed artifact manifest, or inaccessible provider access configuration must block.
- Failure during protected staging must not leave a partially publishable artifact.
- No CI test may weaken or remove the unconditional `protected_debug` rejection as a shortcut.

## Follow-up work packages

- **G10-ACCESS-02:** define and validate the provider-level authorization model and explicit collaborator approvals in read-only mode before any live permission change.
- **G10-ACCESS-03:** implement offline security checks and browser acceptance against an approved isolated test deployment (requires a separately authorized deployment).
- **G10-ACCESS-04:** independently review evidence, then propose a narrowly gated deployment workflow in a *separate* PR; only a new, explicit owner authorization can lift the existing guard.

**Non-goals:** modifying public login, changing DNS/aliases, inviting users, turning on hosting, changing production, weakening public publication checks, or enabling `protected_debug` in the current manual workflow.
