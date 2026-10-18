# G10-ACCESS-07 — Individual authorization and protected-request acceptance matrix

**Status: DESIGN ONLY · NOT EXECUTED · G10 BLOCKED.**

Baseline: `FraGioco9/football-architect` main `75331cbc2b0643a4a870f87cc5dadff4aa69ca52`. Read with G10-ACCESS-01, -04, -05 and -06 feasibility findings. This matrix is an acceptance specification, **not** evidence of Vercel authentication working.

## Invariant security boundary

Use an independently protected Debug project only after separate feasibility and authorization. Default deny at the server/provider before returning protected bytes, across every hostname and resource path. The public artifact stays on the existing public project and must contain no `/__fa_dev__/` files or references. The current manual `protected_debug` workflow refusal must remain unchanged.

### Principal roster and expected results

| Principal/session | Protected Debug HTML and assets | Public site | Proof required |
| --- | --- | --- | --- |
| Owner: authenticated, explicitly approved | ALLOW, after verification | normal public behavior | identity binding and request logs |
| Named collaborator: authenticated, individually owner-approved, unexpired | ALLOW, after verification | normal public behavior | owner approval record, scoped read-only access |
| Signed-in team member who is **not** on roster | DENY | normal public behavior | 401/403 or provider challenge yielding no protected bytes |
| Signed-in outsider who is **not** on roster | DENY | normal public behavior | same |
| Anonymous visitor / no cookie | DENY | normal public behavior | same |
| Expired session | DENY | normal public behavior | same |
| Previously approved but revoked/expired collaborator | DENY | normal public behavior | effective revocation verification |
| Invalid/corrupt session or unavailable identity/authorization provider | DENY / FAIL CLOSED | normal public behavior, no Debug assets | fail-safe behavior |
| Link/token bypass, share access, custom-domain exception | **NOT AN ACCEPTED AUTHORIZATION** | unchanged | deny or eliminate bypass, inspect effective configuration |

The expected allow/deny labels are **requirements, not observed outcomes**. No collaborator is pre-approved by this document. Individual approvals require separate owner action; team membership alone never grants Debug access.

## Resource and origin matrix

Test each principal above, with *fresh cookies and cache*, against all of the following; enumerate every emitted Debug asset from the actual manifest rather than stopping at named examples.

| Origin / request | Authorized identity expected | Unauthorized identity expected |
| --- | --- | --- |
| Immutable Debug deployment URL, `/` | Authorized HTML after auth | no private bytes |
| Immutable Debug deployment URL, `/app/competitions/it-1/` | Authorized HTML after auth | no private bytes |
| Direct `/__fa_dev__/debug-settings.mjs` | Protected module response | no private bytes |
| Direct `/__fa_dev__/standings-client.mjs` | Protected module response | no private bytes |
| Direct `/__fa_dev__/stats-data.mjs` | Protected module response | no private bytes |
| Direct `/__fa_dev__/artifact-manifest.json` | Protected manifest response | no private bytes |
| Every further Debug import, map, JSON, image, CSS, source map or fixture endpoint | Protected response | no private bytes |
| Any generated Debug alias / redirect destination | Same access policy | no private bytes at any hop |
| Any mistakenly reachable custom domain, shared link or bypass link | No unreviewed exceptions | fail/hold, never infer protection |
| Existing public project URL and all public aliases | Existing public behavior | existing public behavior; no Debug files |
| Existing public project URL + `/__fa_dev__/` paths | Not found or deny | not found or deny |

A redirect, login page, blocked UI control, 200 response containing a challenge, or guessed URL is not sufficient evidence. Record response body safety, content type, status, redirect chain, cache headers, and whether any protected bytes are visible. An expected denial may be a provider login challenge, 401, 403, or 404, but must not leak protected content or allow unapproved bypass.

## Required independent test protocol

1. **Preflight** (read-only): identify Vercel plan and exact identity feature availability; independently resolve the current Access Groups 403 and all effective scope/role grants. Record project ID, deployment ID, immutable URL, alias list, custom-domain exclusions, SSO/password/bypass settings, list of owner-approved individual identities, and SHA. UNKNOWN means HOLD.
2. **Staging authorization**: request separate explicit owner approval before creating or configuring any isolated project, granting access or producing a protected deployment. No changes to the existing public project.
3. **Integrity**: build and verify deterministic `protected_debug` and `public` artifact manifests against the authorized exact SHA; reject extra/missing/symlinked/tampered files, missing import closure, or Debug resource exposure in the public artifact.
4. **HTTP/browser identity matrix**: run all principal × resource × origin combinations from isolated authenticated and anonymous sessions. Include cache and direct navigation, refresh, manual URL access, redirects, session expiry and collaborator revocation. Preserve sanitized evidence; never capture secrets or session cookies.
5. **Functional acceptance**: desktop and 390/320px; settings persistence, fixture and standings/stats behavior, first paint without partial rendering, keyboard/focus accessibility, fresh session and refresh. Record per-case PASS/FAIL, device/browser, date and deployment ID.
6. **Decision**: independently review evidence and assign PASS only if *every* mandatory identity/URL/artifact/browser case passes. Any unexecuted test, unauthorized allow, asset leak, bypass or unresolved provider uncertainty means BLOCKED. Then request **separate** approvals for workflow-guard change (later PR) and deployment; never assume either from this specification.

## Evidence record schema

For each test, store: case ID, UTC timestamp, source SHA, deployment/project identifier, origin class, sanitized path, identity class (never the email or tokens), session condition, expected result, observed status/redirect/body disclosure decision, reviewer, and PASS/FAIL/HOLD. Sensitive authorization artifacts must not be checked into Git. Summaries can be stored with identities redacted.

## Gate and action ledger

- **PASS (source/design only):** G10-ACCESS-01 policy, -03 offline regression tests, -04 independent NO-GO review and -05 isolated architecture proposal have been merged.
- **OBSERVED but insufficient:** existing project reports SSO enabled with mode `all_except_custom_domains`, password protection disabled; team member read returns one owner; Access Groups listing 403.
- **UNVERIFIED / BLOCKING:** granular effective collaborator authorization; production-grade provider plan capabilities; all-origin direct asset denial; expired/revoked access; complete hosted browser acceptance.
- **NO-GO:** G10 stays BLOCKED. This document authorizes no project, invitation, access change, token, bypass, workflow run, deploy, alias, code change, automatic trigger, production change, or merge.
