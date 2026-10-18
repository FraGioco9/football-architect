# G10-PUBLIC-02 — Browser runtime source review

**Current disposition (2026-10-18): PASS for reviewed static capability exposure and the exercised browser flow. Publication remains blocked.**

The earlier HOLD below records an incomplete review at its historical baseline. The later complete content review and merged PR #201 supersede that source-exposure limitation for `bc2e2855813f8aec557eaeb0cdea650eff1b22a9` and its identical-tree main squash `c1609071cef9f1d5884717b971bdae564f1ef21d`. See the [canonical exposure audit](g10-public-02-exposure-audit.md) for inventory, hashes, content findings and exact scope.

## Completed runtime reconciliation

- Reviewed six distinct Debug module sources staged at seven destinations, plus all seven inherited JavaScript files. The two staged standings-data names contain the same deterministic source. The local DEV server itself is not a published browser module.
- Four explicit fetch sites read static JSON with default GET: standings and Stats read the competition manifest, the shared competition page reads its manifest, and app search reads the division catalogue. Fixed local script loading was reviewed. No privileged Authorization header or server-mutation capability was identified.
- Fictional enablement, matchdays, reset, widget position and section expansion operate on browser sessionStorage and UI events. Theme/language use localStorage; tab scrolling uses sessionStorage. Local reset is not a hosted/database write.
- PR #201 browser acceptance exercises canonical URLs, Seasons 1–4 deep links and season-picker transitions, rendered standings/Stats against deterministic data, Fixtures, Stats subviews, numeric/slider/stepper controls, invalid input, page/global reset and same-origin persistence.
- The test retains exceptions and console errors in the Node process across document navigation, observes requests through CDP, checks same-origin GET-only traffic and rejects the socket/stream activity it observes. Chrome shutdown is awaited before temporary profile cleanup, resolving the observed ENOTEMPTY race without removing acceptance assertions.
- [Exact-head PR CI #39157575557](https://github.com/FraGioco9/football-architect/actions/runs/39157575557) and [post-merge main CI #39158710813](https://github.com/FraGioco9/football-architect/actions/runs/39158710813): **167/167 PASS**, zero failures/skips, including the Debug browser flow and theme matrix.

These results cover the tested routes, controls and viewport assertions. They do not establish full accessibility, all browser states, actual iPhone behavior, exhaustive request-dataflow safety or anonymous Vercel access. Those hosted acceptance obligations remain in PUBLIC-04; provider changes and Preview publication require separate authorization. The separately authorized PUBLIC-03 Draft PR replaces the unconditional `protected_debug` refusal only in its implementation branch with exact-source/CI, approved-manifest and post-download inventory/hash gates. Main and live hosting remain unchanged until separately authorized actions.

## PUBLIC-03 implementation scope

The candidate changes only `.github/workflows/manual-vercel-preview.yml`, its four affected test files and the two PUBLIC-02 documents. Runtime modules, builders, fictional datasets, catalogues and assets are unchanged, so the scoped content review above is not extended to new runtime behavior. The default `public` artifact remains 339 files; Debug remains 347 files with the same approved internal manifest hash recorded in the canonical exposure audit.

Publication stays manual and owner-only, for an exact SHA with green automatic CI, on the current project and Preview target. The publisher has no checkout or downloaded-code execution: it independently validates downloaded paths and hashes, including the approved Debug manifest, before the token-bearing step. CLI `64.5.0` uses the token environment variable instead of CLI arguments. Offline positive/negative tests do not establish hosted or anonymous access.

PUBLIC-03 remains pending review/merge. PUBLIC-04 remains OPEN: no workflow dispatch, deployment, alias/provider/SSO change or hosted acceptance is authorized by this implementation. Historical refusal/HOLD statements below describe their earlier baseline.

## Historical source-review record

The following source inspection and HOLD decision are retained verbatim for their earlier baseline; they do not override the scoped current conclusion above.


Source baseline: `81ac6e92b543a86af61573013c433f4067dc2b9c`.

## Confirmed evidence

The pinned automated audit on `41d70dc5f3901768eaef1f6715296f736af26e24` produced 347 Debug files, 339 public files, a verified staging/manifest, and zero *scanner-rule findings* (manual run [#39149968407](https://github.com/FraGioco9/football-architect/actions/runs/39149968407)). The subsequent main change was the documentation-only audit report in PR #195. This review inspected the browser-facing Debug source modules and primary inherited runtime scripts on current main.

The six browser-facing Debug module sources reviewed were `dev-debug-settings.mjs`, `dev-debug-widget.mjs`, `dev-standings-preview-client.mjs`, `dev-competition-stats-client.mjs`, `dev-competition-stats-data.mjs`, and `dev-standings-preview-data.mjs`. The asset builder `dev-preview-artifact.mjs` and public staging guard `publication-guard.mjs` were also inspected. Note that the generator stages seven Debug destinations because one source data file is staged under two destination names.

Primary inherited JavaScript files inspected: `assets/app.js`, `assets/app-search.js`, `assets/competition-page.js`, `assets/competition-tabs.js`, `assets/competition-fixtures.js`, `assets/landing.js`, and `assets/theme.js`.

| Source | Browser network call | Verified behavior from static call site |
| --- | --- | --- |
| `tools/dev-standings-preview-client.mjs:248` | `fetch("/competitions/_shared/manifest.json", {cache:"no-store",credentials:"same-origin"})` | Default GET for static shared manifest |
| `tools/dev-competition-stats-client.mjs:254` | `fetch("/competitions/_shared/manifest.json", {cache:"no-store"})` | Default GET for static shared manifest |
| `assets/competition-page.js:389` | `fetch(new URL("manifest.json",root),{credentials:"same-origin"})` | Default GET for static competition manifest |
| `assets/app-search.js:210` | `fetch(new URL("../data/divisions.json",sourceUrl), {credentials:"same-origin"})` | Default GET for public division catalogue |

In these inspected modules and scripts, no explicit `POST`, `PUT`, `PATCH`, or `DELETE` network operation, privileged Authorization header, WebSocket, XMLHttpRequest or sendBeacon call was found. Debug settings and UI store preference state in `sessionStorage`; general runtime persists theme or language with `localStorage` and tab scroll in `sessionStorage`. Such browser-local writes do not, by themselves, constitute a server mutation.

## Residual risks and limits

**Do not interpret a clean heuristic scan as semantic proof.** The scanner currently does not flag plain `fetch()` calls, and its explicit method detection is regex-based; computed request options, wrapper functions, unrecognized APIs and dynamic browser behavior could elude these checks. Static review of the listed entrypoints is broader than a four-call triage, but it is not an observed browser-network trace, exhaustive AST/dataflow analysis, privacy audit of every field in all 347 files, or security penetration test.

Further checks required for a final security sign-off:
1. Review actual disclosure implications of all JSON, HTML and SVG/static asset contents in the 347-file Debug artifact, including fields and links that are public even if not secret-like.
2. Verify runtime import/module closure and each intended Debug control in a browser, with network instrumentation checking unexpected outgoing calls and methods.
3. Review any dynamic actions, links, navigation and browser-visible debug affordances that may not appear as a direct network call in the checked files.
4. Separately validate the anonymous-access consequences of Vercel configuration changes and inspect the candidate artifact again on the exact SHA to be released.

## Decision

**G10-PUBLIC-02: automated artifact integrity and selected static browser-entrypoint review PASS; overall safety sign-off HOLD.** The findings give no basis to assert a verified privileged/write-capable network operation in the inspected modules, but the outstanding checks preclude an unconditional PUBLIC-02 PASS. Maintain the existing fail-closed `protected_debug` refusal and do not change Vercel settings, publish Debug, trigger manual deployment, or modify production as part of this documentation work.
