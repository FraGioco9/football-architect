# SH-01 — Canonical sporting identities and boundary audit

Baseline: main `08c04e7363c19cc227264e0c170760317512cbb5` (squash of SH-03 #373). Draft/HOLD, no merge, deployment or remote D1.

## Ownership table

| Contract | Canonical owner | Consumer / adapter | Invariant |
| --- | --- | --- | --- |
| Country, competition IDs, version binding, cup final IDs | `assets/sporting-contract.js` (pure UMD) | backend snapshot validator, calendar evidence, scheduling/qualification, and Node world catalogue; browser registry/calendar remain legacy mirrored identities guarded by parity tests | 8 countries, 16 divisions, 2 cups, 3 immutable versions |
| Full sporting rules / phase semantics | `data/divisions.json`, `data/international-competitions.json`; validated by `assets/competition-rules.js` and versioned `assets/rules-registry.js` | `tools/competition-catalogue.mjs`; Worker full-rule snapshot comparison | 16×30 domestic games, 24×6 INT league |
| World calendar markers | `assets/world-calendar-model.js` | `backend/src/calendar-rules-compat.ts`, `backend/src/season-calendar-evidence.ts` | 56 days; 33 N events, 12 I plus 2 finals |
| Season 1 approval, data hashes and membership | `backend/src/approved-season-one.ts`, `backend/src/catalogue-snapshot.ts` | Season 1 trusted snapshot loader | Stored hash cannot self-approve |
| Later-season evidence and archives | backend season authority and archival boundary | History and public read projections | Historical results remain immutable |
| Static club/catalogue identities | `assets/world-catalog.mjs` (data catalogue) | Node generation / static presentation | Not an authority for live membership |

The pure identity module contains no Worker, DOM, mutable season or membership dependency. It is not a source for historical rules snapshots. Calendar derives marker placements; explicit Worker adapters validate their projections against approved, versioned snapshots. Worker and Node duplicate local arrays removed where identity equality is exact; browser identity arrays require a separately coordinated script-loading migration.

## Deliberate non-deduplications

* `competition-model.js` retains its historical/preview compatibility profile; this is not an authorization for server sporting outcomes.
* Backend snapshot/hash validators remain independent of browser mutation, because trusting a client-derived hash or status would violate fail-closed approval.
* Fixture scheduling, international qualifications, archive serialization and page HTML are separate bounded contracts.
* SH-03 owns global/source/view/Debug state; SH-01 must not redefine it.
* #359 owns first paint and page render; #349 owns HTTP/auth boundaries; #354 owns later renderer consolidation.

## Review / verification

Focused tests: `node --test tests/sh-01-sporting-contract.test.mjs tests/rules-registry.test.mjs tests/rules-registry-integration.test.mjs tests/world-calendar-model.test.mjs`. Backend: `npm --prefix backend run typecheck`, then targeted calendar/snapshot/season tests. Final exact-head gates required before review. This document does **not** claim those tests passed before execution.
