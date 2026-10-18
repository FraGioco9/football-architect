# G10-ACCESS-04 — Independent protected Debug release-gate review

Status: **HOLD — G10 NOT APPROVED. No protected Debug publication authorized.**

## Reviewed source baseline

- Repository: `FraGioco9/football-architect`, reviewed main SHA `b54f1b7ee619b5798ee76b083370bc1c09986226`.
- Approved Debug dependency closure: PR #187, merged.
- Access-control requirements: PR #189, merged as G10-ACCESS-01.
- Offline policy regression checks: PR #190, merged; these checks explicitly do not demonstrate real hosted authentication.
- Existing historical decision: `docs/dev-preview-02e-final-review.md` explicitly defers provider access control and browser acceptance.
- Manual publication workflow: `.github/workflows/manual-vercel-preview.yml`; protected Debug branch still contains an unconditional `exit 1` before deployment.

## Evidence inventory

| Gate | Evidence | Result |
| --- | --- | --- |
| G10-01 Debug artifact/runtime | PR #187 module closure and tests merged | PASS — source/CI scope only |
| G10-02 Public isolation | Deterministic public allowlist; regression checks | PASS — source/CI scope only |
| G10-03 Manual-only operation | Workflow has only `workflow_dispatch` and rejects `protected_debug` | PASS |
| G10-04 Provider protection setting | Project reports `ssoProtection.enabled=true`, mode `all_except_custom_domains` | CONFIGURED, NOT SUFFICIENT |
| G10-05 Individual collaborator authorization | Only owner appears in the retrieved team-member list; Access Groups listing returned 403 | UNKNOWN / BLOCKED |
| G10-06 Anonymous and unauthorized denial | No independently observed server-side HTTP/browser behavior on a protected Debug deployment | NOT VERIFIED |
| G10-07 Direct immutable URL and Debug paths | No tests of all origins, paths, redirects, assets and manifest | NOT VERIFIED |
| G10-08 Interactive behavior | Navigation, persistence, standings/stats, initial paint, accessibility and 320/390px responsive checks not completed on hosted Debug | NOT VERIFIED |
| G10-09 Safe publication mechanism | Protected branch of manual workflow intentionally disabled; no approved live access configuration | BLOCKED |
| G10-10 Exact deployment authorization | No specific deployment approval and independent security acceptance | BLOCKED |

`PASS` for source-level controls does not imply G10 approval. The presence of SSO is not proof of collaborator-specific authorization. Unknown access-group permissions must not be interpreted as an empty allowlist.

## Independent security decision

**NO-GO for a protected Debug deployment now.** Keep the workflow guard, public artifact, aliases, domains, collaborators and hosting configuration unchanged. Do not generate a share/bypass link to substitute for actual user authorization.

## Necessary work before a future G10 PASS

1. Choose an effective, enforceable provider-side mechanism for an explicit owner-approved collaborator roster, including invite, expiry and revocation behavior. Prefer a separate protected project/deployment if the existing shared project cannot enforce Debug-only permissions.
2. Independently inspect effective project and deployment-protection configuration, including direct immutable domains, aliases, custom-domain exclusions and bypass mechanisms. Resolve the access-group 403 through authorized administrative access rather than claiming verification.
3. With separate authorization, stage the exact protected artifact in an isolated environment under server-side authentication. Record an owner PASS, an explicitly approved collaborator PASS, and unauthorized/anonymous DENY for both page HTML and every `/__fa_dev__/` module and manifest.
4. Complete browser acceptance at 320px and 390px and desktop: navigation/refresh, controls, persistence, fixtures, standings, stats, first paint and accessibility.
5. Confirm exact-source SHA, deterministic artifact integrity, complete import closure and exact-head successful CI. Repeat security review against the *actual* deployment configuration.
6. Request explicit owner approval for each live permission change and eventual Preview deployment. Only after independently recorded G10 PASS should a separate PR propose a narrow fail-closed workflow change. Do not promote to production or automatically assign a stable alias.

## Non-authorizations

This review does not authorize deployment, workflow dispatch, PR merge, Vercel configuration changes, access invitations, share links, DNS or alias changes, production publication, or removing the protected Debug `exit 1` guard.
