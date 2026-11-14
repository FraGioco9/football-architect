# C3.1 — read-only physical shoe-contact succession, not awarded dribbling

**Status:** implemented in Draft/HOLD, exact-head CI required for acceptance. Parent C3 remains OPEN.

## Physical provenance

Each trusted fixture frame comes from the SAME 60Hz Rapier world as the autonomous movement and optional player ball action. The private already-closed fixture collision reader verifies shoe START/ACTIVE/END lifecycles against the 22 canonical temporary actors, including team, physics tick, club identity and no external event injection. C3.1 consumes only that output plus the canonical Rapier ball centre/velocity; it never adds an action or accepts public fake contact data.

Track each strictly later sole Rapier shoe START and accumulate the measured 3D ball-centre path from the last eligible START. For every pair record:
- exact previous/current shoe IDs, team and physical ticks;
- whether the next contact is a teammate relay, same-player *physical recontact*, or opponent contact;
- elapsed 60Hz ticks, measured total physical path, net 3D displacement, **signed toward-goal X displacement relative to the first shoe's attacking direction**;
- whether a same-tick independent Rapier kick impulse was truly applied, or it was contact only.

Simultaneous multiple shoes and overlapping contested ACTIVE contacts reset the pending sole-contact chain. They never become evidence of a clean controlled carry. Readouts are frozen and explicitly `dribbleConfirmed:null`, `carryConfirmed:null`, `officialMatchPossession:false`, `officialMatchResult:null`. A teammate's second touch is *not* one player's dribble; a physical recontact is not automatically a completed dribble or a new kick. All previous global ball physics and autonomous action policy remain untouched.

## QA

1. **Pure synthetic contract vectors** separately validate exact tick ordering, same-player vs teammate vs opponent distinctions, 3D displacement, immutable non-scoring status; malformed names/teams/clocks/action claims rejected. Such vectors do **not** count as physical witnesses.
2. **Actual 22-player Rapier fixtures**: unchanged canonical Home/Away starting positions, real shoe PASS then a later real different teammate shoe, and subsequent opponent contact. Assert chronological exclusive shoe provenance and ball trajectory over independent worlds and reset. The resulting signed progress may be backward: measure it instead of inventing goalward carry.
3. **No-contact counterfactual**: cannot produce any shoe pair or dribble.
4. [Prior C2.3e 4×480-tick baseline](../tests/player-ball-natural-physical-progression.test.mjs) observed 0 natural shots; this is a data collection foundation for **C3.2 physically driven serial touches** rather than an assertion that carry is already working.

No new LAB section, real roster binding, output score, production match actions, deploy or database changes. Do **not** check parent C3 until a genuine same-player dribble through successive physical shoe contacts and ball progression has been observed.
