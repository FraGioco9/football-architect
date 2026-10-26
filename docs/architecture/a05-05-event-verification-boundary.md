# A05-05 — Temporal reach is not verified completion

**Issue:** #268 / A05-05. **Baseline:** `main` `64f4619d9484fc3e638d4a6aa84d9c416c4db55a`. **State:** Draft/HOLD.

## Independent assertions

**Event identity:** `faWorldCalendarModel.createSeason(viewedSeason)` enumerates immutable scheduled abstract events in WORLD-TIME QA-06. The 56-day axis indicates when an event is *scheduled*, not that a match has been played.

**Temporal reach:** `faWorldCalendarModel.projectSeason(viewedSeason,{source,current,eventStates:[]})` derives `relative: past | current | future | null` solely from the sourced global clock and the viewed season. `past` means the abstract day was reached; it is not a match-completion status.

**Verified lifecycle:** A separate, explicitly authorized provider owns competition-specific states and must validate competition/event identity, dataset provenance and immutable revision context before a consumer can display a played or completed result. The existing public `faWorldClockAdapter.normalize` intentionally rejects nonempty `eventStates`; the calendar model's optional event state validation is not itself proof of provider authorization.

## Fail-closed matrix

| Calendar / provider situation | Time label | Verified result / completion |
| --- | --- | --- |
| World clock day is after scheduled event; no authorized provider record | `past` | Unknown (`null`), not completed |
| Scheduled event is today; no authorized record | `current` | Unknown (`null`), not live by inference |
| Future scheduled event; no authorized record | `future` | Unknown (`null`) |
| World clock unavailable or DEV Season 0 | `null` | Unknown (`null`), no fallback |
| Historical viewed season, current world season is later | `past` | Unknown until independently verified |
| Authenticated provider identifies a different competition/event | Any | Reject, do not adopt foreign outcome |
| Duplicate, stale-revision, missing-provenance or invalid lifecycle payload | Any | Reject and do not infer completion |
| Independently verified and current provider lifecycle payload | Clock-relative label remains independent | Provider result may be displayed **only after** A04 validation |

The mapping is per competition: both cups share I01–I12 abstract event markers, but their fixture results and completion states are distinct; each cup has its own final. National division standings, postseason, Fixtures, Stats and History must not treat calendar reach as final-result authorization.

## Ownership and verification

A05 supplies only time and event projections. A04 supplies validated datasets and provenance; History completion remains gated by authoritative verified records. A05-05 **specifies the boundary only**: this documentation checkpoint does not claim producer/consumer migration or introduce a public lifecycle authorizer. Subsequent A05-07 tests, A05-10 consumer integration and A06 integration audits verify implementation.

Reuse existing `tests/arch-clean-02-security.test.mjs`, `tests/a04-11-isolation-boundary.test.mjs`, calendar contract and full Node/Chromium exact-head CI. No source, tests, generator, workflows, publication guard, deploy or DB changes. Do not mark CLOSED before exact-head green and separately authorized squash merge.
