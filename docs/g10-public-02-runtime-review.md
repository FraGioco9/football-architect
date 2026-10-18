# G10-PUBLIC-02 — Browser runtime source review

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
