# ME-PB-54 / A1.2 — universal Rapier ball candidate

Status: implemented in Draft/HOLD PR #481 for new exact-head CI.
Not yet connected to official or ordinary match simulation. A1.3 and
A1.4 remain open, as do A1/A4 parent gates; V1 stays 40% (8/20).

A closed 60Hz Rapier world provides ONE 0.43kg/0.11m ball, 22 canonical
shoe colliders and all existing ball scenarios: roll, drop, launch,
bounce. No extra physics solver or public UI; one globalResponse
default 1.00 is the only physical input.

Shared core helper resolveUniversalBallTechnicalParams is now the single
source of technical coefficients for both historical ME-PB-47 and this
new candidate: foot restitution = 0.12 x response, grass rolling
deceleration = 0.8 / response, shoe friction = fixed 0.65.
These proxies are uncalibrated and still research-only.

The private core capability allows bounded common response in non-roll
scenarios; regular core.createEngine callers STILL cannot arbitrarily
alter grass rolling resistance in launch/drop/bounce diagnostics.
No caller can supply external player/contact/ownership frames, impulses,
per-player boots, club/pitch profile or a scoring action.

Focused tests compare default 1.00 against independent real Rapier
foot-enabled reference engines, exactly matching ball snapshots and
shoe START/ACTIVE/END over all four scenes. Other scalar values replay
deterministically; 22-foot genuine contacts and distant no-contact are
verified; invalid inputs fail closed.

The ordinary core still creates no shoe colliders by default; ME-PB-47
research factory is still roll-only. Match backend still uses
temporary-score-v1. Thus this factory is an internal candidate for
A1.3/A4 integration and does not itself prove real match gameplay.

Tracking: https://github.com/FraGioco9/football-architect/issues/480
PR: https://github.com/FraGioco9/football-architect/pull/481
