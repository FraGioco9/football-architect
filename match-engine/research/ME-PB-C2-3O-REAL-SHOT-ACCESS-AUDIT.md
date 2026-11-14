# C2.3o — Read-only 720-tick real-shot boundary / lane / shoe access

## Why this step

C2.3n (exact HEAD e0dc5c9, FULL PASS) improves AWAY-10's actual body–ball
gap at tick693 from 3.048m to 2.224m via an authenticated carry-based
presser/support handoff, but produces **no new real Rapier shoe START,
no additional ball progress and no genuine SHOT**. The ball remains
0.681m outside the 35m shooting range. We must distinguish the source
of the failure: true physical shoe access vs real shot range vs
unblocked goal lane, without conferring new actions.

## Rigorous source boundary

Replay independent Rapier 22-person HOME IT and AWAY DE physical
fixture pairs, original carry-support vs the new bounded handoff, for
720 actual 60Hz physics ticks each. Recreate a separate observer-only
mover for EACH session from the *previous completed actual ball* and
true earlier same-world shoe PASS/CARRY and END, verifying every 22
canonical player XY against each actual Rapier body on EVERY tick.
The sidecar is a measurement probe only; NEVER an input to physics.

At checkpoints 292; 532, 533; 546, 547, 567; 599–601; 620,
640, 680; 692–695, 700, 720 and across all 720 ticks:
- Measure actual ball distance to correct opponent goal, hard policy
  shooting range <=35m and lateral limit |y|<=20m.
- Independently derive actual opposing body clearances along
  goal-centre and two near-post target segments (goal y=0,-3.1,+3.1),
  mirroring the existing uniform policy's 2.4m lane threshold.
  A geometrically open lane is NOT an authorized shot.
- Measure HOME/AWAY offensive forward's ACTUAL matching 60Hz
  oriented shoe pose (facing, forward/lateral ball components),
  rounded-shoe static clearance, body–ball gap, blocking body,
  current duty and optional authentic carry-support target. This
  estimate is NOT the real swept Rapier collision.
- Require true shoe START+ACTIVE, exclusive action source, the
  real policy decisionContext and applied Rapier impulse for
  any actual football action. A natural SHOT is accepted only
  with genuine Rapier START, policy `shot`, actual shot target
  provenance and real physical impulse; an inferred shot range,
  nearby ball, target or velocity is insufficient.
- Clearly label the post-physics ball/lane geometry as
  *observation-only*. The actual action policy observes same-tick
  physical contact and source actor/ball before applying its impulse.
  The previous-tick ball is also measured separately to avoid
  retroactively granting an action from later ball coordinates.

No model/physics changes, artificial contacts, player moves,
goalkeeper intervention, auto-shot decision, shot-range adjustments,
new possession/score inference, or generated players.

## Acceptance

One new explicitly registered Node test and this research note.
Exact HEAD targeted CI passes with both HOME/AWAY 720-tick real world
A/B, 22-player observer XY equality every frame, no pre-tick600
divergence for AWAY, current unaltered HOME regression, and genuine
tick694 HOME-7 PASS baseline vs CARRY after the role handoff.
Record *measured* nearest body/shoe clearance, policy range/lane
availability and real shoe event timelines. FULL CI is independent.
C2 remains OPEN and #480 stays at 11/20 = 55% until genuine
natural shot proof; no merge, deploy or remote D1.
