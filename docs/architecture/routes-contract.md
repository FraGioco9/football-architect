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
