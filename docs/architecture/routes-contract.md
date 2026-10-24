# ARCH-CLEAN-02 — A03 PR-04A Compatibility Freeze
Baseline: `c49e67cc6052ad4ff7d89f37075fb4d287f1b5c8`. Draft/HOLD: no merge, deploy, database, or runtime migration.
## Frozen hosting oracle
`vercel.json` Git blob SHA-1 `b8afd0babb019680223c39be48e659f92aae39a5`, 29 ordered redirects and 7 ordered rewrites. `tests/routes-compatibility.test.mjs` embeds every rule verbatim as JSON and checks byte hash and deep structure, including conditions and ordering.
## Allowed scope
Only `assets/routes-registry.mjs`, `assets/subpage-routes.mjs`, `tests/routes-registry.test.mjs`, `tests/routes-compatibility.test.mjs`, and `docs/architecture/routes-contract.md`. Existing ROUTE-02 facade retains the exact public return shape for domestic clubs/divisions. New pure A03 API adds `parseRoute`, `buildRoute`, `canonicalizeRoute`, `resolveRouteIdentity`; cups are handled without changing legacy facade support.
## Deferred dynamic oracle
DEV HTTP status/Location and browser popstate/refresh/query tests must be captured against this baseline before any consumer migration. Existing DEV and browser behaviors can intentionally differ from hosting (e.g. legacy `view`, temporal query stripping, INT-24 root). Do not normalize them centrally until the data are measured and approved.
## Gates
Full Node suite, generator --check, generated artifacts equivalence, exact-head CI, Chromium, publication guard unchanged, source hosting blob unchanged. File scope extension requires HOLD and renewed permission.

## PR-04B DEV and generator integration
Base `0ea77fbe50f152f5387cd0dbe3a03f81ae954963`; Draft/HOLD. Only six authorized file paths.
- DEV uses A03 `parseRoute`/`buildRoute` for domestic root and slash canonicalization while preserving existing query logic and status codes.
- Generator uses `buildRoute` for domestic card links; cup first-paint scripts and browser stay unchanged.
- CRLF isolated fixture copies `assets/routes-registry.mjs` because generator imports it.
- Tests pin DEV HTTP status/Location, generated card hrefs, and existing byte-identical hosting fixture.
- Require direct generator 23/23 and SHA-256 27/27 baseline parity, G328, full Node, Chromium, exact-head CI before merge authorization. Hosting and publication guard remain untouched.


## PR-04C implementation plan — frozen browser baseline
Approved scope: tests and documentation only, based on main `15d320845ba1e1cb9b657d06a2d0b38a26363afd` and issue #268 audit comment 6388445585. No runtime, canonical data, generator, hosting or publication-policy changes.

- [x] Record literal URL/state expectations in `tests/fixtures/a03-browser-routes.json`, independent of registry helpers.
- [x] Exercise competition normalization and calendar return validation in the existing VM harness; preserve replacement history and in-memory temporal state.
- [x] Pin strict club parser return shape and active/inactive rendered link semantics.
- [x] Extend the existing real-browser harness for direct loads, click, Back/Forward, refresh and locale/viewport coverage.
- [ ] Run targeted and full Node checks, actual Chromium, direct generator and 27-file regenerated parity; record exact tested SHA and any unavailable gate before review.

The baseline prevents a future migration from broadening club parser acceptance, letting legacy query view override an explicit path, leaking invalid calendarReturn, or losing cup leg tokens and in-page matchday state. Runtime migration and its script-loading strategy require a separate scope.

### Consumer and query boundaries

| Consumer | Owned behavior | Preserved boundary |
|---|---|---|
| `competition-tabs.js` | Read view/season/round, URL updates, history and scroll state | Explicit view wins; initial replace does not add history; History/Rules omit temporal query; only Fixtures emits matchday; unknown query/hash removed |
| `club-model.js` | Strict canonical parser and rendered links | Root/slash variants remain rejected by this caller; only Fixtures/Stats tab links carry season/matchday; inactive clubs do not invent division links |
| `club-page.js` | Initial query cleanup, clicks, Back/Forward, retained crest | Remove legacy view; Overview/History remove temporal query, other unrelated parameters/hash remain on initial load |
| `competition-page.js`, `competition-history.js`, `clubs-directory.js`, `world-calendar.js` | Club, archive and calendar links | Inventory for subsequent migration; unchanged in this lot |

