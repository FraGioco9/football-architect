# A05-04 — Pure competition-specific temporal progress projections

**Issue:** #268 / A05-04. **Baseline:** `main` `c8929ee5ce9dca68ecb52a187a7d4495d8860135`. **Status:** Draft/HOLD.

## Source of truth and scope

Use the already-approved **56-day WORLD-TIME QA-06** calendar identity model, not page-local day counters or wall-clock dates. `faWorldCalendarModel.createSeason(viewedSeason)` is a frozen read-only calendar containing events with explicit `competitionIds`, `family`, `phase`, `round` and source markers. `faWorldClockAdapter.project(viewedSeason,worldSnapshot)` validates provenance and produces read-only relative timing; it does **not** create fixture results.

A pure projection for **one competition** accepts only an explicitly selected `competitionId`, a valid `viewedSeason`, and an already-normalized World Progress clock. Its result is derived by filtering immutable calendar events whose `competitionIds` include the selected competition. It must not mutate either input or the globally owned clock. A division such as `IT-1` receives national markers `N01–N33`, including postseason, while `int-1` or `int-2` receives `I01–I12` plus its **own** cup final; other competitions' final does not leak into its projection. This is an identity and temporal projection only.

## Contract and edge cases

| Input case | Required result |
| --- | --- |
| Viewed season equals current world season | Relative days follow current abstract day |
| Viewed season precedes/follows current world season | All relevant competition days are relatively past/future; do not synthesize scores |
| World snapshot unavailable / DEV Season 0 | Known scheduled calendar identities remain visible, while relative time and completion are unknown |
| National division (one of 16 identities) | Exactly its 33 design markers, including postseason; no cup event |
| International cup `int-1` | I01–I12 and Sovereign final; never Federation final |
| International cup `int-2` | I01–I12 and Federation final; never Sovereign final |
| Event time reached, no independently verified result | Status remains `null`; reached does not imply played/completed |
| Invalid or unrecognized competition ID | Fail closed; never use another division or cup as fallback |

Any optional wrapper or future consumer must preserve immutability and provenance and avoid storage, fetching, side effects, private DEV adapters or implicit mutation of historical selections. A04 remains the owner of verified datasets and completion status.

## Implementation ownership

This A05-04 checkpoint **specifies** competition-scoped pure projection semantics. It does not claim that a new projector function or consumer wiring has been implemented. Production projector extraction and cross-page consumption are part of the later scoped integration work under A05-07/A05-09/A05-10, with behavior-equivalence and negative tests required before replacing existing calculations.

Retain existing `world-calendar-model.js`, `world-clock-adapter.js` and `dev-world-clock.mjs` unchanged. Reuse current calendar/model, publication and browser regressions; require full exact-head Site checks and Chromium before requesting merge. No generator, simulation, workflow, deploy or DB changes.
