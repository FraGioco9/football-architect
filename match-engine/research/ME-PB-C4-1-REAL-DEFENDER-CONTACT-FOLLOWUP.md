# Match Physics V1 — C4.1 real defensive contact and six-tick physical continuation

Research-only subgate of issue #480 / Draft PR #481. This upgrades the
existing C1.2c real 11v11 pass-challenge integration test **without**
duplicating the expensive eight-scenario, 375-tick matrix.

## Mandatory physical evidence

For **both** passing teams in an unmodified canonical 22-player fixture:

1. A prior pass is an actual exclusive same-tick Rapier shoe
   START+ACTIVE with a physically applied impulse, not a scripted pass.
2. A defending player of the opposite team subsequently generates a
   real Rapier shoe START+ACTIVE, backed by the same 60Hz sealed feed
   and a finite, genuinely moved 22-player position.
3. The independent Rapier control world reproduces each full frame
   exactly. After the observed defender contact, measure **six**
   subsequent consecutive actual 3D ball-centre positions and
   velocities, conserving ticks and reporting travelled metres plus
   changes in velocity magnitude. A change in velocity is an
   observational value, **not** proof that the defender caused it.
4. Retain no-contact opt-out negatives; a real pass or a mover's
   `challenge-pass-intent` alone never creates a defending shoe event.
5. Keep `interceptionConfirmed:null`, `tackleConfirmed:null`,
   `passCompleted:null`, `officialMatchPossession:false`,
   and `officialMatchResult:null` at every observation. A contact
   and six post-contact ball frames are **not** a successful tackle,
   interception, recovery, controlled ball owner or match result.

## Acceptance boundary

C4.1 is an **evidence-only** physical substep, not full C4 acceptance.
C4.2 needs separately approved football adjudication rules distinguishing
an actual interception/recovery from collision, rebound, contested
simultaneous feet or a normal ball movement after another player's touch.
No changes to Rapier collision shapes, actor steering, goalkeeper roles,
shot physics, scoreboard, possessions, or remote systems.

This work keeps PR #481 Draft/HOLD with one cumulative commit. Exact-head
Node, routing/security and Chrome QA are required before marking
C4.1 complete. Site/Browser/Admin/FULL run on the same head.
