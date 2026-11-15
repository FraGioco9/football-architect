# Action LAB clean migration — source-bound adaptation of #621

Issue #620, original [Draft/HOLD #621](https://github.com/FraGioco9/football-architect/pull/621), cleanup chain [#622](https://github.com/FraGioco9/football-architect/pull/622) → [#624](https://github.com/FraGioco9/football-architect/pull/624) → [#626](https://github.com/FraGioco9/football-architect/pull/626).

## Scope and reason

Do not retarget the historical #621 directly to #626: its branch contains the 71+ research commits from original Draft #481 and imports optional tactical/universal-world code not in the clean foundation. The new **cleanly based** small Draft branch copies the action-menu, compact dialog and genuine-physics readouts, but intentionally replaces the old `createUniversalMatchBallSession` and legacy reception/exchange simulators.

All five Action LABs instantiate exactly **one** `createEngine` from the clean core, with **both** opt-ins `diagnosticPlayerFootContactsEnabled:true` and `diagnosticAutonomousFixtureActionEnabled:true`. They use only the existing canonical `createPlayerMovement()` for real 22-player 60Hz foot frames, and actual `footContactSnapshot()` + `uniformAutonomousActionSnapshot()`. The separate prior physics LAB engine is disposed while the dialog is open and reinitialized on close. No new ball world, artificial START, manually injected impulse, official scores, possession, tackle or dribble confirmation.

## Five LABs: distinguish presentation from acceptance

- PASS: original shoe-origin pass. **Must have** one genuine Rapier START + applied same-tick impulse. HOME mirrored source tests in the clean core and original #626 HOME/AWAY private action test prove this baseline.
- SHOT: the canonical starting formation has no player automatically in the attacking-third shot window. Merely placing the ball at x=30 **does not stage a real shoe shot**. Render as **unobserved** until a genuinely eligible shoe START and open original shot lane. Additional controlled HOME/AWAY starting arrangements and actual SHOT flight witness remain OPEN.
- CHALLENGE: physically measured AWAY foot-ball START is an opponent's foot collision, **not** a tackle, interception or change in possession. Do not infer defensive success.
- CONTROL: needs a **separate same-team receiving shoe START after a real prior pass**; the old bespoke local receive script is not copied. No trap, official possession or pass completion is awarded.
- CARRY: allows the original bounded carry action flag, but only a genuine chosen `carry` plus the same-tick shoe START and Rapier impulse counts; if original physical policy instead selects PASS, **do not award dribble**.

The scenario catalog and controller are pure/DEV-only; the classifier only validates structural source records. Their physical origin is trusted exclusively when they come from the encapsulated Rapier engine. The Chrome UI must show **Waiting/No witness** when the real action has not occurred.

## QA and incomplete work

- [ ] Current clean-stack exact-head targeted Node and Chrome PASS, no regressions in original LAB
- [ ] PASS positive physical witness, Chrome verified
- [ ] CONTROL receiving shoe witness without legacy simulator
- [ ] SHOT HOME/AWAY staged physical positive, 3D trajectory after authentic real shoe START
- [ ] CARRY source-bound positive, contested vs unopposed negative
- [ ] CHALLENGE opposing real contact (no successful tackle), negative/no-contact/ambiguous START
- [ ] Full Chrome + iPhone Safari manual QA after positive scenarios
- [ ] Once independently approved, integrate in dependency order and retire old #621 without losing its original research

Do not mark #480 C2/C3/C4 complete. The old accepted 11/20 technical count is unchanged. All PRs remain Draft/HOLD; no merging, deployment or remote DB writes.

## #620 — clean mirrored SHOT LAB initial situation

LAB-15 now offers HOME and AWAY choices within one LAB. Before physics
tick zero, only canonical forward #10 is placed 0.28 m behind the
grounded attacking-third ball at x=+30 (HOME) or x=-30 (AWAY), with
all other 21 canonical players left unchanged. The SAME bounded lineup
initializes the existing 22-player mover and the shoes in its single
Rapier world. No shoe or player teleport during a tick, injected START,
manually selected action, second Rapier world or official scoring.

Existing selector rules for exclusive same-tick shoe START, original
shot-range and goal-lane clearance, and same-world impulse remain
unchanged. Ball-centre trajectories after the shot are observed in 3D
from actual Rapier snapshots. No goal, on-target status or natural C2
success is inferred.

The targeted tests require mirrored real-physics shot witnesses,
post-impulse 3D flight and deterministic replay; the unstaged original
formation is an explicit no-SHOT counterfactual. Exact-HEAD CI and
Chrome confirmation are required before marking this positive slice
accepted. Blocked-lane physical setup, CONTROL and CARRY stay open.


