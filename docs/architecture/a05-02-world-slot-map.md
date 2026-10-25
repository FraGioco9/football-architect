# A05-02 — WORLD-TIME abstract-slot mapping

**Issue:** #268 — A05-02. **Frozen baseline:** `main` `b6df8a86d11f115913f7fabda388c3d846720636`, `assets/world-calendar-model.js` blob `65b1e4b6d30cb9b3c3f36c1464e3b3e44bcd70f3`.

This document describes the **already-implemented WORLD-TIME QA-06 projection** and does not substitute the earlier INT-24 design schedule. Slots are abstract days, never dates or completion evidence.

## Mapping

| Abstract day | Marker(s) in existing model |
| ---: | --- |
| 13 | N01 |
| 14 | N02 |
| 15 | N03 |
| 16 | I01 + N04 |
| 17 | N05 |
| 18 | N06 |
| 19 | I02 + N07 |
| 20 | N08 |
| 21 | N09 |
| 22 | I03 + N10 |
| 23 | N11 |
| 24 | N12 |
| 25 | I04 + N13 |
| 26 | N14 |
| 27 | N15 |
| 28 | I05 + N16 |
| 29 | N17 |
| 30 | N18 |
| 31 | I06 + N19 |
| 34 | N20 |
| 35 | N21 |
| 36 | I07 |
| 37 | N22 |
| 38 | I08 |
| 39 | N23 |
| 40 | N24 |
| 41 | I09 |
| 42 | N25 |
| 43 | I10 |
| 44 | N26 |
| 45 | N27 |
| 46 | I11 |
| 47 | N28 |
| 48 | I12 |
| 49 | N29 |
| 50 | N30 |
| 52 | N31 |
| 53 | FEDERATION-FINAL + N32 |
| 54 | SOVEREIGN-FINAL + N33 |

Days **1–12** are preseason. Unlisted days 13–55 are pauses; day **56** is transition. The source maps **N01–N30** to league days and **N31–N33** to postseason. **I01–I06** are league markers, **I07–I08** playoffs, **I09–I10** quarterfinals and **I11–I12** semifinals. FEDERATION-FINAL belongs to `int-2` at day **53** and SOVEREIGN-FINAL belongs to `int-1` at day **54**. Both final days also contain a national postseason marker; `pairing='final'` is source behavior on those double-event days.

The international and national markers on the same day are listed international-first, as in `createSeason`. Every N marker addresses all sixteen division identities (eight countries × two divisions). Every I marker addresses both international competition identities, except the two named finals which each belong to their designated cup.

## Contract boundary

`createSeason(season)` produces immutable, design-provenance calendar identity events. `projectSeason` adds the world's relative progress and only explicitly supplied, validated per-competition event statuses. **A reached event is not a verified played match or finalized result.** Missing states remain `null`. Neither function simulates matches or infers outcomes.

This map is a documentation freeze of the current public model, **not** approval to reinterpret past INT-24 calendar design, change fixture scheduling, convert abstract days into real dates, or write match results. Differences with the earlier 43-slot INT-24 concept require separate product/design reconciliation; this A05-02 checkpoint does not silently resolve them.

## Validation and release

Reuse existing `tests/cal-world-56a.test.mjs`, World Calendar tests and full Node/Chromium exact-head CI. No code, model, tests, generator, publication guard, workflow, DEV clock, database or deployment changes. A05-02 remains OPEN/Draft until green exact-head CI and separately authorized merge, then confirm post-merge CI.
