# ME-PB-55 / A4.2b.1 — genuine opt-in 22-player physical actions

**Scope:** a FIRST, closed, *provisional local* action executor. Not
official football match scoring or completion of A4.2b/A4.

Use `createPhysicalFixtureStepRuntime(RAPIER,fixture,scenario,
{autonomousActions:true})` or set `autonomousActions:true` on the
existing bounded stdin CLI fixture request. With this flag **omitted**,
the original 60Hz universal ball is numerically unchanged and its
physical contact digest remains compatible with existing evidence.
The read-only persisted-D1 bridge does not accept the flag and stays
purely observational. No published match is affected.

At each real Rapier shoe START, only the internal canonical 22-player
mover may supply a candidate. Uniform deterministic eligibility:
outfield player, same physical tick, shoe-to-ball distance ≤0.85m,
ball near grass, bounded moving speed, 12-tick cooldown. The same
rules apply to all 22 homogeneous placeholders (20 attributes=50).
A simple deterministic priority chooses **shot** near goal,
otherwise **pass** to a geometrically suitable teammate (not a
hardcoded player), otherwise **clearance**. The three action impulses
are provisional shared magnitudes 2.4 / 3.0 / 2.7 N·s, NOT player stats
or calibrated foot-force evidence. No extra per-player/turf physics
knobs, no second world. The selected impulse is applied to the
ACTUAL existing Rapier ball rigid body **after the solver**.
Every executed record identifies actual collision tick and player,
and is checked against that same tick's genuine A4.1 contact feed.

This is a *physical trial*, NOT proof of tactical pass quality,
valid possession, successful reception, scored shot, tackle or goal.
No personal player ID, no real club contracts/roster, no external
auth, no action injection, no server-authorized score, no D1 writes.
Both `officialMatchAction` and `officialMatchPossession` stay false;
`temporary-score-v1` remains authoritative.

A4.2b continues with follow-up decisions, execution outcome validation,
action source safety and opponent/player interactions; A4.3 requires
full replay, integrated and CI acceptance. A4 primary stays OPEN.