## #620 — genuine blocked-lane SHOT negative (HOME/AWAY)
LAB-15 adds a Lane selector, Open/Blocked. In the blocked setup only one
genuine opposing defender (#2) is also moved BEFORE tick zero, 11m ahead
of the ball on the centre-goal line, with all 22 player identities, roles,
>=0.98m initial separation and original mover/physics intact.
At that cross-section the original three lanes (centre and ±3.1m)
pass within ~1.6m of the opponent, below the unchanged 2.4m minimum.
Only a same-tick real Rapier shoe START permits a negative witness:
the unmodified inspectUniformPolicyGeometry reads the same live canonical
22-player frame and confirms no valid SHOT lane; it never selects actions
or overrides the original physics executor. A genuine alternative
PASS/CLEARANCE is allowed; no SHOT or goal is pre-awarded.
Mirrored Node, replay and Chrome negative tests accompany the positive
open-lane controls. This is not proof of successful defensive tackle.


## #620 — CONTROL genuine contact after physical PASS (clean)
Initial geometry places only canonical HOME #9 at (-5,-3.2) before tick
zero, so an unchanged authentic HOME #10 PASS from the grounded (-4.96,0)
ball selects its intended recipient at a viable 3.2m distance.
The original PASS impulse is applied to the SINGLE Rapier ball at tick 1
from one exclusive shoe START. Only after that actual recorded physical
PASS, the research-only HOME #9 movement intent targets the measured
ball XY; the ordinary mover still enforces acceleration, speed, turning,
pitch bounds and 0.98m minimum player-body separation.

Rapier's OWN contact event queue then observes a distinct HOME #9 shoe
START at tick 30. The observer requires exactly that original recipient
and a later tick; mixed/ambiguous shoe starts, other teammates or an
opponent-first contact do not certify a receiving event. The receiver
may issue another independent original physical PASS: it does NOT imply
a trap, control, completed pass, dribble, official possession or score.
The normal unstaged formation is a genuine PASS-without-reception negative
counterfactual. Acceptance requires exact-head Node and real Chrome QA;
CARRY and real opponent-before-receiver negative remain pending.


## #620 — genuine CARRY source-bound positive (HOME/AWAY)
The isolated original carry policy only chooses the small 0.42 Ns
same-world ground touch if there is a **single authenticated shoe START**,
no eligible SHOT, and no safe PASS target. The prior canonical formation
correctly prefers PASS even with the opt-in for CARRY enabled.

For the positive controlled scene the mirrored canonical opponent #9 and
#11 are *initially* marking the two would-be pass recipients #9/#11 of
the attacking side at 1.15m (still above the canonical 0.98m minimum
body separation). These two physical opposing players, all 22 original
shoe IDs, original 60 Hz mover and the original selector remain present
in a single Rapier world. No runner-time teleports or injected impulses.
HOME uses grounded (-4.96,0) moving +X; AWAY mirrors (+4.96,0)
moving -X. The original policy can authorize a real #10 CARRY only if
contact and all gates genuinely pass, and the exact measured post-impulse
2D displacement is accumulated from the single actual Rapier body.
Movement is not a completed dribble, second contact, maintained possession
or a match result. Unstaged control with unchanged CARRY opt-in must select
PASS instead and never label it a dribble. HOME/AWAY parity, deterministic
replay and true Chrome UI are required before acceptance.


## #620 — genuine CONTROL opponent-before-recipient negative
The second LAB-17 Scene variant 'Opponent first' is a bounded **initial**
long-pass lineup: only HOME #9 at (-5,-6.5), HOME #11 at (-30,+18) and
AWAY #7 at (-2.95,-2) differ before tick zero. Original safe-pass policy
authentically selects HOME #9 as recipient; original Rapier HOME #10
shoe START plus 2.4 Ns PASS impulse occurs tick 1. The real AWAY #7
then targets the actual ball XY ONLY after the prior pass was recorded
by the closed same-world engine. The original canonical 60Hz mover still
enforces acceleration, 7m/s speed, turn and >=0.98m player separation.

The same original Rapier world registers a genuine exclusive AWAY #7
shoe START at tick 91; the original physical policy independently chooses
CLEARANCE. HOME #9's later genuine shoe START at tick 204 is not a
reception of that already-interrupted original pass. The Action LAB
records the first opposing START and feeds its persistent boolean to the
existing pure classifier; no fabricated collision, interception, tackle,
pass completion, official possession or score. The standard Receiving
scene still produces HOME #9's own authentic shoe START at tick 30.
Exact-head Node/replay and real Chrome results are required for acceptance.


## #620 — CHALLENGE negative authorization and mirrored physical contact
The separate HOME/AWAY CHALLENGE variants reuse the **original** canonical
forward #10 positions, ball contact, 22 kinematic Rapier shoes and original
fixture selector. A CHALLENGE witness counts only a **single exclusive**
real shoe START by the selected side, not any presumed successful tackle,
interception, possession or score. The bounded No contact alternative has
an ordinary grounded ball at (0,30), safely remote from the unchanged
22 players; the 60Hz mover/real Rapier events must show no genuine START.
The default existing AWAY CHALLENGE remains unchanged. The original
selector requires exactly one START and one matching active shoe, and
its pure rejection auditor reports `no-exclusive-shoe-start` for absent,
multiple, and ambiguous active shoes; these are counterfactual guard tests,
NOT claimed physically observed simultaneous Rapier collisions. A real
same-tick duplicate-start fixture would require its own measurable evidence
without violating >=0.98m player separation; do not manufacture one.
Original action policy and match scoring remain untouched.
