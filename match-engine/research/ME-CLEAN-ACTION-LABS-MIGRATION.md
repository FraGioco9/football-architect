# Action LAB clean migration — source-bound adaptation of #621

Issue #620, original [Draft/HOLD #621](https://github.com/FraGioco9/football-architect/pull/621), cleanup chain [#622](https://github.com/FraGioco9/football-architect/pull/622) → [#624](https://github.com/FraGioco9/football-architect/pull/624) → [#626](https://github.com/FraGioco9/football-architect/pull/626).

## Scope and reason

Do not retarget the historical #621 directly to #626: its branch contains the 71+ research commits from original Draft #481 and imports optional tactical/universal-world code not in the clean foundation. The new **cleanly based** small Draft branch copies the action-menu, compact dialog and genuine-physics readouts, but intentionally replaces the old `createUniversalMatchBallSession` and legacy reception/exchange simulators.

All five Action LABs instantiate exactly **one** `createEngine` from the clean core, with **both** opt-ins `diagnosticPlayerFootContactsEnabled:true` and `diagnosticAutonomousFixtureActionEnabled:true`. They use only the existing canonical `createPlayerMovement()` for real 22-player 60Hz foot frames, and actual `footContactSnapshot()` + `uniformAutonomousActionSnapshot()`. The separate prior physics LAB engine is disposed while the dialog is open and reinitialized on close. No new ball world, artificial START, manually injected impulse, official scores, possession, tackle or dribble confirmation.

## Five LABs — current verified evidence (2026-11-15)

| LAB | Clean original-source observation | Certified? |
| --- | --- | --- |
| PASS | Exclusive #10 Rapier START and original same-world PASS impulse at tick 1 | **Yes** — not pass completion |
| SHOT | HOME/AWAY #10 START at tick 1 and original SHOT with measured 3D flight; blocked lanes choose non-SHOT | **Yes** — not a scored goal |
| CHALLENGE | HOME/AWAY #10 genuine shoe contact; no-contact alternative has 0 START/0 actions through 90 ticks | **Contact only** — no tackle or interception |
| CONTROL | HOME #10 PASS tick 1; intended HOME #9 START tick 30; alternate world has AWAY #7 START + CLEARANCE tick 91, so later HOME #9 START tick 204 is rejected | **Shoe events only** — no completed reception |
| CARRY | HOME/AWAY #10 START and original 0.42 N·s CARRY, 1.212 m measured ground path in 70 ticks; unstaged setup chooses PASS | **Physical touch** — no certified dribble |

No official goal, possession, score, tackle, pass completion, dribble, or natural
11v11 tactical success is awarded by any controlled LAB.

## Scope decision — desktop-only DEV LAB (2026-11-15)

The owner will use the Match Engine LAB **only on desktop**. Safari/iPhone
hardware, touch, portrait/landscape and phone viewport QA are **out of scope**,
not failed and not untested acceptance blockers. The already completed historical
Chrome phone emulation remains useful evidence but is no longer required or
re-run in the focused browser acceptance suite.

This decision does not change any action physics, user-facing main product,
official match state, private DEV routing, release authorization or FULL CI
requirements. Keep the five controlled LABs and the legacy original physics
LAB regression focused on desktop Chrome.

## Exact-head QA / remaining acceptance gates

- [x] Clean-stack targeted CI at [`b8352a6`](https://github.com/FraGioco9/football-architect/commit/b8352a622e06ec9f7e74d4d7cfe1ff3ffc8c8440):
  [ME-01 #43742620635](https://github.com/FraGioco9/football-architect/actions/runs/43742620635) **295/295 Node**, **9/9 routing**, original LAB viewport and five desktop Chrome Action LAB interactions
- [x] Regressions over 13 Action LAB combinations ×61 60Hz ticks,
  22 stable player identities, minimum measured separation 1.15m
  against canonical 0.98m and no official result/possession mutations
- [x] Real desktop Chrome Play, Pause, Step, Reset, scenario/side selectors,
  dialog open/close and existing original LAB-01/02/04/05 viewport acceptance
- [x] Source/option guards for absent START, multiple or ACTIVE-ambiguous inputs,
  stale tick and cooldown; simulated input tests are **not** evidence of
  physical simultaneous dual-shoe Rapier events
- [x] iPhone Safari / phone layout QA explicitly **N/A by owner decision**;
  not a required milestone, not a claim that Safari was tested
- [x] Prior Site, Admin, Browser, ME targeted and #622 FULL workflows
  succeeded at their respective checked HEADs. Stacked #624/#626/#627
  FULL gate is non-green because the base is not `main`
- [ ] Recheck current `main`, exact HEAD/base SHA leases and complete
  required FULL evidence before independently authorized ordered integration
- [ ] Obtain separate explicit merge authorization and run post-merge checks
  before any release or deployment

## Desktop QA acceptance checklist

1. On the authorized DEV-only desktop URL, confirm the original
   match-engine LAB and LAB-01/02/04/05 still render with correct pitch
   geometry and existing controls at 1280×720 and 1440×900
2. Open Controlled actions, select Pass, Shot, Challenge, Control, Carry;
   check that Side, Lane and Scene controls are displayed only when relevant
3. Play must advance real 60Hz ticks, Pause freeze, Step advance exactly
   one tick and Reset return to tick 0 with no phantom witnesses
4. Confirm SHOT HOME/AWAY and blocked lanes, CHALLENGE actual contact vs
   No contact, CONTROL Receiving shoe vs Opponent first, CARRY HOME/AWAY
   and distinct evidence without false goals/tackles/interceptions/possession
5. Close and reopen the dialog. Confirm the parent LAB stays usable
   without duplicate animation or stale physics session
6. Keep the target Node, routing, original Chrome viewport and five Action LAB
   browser tests GREEN on the exact PR HEAD

**No iPhone/Safari verification needed for acceptance of this desktop-only
DEV research tool.**

## Review and integration isolation

- **Stack:** [#622](https://github.com/FraGioco9/football-architect/pull/622) (pure policy, base `main`) →
  [#624](https://github.com/FraGioco9/football-architect/pull/624) (physical shoe queue) →
  [#626](https://github.com/FraGioco9/football-architect/pull/626) (same-world physical executor) →
  [#627](https://github.com/FraGioco9/football-architect/pull/627) (five controlled LABs).
  At this checkpoint their HEADs are respectively `baed69d`, `f283576`,
  `5ff17a8`, `171f85a`. Reverify exact SHA and main before any merge.
- The latest `main` advanced to `dc3c7e0` while #622 is based on the
  previous `0485aa1`; `main` and #622 have **one commit of divergence**.
  GitHub reported the PR mergeable at the read time, but update/conflict
  safety is an independent **pre-integration check**.
- The DEV-only `/dev/match-engine` and `/__fa_match_engine__/` route
  authentication must keep the new Action LAB modules private. No public
  feature, production API, DB or gameplay scoring should change.
- Historical #621 and #481 research is preserved and not imported en masse.
  The originals' 71+ commit research surface and the clean extraction are
  deliberately separate.
- The original technical baseline for #480 remains OPEN; the Action LAB
  claims are narrow physical evidence, not C2/C3/C4 football outcomes.
- No merger, auto-merge, deploy, production DB edit, PR base retarget or
  direct `main` write is authorized by this QA/review work.

> **Historical engineering notes below describe the implementation in the order
> it was developed. Earlier “pending” statements in those dated sections
> are not current acceptance status; use the checked evidence above.**

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
