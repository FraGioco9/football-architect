# G10-ACCESS-05 — Protected Debug environment architecture (design only)

**Decision: PROPOSED ARCHITECTURE / G10 BLOCKED / NO DEPLOY AUTHORIZATION.**

## Source baseline and observed provider state

- Source baseline: `FraGioco9/football-architect` main `b41fa08733a2b980a8ad421fb04adf04c49a9e39`.
- Prior policy and independent no-go review: G10-ACCESS-01 and G10-ACCESS-04. Offline checks in G10-ACCESS-03 do not prove provider enforcement.
- Existing Vercel project `football-architect`: SSO reports enabled with `all_except_custom_domains`; password protection disabled. These are settings, not authorization proof for all protected Debug paths.
- Team-members read exposes one confirmed owner and no other returned members. Access Groups listing returns 403: effective memberships and access grants remain **UNKNOWN**, not empty or denied.
- Existing manual-preview workflow must keep the `protected_debug` unconditional publication refusal unchanged.

## Recommended boundary (subject to feasibility validation)

**Prefer an entirely separate Vercel Debug project**, isolated from the public project's domains, deployment protection and deployment configuration. Reuse only the deterministic source-to-artifact builder; publish only the explicitly generated `protected_debug` artifact to the proposed private project. A different route on the current public project is *not* a sufficient security boundary.

Public project → public allowlisted artifact; no Debug module or manifest paths.
Proposed private Debug project → protected_debug artifact; no production alias or custom domain; server-side identity gate on every request; explicit, owner-approved allowlist of individuals.

This recommendation is conditional: do not assume that a separate Vercel project or team SSO alone enforces individual access. Validate plan capabilities, project-level roles, actual deployment protection behavior, and bypass mechanisms before approval. If granular collaborator access cannot be demonstrated, select another independently reviewed authenticated hosting design or **stay BLOCKED**.

## Fail-closed policy

1. Default deny: unknown identity, anonymous visitor, account outside the approved roster, expired/revoked approval, unavailable identity service and unknown protection state must not receive protected HTML, scripts, manifests, fixtures or data.
2. Authorization happens **server-side before the response** for each direct URL and every dependency, not solely in a JavaScript UI, a landing-page redirect or obscurity-based path.
3. Protect immutable deployment URLs, generated aliases, any redirect target, direct `/__fa_dev__/` assets, manifest and source maps. No unrestricted custom domain, public static asset bypass, protection bypass token/share link or preview convenience feature.
4. Least privilege: each collaborator must be named and individually approved by the owner, have only the required preview-view capability, with defined expiry/revocation and auditable access. Team visibility does not automatically imply permission.
5. Preserve the pre-existing public publication allowlist and public Preview functionality; do not alter public project authentication, aliases or production.
6. Do not remove the manual workflow `exit 1` guard until a later, separately authorized, exact-head-reviewed fail-closed workflow patch and security acceptance exist.

## Candidate evaluation

| Pattern | Benefit | Residual blocking condition |
| --- | --- | --- |
| Separate Vercel project + verified provider-side auth (preferred candidate) | Isolates public/Debug artifacts and domain settings | Must prove individual authorization and denial on *all* URLs; verify provider feature support |
| Same project with protected Debug route | Fewer projects | Shares public-origin and protection surface; do not approve without independent server-side partition proof |
| Client-only login or unguessable Preview URL | None acceptable for access control | **REJECT**: cannot secure direct asset downloads |
| Public share/bypass link | Convenience | **REJECT** as a substitute for identified, revocable individual authorization |

## Non-invasive validation sequence

**Phase A — read-only feasibility:** inventory account plan and authorized identity features; reconcile Access Groups 403 through permitted admin evidence, verify project/team protection effective scope and custom-domain exclusions; enumerate all public and proposed private origins. No invitation or setting change.

**Phase B — explicitly authorized isolated staging:** only after separate owner approval, configure a disposable private project/deployment with no public alias, no automatic deploy, and individually granted access. Record source SHA, project scope, immutable origin and settings snapshots; do not change public project.

**Phase C — enforcement acceptance:** independently test owner allow, approved collaborator allow, anonymous deny, unauthorized signed-in user deny, revoked collaborator deny, and identity-provider failure deny. Repeat for root HTML, every asset, manifest, direct module URL, refresh, redirects and immutable deployment URL; verify no bypass. Treat unknown, unreachable or untested cases as FAIL/HOLD.

**Phase D — browser and release gate:** exercise desktop/390px/320px, first paint, settings persistence, navigation/refresh, fixtures, standings, stats, accessibility and import integrity. Require exact-head CI and a signed independent G10 PASS. Request separate permission-change and deployment authorizations. Any workflow unlocking is a later PR, not part of this design.

## Acceptance criteria for lifting G10

G10 stays **BLOCKED** unless ALL are documented: owner-approved finite roster; verified effective server-side access controls; full URL/asset deny matrix; revocation; browser acceptance; complete, deterministic Debug artifact and source SHA; manual-only and isolated deployment; an independent security signoff; explicit, deployment-specific owner approval.

No provider configuration change, collaborator invitation, bypass-link generation, workflow execution, Debug deploy, alias, production release, or merge is authorized by this document.
