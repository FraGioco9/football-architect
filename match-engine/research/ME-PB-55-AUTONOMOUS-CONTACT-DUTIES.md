# ME-PB-55 / A4.2a — Rapier contact ↔ autonomous movement duty

**Scope: first integration substep, NOT full A4.2 or A4 acceptance.**
This implementation joins the same 60Hz physical fixture's genuine Rapier
shoe collisions with the existing canonical autonomous mover's **real**
tactical assignments, without adding a second world or any input source.

## Evidence path

1. `createUniversalMatchBallSession` calls the single existing
   `createPlayerMovement({experimentalAiKickApproach:true})` every physical
   tick. It now exposes a *sealed projection of the mover's actual output*
   covering all 22 engine IDs and current duties: `press`, `cover`,
   `screen`, `support`, `balance`, `recover`, `formation` and
   `goalkeeper-position`. These are movement assignments, NOT football
   action decisions or player skill differences.
2. `createPhysicalFixtureStepRuntime` binds the projected duties to
   its A4.1 internally verified START/ACTIVE/END actor contacts from
   exactly the same physics tick. Every contact has an immutable
   `movementDuty`, team and fixture club. It rejects mismatched clocks,
   unknown actors, noncanonical assignments and forged claims of action
   authority. The same 22 temporary actors retain all 20 attributes=50.
3. CLI and the optional *read-only* D1 due-fixture bridge validate that
   the contact-duties join corresponds to the same 22-person fixture.
   The physical evidence SHA calculation is unchanged: same ball
   and canonical Rapier contact IDs.
4. Real-Rapier test covers an independent 155-tick canonical world,
   real first/last shoe collision, every assigned player, replay/reset,
   physical parity and a no-contact scenario without invented actions.

## Strict negative boundary

The joined readout is deliberately **read-only**:
`actionPolicyConnected=false`, `footballActionExecuted=false`,
`intendedFootballAction=null`, `officialMatchPossession=false`.
It does not assert that contact is pressing, tackle, interception, pass
or control. It does not dispatch a kick/shot, apply new forces, replace
`temporary-score-v1`, create generated player IDs, write D1, or
authorize published results.

**Next A4.2b:** integrate a distinct *execution policy* fed by this
provenance, with independent authorization, physical eligibility and
replay checks, so actual generic on-ball decisions can eventually be
issued on a subsequent tick. A4.2, A4.3, A4 parent remain unchecked
until that broader integration and exact-head evidence are complete.
