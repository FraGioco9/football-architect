# ME-PB-54 / A1.3b.2a — homogeneous temporary players

Owner-directed interim mode (2026-11-12): the real 60Hz Rapier match
runs with 22 temporary actors, 11 on each fixture side, instead of
waiting for generated player–club relationships. No D1 migrations.

The engine's existing canonical `home-1..11` and `away-1..11` shoe
actors are associated with the verified fixture's club identities.
Every player has exactly the same 20 generator-named attributes
(speed, strength, stamina, agility, passing, technique, dribbling,
shooting, crossing, tackling, marking, heading, vision, positioning,
decisions, composure, gk_reflexes, gk_handling, gk_positioning,
gk_aerial), all **50**, on a single immutable shared object.

Real physical movement uses the same existing caps for everyone:
7 m/s speed, 9 m/s² acceleration, 12 m/s² braking, 6 rad/s turn.
The neutral attribute ratings are **not yet physical multipliers**.
Existing tactical roles and formation positions differ, not ability
ratings. Foot contacts remain genuine real Rapier measurements.

The strict authority boundary remains: `generatedPlayerId=null`,
`playerId=null`, `rosterBound=false`, provisional source label,
no claims of generated, persisted, or club-contracted footballers.
The approved D1 fixture bridge supplies validated club IDs only.
Neither the official score, temporary-score-v1 lifecycle, nor D1
persistence changes. A1.3b.2b later replaces this fallback with actual
generated players once #509's contract and lineup decisions are ready.
The future replacement must preserve the contact IDs / physics
provenance and require new tests; no automatic fake assignment.

A1.3b.2a can be accepted after exact-head targeted physical tests.
A1.3 main and Match Physics V1 remain open pending actual lifecycle
integration/acceptance, without assuming ratings affect physics.

#480 https://github.com/FraGioco9/football-architect/issues/480
#481 https://github.com/FraGioco9/football-architect/pull/481
#509 https://github.com/FraGioco9/football-architect/issues/509