The fixture has 25 competition cases covering 16 divisions and both cups, nine strict club parser cases and three initial club URLs. Expectations are literal observations of the frozen baseline, never calculated using the registry. VM tests exercise replacement history, configured cup leg tokens, path/query precedence and calendarReturn validation. Real-browser additions use the staged public bytes and existing CDP harness for direct load at 1440/390, plus club cleanup/refresh and temporal navigation across EN/DE/ES/FR/IT at representative 320/390/768/1440 widths and Dark/Light. This is a representative context matrix, not the Cartesian product of all combinations; it does not assert new Safari coverage.

The registry is ESM while these browser consumers are classic scripts. `assets/routes-registry.mjs` is not a public runtime allowlist entry. A later migration must separately decide loading/packaging, retain independent publication authority and explicitly review any generated-byte or policy change. Replacing the strict club parser directly with registry parsing would broaden accepted inputs.

### Local verification before CI

Targeted six-suite run: **51/51 PASS**, no skipped tests (Node v24.22.1). Direct generator check: **23/23 PASS**. Local Chromium unavailable: the previously available binary crashes on version inspection and a clean Playwright installation receives truncated download archives. Actual Chromium and the authoritative Node 22 full-suite result remain required CI gates; no local browser PASS is claimed.


## PR-04D implementation plan — browser bootstrap
Approved against main `15456a257e37af6cc3339cc328ab2e2a02d83b89`, issue #268 proposal 6388665606. Maximum scope: ten sources/tests/docs and 23 generated HTML documents. Consumer migration remains deferred.

- [x] Test classic/CommonJS/ESM parity, immutability, generated script ordering and staged-asset isolation before changing runtime.
- [x] Move the pure implementation to `routes-registry.js`; retain the `.mjs` named API as a thin Node facade.
- [x] Add the exact classic asset to runtimeAssets; inject its deferred tag once into Calendar, Clubs and competition HTML before existing deferred consumers.
- [x] Extend the existing browser harness to execute the staged immutable API and observe availability before deferred consumers run.
- [ ] Verify all 27 artifacts: exactly 23 one-tag HTML deltas, four exact matches; full Node/Chromium and exact-head gates before review.

### PR-04D approved bootstrap and generated exceptions

`assets/routes-registry.js` is now the sole pure implementation, using the established classic/CommonJS wrapper and an immutable API object. The Node-only `.mjs` facade preserves all nine named exports. Browser consumers are unchanged; they do not yet call the registry.

The generator inserts exactly one deferred script tag immediately after `<head>` in the 23 approved Calendar/Clubs/competition HTML outputs, before any other deferred scripts. The Clubs directory inherits the tag from the competition shell; insertion is idempotent. Inline first-paint scripts, styles, page content and all other bytes remain untouched. Publication policy changes only by adding `routes-registry.js` to runtimeAssets; the `.mjs` facade remains excluded.

Initial red checks confirmed the missing classic core, generated loading and public-asset eligibility. After implementation: **17/17 targeted tests PASS**, including G328 isolated CRLF, cross-runtime equivalence, immutability, script ordering and staged exclusion. Direct generator **23/23 PASS**. Independent regeneration against main `15456a257e37af6cc3339cc328ab2e2a02d83b89` accounts for all 27 artifacts: **23 exact one-tag HTML changes; four unchanged SHA-256 artifacts; 27/27 byte-identical after removing only that exact tag**. The four unchanged artifacts are Dashboard, Settings and the two shared manifests. This is normalized parity under the approved exception, not raw 27/27 hash equality.

The existing browser harness additionally checks actual staged API behavior, frozen API/arrays and availability before the deferred club model/competition router initialize. It checks competition routes and Calendar/Clubs directory/club pages. Actual Chromium/full Node 22/exact-head results remain CI gates; local Chrome remains unavailable. No consumer migration, hosting-rule change or additional public module is included.


## PR-04E implementation plan — browser consumer migration
Approved against main `aa052b9471ea62638e41ba021c3e7b83d1e61861`, issue #268 design comment 6388936019. Maximum 18-path scope: six runtime consumers, eleven existing test files and this document. No registry, loading, generator, canonical-data, hosting or publication-policy change.

