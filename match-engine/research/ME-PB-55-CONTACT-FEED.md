# ME-PB-55 / A4.1 — physical fixture contact feed (non-scoring)

Status: IMPLEMENTATION in Draft/HOLD PR #481. **A4 overall remains OPEN.**

The existing `createPhysicalFixtureStepRuntime` executes the one actual
A1 Rapier world at **60 Hz**, with 22 canonical kinematic shoe colliders.
A4.1 exposes a **closed, read-only match-step contact feed** inside that
same physics frame; it never starts a second collision simulation.

Each `frame.physicalContactFeed` is derived directly from the internal
Rapier `footContact` snapshot in the corresponding physics tick. It
contains canonical START, ACTIVE, END actor records with:
`engineId, team, clubId, squadNumber, tacticalRole, playerId=null,
generatedPlayerId=null, temporary=true`. Club IDs come only from the
already validated fixture and the same immutable 11v11 uniform squad.
The collector rejects unknown, repeated/out-of-order, skipped-tick,
duplicate START, invalid END or inconsistent ACTIVE transitions. There
is no caller-supplied contact frame, possession or foot movement.

**No unsupported football claims**: raw collision == physical event;
it is NOT an intentional touch, possession, pass, tackle, interception,
goal, unique-foot impulse, shot or score. It does not create real
player affiliation, does not write D1, does not touch archive or results,
and never changes `temporary-score-v1` authority.

The standalone CLI and optional read-only D1 due-fixture bridge consume
the **same mapped contact feed**, checking immutable identity and
continuity; their physical SHA-256 evidence uses the identical canonical
IDs as before. A4.1 regression covers real 155-tick Rapier START/END,
complete frame parity with the independent A1 world, alternate club
identity, no-contact, injected-frame rejection and reset/replay.

**Next A4 gate**: integrate this trusted feed into a normal autonomous
football *action* loop, qualifying actual shoes/ball action intentions
without creating official scoring. **Do not check A4 main just for
exposing a richer feed**. After action-loop integration prove full
fixture, deterministic replay and exact-head regression. Keep
normal player visibility controls inert; do not confuse LAB opt-in
diagnostics with the match-step source.
