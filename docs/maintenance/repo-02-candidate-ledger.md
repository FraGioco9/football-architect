# REPO-02 — evidence-based legacy and dead-code cleanup (#357)

## Source and protection boundary

Verified starting point: `main@4fec3da66e5ede29f6cae0975c16f33579b8fde0` (2026-11-06 Europe/Rome), after #367/PR #402 and #369/PR #401 squash merges. Current source tree is not truncated (1,108 entries / 1,009 files). This work uses **only current main**. The historical unmerged pre-#347 branches are not a code source.

Active competing work: Draft/HOLD PLAYERS PR #400 (new player balancing and trial); its generator, test, data and fixture files are out of scope. No currently open PAGE-LOAD PR was listed at audit time; all page-load tests, first-paint shells and generators remain protected. #370 owns any future naming/semantic renames; this PR makes none. The repo-wide README dictates Node 22, generated-page `--check`, external-DEV isolation, strict publication guard, exact-head FULL evidence and separately authorized squash merge.

**Deletion rule:** absence from a static import graph is not sufficient. For an entire file, first prove no callers across static imports/reexports, literal and computed/dynamic imports, browser script tags, generator output, protected staging, CLI/workflow invocations, test registry and external compatibility. For a local binding or branch, a stronger *local syntactic/semantic impossibility proof* suffices when the source module, API and every entrypoint stay unchanged.

## Candidate ledger — revalidated against current main

| Candidate | Evidence and consumer trace | Decision | Change |
| --- | --- | --- | --- |
| `tools/audit-repository-assets.mjs` local `basename` | The declaration inside the asset loop is never read; all reference detection uses `asset`, `pathsToFind` and `sourceText`. Existing `tests/clean-ui-03-repository-assets.test.mjs` exercises all removal classifications. CLI entry and exports remain intact. | **REMOVE** local dead binding | Delete one unused declaration only. |
| `tools/measure-declared-assets.mjs` imported `posix` | The sole `posix` occurrence was the `node:path` import. Actual URL resolution uses `URL`; the CLI and `resolveLocalAsset`/`measureRouteDeclaredAssets` exports remain. `tests/clean-ui-03-asset-footprint.test.mjs` covers real pages, external URLs and path traversal. | **REMOVE** unused import | Delete one import line only. |
| `backend/src/calendar-rules-compat.ts` marker checks `!markers` and `!Array.isArray(markers)` | `markers` is a local `string[]` assigned exclusively by `[...calendarModel.domesticPhaseMarkers(...)]`. A successful spread always returns an array; a failed/non-iterable value already reaches the existing `catch { return fail(); }`. Neither false branch can execute. Duplicate ID and pre-existing `calendarEvents` fail-closed guards remain. | **REMOVE** two unreachable condition arms | Keep module and all exported functions. Add negative contract test. |
| Entire `backend/src/calendar-rules-compat.ts` module | `approved-season-one.ts` calls both exports, and `knockout-progression.ts` imports `legacySeasonOneRules`; unit contracts exercise frozen Season 1 reconstruction. | **KEEP** | No API, schema or fixture change. |
| `assets/competition-overview-teams.mjs` | Explicit source import from `tests/competition-overview-teams.test.mjs`; competition Overview/Teams historical rendering and routes require further runtime/feature review. Being absent from current generated HTML does not prove safe deletion. | **KEEP / runtime role UNKNOWN** | No change. |
| `tools/ci-fast-scope.mjs` | `tests/ci-fast-scope.test.mjs` imports `classify`; the CLI may be invoked independently. The current broader CI selector does not make this public/manual entry point obsolete by itself. | **KEEP** | No deletion. Possible replacement requires separate proof. |
| `tools/dev-auth-local.mjs` and `tools/dev-app-preview.mjs` | Explicit backward-compatible CLI entry points to the canonical `tools/dev.mjs` launcher; developer commands may use them externally. | **KEEP** | No change. |
| `tools/check-dev-competition-stats.mjs` | Standalone DEV-only assertions and CLI entry; no exhaustive external command invocation inventory. | **UNKNOWN** | Preserve unchanged. |
| `tools/ci-history.mjs` | Documented CLI for downloaded GitHub Actions evidence in `docs/ci/ci-opt-04-05.md`. | **KEEP** | No change. |
| `tools/benchmark-standings-first-paint.mjs` | Referenced by performance workflow; no disappearance of its use. | **KEEP** | No change. |
| `assets/standings-loading.js`, `assets/sidebar-first-paint.js` | First file loaded by generated competition HTML; second is read and inlined by `tools/render-sidebar.mjs`. Absence of a simple `src` for the latter is not evidence of nonuse. | **KEEP** | Preserve ordering and shell geometry. |
| `assets/calendar-simplified.js`, `assets/provider-selectors-bootstrap.mjs`, `assets/competition-rules-view.js` | Calendar script tags and `assets/competition-page.js` dynamic module/script loader are real consumers. | **KEEP** | No change. |
| `assets/routes-registry.mjs` | Node facade around `routes-registry.js`, used by generators and local-preview routing. | **KEEP** | No change. |
| `backend/src/temporary-simulation.ts`, `approved-season-one.ts`, `season-evidence-repository.ts` | Referenced by knockout progression, frozen-season approval and public-sporting-read paths. Names that sound historical do not prove dead code. | **KEEP** | No changes; naming belongs to #370. |
| Historical migrations, operator receipts, audit records, identifiers, auth/security and D1-bound contracts | Public APIs, archival/approval and persistent identity boundaries; removal would require migration and rollout evidence not present. | **KEEP** | No changes. |
| Flags, crests, division SVGs, logos, licenses and other unreferenced assets | `audit-repository-assets.mjs` explicitly reports no proven-unused removals; dynamic URLs/generator manifests and publication assets can retain nonliteral consumers. | **UNKNOWN / KEEP until proven** | **Zero asset deletions.** |
| Phase-coded/legacy-named tests, fixtures, PAGE-LOAD first-paint harness, PLAYERS generators | CI discovery/manifest, historical evidence and/or active #400; renaming and fixture pruning not authorized. | **KEEP** | No changes. |

