# #628 ACTIONS-B06a — exact 60Hz source-gated match clock, goals, result timeline

**User priority:** finish football actions and match lifecycle before tuning numerical physics parameters.

## Implemented and guarded

- One read-only `createBasicMatchTimelineB06` attached **only** to the existing 6 original B05/B05b referee scenes, without adding another Scenario launcher, physics World, player body, or artificial ball. The unified Scenario selector stays at **51** (4 ball, 17 actions, 30 movement).
- Clock derives exclusively from original sequential **60Hz** Rapier/B05 ticks. Explicit, pure **45:00 = tick 162000** and **90:00 = tick 324000** boundary contracts. Half-time and full-time *clock boundaries* are **not automatically certified completed match phases**, because live half-time player kickoff and 90-minute running acceptance are still missing.
- Provisional per-team score counts only **independently rechecked full-ball goal-line crossing geometry**, using original consecutive Rapier ball centres and existing B05 source data. A 2nd source check rejects altered crossing point, side, scorer, clock, source flags, unsequenced/duplicate tick, or mismatched B05 score. No fabricated goal from a shot, collision proximity or misleading action outcome. Both HOME/AWAY mirrored GOAL scenarios are covered.
- Separate chronological `matchEvents` for genuine `goal` / `touchline` / `goal-line`, exact-tick physical `restart-placement`, and later independently authenticated physical `set-piece-physical-attempt`. A deliberate **unresolved dead ball** remains pending and cannot turn into an invented restart, possession or score. The physical throw-in remains an **unmodelled-hand proxy** with `legalThrowConfirmed:false` while real corners/goal kicks keep the original independent #9 shoe START.
- B05 referee now supports subsequent *independent* source-verified exit events **after an actual acknowledged previous restart**, without counting repeated exits during dead-ball periods. The earlier phase's last-touch metadata is cleared at restart to prevent false future throw/corner ownership.
- The existing Action LAB readout shows `B06 MM:SS · LAB HOME–AWAY · match events N · unofficial` in the same scene. Never writes world competitions, match results, match possession or DB data.

## Exact acceptance

- 45/90-minute pure tick-based projected clock boundary tests, with strict invalid-tick rejection.
- Original Rapier 22-player mirrored HOME/AWAY goal / unresolved touchline / unresolved goal-line / source-positive throw-in / corner / goal-kick 60Hz replay. Must show original clock, native event ticks, 1–3 independently sourced timeline events, correctly attributed provisional score, and no official match result.
- Negative forged winner, changed line crossing, unmatched B05 score, duplicate ticks, absent native source, fake or wrong-owner restart, illegal set-piece action.
- DEV-only route and public/non-DEV negative gates, unchanged prior M17–M20 and 51 unified Scenario browser QA.

## Explicit remaining B06b / later integration

This is **B06a**, the match **clock, provisional scoreboard and event ledger foundation**; it is **not yet a complete simulated 90-minute match**:
- Real half-time stop and authenticated second-half physical kickoff.
- Complete original continuous 90-minute run through 324000 sequential physical ticks, repeatable end-to-end with real match winner, draw, full-time result and event export.
- Official match score and match result only after the above are genuine, source-verified and connected to the match backend/competition state.
- Actual roster/club linking (separate issue checklist), and full final QA.
- Referee refinements such as stoppage time, cards, fouls, offside and real hand-contact legality remain open. No parameter tuning yet.

PR #633 remains **Draft/HOLD**. No Ready, merge, deploy, or remote D1 changes.
