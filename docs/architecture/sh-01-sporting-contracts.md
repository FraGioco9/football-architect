# SH-01 — Canonical sporting identities and boundary audit

Baseline: main `08c04e7363c19cc227264e0c170760317512cbb5` (squash of SH-03 #373). Draft/HOLD, no merge, deployment or remote D1.

## Ownership table

| Contract | Canonical owner | Consumer / adapter | Invariant |
| --- | --- | --- | --- |
| Country, competition IDs, version binding, cup final IDs | `assets/sporting-contract.js` (pure UMD) | backend snapshot validator, calendar evidence, scheduling/qualification, and Node world catalogue; browser registry/calendar resolve the canonical module when supplied but retain frozen standalone UMD mirrors for the existing deferred-script load order; browser and Node parity is tested | 8 countries, 16 divisions, 2 cups, 3 immutable versions |
| Full sporting rules / phase semantics | `data/divisions.json`, `data/international-competitions.json`; validated by `assets/competition-rules.js` and versioned `assets/rules-registry.js` | `tools/competition-catalogue.mjs`; Worker full-rule snapshot comparison | 16×30 domestic games, 24×6 INT league |
| World calendar markers | `assets/world-calendar-model.js` | `backend/src/calendar-rules-compat.ts`, `backend/src/season-calendar-evidence.ts` | 56 days; 33 N events, 12 I plus 2 finals |
| Season 1 approval, data hashes and membership | `backend/src/approved-season-one.ts`, `backend/src/catalogue-snapshot.ts` | Season 1 trusted snapshot loader | Stored hash cannot self-approve |
| Later-season evidence and archives | backend season authority and archival boundary | History and public read projections | Historical results remain immutable |
| Static club/catalogue identities | `assets/world-catalog.mjs` (data catalogue) | Node generation / static presentation | Not an authority for live membership |

The pure identity module contains no Worker, DOM, mutable season or membership dependency. It is not a source for historical rules snapshots. Calendar derives marker placements; explicit Worker adapters validate their projections against approved, versioned snapshots. Worker and Node duplicate local arrays removed where identity equality is exact; browser fallback arrays and the exact pinned calendar definition remain an intentional compatibility representation, guarded with execution-based parity tests; actual removal requires #359's coordinated script-loading change.

## Deliberate non-deduplications

* `competition-model.js` retains its historical/preview compatibility profile; this is not an authorization for server sporting outcomes.
* Backend snapshot/hash validators remain independent of browser mutation, because trusting a client-derived hash or status would violate fail-closed approval.
* Fixture scheduling, international qualifications, archive serialization and page HTML are separate bounded contracts.
* SH-03 owns global/source/view/Debug state; SH-01 must not redefine it.
* #359 owns first paint and page render; #349 owns HTTP/auth boundaries; #354 owns later renderer consolidation.

## Review / verification

Focused tests: `node --test tests/sh-01-sporting-contract.test.mjs tests/rules-registry.test.mjs tests/rules-registry-integration.test.mjs tests/world-calendar-model.test.mjs`. Backend: `npm --prefix backend run typecheck`, then targeted calendar/snapshot/season tests. Final exact-head gates required before review. This document does **not** claim those tests passed before execution.

## Explicit consumer parity and compatibility rationale

- `assets/rules-registry.js`: Node resolves `sporting-contract.js`; standalone browser UMD retains the frozen three-version/final mirror. VM-based test proves browser bindings equal Node bindings.
- `assets/world-calendar-model.js`: The approved file remains byte-identical to the Season 1 SHA-256 pin; Worker calendar evidence checks it against canonical competition IDs. Browser and Node UMD retain the pre-existing 56-day source, event ordering and mirrored identity fallback. The standalone VM projection must match Node output byte-for-byte after JSON serialization.
- `assets/world-catalog.mjs`: pure Node generator takes canonical country/competition IDs, preserving 320 identities, 256 provisional participants and 352 rivalries.
- Backend `catalogue-snapshot`, `season-calendar-evidence`, `initial-schedule` and `season-qualification-pots` use the same immutable ID array; snapshot and archive hashes are never recomputed from a browser instance.
- `backend/src/calendar-rules-compat.ts` remains the explicit legacy season-one bridge; no persisted calendar markers or historic snapshots are rewritten.
- `assets/competition-model.js` remains a preview/historical projection; `assets/competition-rules.js` is the pure schema and outcome validator; `assets/authoritative-history.mjs` and `assets/verified-history-provider.mjs` consume immutable season records, not current fixtures.
- INT-24 draw and bracket progression keep backend-only trust and approved participant/seed authority; broad HTTP and public-data transport changes are explicitly delegated to #349.
- Season 0 remains a navigation/debug/provisional-view state, not an approved scheduling season. `createSeason(0)` must continue to reject design calendar creation without altering Season 0 visibility.
- Isolated generator fixtures must explicitly copy the pure shared module; `tests/generator-windows.test.mjs` protects Windows CRLF parity.

### Frozen Season 1 source pin

`backend/tools/season-one-candidate.mts` protects `assets/world-calendar-model.js` with SHA-256 `1d2461e0fff14afe0bd84b604ed7e75486710e8171abf710c446d4206f797f9b`. SH-01 MUST NOT rewrite this asset or update the pin. Runtime/Worker projection parity is enforced by executable contracts instead of changing approved source bytes.
