# C2.3s — Authentic-source, bounded lateral approach A/B

## Motivation

C2.3r physical shoe audit targeted/full PASS found the limiting
geometry at two real close approaches was **lateral**, not
vertical or a teammate guard: original presser AWAY-10 at tick657
exceeded its shoe's lateral halfwidth by 0.375m, while C2.3q
near-ball actor tick664 exceeded lateral halfwidth by 0.600m.
The latter was longitudinally within the real shoe but had no
actual Rapier START. There were zero guard stalls in tick600–720.
Neither baseline, handoff nor close-ball mode produced a natural SHOT.
Ball stayed 0.681m outside the hard 35m shot range.

## Sealed tactical hypothesis

Layer `autonomousCarrySupportLateralAlign:true` on explicit DEV
`autonomousActions:true`, `autonomousCarry:true`,
`autonomousCarrySupport:true`,
`autonomousCarrySupportPressHandoff:true`,
`autonomousCarrySupportBallAccess:true`. Reject any missing or
false prerequisite, untrusted research-shot combination, and
unpaired direct movement option. All modes default OFF.

Only when the old mode would **already** assign an authenticated
same-world Rapier PASS + later physical CARRY source, select a
legitimate, currently in-bounds `post-carry-support` runner
(not carrier) and measure his real pre-step ball gap <=4m:
- Measure shoe-local lateral offset from this runner's *actual*
  pre-step XY/facing to the previous observed physical ball.
  The shoe centre's ordinary 0.22m forward offset does not
  alter lateral projection.
- Keep the existing 0.26m goalward-backoff X waypoint; change
  **only tactical waypoint Y** by a bounded, deterministic
  `clamp(lateral * 0.5, -0.35m, +0.35m)` when
  `abs(lateral)>0.16m`; otherwise the old waypoint is
  identical. Clip to existing pitch edges.
- This changes neither player's actual facing directly nor
  any kinematics. He still turns at max 6rad/s only from
  actual movement velocity and accelerates within 7m/s and
  the unchanged 0.98m teammate guard.
- Do not change the 3D Rapier rounded shoe collider, ball
  collider or impulses, 35m shot range, 2.4m goal lane,
  autonomous pass/dribble/shoot policy, official possession
  or result. **Never fake a START or infer a contact from
  static shoe geometry.**

This is a single bounded source-gated waypoint hypothesis,
**not** a tuned contact-generator. Its real outcome is
unknown until GitHub exact-head Rapier runs.

## Acceptance / evidence

Registered Node A/B test across four independent HOME IT/AWAY DE
720-tick worlds: original support, C2.3n handoff, C2.3q
near-ball, and C2.3s lateral. Recreate an independent fifth
AWAY aligned physical world for exact Rapier repeat. Every
one of the 8 distinct worlds must have an independent passive
22-player mover fed only previous true physical ball and
subsequent authentic same-world shoe PASS/CARRY/END; all 22
XY must match actual Rapier player bodies per frame. One
separate AWAY replay must match physical ball, all player
bodies, shoe contacts and real action at every tick.

Require identical HOME and old exact AWAY baseline/handoff/
access before any eligible lateral correction; source
PASS/CARRY tick and <=4m actual pre-step gap for each
nonzero corrected waypoint. Measure first physical divergence,
corrected frames/shift, true oriented foot clearance,
real Rapier START+ACTIVE, genuine physically applied
PASS/CARRY/SHOT, ball territorial progress and hard
shot-range shortfall. Don't assert a positive football
outcome or move C2 parent until an actual source-authenticated
natural physical SHOOT passes both HOME/AWAY gates.

No merge, deploy or remote D1. The feature is experimental
and always opt-in. #480 still 11/20=55%.
