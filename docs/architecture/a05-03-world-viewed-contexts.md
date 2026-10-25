# A05-03 — World Progress versus Viewed Season

**Issue:** #268 / A05-03. **Baseline main:** `73ff3f67edeedbc0543d75af52eee160fbceeb2a`. **State:** Draft/HOLD pending exact-head CI and authorized merge.

## Two distinct contexts

**World Progress** is an independently sourced clock snapshot: `{source:{kind,reference},current:{season,day}}`. It represents a single current global season and a WORLD-TIME abstract day in **1–56**. The public `faWorldClockAdapter.normalize` accepts only explicitly provenanced `dev` or `authoritative` sources and rejects supplied event lifecycle states. With no trusted clock, the normalized snapshot is unavailable with `current:null` and no event states. No browser wall time is inferred.

**Viewed Season** is the season chosen for reading a competition's Fixtures, Stats, History or Calendar. It is a positive season identifier, independent of `World Progress.current.season`. Switching the viewed season must **not** mutate the world snapshot, increase the world's progress, write results, or resimulate prior seasons. The viewed season can be past, current or future relative to the world; `world-calendar-model.projectSeason(viewedSeason,{current,source,eventStates:[]})` derives only `past`/`current`/`future` display relations.

| Case | World Progress | Viewed Season | Read-only result |
| --- | --- | --- | --- |
| Current season | S2, day 22 | S2 | Day 22 is current; earlier/later days past/future |
| Historical view | S2, day 22 | S1 | S1 events appear temporally past; no result is inferred |
| Future view | S2, day 22 | S3 | S3 events appear temporally future; no forecast is inferred |
| No world clock | unavailable | S1 | No relative-progress status; static calendar identity remains |
| DEV Season 0 | no active snapshot (`null`) | S1 | No advancing world progress or authorized fixture outcome |

## Trust and lifecycle boundaries

The DEV-only `createDevWorldClock` may update its protected session state, including Season 0, but its changes are not published as authoritative data. A clock snapshot reports **time**, not whether an event has actually been played. A lifecycle status can be supplied only by an independently authorized verified provider; the public clock adapter explicitly rejects external `eventStates`. The calendar projection with missing states leaves completion status `null`.

## Ownership and later work

A05-03 specifies this separation; it **does not claim all page consumers have migrated**. A05-04 owns pure competition projections, A05-06 atomic transitions/revisions, A05-08 DEV integration, and A05-10 actual Fixtures/Stats/History/Calendar consumer wiring. Do not broaden this documentation checkpoint into implementation or rewrite A04 provenance rules.

**Existing verification:** `tests/cal-world-56a.test.mjs`, World Calendar and clock-adapter tests, plus the required full Site checks and Chromium exact-head CI. No application source, generator, test, publication policy, database or deployment changes.