**Outcome:** 3 surgical dead-code removals (unused local declaration, unused import, two tautologically false Boolean arms); **0 files deleted**, **0 exported symbols removed**, **0 new/changed runtime behavior**, **0 UI, generated output, migrations, player files or public API edits**. No file-level candidate met the much stronger deletion proof on this baseline.

## Comparison and regression evidence

The `basename` binding is a pure computed local value with no reader, so deleting it has no effect on asset inventory output or classification. The `posix` import is never referenced in any path resolution; removing it leaves the same standard `URL` operations. The backend `markers` checks can only evaluate false after a successful spread; the existing `catch`, `seen.has(key)`, explicit-calendar guard, phase-count checks and mapping validation remain byte-for-byte identical. The new negative test covers pre-existing explicit events, repeated phase IDs, invalid division IDs, preservation of the approved catalogue and the same 422 `calendar_invalid` error.

The backend module is consumed via **static** imports by the actual approved-snapshot and knockout paths; frontend dynamic consumers remain unchanged. Generated page scripts, asset references, Worker routes, DEV/preview CLI, publication guard, historical data and JS/TS exports are not modified. This is a **local semantic proof**, not a claim that the full repository has no other dead modules; external CLI and dynamic consumers that are not exhaustively proved remain UNKNOWN.

### Targeted validation commands (Node 22, clean checkout)

```sh
node --check tools/audit-repository-assets.mjs
node --check tools/measure-declared-assets.mjs
node --test tests/clean-ui-03-repository-assets.test.mjs tests/clean-ui-03-asset-footprint.test.mjs
npm --prefix backend run test:contracts
npm --prefix backend run typecheck
node tools/generate-app-pages.mjs --check
node tools/ci-discovery.mjs
```

The backend contract runner includes `backend/tests/calendar-rules-compat.test.ts`. CI's backend import graph and Node tests retain static/dynamic import coverage; these checks are not a proof of every external manual invocation. **PASS/FAIL/UNKNOWN must be assigned only from the exact commit actually executed**. The Draft PR triggers repository-managed GitHub Actions; do not manually dispatch duplicate workflows, weaken publication gates or infer PASS from historical source heads.

## Deferred / residual risk

External consumers of manual scripts, nonliteral dynamic imports, optional DEV tooling and catalogued artwork remain deliberately undeleted; these are **UNKNOWN**, not false positives to remove. A future file-level deletion needs a full caller graph plus isolated generator/publication/browser/runtime parity evidence and separate approval. #370 owns semantic renames; #400 owns PLAYERS. Physical iPhone Safari and full player-generation behavioral QA are untouched by this scoped pure cleanup. Merge, deployment, remote database mutation, secret access, branch deletion and destructive GitHub cleanup remain on HOLD.