- [x] Pin club/router delegation using the real registry with call-through instrumentation and literal output expectations before runtime edits.
- [x] Adapt strict club parsing and link builders, then competition path handling and rendered club/history/calendar/directory links.
- [x] Supply the actual registry to existing VM test environments; retain negative/query/history assertions and the frozen fixture unchanged.
- [ ] Extend actual-browser link-flow checks; run full Node, Chromium, independent review and exact-head CI.
- [ ] Verify direct generator 23/23 and fresh raw regenerated SHA-256 parity 27/27 before readiness. Consumer migration does not implement A01 lookups, A02 rules, new Providers or World Context.

### PR-04E implementation and scope HOLD

The six approved runtime consumers now call the shared core. Club parsing is a strict adapter that rejects registry redirect candidates and retains its caller-facing object shape. Query normalization, viewed seasons, clock state, focus/history and data logic stay local. Existing legacy tab-scroll storage keys are preserved verbatim and explicitly tested; canonicalizing those keys would incorrectly merge root/index storage identities.

The club/router integration tests first failed against the old independent implementation, then passed using call-through instrumentation of the actual core. Existing VM environments receive the real registry in the three fixtures that require it. Literal strict-route coverage includes all 1600 club routes and trailing-slash rejection. Fresh comparison against the exact baseline verified **8000/8000 identical rendered club HTML combinations** (320 clubs × five languages × five views). Calendar detail links retain the existing exact query order and returnPath encoding for all 16 divisions; no calendar behavior correction is included. The hidden legacy calendar return producer remains as-is; its output is distinct from the stricter competition calendarReturn acceptance contract.

**Scope blocker identified by full-suite validation:** three tests outside the approved path list assert the old concatenation source text: NAV-01B in `tests/nav-01-sidebar.test.mjs`, STANDINGS-LINK-01 and CLUB-NAV-02 in `tests/world-divisions.test.mjs`. The migration intentionally removes those source forms while preserving runtime destinations. These files have not been edited. Do not add dead source strings or weaken assertions to bypass them; any update must test actual consumer output and needs explicit path authorization.

A wider inventory also identified still-unmigrated club links in `assets/competition-fixtures.js` and `assets/competition-stats.js`, neither in the six-consumer approved runtime list. They remain unchanged and A03-08 must stay open. To finish that broader migration, the proposed extension is exactly these two runtime files, the two test files above and `tests/competition-stats-view.test.mjs` for actual registry dependency/behavior assertions. The existing authorized Fixtures/runtime test files already cover its companion dependency work. No additional module, generated, hosting or publication-policy path is proposed.

This is a reviewable partial PR within the original allowlist, **Draft/HOLD**, until that five-path extension is decided. Browser CI and independent review remain verification gates. No merge/deploy/DB.


### PR-04E five-path extension authorized

The user authorized the five additional named paths recorded in issue #268 comment 6389043137. Fixtures and Stats now use the same real registry for canonical club/team links; no validation, scoring, metrics or provider behavior is changed. Their VM fixtures receive the actual core. Call-through integration tests first failed on the old independent link construction and now pass with literal emitted URL expectations. Player labels remain unlinked; 16-team domestic and both 24-team cup contexts are covered.

The three obsolete source-form assertions have been replaced by executable consumer coverage. The directory test executes the real paint function and checks all 320 emitted canonical card destinations against literal country/id paths and publication routing. Standings/Fixtures tests execute their real renderer functions for all canonical clubs. A separate runtime fixture verifies the complete desktop and compact link sets for all sixteen divisions. Existing CSS/DEV checks remain; actual domestic/cup History dialog season links continue to be checked by the dedicated existing history-view tests.

The named allowlist is now 23 possible paths. The expected actual PR diff is **19 paths**, because the already-authorized `tests/competition-fixtures.test.mjs` also needs its real registry dependency and integration test in addition to the original thirteen changes and five newly approved paths. All other approved but unnecessary test paths remain unchanged. No registry, canonical data, generated artifact, generator, hosting, guard or workflow changes are introduced.

Extension-focused tests: **77/77 PASS**. Full local/CI and final fresh generated parity are being rerun on the updated commit. This supersedes the earlier scope HOLD once those gates are conclusively green; it does not authorize merge/deploy/DB.
