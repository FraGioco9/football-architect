# G10-PUBLIC-01 — Public Preview and public Debug decision

**Status: APPROVED PRODUCT DIRECTION; IMPLEMENTATION AND DEPLOYMENT NOT AUTHORIZED.**

## Owner decision

The Football Architect Vercel Preview may be accessed publicly, **including all intended Debug tools**. No login, collaborator invitations, individually approved roster, Vercel Access Groups, or private-project requirement applies to this Preview. This is a deliberate replacement of the earlier restricted-Debug access goal.

This decision does **not** authorize an immediate deploy, removal of deployment guards, changes to Vercel configuration, publishing secrets, or changes to production. The Preview remains manually published only.

## Superseded documents and scope

- G10-ACCESS-01 (`docs/g10-access-01-collaborator-gate.md`): restricted owner/collaborator authorization policy **superseded for public Preview**.
- G10-ACCESS-04 (`docs/g10-access-04-final-review.md`): previous NO-GO based on identity denial is historically valid for the **old** requirement, not the current public design.
- G10-ACCESS-05 (`docs/g10-access-05-protected-architecture.md`): separate private Debug project and server-side identity allowlist **no longer required** for public Preview.
- G10-ACCESS-07 (`docs/g10-access-07-authorization-matrix.md`): per-user authorization/denial matrix **superseded**; retain as historical record, do not represent it as the current release gate.
- G10-ACCESS-03 offline tests: historical assertions on the existing publication guard remain correct **until a separately reviewed workflow change**. Do not delete or weaken checks as a shortcut.
- G10-ACCESS-06/-08 feasibility observations: historical read-only evidence, no longer gates for collaborator access.
- Public application authorization, production protection, and any future write-capable administrative functionality are outside this change.

Keep historical documents and prior CI evidence intact. This new decision document is canonical for the *new* product intent; operational release gates remain in force.

## Deployment model proposal (not yet implemented)

Use the existing `football-architect` Vercel Preview project unless the subsequent audit finds isolation necessary for security or deployment correctness. Package the explicitly staged Debug-capable Preview artifact, not the public-only artifact, and treat **all bytes within it as publicly readable**, including direct asset and manifest URLs. Avoid relying on SSO or obscure URLs for confidentiality; the existing project currently reports SSO enabled, so actual anonymous availability must be separately proven.

Keep GitHub Actions `.github/workflows/manual-vercel-preview.yml` as `workflow_dispatch` only. Maintain exact approved source SHA, deterministic manifest and complete module closure validation, artifact byte integrity and public artifact isolation. Do not change public production deployments, domains, aliases or existing automatic deployment settings.

## Remaining fail-closed gates

**G10-PUBLIC-02 — Exposure audit (mandatory):** enumerate every Debug file and transitive import, inspect for secrets, tokens, private user data, internal-only endpoints, administrative or write-capable actions, mutation requests, unsafe configurations and content mistakenly assumed confidential. Remove/redesign unsafe capabilities **before** any public Debug deployment; preserve the public-only artifact's clean allowlist. A read-only UI label is not a security guarantee.

**G10-PUBLIC-03 — Workflow proposal (separate authorization):** prepare a minimal, manual-only publication workflow diff. The existing unconditional `protected_debug` rejection must not be disabled until PUBLIC-02 is PASS, exact-head CI and guard tests are updated, and the owner explicitly authorizes the workflow change. No production/automatic deployment path is implied.

**G10-PUBLIC-04 — Hosted acceptance (separate deployment authorization):** only after an explicit Preview deploy approval, verify direct anonymous access to routes, Debug modules and manifest; validate desktop and 390/320px navigation/refresh, standings/fixtures/stats, settings persistence, first paint and accessibility. Verify no secrets or write-capable endpoints are newly exposed. Record exact source SHA, deployment ID and observed HTTP/browser outcomes.

## Explicit decision

**Public Preview + public Debug: approved as a requirement. Public Debug deployment: HOLD.**

This file changes no production runtime, Preview configuration, collaborator permissions, deployment workflow or security gate. No deployment may be inferred from merging this documentation.
