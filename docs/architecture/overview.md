# Football Architect — current architecture and naming

**Living baseline:** `main@f9b595636d02d4a1ebfdbd967e1a97c18f2dd41d` (2026-11-06). [Document index](../README.md). Football Architect implements a generated multilingual UI and a D1/Cloudflare Worker backend, but not a finished manager career or automatically verified hosted Production.

## Components and authority

| Layer | Actual owners | Boundaries |
| --- | --- | --- |
| Static UI/locale/theming | `templates/app-page.html`, `assets/landing.js`, `assets/app.js`, shared CSS | EN/DE/ES/FR/IT, dark/light, keyboard focus, static reserved first paint |
| Generated competition/club pages | `tools/generate-app-pages.mjs`, `render-competition-page.mjs`, `generate-club-pages.mjs` | Deterministic outputs; never hand-edit generated pages |
| Canonical routes/hosting | `assets/routes-registry.js`, `vercel.json` | Public path and redirect compatibility |
| Sporting identities/rules | `assets/sporting-contract.js`, `assets/rules-registry.js`, `assets/competition-rules.js` | 8 countries, 16 domestic divisions, 2 cups, versioned snapshots |
| World and Debug | [SH-03](../state/sh-03.md), clock/provider coordination | D1 owns generation/revision/season/day; viewed URL and protected fictional Debug do not |
| Public and private Worker | `backend/src/index.ts`, `http-player.ts`, `http-admin.ts` | Public projection, verified Player session and separately granted Admin commands |
| Persistence/lifecycle | `backend/src/world-repository.ts`, `backend/src/domain/`, `backend/migrations/` | D1 transactions, receipts, archived history and 56-day cycle |
| Local DEV/CI | `tools/dev.mjs`, `backend/wrangler.toml`, `.github/workflows/` | Local loopback; fail-closed public allowlist and exact-head CI |

Season 0 is unstarted, not completed results. Provisional club membership is not approved sporting history; protected DEV projections cannot be published as canonical output. Competition paths: `/competitions/<id>/<view>`; club paths: `/clubs/<country>/<clubId>/<view>`. International cups do not have an invented Overview. [Routing](routes-contract.md), [rules](sh-01-sporting-contracts.md), [HTTP](../../backend/docs-http-contracts-be-02.md), [lifecycle](../../backend/docs-season-lifecycle-be-04.md), [D1](../../backend/docs-d1-repositories-be-03.md).

## #370 private naming choices — merged PR #404

The private OLD → NEW decisions changed **no file paths, published URLs, exported APIs, DOM IDs, persistent schema/keys or CLI**:

| Unchanged module filename | Current private identifiers |
| --- | --- |
| `assets/competition-page.js` | `mainContent` (was local `status`) |
| `assets/calendar-simplified.js` | `calendarTexts`, `currentWeekShortcutButton` |
| `assets/sidebar-evolution.js` | `positionOpenDropdowns`, `scheduleDropdownPositionUpdate` |
| `tools/competition-view-skeletons.mjs` | `renderHistorySkeletonMarkup`, `renderRecordSkeletonCards`, `renderAwardSkeletonCards` |
| `backend/src/temporary-simulation.ts` | `parseMatchContext` |

Filenames such as `calendar-simplified.js`, `sidebar-evolution.js`, `backend/src/commands.ts`, `tools/dev-standings-preview*.mjs` and phase-coded tests remain deliberately unchanged. No blind rename or old-branch restoration.

## #357 cleanup and open questions

[PR #403](https://github.com/FraGioco9/football-architect/pull/403) removed only demonstrably unused bindings/guards and **deleted zero files**. The [KEEP/REMOVE/UNKNOWN ledger](../maintenance/repo-02-candidate-ledger.md) preserves reasons and dynamic import/CLI exceptions. Static graph absence is not proof that a public asset or external script is dead.

Default `node tools/dev.mjs` is loopback-only and disables inherited shared-pool values. Shared Dev/Preview requires an independent opt-in to a nonproduction Worker/D1 and is not Production. [DEV](dev-env-01-startup.md), [shared pool](../../backend/docs-shared-nonproduction.md), [Auth](../../backend/docs-auth-security-be-05.md), [CI/QA](../ci/README.md). Live remote infrastructure, physical Safari/VoiceOver and third-party deploy hooks are UNKNOWN until independently checked.
