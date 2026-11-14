# ME-PB-47 — ONE universal global ball-response parameter (2026-11-11)

**Product decision:** ONE shared, numerical match-ball response setting
for ALL 22 players, ALL shoes and ALL pitches. No player, club,
footwear, venue, material, or terrain preset. No separate foot
restitution, foot friction or grass-resistance adjustment in
the public/shared configuration. Nothing added to LAB controls,
production, Preview, world APIs or remote D1.

**Implementation (isolated research facade ONLY):**
\`src/player-ball-global-response.mjs\` provides a single numeric
\`globalResponse\` (default **1.00**; bounded diagnostic
range **0.75–1.25**) and an opt-in factory for genuinely physical
Rapier research worlds. Fixed technical coefficients are derived
**internally** as foot restitution \`0.12 × globalResponse\`
and grounded grass rolling deceleration
\`0.8 ÷ globalResponse m/s²\`. Foot contact friction remains fixed
at \`0.65\`, and all other material/collider/ball constants remain
unchanged. A higher value makes the ball **slightly more responsive**
to foot contact and preserves more horizontal rolling speed.
**These relationships are provisional research proxies, NOT
externally calibrated football parameters.**

The only independent optional locator in the research factory
is \`omittedShoeId\` to perform a controlled leave-one-shoe-out
counterfactual, never to choose a physical property for that shoe.
Unknown keys, individualized footwear/grass settings, values outside
the bounded range, and non-grounded research scenarios fail closed.
The factory does not accept the old individually tuned internal
diagnostics; ME-PB-46's previous one-axis studies remain retained as
**historical tests only**, to document why separate gameplay knobs
were rejected, not as product controls.

The default \`globalResponse=1.00\` must reproduce the original
canonical Rapier contact events and ball trajectory EXACTLY, without
any engine version or normal-world change. Tests run identical
22-player movement inputs through three real worlds (complete feet,
Home #10 foot omitted, unrelated Home #1 sham omitted) at 60 Hz,
in two distinct starting ball configurations under \`0.85,1,1.15\`.
The baseline genuine Away #10 → Home #10 physical START and END
witness remains a regression, the neutral sham must stay physically
identical to the complete world and a distant no-contact ball must
not manufacture events. A non-opted-in core world remains unchanged.
All observations are whole-world physics, not a singular foot impulse,
controlled reception, official interception, dribble or possession.

No merged/deployed code or remote D1 changes. Branch/PR remains
**Draft/HOLD** pending separate authorization; follow exact-head CI.

---

# ME-PB-46 — bounded real-world foot/grass sensitivity (2026-11-11)

This isolated 60Hz deterministic Rapier *research test* varies TWO
already supported opt-in parameters, **one at a time**, while keeping
the accepted normal engine and all existing LAB/football constants
unchanged: `diagnosticFootRestitution` defaults to **0.12**, tested
at **0.06** and **0.22**, both within its strict [0, 0.35] allowlist;
`diagnosticGrassRollDecelerationMps2` defaults to **0.8 m/s²**,
tested at **0.60** and **1.00 m/s²**, both within [0.3, 2].
These are NOT yet calibrated turf/shoe gameplay values.

A 3×5 matrix tests the two genuinely sustained ME-PB-45 initial
balls (x=4.96/vx=-0.3 and x=5.00/vx=-0.3) and one genuine short,
physically recontact-censored negative (x=4.92/vx=-0.3), each
under default physics and the four single-axis diagnostic variations.
A fixed seed is shared across all five variants for each initial
physical condition: new labels or seed strings are not counted
as additional physical initial-state evidence.

Every trial runs three independent pinned Rapier worlds with
identical physical parameters and exactly the same canonical
22-player input at each tick (full world, omit Home #10 collider,
distant Home #1 sham omission). Actual real ball/foot START/END
frames flow through the existing ME-PB-38/39 co-motion and
measured release, ME-PB-41 distinct real second-shoe START,
ME-PB-43 matched-world sensitivity and ME-PB-44 post-END,
no-contact, >=8 consecutive clean-tick observer. A short,
unqualified, or unfinished shoe episode MUST NOT be promoted
to a sustained reception; every new real shoe START/END/ACTIVE
event immediately censors the post-END clean window. The
sham world must remain bit-identical to the complete world
for all physical configurations.

**Actual first pinned Rapier sensitivity measurements (15 trials):**
7 **sustained**, 5 **real but short/censored**, and 3 **genuine
second START without an eligible END**. Outcomes by one-axis
diagnostic variant, always in order [x=4.96/-0.3 strong,
x=5.00/-0.3 strong, x=4.92/-0.3 short]:

| Isolated sensitivity option | A | B | C |
| --- | --- | --- | --- |
| Defaults foot=0.12, grass=0.80 | sustained (10 ticks) | sustained (12 ticks) | short (5 ticks) |
| Lower foot restitution 0.06 | sustained (9) | short (4) | short (4) |
| Higher foot restitution 0.22 | sustained (12) | short (4) | sustained (9) |
| Lower grass deceleration 0.60 m/s² | missing END | missing END | missing END |
| Higher grass deceleration 1.00 m/s² | sustained (10) | short (5) | sustained (11) |

The low-resistance cases have a true second Rapier START but NO
qualifying END within the bounded 175-tick experiment. The
three positive/short categories CAN change under these uncalibrated
diagnostic parameters; such sensitivity **does not justify**
adopting these values as official gameplay physics. A change in
whole-ball matched-world velocity still is NOT a unique foot impulse,
successful reception, or possession. All 15 scenario classifications,
the original default physical timestamps, the unchanged full/sham
physics and the no-observer deterministic replays are now locked in
Node regression tests. No claim of independent calibration.

Baseline classification is **asserted unchanged** from ME-PB-45
(127/130 + 10 clean ticks, 125/128 + 12 clean ticks, and
129/134 + 5 short ticks). For the uncalibrated variations,
classifications are measured independently rather than forced
to match the baseline. Replayed independent triple-world
runs plus observer-disabled canonical A/B/C traces must match.
Invalid restitution/grass bounds and unauthorized non-opted-in
foot sensitivity fail closed. All source evidence remains
read-only, with no new ball impulse, physics engine modifications,
player moves, new LAB page/button, public API, Preview,
production deploy, or remote D1 writes.

This measures only **marginal whole-physics-world**
counterfactual sensitivity with matched fixed player inputs,
NOT isolated foot impulse, controlled reception, interception
or possession. `officialPossession=false` and
`individualFootImpulseProven=false` throughout.

---

# ME-PB-45 — independent real initial-condition persistence matrix (2026-11-11)

ME-PB-44 verified 10 consecutive uncontaminated Rapier 60Hz ticks
after the Home #10 second-shoe physical END, with clean tail censored
at a new genuine START. ME-PB-45 expands this into a **bounded matrix
of 20 independent physical initial-condition/movement trials**:
five actual ball starting X coordinates (4.92–5.00 m) crossed with
three initial X velocities (-0.2, -0.3, -0.4 m/s), two real initial Y
offsets, plus (1) ordinary movement without a second shoe START,
(2) authentic grazing original-shoe-recontact BEFORE an opponent,
and (3) a physically distant ball without shoe contact.
The Rapier scenario `seed` is a descriptive identity only; the
experiment varies actual initial ball states rather than counting
seed strings as independent randomized physics.

Each trial creates THREE independent pinned Rapier worlds with
identical 3D ball state and identical canonical 22-player movement
frames per 60Hz tick, driven by the full world's previous actual
ball. One world includes all shoes, one omits ONLY Home #10, and one
omits a distant unrelated Home #1. The experiment reuses the
existing genuine ME-PB-38 co-motion, ME-PB-39 shoe END/clearance,
ME-PB-41 distinct second-shoe START, ME-PB-43 physical matched-world
ablation and ME-PB-44 fully event-free post-END tail observers.
It must NEVER arm a post-END tail merely because a shoe is near the
ball. All ball and shoe data come from the actual Rapier integration,
and an intervening real contact **censors** the clean tail.

Research result classifications are deliberately asymmetric:
a positive requires genuine sequential Rapier provenance AND
>=8 consecutive clean post-END samples with >0.01m world position
difference and >0.1m/s world velocity difference. A short,
interrupted, absent second contact, prematurely recontacted original
shoe or no-foot event remains **negative/unqualified**, not an
invented handoff. Heading changes in the FULL world are reported
only when BOTH measured horizontal velocities are >=0.2m/s;
no heading is inferred from a stationary ball. The complete sham
world must remain physically identical to the full world. Selected
independent simulations are replayed and compared with all
diagnostic observers disabled to prove they never steer physics.
The step has no newly issued ball impulse, collider, player
teleport, movement algorithm, public gameplay/LAB scene/button,
Preview, production, remote D1 write or deploy.

**Observed first 20-trial exact-head Rapier matrix:** 4 genuinely
sustained cases with independently varied ball states (x=4.96,
vx=-0.2/-0.3; x=5.00, vx=-0.3/-0.4, all y=0 m/s where relevant).
Every certified case has genuine Away #10 first release, Home #10
second Rapier START/END, >=10 consecutive contact-free post-END
frames and an explicitly real new START censor at tick 141.
11 trials instead have a real second START/END and world ball
velocity difference, but an intervening genuine contact cuts the
clean interval to 1–6 ticks (<8, **not sustained**). 2 have a
genuine second START but no unambiguous completed second shoe
END and therefore cannot arm a clean tail. 3 never establish
an eligible second-player episode (ordinary-movement no-second,
original-shoe-recontact first, and genuinely distant no-contact).
The regression locks all four groups and selected full-physics
deterministic replays, including a second independently varied
positive. Exact numerical values remain logged in the targeted
GitHub Actions job. Full-world post-END heading drift is a
measured angle between two nonzero velocities, **not** a causal
foot attribution or a direction comparison to a stationary ball.

The output is **marginal whole-world physical sensitivity** under
matched fixed player inputs, never proof of an individual foot's
isolated impulse, control, interception or official possession.
All corresponding flags remain false. Exact-head GitHub CI evidence
is attached to issue #480 after verification.

---

# ME-PB-44 — genuine post-END matched-world trajectory persistence (2026-11-11)

ME-PB-43 showed that a real Home #10 Rapier shoe START **127**,
END **130** changes the whole world's ball trajectory relative to
an otherwise matched 21-shoe ablation. ME-PB-44 verifies the actual
**clean interval AFTER that END**, not mere initial deviation.

Three independently created pinned Rapier worlds — complete 22 shoes,
Home #10 omitted and a sham with distant Home #1 omitted — receive
the **same identical 22-player movement frame every tick** (driven by
the full world's preceding *actual* ball). The entire world uses
genuine solver movement and genuine shoe START/END/ACTIVE events:
none is created or patched by the observer. A new immutable
read-only pure observer requires the true second-shoe END frame,
matching ME-PB-43 full/ablated ball measurements, a bit-identical
sham ball state, and consecutive canonical event ledgers. It
records 3D position/velocity differences, min velocity difference,
clean-world planar travel, and sustained divergence (>=8 consecutive
clean frames with >0.01 m position and >0.1 m/s velocity gap).

**Interpretation boundary:** a later genuine new shoe START or other
physical shoe event immediately **CENSORS** the post-END interval.
The observed Home #10 **recontact at tick 141** makes the 131–140
interval (up to ten consecutive 60Hz frames) the only eligible
uncontaminated post-END window. Even though the world difference
persists beyond 141, the later trajectory cannot be attributed solely
to the earlier second contact episode; recontacts introduce new
physical causes. This is still a **fixed-player-input counterfactual**,
not two independent adaptive matches, and reports only aggregate
whole-physics-world marginal differences. No exclusive foot impulse,
controlled reception, interception, or official possession proven.

QA: independent triple-world deterministic replay; read-only observer
ON/OFF identical canonical ball/foot streams; true physical shoe-END
and subsequent recontact provenance; sham/no-touch world negative;
invalid or stale data fail closed. No new physics, collision API,
player motion, LAB controls, official game actions, Preview,
production, remote D1 write or deployment.

---

# ME-PB-43 — matched-world marginal second-shoe ablation (2026-11-11)

After ME-PB-42's genuine physical Away #10 → Home #10 sequence,
ME-PB-43 executes the already supported **diagnosticOmittedFootId**
counterfactual with the **same pinned Rapier** solver and **the SAME
canonical 22-player kinematic frame on every 60Hz physics tick**.
Three independent worlds receive identical ball initial conditions:
(A) full 22 shoes, (B) 21 shoes with **Home #10 omitted**, and
(C) sham control with an unused far-field **Home #1 omitted**.
Every player, including the omitted shoe's actor, still participates
in the shared canonical movement; no additional engine flags,
forces, new contact APIs, synthetic shoes, repositioning, new LAB
scene or button were introduced.

Both A and B have identical player trajectories by experimental
design: each movement frame is derived from A's *real previous ball*
and is applied unchanged to **all** worlds. This is a matched
kinematic-input comparison, **not** an independently adaptive
counterfactual football match. Once the balls diverge, the B and C
worlds deliberately do not independently retarget their players.
This must be disclosed when interpreting the difference.

An independent immutable observer validates each completed world
state (same tick, canonical 3D coordinates), the genuine ordered
Rapier START/END/ACTIVE ledger for both A and B, and that the
omitted Home #10 physically cannot generate a shoe event in B.
It measures whole-ball position and velocity vector differences,
planar differences, speed differences, the first divergent physics
tick and the genuine A-world Home #10 START/END. One actual
physical Rapier START remains **tick 127**; END **tick 130**.
The comparison explicitly accounts for Rapier CCD potentially
producing motion divergence just BEFORE the START event; such a
pre-START difference is NOT a fictional foot START or a
preemptively inferred intervention.

Exact same-world ball/foot replay, sham omission negative
(including no-target no-contact), observer ON/OFF matched kinematics,
and guarded invalid states are verified in CI. This quantifies a
**marginal whole-physics-world response to a physical collider
ablation**, NOT unique individual-foot impulse attribution,
control, interception, successful reception or any ball ownership.
All official possession/control/foot-impulse attribution fields
remain false. Experimental-only; no official match integration,
public/Preview/D1 impact, deploy or merge.

---

# ME-PB-42 — measured 60Hz ball trajectory during the SECOND real shoe contact (2026-11-11)

ME-PB-41 independently established a legitimate first-to-second
collision chain: Away #10 genuine START (tick 1), first real END (19),
measured uncontested clearance (26), then Home #10 genuine new START
(127). ME-PB-42 extends **only isolated, test-only Rapier research**,
using a read-only frozen second-contact episode observer. It takes
the actual ME-PB-41 positive witness, the prior and current completed
3D ball snapshots, and a genuine Rapier shoe event frame at each
consecutive physics tick; no contact is created or retroactively inferred.

The observer reports the total ball speed change, aggregate world
delta-velocity and delta-momentum, absolute heading-angle change,
measured planar displacement/path, genuine active contact samples
and real physical END tick/duration for the second shoe. Every source
frame must have canonical tick/identity/event continuity. A competing
shoe, missing genuine END, stale state or expired <=60-tick window
does **not** prove a completed exclusive second-foot episode. Actual
observations are frozen, deterministic, and unable to steer physics.

Crucially, even a coincident measured ball delta-velocity is the
aggregate response of the **whole Rapier world**: terrain/friction,
gravity, other possible contacts and the shoe may all contribute.
No exclusive individual-foot impulse is proven. Contact is NOT
controlled reception, an interception, a tackle, a change of
possession or an official match action. All control, possession,
interception, official free-ball, pass and ball-force-attribution
flags explicitly remain false. No new kick/impulse, collider,
teleport, movement mode, engine code, LAB scene/button, Preview,
production endpoint or remote D1 write.

QA: real seeded Rapier replay twice; alternate existing approach
tactical mode; observer on/off ball and shoe collision traces;
no-foot-collider control; negative no-second and intervening
original-shoe recontact; strict forged/stale state rejections.
Exact-head CI evidence is recorded in issue #480.

---

# ME-PB-41 — genuine second player's shoe START after real ball release (2026-11-11)

A **new, entirely read-only diagnostic evidence observer** and isolated
real 60Hz Rapier regression prove a distinct second player's genuine
shoe START **after** the same ball already underwent:
(1) >=6 qualifying real shoe/ball co-motion ticks,
(2) a genuine initial shoe END and
(3) >=3 independently measured uncontested-ball clearance frames.

The observer is armed **only** by the frozen ME-PB-39 snapshot from the
*first* confirmed physically clear tick. It then consumes every
consecutive completed Rapier shoe START/END/ACTIVE frame, canonical
22-player actual pose/velocity and measured ball XYZ/velocity. It
reconciles each previous active-foot set with the next real event frame,
validates provenance and ordered canonical IDs and expires after at most
180 ticks. Only the **first subsequent** genuine active START can
qualify. A recontact by the original player, a transient/multiple-shoe
START, a stale/forged frame, nonfinite data or a missed observation
invalidates a clean second-player witness. A later contact cannot
retroactively repair an interrupted clearance-to-contact interval.

**Exact independent Rapier positive witness:** grounded x=+4.96 m,
initial velocity x=-0.3 m/s, existing approach intent without
the physical AI-kick switch; genuine **Away #10 START tick 1**,
13 qualifying co-motion ticks, **Away END tick 19**,
**three-frame uncontested clearance confirmed tick 26**, and
**Home #10 actual Rapier START tick 127**. No other shoe START
between the clearance and second-player contact. An independent
existing exchange-approach intent reproduces the same physical
contact tick; full-state deterministic replay and an observer-disabled
A/B trace are identical. The no-foot physics control creates **zero**
shoe START/END events.

A separate real grazing experiment does register a later Away START,
but an intervening **original Home #10 recontact** occurs first.
This must remain **not qualified as uninterrupted handoff**, rather
than counting a second actor merely because they eventually touched.
An unqualified contact or stalled ball likewise cannot be promoted
to ownership. The original LAB-11 remains unchanged and does not
suddenly claim a release or possession.

The witness is **physical collision evidence only**, NOT controlled
reception, interception, tackle, change of possession, exclusive force
attribution or official ball ownership. officialPossession,
controlConfirmed, interceptionProven, freeBallOfficiallyProven,
passCreated and ballForceApplied remain **false**. No player teleport,
new kick, synthetic collider event, physics or movement change, new
LAB page/button, public gameplay, Preview, production or remote D1
write. All thresholds are exploratory DEV-only research conditions.

---


# ME-PB-40 — isolated REAL Rapier shoe-release witness search (2026-11-11)

ME-PB-39 correctly refuses to invent a shoe END in the established
LAB-11 exchange, where contact remains active throughout its bounded
observation window. ME-PB-40 adds an **independent, test-only physical
release investigation**, not a new user-visible LAB scenario, physics
coefficient, control mechanism or official football action.

A bounded matrix of pre-existing grounded ball positions and velocities
is passed unchanged to the same pinned deterministic Rapier engine with
the same 22-player movement. Every shoe START, ACTIVE and END is read from
the **real completed Rapier collision-event queue**. A test-only observer
gate is initialized *only after* a genuine Rapier shoe START; it is
expressly not a real LAB-11 ownerless-response authorization, a pass, a
controller/possession claim, a match event or a fabricated collision.
The gate changes **nothing** in Rapier or player movement.

The ME-PB-38 and ME-PB-39 pure observers consume only completed physical
frames and actual ball/player positions and velocity. A positive outcome
requires >=6 consecutive qualifying observed co-motion frames, a real
Rapier END for the same shoe and >=3 subsequent physically clear frames
with the existing bounded separation, height and relative-speed rules.
Tests explicitly reject the absent-END/absent-clearance cases rather
than synthesizing touch events or overriding the engine, compare
deterministic full-state replays and verify that the no-foot control
world creates no shoe events. Actual positive/negative outcome is
determined by exact-HEAD GitHub Actions, not assumed from fixtures.

This remains a non-calibrated **DEV research witness only**. It never
produces actual ownership, a change of possession, control, interception,
official loose-ball status, a goalkeeper save, score or additional force.
Default engine behavior, LAB-11, production, Preview and D1 are unchanged.

---

# ME-PB-39 — verified shoe END and measured ball separation (2026-11-11)

LAB-11 extends the read-only ME-PB-38 co-motion observer without changing
movement or Rapier physics. Only the previous **completed 60Hz** physical
shoe START/END/ACTIVE frame, canonical 22-player poses and the actual
3D ball position/velocity are admissible. An outfielder who previously
accumulated >=6 consecutive qualifying shoe/ball co-motion frames can
subsequently produce an observed **physical contact END**. A proximity
change or lost co-motion streak alone is not an observed Rapier END.
Ordered identities, 60Hz tick continuity and the previous active-shoe
set are verified before interpreting the real END event.

After that END, **three consecutive independent measured samples** must
show no active shoe colliders, ball center near turf (<=0.28m),
>0.46m XY distance from **all 22 current shoe proxies**,
>=0.2m/s actual ball ground speed and >=0.12m/s outward
relative radial speed from the ended shoe. Only then is a
**provisional measured-uncontested-ball** observation recorded.
Recontact, ambiguous shoes, airborne ball, a stationary ball,
inward velocity or nearby shoes reset current clearance; historical
observations remain frozen. If genuine Rapier END is never present,
the system must never fabricate a release. The observer expires
within the existing 90-tick bounded ownerless response window.
Thresholds remain provisional research parameters, not match rules.

The result never proves control, lost possession, an interception,
or official ball freedom. \`controlConfirmed\`, \`officialPossession\`,
\`interceptionProven\`, \`freeBallOfficiallyProven\` and
\`ballForceApplied\` are always **false**. No ball impulses, new LAB
scene, scattered buttons, new player actions, official fixtures,
Preview, production or remote D1 modifications are introduced.

---

# ME-PB-38 — observed contact-compatible shoe/ball co-motion (2026-11-11)

LAB-11 now has a **read-only**, finite 90-tick observer after the already
verified actual Away shoe START and terminal opponent-flight audit.
At movement tick N+1 it inspects only the completed Rapier collision frame N,
actual canonical 22-player pose/velocity and the same completed 3D ball state.
An outfielder can accumulate a **provisional sustained co-motion evidence**
streak only if exactly one genuine Rapier shoe collider is currently active,
that collider belongs to an already selected post-contact responder,
ball and shoe are close and low to turf, both are moving in approximately
the same direction, and observed planar relative speed is small.
**Six consecutive frames** are needed. No shoe event, a stationary proximity,
a fast rebound, an airborne ball, conflicting shoes or an interrupted streak
cannot pass. Thresholds (0.46 m XY, 0.28 m maximum ball-center Z,
0.75 m/s relative speed, 0.2 m/s minimum motion and 0.75 direction cosine)
are conservative *uncalibrated DEV research parameters*, not game rules.

Frozen evidence snapshots retain the highest observed streak, expire within
the existing response window, and never represent exclusive physical force,
intentional first touch, ball ownership or match possession. The existing
LAB-11 row displays evidence without a new button or LAB scene. Normal
physics, default scenarios, official fixtures, D1, Preview and production
remain unchanged. Node guard tests include provisional positive fixtures
(**not** claims of Rapier-verified control) and a same-world actual Rapier
negative/observational replay with the genuine opponent START. The observer
**always** has controlConfirmed=false, officialPossession=false,
interceptionProven=false and ballForceApplied=false; future controlled
possession requires separately verified mechanics and authorization.

---

# ME-PB-37 — two-team ownerless loose-ball reaction after real opposition contact (2026-11-11)

This milestone does **not** add LAB-14 or any new button. The existing
**LAB-11** is the only opt-in environment in which an already observed
actual Away shoe START and the **terminal** ME-PB-36 measured-flight audit
can trigger a tactical **loose-ball response**. This is not an officially
adjudicated change in possession, a stolen pass, an interception or even
an assumption that a rebound belongs to either team.

The response selects **one actual outfielder per team** based solely on
current canonical 22-player XY and the current physical ball XY at the
first eligible movement tick, with a deterministic distance/ID tie-break.
It persists those two canonical identities and aims them toward the
**subsequently measured ball** for at most **90 consecutive 60Hz ticks**.
The existing player movement acceleration, global 7m/s speed bound,
turning, pitch limits and hard teammate separation remain in charge.
There is **no positional teleport, ball impulse, newly invented shoe
contact, scripted pass or explicit possession owner**. Both teams may
try to reach the same genuinely loose ball.

The source audit is accepted only after a physically authenticated
opponent START and a terminal measured-flight result: confirmed
reverse/slow/redirect, no confirmed persistent change, or insufficient
incoming flight. Unknown, gapped or forged audits cannot re-arm a new
response; only one bounded response is created per scene. The existing
Home #7 and Home #10 passes remain genuine and independently required,
and the prior physical opponent START still halts the experimental
exchange. Neither the outcome nor the new player reaction implies a
scored tackle, official match result or per-foot impulse attribution.

A separate pure contract suite tests canonical roster selection,
initial actual XY, monotonic tick/hysteresis, terminal statuses,
immutable snapshots, forced 90-tick timeout and rejection of stale or
fabricated evidence. Same-world Rapier tests compare the existing
two-pass opponent-contact scene **with and without** ownerless response,
check no pre-contact movement changes, verify real post-contact motion,
physical movement bounds, absence of new fabricated passes, and
deterministic replay. The existing Chrome LAB-11 row displays the
responders and explicit 'no possession' status; Reset and Compare remain
unchanged. Ordinary LAB modes and production football state are
unaffected. PR stays Draft/HOLD; no merge, deploy or remote D1 writes.

---

# ME-PB-36 — evidence-qualified opposition touch versus altered ball flight (2026-11-11)

This milestone does **NOT** add another LAB scenario, controller action, possession,
interception, foot force or match event. Existing LAB-11 contains an independently
verified physical Away #10 shoe START at tick 196 while the Home #10 return pass
is underway. Previously that true contact safely stopped the *experimental*
exchange, but did not establish any measurable *flight outcome*.

The new DEV-only `oppositionFlightAudit` observes only the **same-world Rapier
velocity immediately before/after the actual 60Hz solver step** and the
subsequent **completed 60Hz ball velocities**, synchronized to the exact Away
shoe START and preceding **real applied** pass record. The first result is
explicitly `contact-only-not-interception`. A continuing reversal, substantial
slowdown or >=30-degree redirect is described as **observed altered flight
after contact** only after **3 consecutive actual observations** of the same
kind. If no such stable change occurs in **6 consecutive observed ticks**,
it records `contact-only-no-confirmed-change`. An incoming speed below
1.5m/s is **insufficient** to claim a directional change.

Neither solver aggregate velocity delta nor the subsequent trajectory
isolates a per-player cause: gravity, turf and any other colliders may also
contribute. All records explicitly mark solver attribution unresolved and
`interceptionProven:false`, `officialPossession:false`,
`passCreated:false`. The earlier experiment's conservative halt on a
real Away touch is unchanged; this is NOT an official match stoppage.

A separate pure Node test suite rejects fabricated/stale foot STARTs,
unsynchronized pass records, non-finite or gapped velocities and transient
rebound samples. The real LAB-11 integration must verify both the true
physical touch and subsequent frozen flight outcome without inventing any
additional pass, with deterministic two-pass replay. Existing Chrome LAB-11
status appends the **observed** result without new controls; LAB-01–13,
physics coefficients, collision handling, movement and score stay untouched.
No merge, deployment or remote database write is authorized.

---

# ME-PB-35 — fourth actual-physics pass vs observed contact (2026-11-11)

**LAB-13 · AI Defend (Fourth Pass)** is a separate opt-in choice in the
existing Scenario dropdown, sharing no new action button with ordinary
LAB-01–12. It starts from the unchanged, normal 22-player formation.
The first and second genuine Rapier impulses remain Home #7 → Home #10
and Home #10 → Home #7; the third is the independently shoe-gated
Home #7 action introduced in LAB-12.

Only in LAB-13, after the genuine third impulse, Home #10 pursues the
**currently measured physical ball** with normal ≤7 m/s bounded
movement and existing collision separation. A **fourth** Home #10
return-pass impulse is permitted only if a **new, different 60Hz Rapier
shoe START** occurs, the current ball and sender XY/Z are close enough,
the earlier third impulse is independently recorded, the current Home
#7 location is valid, and the impulse is within the existing bounded
10 N·s change. The core calls `applyImpulse` on the REAL Rapier ball
before adding the linked fourth action record. The defensive ledger
can only create the fourth task on the subsequently verified,
**physically applied** event. LAB-13 defers the third active defensive
lane; earlier LAB-12 assignments/physics remain unchanged.

Crucially, the read-only `postThirdFootStarts` timeline records new
post-third shoe START observations separately from actually applied
pass actions; a bounce, contact or ongoing velocity **does not create
a fourth event, possession, interception or score**. The list is frozen
and bounded to 12 observations. A contact is labeled as a fourth pass
only if its same-tick independently applied impulse is recorded.
Any earlier official gameplay path remains unchanged.

Acceptance requires a fourth **actual** Rapier impulse in the same
world as the first three, a distinct later Home #10 START, strict
previous-event linkage, separate defensive response and deterministic
Node/Chrome replay. Tests must reject the milestone if any of these
conditions fail; no scripted fake contact or timing-based action.

---

# ME-PB-34 — candidate third *real* Rapier shoe-triggered pass (2026-11-11)

**LAB-12 · AI Defend (Three Passes)** is a separate opt-in entry in the
existing Scenario dropdown. LAB-11 and all earlier scenarios retain their
accepted physics and outcomes. In LAB-12 the engine first uses the same
Home #7 → Home #10 impulse and Home #10 → Home #7 impulse as LAB-11.
Only after the return has actually occurred, Home #7 approaches the
measured live ball at normal bounded player speed, without teleporting
the feet, relocating the ball, or manufacturing a contact event.

The new independent **Home #7 shoe START** must be reported by the
completed Rapier collision step. Only if current player XY, ball XY/Z,
previous physical pass ticks, current ball velocity and the new real
shoe START pass the dedicated guard may the engine call
`body.applyImpulse` to send the physical ball toward the *current*
Home #10 location. Its applied impulse is then recorded as `stage:'pass'`,
`sequence:3`, `previousPassTick` linked to Home #10's genuine return,
and `appliedByRealRapier:true` strictly after the physical application.
The existing ME-PB-33 coordinator must independently accept this event
before a new autonomous Away defensive lane task can be assigned.

The experiment deliberately defers the **second** active defensive lane
task so the genuine return can physically reach Home #7 before the
previous LAB-11 Away #10 collision at tick 196. The **first** defensive
task remains real and archived. The third task begins only on physical
third-pass evidence, not on the delay or any timer. Normal 22-player
initial positions, 7 m/s speed bounds, teammate separation and ordinary
Rapier foot physics remain unchanged; no official match possession,
interception, score or pass completion is claimed.

Acceptance is deliberately strict: real Rapier test must show three
distinct ordered shoe START contacts / applied ball impulses in the SAME
world, then a third independent defensive response and deterministic
full-world replay. A pure unit test validates the third-pass decision
guard separately. The browser must select LAB-12, observe the third
pass, complete Compare replay, Reset, and return to LAB-01 without
additional buttons. If the physical third START does not occur, the
milestone **fails** rather than simulating it.

---

# ME-PB-33 — bounded verified pass ledger, prepared for future physical cycles (2026-11-11)

The DEV-only **LAB-11 · AI Defend (Two Passes)** maintains its existing
two real Rapier kick actions and identical ball/player simulation. This
milestone generalizes the **read-only defensive event coordinator** rather
than claiming a third kick that the engine cannot yet physically perform.

A pass epoch now carries a frozen monotonically increasing `sequence`,
`previousPassTick`, immutable actor/target pair and an observed,
same-tick Rapier foot-START evidence reference. Subsequent epochs
alternate Home #7 forward `pass` and Home #10 `return-pass`; they
must be **independently applied physical impulses** reported by the
same opt-in engine with a strictly newer real shoe START, not inferred
from ball motion, nearby players, previous intent or a re-used event.
The new ledger rejects skipped/stale epochs, wrong players, changed
signatures, non-finite/zero impulses, missing contact, immediate
same-tick "second actions" and mismatched actor/receiver continuity.

The historical tasks remain immutable. A new action can supersede the
currently **closing** duty; an already terminated physical or
measured-flight release is preserved exactly. Both the live list and
the defensive history have a hard **8-pass-epoch cap** (at most seven
archived tasks). Once the limit is reached, further events do not
increase memory or activate another defender. Normal 7 m/s movement,
the existing real-world player-separation guard and replay remain
untouched; no possession, interception, match score or official
pass-completion decision is inferred.

The DEV UI reads the latest **actual pass event in the engine's ordered
event history**, instead of a hard-coded two-field fallback, so future
real kick events can be discovered without expanding the controls.
LAB-11 still displays `2 / 2` for its **current physical two-pass
scenario**, and there is no LAB-12, new button, official gameplay,
deployment or remote DB change.

Verification boundary: **actual Rapier integration tests verify only
the two physical kicks currently produced** (Home #7 then Home #10)
and their resulting defender contacts/replays. New third/fourth/eighth
event tests are *pure schema/guard fixtures*, not generated physical
third passes; they prove the coordinator's validation and finite
history contract only. An additional real kick needs a separately
implemented and physically verified AI action before it may be
reported as gameplay evidence.

---

# ME-PB-32 — second real physical pass, new defensive task (2026-11-11)

**LAB-11 · AI Defend (Two Passes)** is an isolated **new option in the
existing Scenario dropdown**; no scattered action buttons or official
match routes. It uses the same grounded Rapier Home #7 → Home #10
exchange as LAB-08, with an autonomous, non-pre-positioned Away lane
defender. Unlike LAB-10, Home #10 makes the ordinary bounded receiving
run, so a **later genuine independent Home #10 shoe START** may trigger
a second **real Rapier impulse** back toward Home #7.

The DEV-only pass-cycle observer accepts a fresh action only when the
engine has actually applied an impulse, the action tick matches the
**already completed Rapier** collision frame, and its player ID is
present in the genuine shoe START list. The two allowed stages are the
first pass (Home #7) and a strictly later **return-pass** (Home #10),
linked to the previous pass's tick. Repeated or stale events, merely
ongoing ball motion, proximity, a return-control event, invented
possession or a reused shoe START **never** re-arm a task.

A later verified pass archives the previous immutable defensive plan
(with its original physical or observed-flight release preserved),
then chooses a **new** defender/waypoint from current actual 22-player
XY and the new real ball velocity. Return-pass flight uses the **current measured signed X direction**
(not a fixed assumed backward direction), with the same bounded retargeting,
slow/reverse/passed-defender abandonment, 7m/s movement cap and hard
player-separation guard. LAB-01–10 retain their accepted behavior
unchanged. This is **research-only defensive intent**, not a
guaranteed interception, control, possession or scored result.

Node tests cover the two contact-gated pass records, strict anti-replay
validation, physically grounded same-world multi-pass replay,
bounded defender movement, zero-tick/reset and isolation. Chrome LAB
QA checks both physical stages, Scenario selection, reset and Compare
replay. The extra LAB mode is opt-in and never calls remote DB or deploy.

---

# ME-PB-31 — actual post-release defensive duty rejoin evidence (2026-11-11)

**LAB-10 · AI Defend (Autonomous)** now audits how its *same moving
defender* resumes the **currently selected ordinary tactical duty**
after either the genuine previous-tick Rapier shoe START (ME-PB-27) or
confirmed stale-flight abandonment (ME-PB-30). The defensive assignment
is still immutable and terminal; **no new defensive control loop**, no
re-arm, forced recovery waypoint, body teleport, new collider, ball action
or gameplay event is introduced.

For every post-release 60 Hz movement tick, the DEV-only observer compares
the player's **actual XY before and after the existing acceleration,
turning and teammate-separation guard** to that tick's **actual chosen
tactical target**. It exposes the measured distance, real progress and
distance moved, including an actual blocking teammate/opponent ID when the
existing kinematic guard prevented motion. A player is labelled
`aligned-with-current-duty` only after **6 consecutive measured ticks**
within **1 m** of the current duty target, not merely because the assignment
was released. A `blocked-by-observed-player` label similarly requires
**6 consecutive actual blocked ticks** away from the duty. Both streaks
reset on changed measurements; the current target is dynamic, so the UI
never claims permanent rejoining to a fixed initial formation.

Normal physics, non-AI scenarios and ordinary 22-player movement remain
unchanged. The existing LAB-10 status appends the current **measured duty
gap**, with no new buttons. New pure guard tests reject stale frames,
forged defender IDs and unbounded player jumps; the real 60 Hz Rapier
roll / physical shoe-contact replay and Chrome LAB-10 Compare replay
test confirm that this observational audit does not alter motion or
promote a touch into official possession/interception/score.

---

# ME-PB-30 — abandon an obsolete measured passing lane (2026-11-11)

**LAB-10 AI Defend (Autonomous)** now ends the live defender's assigned
lane-closing task when successive already-completed **Rapier** 60Hz ball and
defender-position measurements confirm the ball can no longer use that lane:
**6 consecutive ticks** below **1.25 m/s** forward X velocity,
**3 consecutive ticks** at or below **−0.6 m/s** (reversed flight),
or **4 consecutive ticks** with the real ball at least **2.5 m** beyond
BOTH the moving defender's current X position and the original crossing
X waypoint. These thresholds are experimental DEV-only tuning, not
official game rules. A restored forward flight or change of lost-flight
reason resets the consecutive-evidence counter; there is no one-frame
abandonment, re-selection, teleport or automatic restart of the same task.

An already observed **previous-tick Rapier shoe START** has priority and
still uses the existing separate `released-after-physical-contact` event.
Without that physical event, the assignment becomes
`released-after-observed-flight` with a specific, immutable reason
(`slowed`, `reversed`, `passed-defender`) and a measured movement tick.
In either case the defender returns to existing ordinary bounded tactical
movement; no possession, interception, score, tackle, official match
outcome, external scheduler or synthetic foot contact is inferred.

The existing LAB-10 status now shows the **observed** abandonment reason;
no scenario option or button has been added. Regression tests cover strict
finite/monotonic samples, physical-contact precedence, hysteresis,
no task revival, speed bounds, deterministic replay and independently
simulated **real Rapier rolling ball** tests for slowing and passing a
moving defender. Standard LAB scenarios and normal 22-player formation
remain unchanged.

---

# ME-PB-29 — measured-flight bounded lateral lane retargeting (2026-11-11)

**LAB-10 · AI Defend (Autonomous)** now keeps the *same* live defender but
can correct its intended **lateral** crossing point when later, already
completed **real Rapier** ball position and velocity samples put the
approach corridor at least **0.65 m** away from the current waypoint.
Every such adjustment is capped at **0.12 m per 60Hz movement tick** and
spaced by at least **3 ticks**; the longitudinal aim remains unchanged,
the player still obeys the existing **7 m/s** acceleration/turn/separation
constraints, and normal LAB modes/initial formation are untouched.
The on-pitch LAB readout reports the number of measured-flight corrections
without introducing another button.

The actual previous-tick Rapier defender shoe **START** always releases
the assignment *before* any attempt to retarget; a released plan can
never be revived by subsequent ball velocity changes. This remains a
DEV-only waypoint intention and **does not award interception, possession,
score or official game action**. The pure decision rejects stale/nonfinite
inputs and is immutable. Node regression coverage uses an independent real
**oblique Rapier rolling ball** to verify the lateral motion, cap and exact
deterministic replay, plus separate altered-velocity/invalid-input and
real-contact lifecycle tests. Chrome checks preserve the LAB-10 physical
contact and Compare replay baseline.

---

# ME-PB-28 — consolidated LAB Scenario dropdown (2026-11-11)

The **Scenario** dropdown is now the single entry point for physics setups
and local-AI trials. It retains **LAB-01 Ball Drop**, **LAB-02 Ball Launch**,
**LAB-04 Ball Roll (Grass)** and **LAB-05 Ball Bounce (2 m)**; **LAB-03**
remains the separate **Compare replay** action in Advanced settings. It adds
**LAB-06 AI Kick**, **LAB-07 AI Pass & Control**, **LAB-08 AI Exchange**,
**LAB-09 AI Defend (Live Lane)** and **LAB-10 AI Defend (Autonomous)**.

Selecting any scenario prepares its genuine 3D Rapier initial conditions,
seed, and relevant optional local-AI controller, then **resets to tick zero
paused**. **Play, Pause, Step, Reset** now work identically across all
scenarios; **Apply & restart** retains the chosen LAB and accepts Advanced
input changes; **Compare replay** uses the same selected physics world.
AI trials show Players (22), their mandatory physical foot-contact switch
is checked/disabled, and returning to a standard scene restores the
unchecked editable switch and a collapsed Players panel. No new public
routes, official possession, scoring, Preview, or remote DB effects.

This replaces the five scattered demo-launch buttons; historical
one-click-button descriptions below are superseded by this section.

---

# ME-01 — Match Engine Foundation & Visual Laboratory

**Experimental / Draft-HOLD.** This folder is isolated from official fixtures, D1, Admin commands, production pages, players and the existing `temporary-score-v1` authority. Follow #452 for decisions and acceptance evidence.

## Run locally (Node 22, Windows PowerShell)

From repository root:

```powershell
npm --prefix backend ci
npm --prefix match-engine ci
node tools/dev.mjs
```

Open **http://app.localhost:2000/dev/match-engine** on the same computer in Chrome. The experiment is *intentionally denied* on the local site's `localhost:2000` host, frontend LAN, shared Preview and public modes. No API or D1 operations are required by the lab. Stop with Ctrl+C.

To run the focused verification and benchmark from another terminal:

```powershell
npm --prefix match-engine test
npm --prefix match-engine run bench -- 6000
node --test match-engine/tests/lab-viewport-browser.test.mjs
node --test tests/app-subdomain-preview.test.mjs tests/app-canonical-routes.test.mjs
```

The simplified default screen shows only the **Scenario** selector, **Play/Pause/Step/Reset**, playback **Speed**, large top-down pitch, compact **Time / Height / Ball** indicators and a small **Ball height** chart. Open the native, keyboard-accessible **Advanced settings** section to edit starting coordinates and velocities, set the seed, inspect exact position/velocity and engine version, **Apply & restart** or use **Compare replay (LAB-03)**. The initial Advanced settings panel is intentionally closed; no engine capability has been removed. The same frozen scenario and physics tick are used throughout. The seed is currently a reproducibility identifier, not a source of stochastic motion.

## ME-PB-26 — autonomous defensive closure after observed ball flight (2026-11-11)

**Real-time defense instead of a staged blocker:** In a dedicated opt-in DEV LAB mode, the Away team starts in the **ordinary canonical 22-player starting positions**. The new `AI defend · autonomous` button is available only when AI exchange is active. Away defenders do not teleport into an interception corridor and no Rapier collider has an adjusted tick-zero position. Only **after the first actual Home #7 Rapier shoe-ball START and resulting measured ball velocity** does the deterministic observer pick the closest of Away #9/#10/#11, project a bounded near-recipient interception waypoint from the real moving ball XY/velocity, and assign that *ordinary movement target* to the chosen player. The candidate continues under the existing 60Hz max 7m/s, acceleration, braking, turn-rate and inter-player collision bounds; physical contact remains an entirely separate, independently audited Rapier shoe-ball START. The receiving Home #10 performs a **bounded lateral off-ball support run (5m from its regular lane) AFTER observing the pass**, rather than the earlier experimental close-foot reception. Both participants still start in the original formation and undergo the normal speed/acceleration/turn/collision guards; this explicit controlled trial clears an unintended early receiver shoe rebound so the defender's physical interception can be measured without increasing its speed, adjusting ball physics or teleporting anyone. It is not a finished intelligent receiving tactic. An intended waypoint is never counted as an interception or possession.

**Research boundaries:** `experimentalAiAutonomousDefense` and `diagnosticLocalAiAutonomousDefenseEnabled` must both be opt-in, require the existing local exchange and are mutually exclusive with the older ME-PB-25 pre-positioned Away #7 mode. The pure observed lane planner has no future game state, no client command authority, no official score and no ball physics access. The browser passes the *previous completed* real Rapier snapshot ball velocity to the movement observer. Only genuine contact in the same physical world may stop the live outgoing pass; none is inferred from tactical proximity. The optional visible status shows when the defender made a real observed-flight decision and its measured waypoint; it does not assert a collision.

**Exact-head QA:** negative/no-velocity/invalid-frame tests, dynamic candidate ranking, standard formation at tick zero with valid consecutive Rapier foot frames, physical real-contact scenario versus independent replay and local Chrome button/replay/Reset checks. If the defender cannot reach the ball before the recipient, this remains a measured failure and must not be reported as a successful interception. Normal production/official matches and all previous LAB demos are unchanged; Draft/HOLD, no merge, Preview, deploy or remote DB.

## ME-PB-25 — observed dynamic pass selection and live opposing shoe lane (2026-11-11)

The opt-in local AI exchange no longer hardcodes Home #10 as the outbound recipient: at the *actual* Home #7 Rapier shoe-ball START it evaluates Home #9, #10 and #11 from the real simultaneous 22-player frame, using forward distance, lateral displacement and physical opponent-to-segment proximity; deterministic tie order, explicit absent/invalid target rejection, full immutable candidate scores. It applies an actual 2.7 N·s ground impulse toward the selected real teammate, without guaranteeing reception, pass completion, ball ownership or a match goal. A subsequent return can only be attempted by the chosen recipient after a separate real Rapier shoe START. The baseline demonstration still chooses Home #10 organically and retains 13/153/445 physical events if the observed positions permit.

The distinct **AI defend · live lane** button appears only inside Players after enabling AI exchange. Its dedicated local research flag pre-positions an Away #7 midfielder at (-12.4, 0) from tick zero with the *same starting pose in the player movement state and Rapier foot collider*, rather than teleporting any player after physics begins. All subsequent transitions are canonical bounded 60Hz movements; a true Away foot START during the ball's live outgoing trajectory is reported as physical opposition contact and halts the experimental exchange. This is not a verified possession change or an adjudicated interception. The ordinary 22-player formation, existing ME-PB-22/23/24 demos, normal games, statistics and APIs remain untouched.

ME-PB-25 tests cover pure dynamic target re-ranking under changed real teammate positions, frozen candidate scoring and fail-closed no contact, pre-positioned initial 22-player consistency, strict opt-in, same-world real Rapier defender START with original Home #7 pass, independent double replay and Chrome GUI click/compare/reset/normal-preset restoration. It is *not* multi-target tactical game play or calibrated defender biomechanics. PR Draft/HOLD; no merge, Preview/deploy or remote DB.

## ME-PB-24 — local physical return-pass and opposition contact audit (2026-11-11)

**Research-only extension of ME-PB-23:** a new "AI exchange" DEV LAB button runs Home #7 → Home #10 and attempts a physical *return pass* Home #10 → Home #7. The first Home #7 pass is the existing real Rapier 2.7 N·s START-gated shot. On a later independent actual Rapier Home #10 foot-contact START, the receiver chooses Home #7 as the return target from the current player frame and uses a bounded Rapier ball momentum-change impulse to target 6.5 m/s backwards. A subsequent Home #7 *controlled reception* is recorded only if yet another genuine Rapier shoe START occurs; a missing START stays unreported, never fabricated. No teleporting and no synthetic possession/pass completion. A physical away-player shoe START during the attempted route is recorded as "opponent-contact" and halts future AI impulses, never as an adjudicated ball steal or ownership change.

**Isolation:** the opt-in `diagnosticLocalAiExchangeEnabled` flag requires grounded roll, 22 genuine foot colliders, no missing foot, no competing local kick/pass mode. The autonomous close-press behavior is likewise separate from the default and from ME-PB-22/23. All known applied controller impulses are separate from Rapier solver-only contact and force reports. There is no official gameplay, scheduler integration, player authentication, score, goal, possession or calibrated foot biomechanics. Standard LAB scenarios are byte-for-byte isolated.

**Evidence:** Node real-Rapier double replay/negative/physical-opponent controls, plus real Chrome action-button click, 440-tick scene, physics Compare replay, Reset, default restoration, route allowlist and desktop viewport QA. The meaningful success target is **two separate real shoe-gated passes**; third physical receiver contact is *conditional and explicitly reported only if observed*. The opponent branch is tested with a separate real Rapier negative-control scenario, not a scripted interception outcome in the ordinary exchange scene. All acceptance subject to exact-head Actions results; PR Draft/HOLD, no merge, Preview, deploy, remote DB.

## ME-PB-23 — first local two-player physical pass and controlled reception (2026-11-11)

**New visible gameplay proof:** an isolated **AI pass** button beside the existing AI kick demo in the DEV LAB runs Home #7 (midfielder) to Home #10 (forward). A stationary roll ball initially sits near Home #7, all 22 player tracks still evolve on the accepted deterministic 60Hz system, and only Home #7/#10 use closer 0.38 m pressing targets in this explicitly opted-in research world. Home #7 aims an illustrative 2.7 N·s *real Rapier ground impulse* toward the observed Home #10 position **only following Home #7's genuine Rapier shoe-ball collision START**. On a separate later **real Home #10 Rapier collision START**, the recipient may attempt an actual measured momentum change with a capped, local AI-calculated impulse to reduce horizontal speed toward 0.35 m/s. The control is **not** automatic possession, an inferred pass completion or calibrated foot biomechanics. Both physical actions are recorded as distinct immutable local diagnostic events, after ordinary solver contact auditing, without modifying the main-world physics path.

The LAB visibly shows the pass and subsequent control if both actually occur. Reset recreates the original independent world and Compare replay recreates the exact canonical ball trajectory and Rapier contact trace. Normal LAB-01/02/04/05, default 1.8 m tactical pressing, the earlier AI kick demo, match state, world data, frontend gameplay, previews, deployment and database remain untouched.

**Strict gate:** `diagnosticLocalAiPassReceiveEnabled` defaults false, requires an explicit boolean, enabled 22-player Rapier shoes, grounded roll with no omitted shoe, and is mutually exclusive with the earlier local first-kick trial. `experimentalAiPassReceiveApproach` is also opt-in, mutually exclusive with the kick approach, and never changes the normal movement model. Calls from untrusted ME-PB-18/21 claims are not accepted as executable commands. The new Node suite exercises real Rapier physical events, pass/receive ordering, negative conditions, no teleport on the first kick, one-shot lifecycle, two full independent replays, world reset and LAB controls; Chrome checks actual button, recorded actions, Compare replay, Reset and default restoration. The first release is a local lab research experiment, **not completed passing AI for official matches**.

## ME-PB-22 — first visible deterministic autonomous kick in local LAB (2026-11-11)

**New milestone: actual playing action, not another passive action-provenance audit.** The local app-host DEV Match Engine has a one-click **AI kick demo** beside the Ball height chart heading. It constructs a *disposable* grounded stationary ball near Home #10, enables actual 22-player kinematic Rapier shoe contacts and a Home #10-only close-approach tactic (normal 1.8 m tactical press stays unchanged for every other mode). The player moves on genuine consecutive 60Hz autonomous trajectories and never fires the local action until **Rapier actually reports a Home #10 shoe–ball COLLISION START**, the ball is low and near, and the observed player faces forwards. At that exact contact tick the isolated engine applies a single deterministic **2.4 N·s horizontal impulse directly to the REAL 430 g Rapier ball** with `body.applyImpulse`; the returned canonical ball snapshot immediately contains the changed velocity. Its 2D pitch trajectory is real and shown in the existing canvas, with an explicit outcome line. The demo starts playing automatically on click; Reset repeats its deterministic starting situation. The standard scenarios/feet/ball default are untouched.

**Physical meaning and limits:** `2.4 N·s` is an illustrative manually selected *first prototype action*, not a calibrated biomechanics force. This is a true **engine-applied** impulse after independently recorded physical contact, not a fabricated collision, impulse inferred from a solver contact-force sample, or an external client's alleged command. The solver's contact timeline, force reports, attribution and momentum audits remain the original **pre-impulse physical step**; the separate local kick event explicitly reports the extra known controller-applied impulse, so the two cannot be confused. The local AI decision uses actual validated player position/facing and a real Rapier START, *not* ME-PB-18's unverified requests. No authenticated source, official match control, possession inference, pass completion, goal, shot success, roster attribute or score logic. It is one Home #10 kick in one locally opted-in roll research world, not full football gameplay.

**Safety/compatibility:** A new `diagnosticLocalAiKickEnabled` switch defaults to `false`, must be a boolean, and requires a grounded roll scenario with real opt-in foot colliders; disabled for launch/drop/bounce, airborne ball, foot ablation, normal LAB/default, server, D1, public modes, and official fixtures. The independent experimental approach flag similarly defaults to false; no altered player positional press unless the demo is manually selected. One-shot state is world-local, resettable and never accepts forged ME-PB-18/19/20/21 human/AI claims. The browser button is disabled until Rapier successfully initializes; LAB remains strictly app-host DEV-only.

**Evidence gate:** `player-ball-first-local-kick.test.mjs` covers strict configuration, pure decision negatives, genuine player approach and real Rapier collision START, exact reported and applied impulse versus a matched shoe-only Rapier control, no teleport, no duplicate action, deterministic double independent replay, reset replay, and local UI wiring. CI on the exact PR head must pass before this milestone is accepted. No merge, Preview/deploy/remote DB or production routing changes.

## ME-PB-21 — proposed session/player/controller binding intervals (2026-11-11)

**Issue #480 / PR #481 Draft/HOLD; research-only, no authentication.** Adds `match-engine/src/player-ball-controller-binding-audit.mjs`, the corresponding Node test suite, and test-script registration. It is not imported by Rapier, LAB browser, backend, or official matches. A caller-supplied experiment plan is **untrusted** and must never mint actor identity, controller permission or source authorization.

The immutable plan declares an untrusted match-epoch label and at most 44 canonically ordered proposed bindings: canonical player ID, human/AI declared origin, claimed source label, proposed controller label, and inclusive start/end ticks (within 3600 ticks, at most 601 ticks per interval). Active intervals cannot overlap for a player, controller, or shared human source; adjacent time windows and target-tick handovers are allowed. Source, epoch, controller and player assertions from client-supplied data remain **claims, not credentials**. The plan is copied/frozen so mutation after construction does not alter a reset.

Each real 60Hz ME-PB-20 source-boundary snapshot is revalidated: schema, ordered canonical candidates, no auth/execution fields, reported expiry IDs matching the previous tick, matched/unmatched counts and unchanged trust requirements. A candidate yields only `matches-untrusted-binding-plan` or an explicit missing/mismatched-claim status. Even when the matching proposed controller exists, `authenticatedControllers`, `authorizedCommands`, `appliedBallActions` and the scheduler queue remain zero/empty; confirmed touch and possession remain false. The API has only `observe`, `snapshot` and `reset`, never authenticate, authorize, sign, dispatch or apply physical force.

Tests cover interval overlap, single human-source exclusivity, permitted sequential handovers, old-source rejection after a switch, Home/Away separate controllers, invalid epochs, forged auth, duplicate/stale/unordered inputs, exact-tick expiry, atomic failure and immutable reset. Six independently doubled real Rapier scenarios (medium, fast CCD, grazing with force-unreported tick-32 START, sustained, turf-only and distant) compare experimental read-only audit with an identical shoe-contact world lacking the audit; physical trajectories, Rapier collision events, pair forces and qualification must remain identical. **Still missing:** server-owned session/actor authentication and epoch, authoritative player/controller binding, secure scheduling and cross-session replay defense, and calibrated physical contact/intent eligibility. No UI, gameplay, Preview, database, deployment or merge.

## ME-PB-20 — boundary between declared source and real execution authority (2026-11-11)

**Issue #480 / Draft-HOLD PR #481. Node-only research, no authenticated source or executable command.** Adds `match-engine/src/player-ball-action-source-boundary.mjs` and `match-engine/tests/player-ball-action-source-boundary.test.mjs`, and registers the suite. The module is intentionally **not imported by the Rapier physics core, autonomous player movement, browser LAB, backend, Admin, or official matches**.

**Trust distinction:** A caller may submit an *untrusted claim* with exact version, canonical player, claimed declared origin, ME-PB-19 sequence, issued/target ticks, `claimedSourceRef` and `claimedMatchEpoch`. The observer cross-checks that claim against the matching quarantined record and its canonical order, 60Hz tick, player, origin and sequence. It also independently verifies that ME-PB-19 pending, newly quarantined and expired records reconcile across ticks, and that no fake `sourceVerified`, `commandAuthorized`, possession, solver force or dispatch fields are present. A matching `claimedSourceRef`, including a string named `validated` or `server`, is **just a text match**; a client can forge both strings. It NEVER authenticates an actor, proves permission for that player, validates a match epoch or authorizes a kick.

The boundary has no `authenticate`, `authorize`, `release`, `dispatch`, `mint`, or `applyImpulse` method. It reports only immutable per-candidate binding diagnostic rows and explicit blockers. Every structurally consistent claim remains `sourceAuthenticated:false`, `controllerPermissionProven:false`, `matchEpochAuthoritative:false`, `commandAuthorized:false`, `eligibleForPhysics:false`; the global `sourceVerifiedCount`, `authorizedCommands` and `dispatchedCommands` remain 0, `executableCommands` remains empty and both confirmed touch and inferred possession remain false. Invalid batches are atomic and cannot advance observation time or local claim sequences. The source labels and local sequence tracking offer **no cryptographic assurance or cross-session anti-replay**.

**Separate future trusted integration requirements:** (1) an authenticated human/AI actor source, (2) server-owned match epoch and player/controller permission binding, (3) authoritative next-tick scheduler with cross-session replay defense and no double execution, and (4) independently calibrated physical eligibility/contact rule. Only a separately designed trusted adapter can eventually satisfy these; **nothing in ME-PB-20 grants those permissions**. Claims cannot escape ME-PB-19 quarantine, which continues to expire them unconsumed.

The test suite checks unclaimed and matching human/AI source labels, spoofed authority, wrong player/source/epoch, mismatched or missing expiry, stale/duplicate/out-of-order claims, malformed arrays, atomic failure and isolated reset. Six independent double real 60Hz Rapier replays (medium, CCD-fast, grazing with force-unreported tick-32 START, sustained, turf-only bounce and distant) prove identical ball trajectories, physical collision events, pair-force samples and qualification even when a matching but untrusted source label is supplied. No changes to the physics solver, gameplay, browser, Preview, remote DB, deployment or official player actions.

## ME-PB-19 — unverified command-source quarantine and exact-tick expiry (2026-11-11)

**Issue #480 / Draft-HOLD PR #481; Node-only isolated research.** Adds `match-engine/src/player-ball-action-quarantine.mjs` (pure observer, not imported into Rapier, movement, browser, backend or official matches), `match-engine/tests/player-ball-action-quarantine.test.mjs`, test registration and documentation. **This is NOT an authoritative scheduler.** It never authenticates any actor, authorizes an action, calls the ball engine or emits an executable action. It contains no approve/release/dispatch/impulse method.

ME-PB-18 produces a format-valid but wholly **unverified** `human-candidate` / `ai-candidate` request for exactly the following 60Hz tick. ME-PB-19 independently checks the canonical 22-player movement, strictly aligned proposal envelope and all individual immutable proposal fields, timing, ID ordering, unit aim, bounded effort, monotonic per-declared-origin/player sequences and absence of fabricated authorization, owner, touch or impulse fields. **The declared origin is only a string, never authenticated identity, input permission or intent.** A valid candidate is put into an in-process, max-22 **quarantine** for its target tick and is automatically **expired unconsumed** on that tick. New candidates may enter the same tick, but cannot release earlier entries. The observer state never contains more than the current tick's candidates; rejected malformed batches are atomic and do not advance time or consume sequence counters. Missing/duplicate/out-of-order/stale frames, replayed sequences, forged source claims and force/owner injection fail closed. A reset starts a fresh isolated research epoch but does not confer trust.

Two independently initialized real 60Hz Rapier foot-contact worlds are driven with identical externally sampled 22-player frames in six experiments (medium, high-speed CCD, grazing repeated contacts with genuine force-unreported tick-32 START, sustained contact, turf-only bounce and distant control). In one path the new pure observer processes a single unverified request then expires it at target tick; in the physics control it does not. Ball canonical position/velocity, actual Rapier collision START/END, solver force and event qualification must remain **identical**, including during the exact expiry tick. No solver force gap can be filled by a pending candidate. No pass, shot, clearance, possession or kick is executed.

**Future blockers:** a separate trusted command provenance adapter and authoritative source binding, permission validation, cross-session replay protection and an explicit execution scheduler; then separately grounded physical eligibility/calibration and touch/possession rules. The current quarantine deliberately offers no route to physical actuation; `sourceVerification`, `commandAuthorization` remain `not-established`, while `eligibleCommandCount`, `dispatchedCommandCount`, touch and possession always remain zero/false. No UI/API/gameplay/runtime changes, no Preview, deploy, remote database or merge.

## ME-PB-18 — untrusted explicit ball-action proposal contract (2026-11-11)

**Issue #480 / Draft-HOLD PR #481; Node-only research, no command execution.** Adds `match-engine/src/player-ball-action-proposal.mjs` (pure observer, not imported by Rapier, player movement, browser, backend or official game logic) and `match-engine/tests/player-ball-action-proposal.test.mjs`. A candidate requests a *future* next-tick ball intervention with a strict allowlisted shape: version, **declared/unverified** origin (`human-candidate` or `ai-candidate`), canonical 22-player ID, monotonic in-process per-declared-origin/player sequence, `issuedAtTick`, `targetTick = issuedAtTick + 1`, intended action (`pass`, `shot`, `clearance`), 2D **unit** aim, and normalized `effort01` in `[0,1]`. Aim and effort are **intent parameters**, not physical force, calibrated velocity, kick strengths, or gameplay permissions.

A bounded (max 22 unique canonical players per tick), strictly ordered, consecutive 60Hz observer validates the current canonical player frame and full candidate batch **atomically**. Forged player identities, stale/replayed sequences, duplicate same-player requests, out-of-order frames, invalid direction/power/timing, unknown action kinds, and injected `authorization`, `confirmedTouch`, `ballOwner` or force fields fail closed. Even a syntactically valid `human-candidate` remains **unverified**, because the LAB has no trusted actor binding, authorization, authoritative command scheduler, input transport or replay protection across sessions. The bounded in-process sequence guard is not authentication. No tactical pressing/facing or Rapier pair force can create authorization.

Deterministic real 60Hz Rapier experiments run identical **shoe-contact** worlds in parallel, while the pure proposal observer processes valid declared requests on selected frames. Independently repeated tests verify that this observer never changes ball positions, velocities, real Rapier START/END, reported pair forces, official match state, touch or possession, including medium, high-speed CCD, grazing recontact with the unforced tick-32 START, sustained contact, and turf/distant negative scenarios. The observer always reports `authorization: 'not-established'`, `eligibleForPhysics: false`, `intentEstablished: false`, `confirmedTouch: false`, `possessionInferred: false`.

**Not yet implemented:** verified human/AI command source, source authentication, authoritative scheduling and deduplication across sessions, physical admissibility, calibrated foot impulse, controlled-touch state and possession rules. No UI input, passes, shots, tackles, ownership, physics actuation, match scores, API/remote DB, Preview, deployment or merge.

## ME-PB-17 — measured physical approach vs unavailable action-command provenance (2026-11-11)

**Issue #480 / Draft-HOLD PR #481, Node-only observational research.** Added `match-engine/src/player-foot-action-observability.mjs`, a pure immutable audit **not imported by the engine, LAB browser or official matches**, with `match-engine/tests/player-foot-action-observability.test.mjs` and test-script registration. It consumes the canonical 22-player positional movement frame, the real Rapier START/ACTIVE/END timeline and actual pair-force evidence at the **same 60Hz tick**. It checks source version, exact tick, ordered player identities, genuine events and force-integral nullability. The report retains real physical onset relative-speed/closing/tangential components, tactical *positional* presser role, physical START/ongoing/END and reported pair forces **without promoting any to a deliberate ball intervention**. A positional presser is not a kick-command source. Foreign "ball action" fields injected into the autonomous movement frame are rejected rather than trusted.

**Replayed real Rapier controls:** medium Home, fast CCD Home, grazing repeated contacts including the unforced tick-32 START, sustained contact with many force reports, mirrored Away, turf-only bounce, airborne and distant negatives, all twice independently reproduced. The fast 16m/s CCD position-only witness remains earlier than discrete START/force. No-contact worlds produce no new physical evidence. Invalid/stale input, forged player IDs, fake action claims and inconsistent force counts fail closed. The default non-foot physics remains untouched.

**Deliberate boundary:** An externally sourced **validated action command** (source, player, timestamp, action intent and authority) does not exist in this autonomous positional pipeline. Consequently the audit always returns `actionCommandProvenance: 'absent'`, `actionEligibility: 'not-established'`, `confirmedTouch: false`, `playerIntentInferred: false`, `possessionInferred: false`. It is a **research data-contract gap**, not a playable kick or a rule engine. Relative approach, geometric normal, tactical pressing, solver force, marginal ablation effect and CCD timing cannot substitute for such a command. No gameplay/physics changes, no new browser controls, no UI/API/DB/Preview or deployment.

## ME-PB-16 — leave-one-foot-out matched Rapier counterfactual (2026-11-11)

**DEV / Draft-HOLD PR #481, issue #480.** Adds an explicitly gated diagnostic `diagnosticOmittedFootId` (default `null`) to experimental foot-contact worlds only, and a test-only `player-foot-contact-ablation.test.mjs`. Omitting exactly one existing canonical player shoe is permitted only when **opt-in foot contacts are enabled for a roll scenario**. It never removes that player from the 22-player movement/validation frame, never creates a controller, and never changes the normal no-foot/22-foot configuration. No UI switch, match result, rules, server, Preview or remote data change. Full and ablated experimental worlds both have CCD ON, default physics coefficients and the same sampled 60Hz autonomous 22-player path driven **only** from a no-shoe reference world.

Each of six genuine 3D Rapier scenarios (medium/fast Home, mirrored Away, oblique grazing recontacts, sustained low roll, distant negative) compares **22 physical shoe colliders vs 21 physical shoe colliders**, while a third no-shoe reference world provides exactly the same exogenous player positions. The suite replays all three real worlds independently twice and verifies actual Rapier collision START/END records, reported solver pair-force events, whole-ball position and velocity trajectories and target-omission negative evidence. The 16m/s CCD positional effect may occur *before* the first discrete collision START and must remain labelled as a position-only clamp. Null missing force evidence is never converted into a zero or a touch. Non-contact worlds remain identical. Strict option allowlist and RESET preserve the control; ordinary Rapier default and explicit `null` replay equivalently.

**Interpretation:** This A/B estimates a *marginal influence of a particular shoe **collider's presence*** under fixed exogenous autonomous motion, not the complete exclusive contribution of that player's foot to momentum, not the human intention to kick, and not proof of possession. Other forces/contacts, numerical solver effects, CCD clamping and post-divergence nonlinear dynamics remain possible. A missing collider is an artificial intervention, NOT gameplay input. Real-world/anatomical control and intention are still unavailable; do not promote these measurements to goals, passes, shots, tackles, possession or user steering.

## ME-PB-15 — falsify naive touch gates using real Rapier force gaps (2026-11-11)

**Issue #480, Draft/HOLD PR #481; Node/CI test-only.** `match-engine/tests/player-foot-contact-sufficiency.test.mjs` is not imported by any runtime or browser. It independently replays seven real 60Hz Rapier closed-loop autonomous 22-player physical scenarios twice: grazing recontacts, sustained low shoe contact, medium approach, mirrored Away, turf-only bounce, high airborne and distant negative controls.

The audit independently tracks true `START` and `END` genealogy for each canonical player, reported per-pair force samples *inside* the current episode, missing force-report ticks, repeated START after a real completed END, and force samples during **continuing** episodes without a new START. It explicitly records **reported coverage**, not complete solver or whole-ball force coverage. The prior realistic grazing case includes a **real Home #10 START at tick 32 without a same-tick pair-force event**; the force sample remains **null**, never an invented impulse or a certified kick. A sustained near-shoe contact produces many solver observations but only one START/END episode. Turf bounces without shoe events are not touches. All evidence remains `attribution: unresolved`, `intentInferred: false`, `confirmedTouch: false`, `possessionInferred: false`.

These cases directly disprove the shortcut `Rapier START == force == player-controlled touch`. Even a real per-pair force report in an isolated episode is a physical solver measurement, **not** evidence of intentional contact, exclusive ball momentum change, possession, pass, shot or tackle. There is no gameplay control or physics modification, no new attributes, no API/admin/LAB UI change, no deployment, no remote database access and no merge. Further work may only propose a gameplay control state after explicit rule design and separately grounded calibration, with evidence gaps retained rather than imputed.

## ME-PB-14 — Rapier START versus actual pair-force sample provenance (2026-11-11)

**DEV / test-only, #480 / Draft PR #481.** The new `player-foot-contact-provenance.test.mjs` runs seven genuine 60Hz Rapier worlds (fast 16m/s, very fast 24m/s, medium, slow, turf-only, airborne, distant), each replayed from two independently initialized world sets. Every case drives the same 22 autonomous player trajectories from the no-shoe reference world; the two high-speed cases additionally compare experimental shoe CCD ON/OFF. Default physics and LAB behavior are unchanged.

For each **actual** Rapier simulation tick, the suite independently records discrete ball–shoe `START`, active and `END`, reported pair-force samples, their derived N·s sample magnitudes, actual A/B whole-ball 3D position/velocity differences, and the evidence-only classification. The report distinguishes first discrete START, first reported solver pair-force tick, first whole-ball velocity response, starts without a same-tick force report, and force reports during continuing episodes without a new START. The absence of a force report remains **null / unknown**, never synthetic zero. One or many force samples are not individually calibrated foot impulses. No collision event, CCD clamp, manifold geometry, cross-world deviation or reported force sample alone establishes an intentional kick, an exclusive player cause, a confirmed touch or ball possession.

Hard regressions retain the ME-PB-13 high-speed CCD **position-only** clamp before any recorded Rapier START or force event, the equal CCD ON/OFF first START tick, the absence of a phantom pre-event CCD-OFF divergence, genuine positive real-force controls, and three no-contact negatives. Results are exact-replay observational signals, not a learned foot-control policy. No new runtime module, browser UI, backend, match rules, remote DB operations or publication; **Draft/HOLD and no merge**.

## ME-PB-13 — CCD motion clamp versus discrete event chronology (2026-11-11)

**DEV-only, PR #481 Draft/HOLD, issue #480.** A narrowly gated `diagnosticBallCcdEnabled` option defaults to **true**. The only permitted `false` experiment is an explicitly opted-in `roll` scenario with `diagnosticPlayerFootContactsEnabled: true`. Normal LAB physics, default no-foot physics and all production match behavior continue to use Rapier 0.21 ball CCD **enabled**. The optional flag is not exposed in the browser, admin UI, published endpoints or the game. A source-level safeguard validates boolean type and disallows turning CCD off without the opt-in foot setup; resets preserve the configuration.

The new **test-only** `match-engine/tests/player-foot-contact-ccd.test.mjs` compares three independent 60Hz Rapier worlds with identical ball initial state, gravity, grass, mass, seed and *externally fixed* 22-player trajectories (driven each tick solely from the no-foot control world): **(A) feet OFF + normal CCD ON**, **(B) feet ON + ball CCD ON**, **(C) feet ON + ball CCD OFF**. The same actual player frame feeds B and C. Per-world tick-by-tick canonical snapshots and true Rapier collision/force reports are replayed twice and compared. There are no scripted collisions, teleports, solver impulses, fixture outcomes or claims of ball ownership.

This is a **timing and provenance experiment**, not an automatically verified causal foot-touch event. The high-speed 16 m/s ME-PB-12 regression at tick **4** showed a **0.088703 m difference in the ball's position and no velocity difference** between control and CCD-on trial, even though the first **discrete Rapier collision START** arrived at tick **5**. Official Rapier documentation describes CCD as **motion clamping**: an object's position may be clamped to an intermediate point on its swept trajectory while its velocity is left intact. This is consistent with the original pattern. The new suite also measures position and velocity divergence against a physically simulated CCD-off shoe trial, true CCD-on/off event onset ticks, per-world force-report counts and a *ratio of observed X progress* in the witness tick (explicitly **not** an internal CCD time-of-impact measurement). A measured discrepancy before the collision queue `START` must **never** be interpreted as a confirmed touch. The test must keep the witness's real pre-event absence of a Rapier collision or force report. Tests cover the fixed high-speed case, 24m/s sensitivity, medium and slow approaches, and a turf-only noncontact control, plus CCD-off guard/replay tests.

**Observed matched CCD ON/OFF proof (2026-11-11, 60Hz, real Rapier):** with an identical externally driven 22-player path, **16 m/s** produced an ON-only *position* clamp at tick **4** (**0.088703m**) with **0m/s velocity difference**; the first actual discrete Rapier shoe `START` occurred at tick **5 in BOTH ON and OFF trials**. At **24 m/s**, ON-only positional clamping occurred at tick **3** (**0.218299m**), and both ON/OFF emitted first `START` at tick **4**. With CCD **OFF** no A/B position/velocity divergence existed before either event onset. The observed ratios of X progress inside these early clamp ticks (**0.659706** and **0.448296**) are **NOT direct internal time-of-impact measurements**. The medium 4m/s and slow 0.8m/s controls had no pre-event difference, while terrain-only bounce had no shoe events and identical baselines. With CCD OFF at **24m/s**, the first discrete collision event at tick 4 preceded the first measurable A/B trajectory divergence at tick 27: **a START is not itself proof of immediate impulse or an intentional touch**. The first START tick matching between ON/OFF is evidence *against simply explaining the position clamp as delayed callback delivery*. These are controlled, replayed measurements; they cannot prove the solver's hidden internal timing or provide a per-player impulse. The CI now asserts these positive and negative constraints as regressions.

**Important limits:** Neither contact queue latency at sub-tick resolution nor Rapier's internal computed time of impact is directly exposed by this audit. The discrete difference is a **60Hz tick-index offset**, not proof of an asynchronous delayed callback. Without CCD, Rapier's collision detection may also miss thin/fast colliders; it is **not** a proposed replacement for the normal CCD-on physics. Any alternate fast case behavior remains a diagnostic finding, not possession or a kick. Future interaction rules must use physical event provenance rather than only cross-world trajectory changes. No merge, Preview, deploy or remote DB writes.

**Rapier docs:** [JavaScript CCD / motion clamping](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/) and [collision events and force events](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/).

## ME-PB-12 — paired real Rapier counterfactual: shoes OFF vs shoes ON (2026-11-11)

**DEV research only — PR #481 Draft/HOLD, issue #480.** New `match-engine/tests/player-foot-contact-ab.test.mjs` is **test-only**; no new runtime/route, physics mutation, UI control, player state, official match results, or database changes.

**Controlled paired design:** Create two independently initialized worlds with **identical ball state, mass, Rapier 60Hz integrator, grass/ground/gravity/aerodynamics settings and fixed seed**. Control world retains the production default **no shoe bodies**. The other world opts into the existing 22-player kinematic Rapier shoe colliders (optional preexisting shoe restitution variant). Crucially, the autonomous 22-player movement frames are computed **once per tick from the control world's pre-step canonical ball position**, and only that same deterministic reference-player schedule is supplied to the shoe-on world. This fixes the player motion externally across both counterfactuals, avoiding a confound in which the shoe-on world's altered ball position itself changes the players' later positions. This is an artificial *fixed-player-path research experiment*; the usual closed-loop actor paths in gameplay may differ and no football causation or ball control follows.

On **every 60Hz tick** compare the real Rapier whole-ball **3D position displacement (m)**, **3D velocity difference (m/s)**, **velocity-direction angle (0–180°, null on zero-speed samples)**, **independently measured ball-mass × cross-world velocity difference (N·s)**, cumulative path-length for both worlds, onset count, real pair-force report tick count, first actual Rapier shoe onset and first measurable ball-trajectory divergence. This cross-world velocity difference is **NOT** an isolated per-foot impulse, a single player's kick, a force measurement or a proof of possession. Later differences also include natural nonlinear propagation through air, grass and ground. Both worlds retain their own actual physical trajectories and solver states; **no scripted forces, teleports, fake collision events, manual player control or manufactured numerical deltas**. For ordinary positive collision scenarios, the worlds agree numerically before their first Rapier shoe event. **Important measured exception:** the high-speed case exhibits physical world divergence **before** the first discrete Rapier collision `START` event. The A/B test now exposes its **first pre-event divergence tick, count and maximal 3D position/velocity differences** as **unclassified** diagnostic evidence, rather than inventing an earlier contact, force or kick. A new pre-event discrepancy in any other scenario fails the gate. The high-speed discrepancy remains **unresolved and requires investigation of Rapier CCD/TOI versus collision-event timing**, not automatic classification as a touch; no quantitative onset timing should be inferred from first trajectory divergence alone. No-contact negative controls must remain canonically identical in both worlds at every tick.

**12 genuinely simulated A/B cases, each independently replayed twice:** initially stationary near the shoe, slow/medium/fast approach, lateral impact, mirrored Away, oblique scenario with Rapier recontacts, two existing restitution perturbations (0.00/0.35), real turf-only bounce, high airborne ball and a distant stationary ball. Positive cases require a real Rapier pair contact and force event and a measurable ball trajectory separation; negatives require **zero shoe onsets/force events/whole-world difference**, including gravity-driven terrain bouncing. An actual repeat requires a Rapier END followed by a new START, never a long-lived contact or multiple force reports. The synthetic/no-contact distinction is asserted, not assumed. Test prints concise `ME_PB_12_AB` measured outcomes with first-onset/difference ticks, peak/final separations, velocities, travelled distances and replay status.

**Scope and interpretation:** The comparison isolates the **effect of enabling the full kinematic shoe-collider subsystem under fixed exogenous autonomous player frames**, not an isolated impulse of a particular player's foot. This does **not** establish a kick or possession rule, real-world calibration, an official match state or tactical feedback. All previous ME-PB-01/11 experiments remain intact. Default LAB contact checkbox stays OFF; UI inspector stays four facts. No merge, Preview, deploy, remote D1 or other publication without separate authorization.

## ME-PB-11 — whole physical collision episode audit (2026-11-11)

**DEV research only, PR #481 Draft/HOLD, issue #480.** New `match-engine/src/player-foot-contact-episode.mjs` and `match-engine/tests/player-foot-contact-episode.test.mjs` are **Node-only research helpers**, not imported by the engine or browser. This is a bounded stateful observer for actual Rapier `START`→`END` episode lifetimes, checked against ME-PB-05 true onset/active/end data, ME-PB-06 actual pair-force reports and ME-PB-10 directional evidence. It **never modifies rigid-body forces, player movement, tactics, the LAB UI or official results**.

For every genuinely completed individual ball–shoe collision episode, it separately records:
- Rapier `startTick`, `endTick`, `durationTicks`, and zero/single/multi-tick kind. `durationTicks` excludes the terminal END tick; `sampledTickCount = durationTicks+1` is the number of observed diagnostic steps (including the end). Continuous force readings within one episode **do not become extra touches**. Same-player recontacts after a real END open entirely separate accumulation records, never inheriting previous forces.
- **Whole-ball** momentum change `measured ball mass × (velocity after END - velocity before START)` (3D N·s) and planar opening→closing ball-direction change. These values are **the total response to gravity, turf, aerodynamic forces, all colliders and the solver**, **not** an attributed foot impulse.
- **Separately**, the vector sum of the *actually reported* Rapier shoe-pair force events × 1/60s, the magnitude of that sum, and the sum of their individual magnitudes. These are **pair-force event integrals** (N·s), not direct per-point solver impulses, and cannot be subtracted from whole-ball momentum to infer other forces or causal attribution. Explicitly record the number of ticks with/without reported pair force and solver-manifold samples. **No force event** means the complete pair impulse measurement is **null**; even partial force coverage is marked incomplete rather than filled with zeros.
- Any observed overlapping Home/Away pairs are separately retained and marked ambiguous, without a winner, owner, possession or intentional kick assignment.

Only **current-tick completions and currently active at-most-22 pair accumulators** are retained; no unbounded list/log or per-player gameplay state. Versioned, validated 60Hz input, canonical IDs, source identity consistency, actual mass and episode genealogy prevent stale/fabricated data; invalid frames do not advance the observer. Every record stays frozen and marked `attribution: 'unresolved'`, `possessionInferred: false`, `exclusiveFootImpulseProven: false`.

Acceptance includes synthetic unit-isolated multi-tick force integration, missing events, same-player repeat isolation, zero-duration, simultaneous Home/Away and atomic rejection, plus **8 independently replayed real Rapier scenarios**: true short/long recontacts, sustained shoe collision, medium/high impact, mirrored Away, gravity+turf-only bounce, airborne and distant negatives. Each real scenario runs twice, checks canonical ball/episode byte equality, and prints `ME_PB_11_REAL` episode evidence including measured global momentum versus reported pair-force integrals. All comparisons remain **descriptive, not a conservation proof or physical calibration**. Default physics OFF and the existing Players (22) four-fact inspector remain unchanged; **no merge/Preview/deploy/remote D1 without authorization**.

## ME-PB-10 — measured directional response to real shoe contacts (2026-11-11)

**PR #481 Draft/HOLD / issue #480 — DEV laboratory research only.** `match-engine/src/player-foot-contact-direction.mjs` is a **pure, immutable, test-only 60Hz diagnostic helper**. It consumes independently measured *consecutive* canonical ball velocities, the actual Rapier ball–shoe event pairs (ME-PB-02/05), actual Rapier pair-force vectors and solver manifold normals (ME-PB-06), observed ball momentum and measured Rapier ball mass (ME-PB-07), and evidence-only onset/ambiguity classification (ME-PB-08). This module **is not imported by the browser, physics engine or official gameplay**; there is no new DEV route or LAB UI setting. It cannot move a rigid body or infer a ball owner.

Every tick records the real ball's **world-space incoming/outgoing 3D velocity (m/s)**, 3D velocity difference, signed speed change, and an **XY turn angle (0–180°)** computed from the two actual velocity vectors. If either XY speed is approximately zero the planar angle and reversal are **null** (not 0° or a fabricated change). For each independently reported Rapier shoe–ball pair, compare the **absolute direction cosine of pair force vs observed ball Δvelocity**, and the **absolute cosine and projected magnitude of observed ball Δvelocity vs available 3D solver manifold normals**. Abs values intentionally discard manifold ordering/sign. Report the real *pair-net derived impulse* (N·s) separately from the ball Δv; **never equate these, calculate a net "player kick" from them, or attribute ball Δv to one contact**, because gravity, turf, airborne effects, other colliders, possible multiple simultaneous contacts and solver internals also affect the result. Missing pair-force events remain **null**, never zero or a claimed touch. A manifold without a solver contact and a zero-length direction yield null directional comparisons.

The source validates finite quantities, real measured ball mass, consecutive 60Hz ticks, previous ME-PB source versions, matching canonical pair/onset/completion IDs, event flags, force/impulse integrals and independent ball momentum. It returns frozen snapshots with `attribution:'unresolved'`, `possessionInferred:false` and `causalFootImpulseProven:false`. The corresponding **test-only** `match-engine/tests/player-foot-contact-direction.test.mjs` covers analytic reverse/normal-sign/null-force/zero-planar-vector/malformed-input controls and **10 genuine Rapier physical scenarios each replayed twice**, including low/medium/high/lateral approach, Away mirror, verified 6/3/113-tick same-player real recontacts, an uninterrupted 18-tick shoe collision, terrain-only ball bounces, high-ball and distant negatives. A genuine contact requires a Rapier onset; repeated contacts require a **previous real exit**. Every time step checks measured force, normal geometry and ball velocity **independently**, and CI emits compact `ME_PB_10_REAL` evidence for audit. There are no synthetic physical impacts, steering or new possession semantics.

No official score, pass, shot, tackle, goalkeeper save, dribbling or tactical ball retention is introduced. Existing LAB default remains OFF, with its four-fact player inspector, unchanged browser routes and unchanged production physics. No merge, deploy, shared Preview, remote D1, official result or additional UI approved.

## ME-PB-09 — real Rapier episode/recontact vs turf-bounce validation (2026-11-11)

**PR #481 Draft/HOLD / issue #480, DEV-only research QA.** A new **test-only** acceptance harness `match-engine/tests/player-foot-contact-recontacts.test.mjs` drives 16 independently initialized real Rapier 3D worlds at 60Hz with the existing 22 autonomous players, actual kinematic shoe colliders, ME-PB-05 episode lifetimes and ME-PB-08 qualification. It samples stationary, slow, medium and fast approaches, lateral/grazing approaches, three real-foot restitution values 0.00/0.12/0.35, mirrored Away, a genuine airborne noncontact case, a distant ball and a separate **turf-only bounce** (vertical velocity reversal without player collision). No injected ball commands, synthetic physics events, fake players or ownership.

**An actual same-player recontact must have TWO Rapier collision starts for that player separated by an actual matching Rapier collision END.** A long-lived active collision counts as **one episode**, even if Rapier reports force during many consecutive ticks; a ball's change of vertical direction on the grass with no shoe contact is **not** a player collision. End-to-start gaps of 1–12 60Hz steps (<=0.20s) are classified as provisional short-window repeats; larger gaps are separate real recontacts but **not** short-window repeats. Absence of a second physical onset is reported as **not observed**, never simulated or assumed to have happened. The suite captures actual completed episode duration, continuing contact samples, normal/force pairs, possible planar ball-direction reversals and `attribution: unresolved`. A velocity reversal on a collision tick is an observed sign change, **not proof that a specific foot caused it or that a player controlled the ball**.

**Observed real-collision positive regression (ME-PB-09):** in the unmodified autonomous `grazing-angle` case (ball starts at x=-5.25m, y=-0.14m with 2m/s forward and 0.1m/s lateral velocity, default foot restitution 0.12), Rapier generated four independent Home #10 collision episodes. New Rapier starts occurred at **tick 15 after end tick 9 (6 ticks / 0.10s)**, **tick 32 after end tick 29 (3 ticks / 0.05s)** and **tick 167 after end tick 54 (113 ticks / ~1.883s)**. The first two qualify as short-gap repeats, while the third is a distinct long-gap return, **not** a continuous touch or control. The separate slow near-shoe sample had **18 consecutive active solver ticks in ONE collision episode**, not 18 touches; a turf-only bounce had **four upward velocity reversals with zero shoe collision starts**. All findings are fixed-seed real Rapier observations, and the positive/negative distinctions are asserted in CI. They are **not biomechanical calibration, proof of dribbling or evidence of an owner**.

Each physical scenario executes independently **twice** and requires byte-identical canonical ball trajectory and exact collision/qualification/solver streams; all episode counts and gaps must match the real event graph. The normal non-opt-in Rapier world has no contact/qualification observer and remains deterministic. Compact `ME_PB_09_REAL` GitHub Actions evidence prints observed counts, real episode durations and the first few proven recontacts, if any. Existing ME-PB-08 state-machine tests cover synthetically defined 12-tick repeat boundaries, but those tests are **not** physical evidence; this suite explicitly distinguishes them. This step introduces **no new runtime module, route, LAB UI control, persistent logs, official gameplay/possession or deploy**.

## ME-PB-08 — collision event qualification without gameplay possession (2026-11-10)

**PR #481 Draft/HOLD / issue #480, DEV-only.** A separate immutable `createFootContactQualification()` observer classifies **only actual Rapier collision event streams**, synchronized against ME-PB-05 episode timing, ME-PB-06 pair-force evidence and ME-PB-07 momentum-provenance records. Its current-tick evidence labels are `none`, `single-pair-event`, `repeated-event`, `multi-pair-ambiguous` and `zero-sample-uncertain`. **These are not confirmed touches, tactical possession, controls or kick intent.** Classification never changes ball trajectories, autonomous player motion, match events, UI rows, official scores or player attributes.

A new onset is marked **isolated** or **repeat-within-window** for the *same player ID* when its previous completed Rapier collision ended within **12 solver ticks** (0.20s). The 12-tick window is an explicitly **provisional observation heuristic, not a ball-control rule**; only one recent end tick per canonical player is retained (max 22 records), and stale records expire. Completed Rapier events retain their actual zero/single/multi-tick duration; same-step begin/end has zero fully observed active ticks and is classified uncertain. Multiple active pairs, multiple pair-force reports, multiple same-tick onsets or completions produce explicit **multi-pair ambiguity reasons**, without privileging Home, Away, force magnitude or arbitrary player order. A collision onset with **no Rapier pair force report** is recorded with `unreportedOnsetForceIds`, never assigned fabricated zero force or asserted as an impulse. Every snapshot maintains `attribution: unresolved` and `possessionInferred: false`.

All source versions, 60Hz tick consistency, canonical ordered IDs, begin/end/active flags, force-pair counts, real momentum event pairs, finite reported impulses, event-duration shape and mutually consistent classifications are checked **before any observer state mutation**. No rolling telemetry/event log is kept by the engine. The Node suite tests isolated vs repeated events, 12-tick expiry, multiple Home/Away pair events, null-force evidence, zero-duration episodes, malformed input atomicity, 180 actual Rapier ticks with deterministic replay and airborne/distant negative controls. Existing ME-PB-04 stationary/slow/medium/fast/lateral physical acceptance cases now compare the classification snapshot for every tick. Routing remains protected by the local DEV-only module allowlist and host-denial tests.

**Not in scope:** controllable touches, ball retention, dribbling, tackles, goalkeeping, shot/pass attribution, official gameplay, public/shared Preview, deployment, D1 or merge. The experiment remains explicitly opt-in, OFF by default, with the original four-fact Players (22) observer and no extra UI statistics.

## ME-PB-07 — ball momentum provenance and solver-force cross-check (2026-11-10)

**DEV LAB only, Draft/HOLD PR #481 / issue #480.** Adds a pure immutable 60Hz `summarizeFootMomentumAudit()` that independently records **actual canonical ball velocity change × measured 0.43kg mass** (the linear change in momentum, N·s) versus the **magnitudes of real, reported per-pair Rapier net force × fixed step (N·s)**. These are distinct physical observations, and **they are deliberately NEVER equated, subtracted, or used as a proof of a player's impulse**, because gravity, turf, aerodynamic forces, other colliders, contact orientation and discrete solver/CCD details can affect the ball. Summing **unsigned** per-pair impulse magnitudes is **not** a total net impulse on the ball. No Rapier force report means a per-pair **null** impulse—not an invented zero.

For actual force events with a post-solver manifold, the readout additionally reports the **absolute cosine alignment** between the measured total pair-force direction and each available Rapier world manifold normal with solver contacts. Its sign is intentionally discarded: collider ordering and normal orientation are not interpreted as the direction of a shot or controlled foot touch. No nonzero pair force or no valid solver manifold means **null** alignment, not a guessed vector. Multiple Home/Away pair force records are canonical and kept separate, with `attribution: 'unresolved'` and `exclusiveFootMomentumTransferProven: false` always. All entries are frozen current-tick evidence; no growing historical telemetry or extra UI rows.

Strict unit, finite/mass, synchronized clock, order, force-integral and source-version validation guards the observer. Real Rapier tests exercise 180-tick replay, Home/Away mirrors, stationary airborne/distant controls, ambiguity, non-force nulls and malformed sources. ME-PB-04 now checks this audit for **every** velocity/direction scenario and its exact replay. The default LAB, 22-player movement and 4-fact inspector do not change, and the audit does not influence physical commands, possession, goalkeeper actions or official match outcomes. No merge, deploy, Preview or D1 without separate authorization.

## ME-PB-06 — actual Rapier pair-force and contact manifold evidence (2026-11-10)

**DEV LAB only, Draft/HOLD PR #481 / issue #480.** Explicit `Foot contacts (experiment)` now collects **actual Rapier CONTACT_FORCE_EVENTS** for ball–oriented shoe-proxy collider pairs and separately reads the **world-space normal(s) and solver-contact counts from Rapier contact manifolds** after each 60Hz step. The frozen, canonical-ID, current-tick-only `footContactSolverSnapshot()` reports the measured aggregate pair **net force vector (N)**, **sum of force magnitudes (N)**, max contact force magnitude/direction, and each available manifold normal, geometric/solver point counts and Rapier orientation `flipped` flag. It distinguishes a missing force event with explicit **nulls**, not invented zero impulses, and does not attribute the world manifold normal as a user-controlled kick direction.

From each actual Rapier-reported pair force, the observer calculates **force × 1/60s** as a *derived* pair-net impulse vector (N·s) and a separate **sum-of-magnitudes × 1/60s**. These are **not direct raw Rapier per-point solver impulse readings**: aggregating geometric per-contact impulses can be incorrect when Rapier clusters contacts. The reported pair force is a solver event across the simulated physics step, while the ball's total velocity change includes *all* sources (gravity, turf, other colliders, aerodynamic forces) and remains an independent ME-PB-03 measurement. **No single player's kick, possession, intentional touch or exact contact-normal impulse is inferred**. Multiple simultaneously force-reporting ball/shoe pairs remain separate, without choosing an owner or summing them as a single player's action.

All output is independent of the default ball physics and protected behind the DEV local opt-in; no extra UI controls, readouts, player fields, production events or memory-growing history. The Node acceptance suite verifies actual 3D Rapier normal and force reads, correct force-unit conversion, no-force nulls, canonical Home/Away pairs, malformed-unit/ID rejection, exact 180-tick ball/event/force replay, airborne/no-contact negative controls and mirrored actual solver events. The ME-PB-04 speed matrix also compares the new per-pair solver evidence in exact replay. The existing **four-fact Players (22)** inspector is untouched. No merge, public Preview, deploy, D1 or real-match possession logic without separate authorization.

## ME-PB-05 — actual collision episode lifetime and relative direction (2026-11-10)

**Draft/HOLD PR #481 / issue #480.** A strictly observational `createFootContactTimeline()` tracks only the **actual Rapier collision start/end/active events** between the 3D ball and the 22 oriented kinematic shoe proxies. It preserves a separate immutable current-tick account of collision onsets, ongoing event-pair contact durations (measured in **60Hz active samples**), and completed episodes. When a collision ends at tick N after beginning at tick S, reported complete duration is **(N-S) solver ticks**, matching the active steps S…N-1; same-tick start+end is **zero fully observed ticks**, rather than inventing a duration. Multiple concurrently active ball/proxy pairs are explicitly retained and marked ambiguous; no first contact becomes an owner. Durations describe **collision event-pair lifetimes**, not physical shoe-ball penetration time, transfer of possession or individual player intent.

For each real onset the observer also measures the *pre-impact planar relative velocity* of the ball center versus that foot proxy's **actual position change** (including foot yaw) from the previous player tick. The ball-to-foot centerline is a **geometric radial approximation**: closing, separating, tangential and total relative speed are recorded as nonnegative m/s. This line is **not Rapier's true manifold contact normal**, a force, kick direction or controlled touch. A zero-distance radial direction is explicitly indeterminate. Validation rejects stale/nonconsecutive ticks, unknown/duplicate/misordered player IDs, impossible state transitions, mismatched active sets, nonfinite ball positions/velocities and invalid 22-foot motion samples **before mutating the observer**. No historical per-frame array is retained by the engine; only current evidence and open-contact start ticks live in memory.

The focused Node tests cover first-tick baseline, one-tick and multi-tick episodes, same-step begin/end, an explicit **synthetic-only simultaneous Home/Away timeline** for state-machine correctness, centerline approach/retreat/lateral mirrors, moving-shoe relative velocity, malformed-event atomic rejection, 150 real Rapier ticks and exact replay. The ME-PB-04 physical scenario matrix now cross-checks the new durations and onset directions against actual Rapier events for stationary, slow, medium, fast, lateral, mirrored Away and no-contact controls. The four-fact Players (22) UI and default ball physics remain unchanged; **no gameplay possession, new player fields, generated kick forces, production, shared Preview, deployment, D1 or merge** is authorized.

## ME-PB-04 — approach-speed/direction collision acceptance matrix (2026-11-10)

**Draft/HOLD PR #481, issue #480.** Fixed-seed, actual 60Hz Rapier+autonomous 22-player matrix using the existing ME-PB-03 rounded, oriented shoe proxies. It exercises five physically distinct laboratory ball starts: **stationary beside a foot** (0m/s), **slow forward approach** (0.8m/s), **standard roll** (4m/s), **fast roll** (16m/s) and **lateral approach** (3.5m/s). Additionally, mirrored Away-side slow/standard/lateral approaches check that contacts are not biased to Home. A high airborne ball over the shoe and a remote stationary ball serve as **negative controls**.

For each case, the Node matrix compares actual colliding Rapier ball trajectory against the default unmodified physics-only world and **replays the opted-in scenario twice**, verifying every canonical ball snapshot and every collision start/end/active event exactly. Successful physical onset must involve the actual target player's collider, and the Rapier ball position must differ from the no-foot control; simple PB-01 geometric proximity is not treated as impact. Every tick verifies 22 canonical, synchronized player frames, frozen ordered canonical event IDs and finite ball states. The matrix prints compact `ME_PB_04_SCENARIO` JSON evidence in GitHub Actions (initial speed, first true contact tick/time, measured *total* ball Δv on onset, A/B separation and exact replay). These are **experiment measurements, not realism calibration limits, verified individual-player kicks, possession, or production match statistics**.

The test does **not** introduce per-frame UI updates or historical telemetry; the DEV LAB remains exactly four player facts and the unchecked Advanced `Foot contacts (experiment)` opt-in. No extra ball forces, new player attributes, official match changes, shared Preview, D1, merge or deployment. Before future possession work, review multi-contact attribution, sustained/rolling collisions, angle-of-incidence sensitivity and whether the provisional shoe shape/materials need empirically supported calibration.

## ME-PB-03 — directional low-profile foot and measured impact response (2026-11-10)

**Draft/HOLD PR #481, issue #480.** Supersedes ME-PB-02's spherical center-of-player proxy with **one rounded rectangular foot pad per autonomous player** in the isolated, explicitly opted-in DEV Rapier experiment. The pad follows the actual canonical facing angle and actual XY of each player, **0.22m in front of tactical center**, with oriented 3D quaternion updated at the actual 60Hz tick. Provisional rounded shape: core half extents (0.105, 0.052, 0.035)m with 0.020m border radius; vertical center 0.09m. This is one oriented shoe proxy, NOT articulated leg/ankle geometry, left/right foot animation, calibrated biomechanics, or official player shape. No procedural steering or generated foot kicks.

The opt-in contact test also has a **test-only, bounded coefficient-of-restitution sensitivity** from 0 to 0.35 (default 0.12), rejected unless the experiment is enabled. The ball's baseline mass, inertia, turf/drag and normal Rapier world are unaffected. Each actual Rapier collision onset records an immutable **total ball velocity-change magnitude measured across that fixed physics solver step**. This delta includes gravity, turf/other contacts and cannot be attributed as individual kick force or a possession event. No new UI metrics or controls beyond the existing one unchecked Advanced opt-in; the 4-fact Players (22) panel remains unchanged.

Geometry and guard tests check orientation, Home/Away mirror, finite/monotonic yaw steps bounded by actual autonomous turn limits, 22 canonical identities, no teleport, material input bounds, genuine Rapier collision/velocity response, replay and determinism. Default physics behavior remains byte-identical to the accepted baseline. This trial is not authorized to drive official match results, player attributes, Preview or production. No merge without explicit approval.

## ME-PB-02 — historical spherical proxy baseline (superseded by ME-PB-03)

**Draft/HOLD PR #481, issue #480.** Advanced settings contains a single unchecked-by-default **Foot contacts (experiment)** option, applied only when restarting the isolated DEV LAB. When selected, the active Rapier world gains 22 small **kinematic spherical ground-level colliders** (radius 0.16m, center Z 0.17m), each driven every 1/60s exclusively by the next **actual autonomous 22-player XY frame**. Real Rapier collision detection, contact constraints and restitution determine the ball's physical response. The experiment records only genuine Rapier collider start/end/active events; it never infers a confirmed touch from PB-01 XY proximity alone and **never assigns possession**. Default/unselected scenarios, production and match outcomes do not instantiate additional colliders.

Strict `validateFootContactFrame` checks all 22 canonical identities, synchronized ticks/clock, finite XY/velocity, pitch bounds and real bounded physical displacement **before any collider moves**. Impossible teleports, missing frames, stale/repeated steps and forged identities fail closed. Foot collision output is an immutable, canonical, versioned event record, completely separate from the PB-01 geometric reach observer and from the original canonical ball snapshot; no new player fields are introduced. Reset reconstructs the experiment and its event record, and **Compare replay** reruns the same autonomous motion in the same Rapier world to validate both ball trajectory and contact events.

This is a **provisional proxy collision**, not anatomically modeled feet/legs, articulated skeletal dynamics, calibrated collision material properties or official match gameplay. No manual steering, scripted ball impulse, dribble, possession, tackles, goalkeeping saves, scoring, world publication, D1, Preview or deploy. The Players (22) panel retains **exactly four** compact readouts, with no added statistics. Node tests cover actual contact-vs-default physics, Home/Away mirrors, airborne misses, event determinism, input guards, Reset and real 60Hz replay; browser QA tests opt-in without altering the baseline.

## ME-PB-01 — first player/ball reach boundary (2026-11-10)

**DEV-only, Draft/HOLD, issue #480.** This first Player–Ball Interaction step combines real Rapier ball XYZ with the 22 canonical tactical XY players on the same 60Hz tick. The strict pure evaluatePlayerBallReach() reports only grounded geometric reach candidates within a provisional 0.65m center-to-center XY envelope and up to 0.30m underside ground clearance. It rejects invalid/unsynchronised 3D/22-body data, ignores balls outside the pitch or too high, preserves simultaneous Home/Away candidates, sorts by true distance and canonical tie order, and freezes its output. These thresholds are **uncalibrated laboratory placeholders**, not a collision or human foot/body geometry model.

createPlayerBallReachObserver() records only consecutive real 60Hz candidate entry/exit transitions. Tick zero can have nearby players but is only a baseline (no synthetic touch); Reset/Apply rebuilds the observer. The observer runs only in the existing DEV engine with no new UI rows/controls, 3D player collider, forces, impulses, confirmed physical touches, possession, dribble, tackles, saves or official-match integration. The existing ball flight/turf and 22-player movement are not changed.

**Next, after acceptance:** controlled finite-height physical foot contact model with genuine Rapier ball response, then possession/retention rules grounded in actual contact events. Merge, deployment, shared Preview and D1 writes remain independently gated.

## ME-PLAYER-UI-01 — compact Players (22) observer (2026-11-10)

The optional **Players (22)** interface is now reduced to **four current facts**: ball zone, the two pressing players, a selected player's identity/position/current speed, and that player's actually observed assignment. It is hidden by default. Selecting a player via the native selector or by tapping/clicking its existing marker is strictly observational; no manager steering, new ball force or simulation write. Unselected players do not generate historical readout fields. The previous long wall of >40 diagnostic rows, velocity/path overlay controls and many verbose on-page methodology paragraphs are **removed from the UI**.

The earlier ME-PLAYER-25–34 research observers remain pure and covered by their existing Node deterministic/validation suites; the LAB no longer computes and renders their history every tick. The sections below document prior research milestones, **not currently displayed UI**. Static first paint, Reset/Apply, autonomous movement, Rapier ball replay and protected local routing remain the operational acceptance criteria. Historical ME-PLAYER PR #465 was **squash-merged** as `1782eb61`; the new ME-PB-01 PR is independently **Draft/HOLD** with no deploy, shared Preview or remote DB writes.

## ME-PLAYER-34 — actual measured step pace by observed duty (2026-11-10)

**DEV Match Engine LAB only, read-only 11v11 observer.** The static **Players (22) → Inspect player → Pace by duty (2s)** row uses only consecutive real 60Hz body XY samples to measure **mean speed** (true path length / observed elapsed duty time), **peak interval speed**, and number of intervals at or above the existing 0.2m/s motion threshold. It compares actual, time-aligned recorded tactical assignments, separate Unassigned and Total segments. The first 60Hz sample is a baseline and never contributes imaginary elapsed time or speed. Simultaneous duties may share an interval, but assigned plus unassigned time/motion equals the uniquely counted total.

Pure immutable `summarizeObservedDutyPace(timeline,history,id)` reuses the exhaustive 22-body, synchronized-window and recorded-duty validators of ME-PLAYER-26/27/30–32; it does not use current velocity vectors as historical evidence or infer sprint effort, fatigue, fitness, possession, tactical quality or movement cause. Five Node tests verify zero baseline, actual moving/still press handoffs with overlapping cover, Home/Away mirrored thresholds, stale/corrupt window rejection, 900-tick deterministic trajectories and Rapier ball independence. DEV route and headless Chrome assertions cover the neutral first paint, both teams' actual readout, no player/time effect on focus changes and Reset. No manual Safari signoff.

**Draft/HOLD PR #465, one grouped commit; no merge, deploy, shared Preview or remote database changes without owner approval.**

## ME-PLAYER-33 — observed attacking-axis and lateral movement by duty (2026-11-10)

**Isolated DEV 11v11 Match Engine inspector only.** The new static-first-paint **Direction by duty (2s)** readout measures the selected player's actual recorded XY changes along the team's attacking/retreating axis (**F** = toward the opposing goal, Home +X / Away -X; **B** = backward) and across the field (**Side** = unsigned lateral component). It associates the 60Hz physical segment (previous/current tick) with only the current tick's recorded explicit tactical duties, separately showing **Unassigned** and **Total** components. Diagonal steps legitimately contribute to BOTH longitudinal and lateral projections; these orthogonal components **do not sum to actual Euclidean path metres** and are not separate distance travelled. Simultaneous duties are reported separately, with disjoint assigned + unassigned components reconciling to the physical total. Neither body position nor tactical intention is inferred.

The pure frozen `summarizeObservedDutyDirections(timeline,history,id)` first validates **all canonical 22 players**, each of the synchronized last 120 physical XY and real assignment ticks via ME-PLAYER-26/27/30/31/32; it then measures actual `deltaX` relative to each real team's attack direction and `abs(deltaY)` as lateral movement. Zero tick zero and Reset show no fabricated movement. Five new Node tests cover true immutable zero baseline, mirrored Home/Away opposite X coordinates with diagonal/projection correctness, actual press handoff with concurrent cover duty, static players/stale/malformed windows, and 900-tick deterministic replay with Rapier physics isolation. DEV route and real Chrome QA cover static first paint, actual live Home/Away readouts, focus-only changes and Reset; physical Safari QA is not claimed. No controller events, tackles, player collisions, match result authority, or remote writes added.

**PR #465 remains Draft/HOLD with one grouped cumulative commit; no merge/deploy/shared Preview/remote database or official match integration without owner approval.**

## ME-PLAYER-32 — physical distance observed during each assigned duty (2026-11-10)

**Local DEV Match Engine LAB, read-only 11v11 observer.** **Players (22) → Inspect player → Distance by duty (2s)** joins the actual last-120-tick frozen player XY path with the existing real 60Hz assignment timeline. It shows physical metres travelled while each explicitly recorded duty was present, plus **Unassigned** and **Total** measured distance. Each segment between consecutive real body positions is associated with the assignments observed at its ending tick. This is a **time correlation only**, not a claim that pressing, screening or support caused the movement, earned a result, or transferred ball possession. When multiple recorded duties coexist, each may display the same actual segment, but assigned distance + unassigned distance always reconciles to one physical total without double counting. First paint/tick zero never fabricate movement; Reset/Apply resets both bounded observers and selection.

Pure frozen `summarizeObservedDutyTravel(timeline,history,id)` validates the complete 22-player observed duty timeline and physical path evidence using the existing 30/31 and 26/27 canonical validators, verifies identical max window, current tick, sample length and **each contiguous sample tick**, then accumulates the measured physical segment for the explicit duty labels at that tick. It returns immutable per-duty travelled metres and assigned/unassigned/total physical distance. No player steering, movement changes, additional simulated tick, ball interaction, fitness load, official-match logic, remote DB write or deployment. Five Node cases cover empty baseline, mirrored real press handoffs, simultaneous observed duties, stationary bodies and invalid/mismatched windows, plus 900-tick deterministic replay and Rapier isolation. DEV route and headless Chrome QA cover neutral first paint, actual positive distance during playback, focus switching without clock/body side effects and Reset. No physical Safari acceptance claimed.

**PR #465 stays Draft/HOLD, one cumulative grouped commit, no merge/deploy/shared Preview/remote database writes without explicit authorization.**

## ME-PLAYER-31 — observed duty occupancy and current continuity (2026-11-10)

**Local Match Engine DEV laboratory; player/ball state unaffected.** Within the existing **Players (22) → Inspect player** read-only view, **Duty occupancy (2s)** now reports the measured duration of each explicitly recorded tactical duty for the selected player, the time with **no explicit assignment**, and the **current uninterrupted assignment/opponent streak**. Durations are calculated from the last 120 *actual 60Hz intervals* and never from the earliest observed baseline point. All 22 player assignments continue to be recorded independently of inspector visibility or selection. Multiple concurrent recorded duties may accrue time simultaneously, but elapsed assigned intervals plus unassigned intervals always equals the true observed duration. Changing the referenced opponent, even with the same duty label, resets the streak. Zero initial ticks and Reset display zero evidence, not a fabricated duty, score, stamina cost, possession or intent.

Pure, frozen `summarizeObservedDutyOccupancy(timeline,id)` validates every canonical physical duty sample through the previous transition observer, then counts only adjacent sample intervals, distinguishing overlapping duty-label tick totals from disjoint assigned/unassigned time. It returns frozen per-duty tick/second totals and continuous current streak ticks with no engine writes, simulated future steps or tactical control. Five focused Node tests cover zero baseline, actual press handoff durations, simultaneous assignments without doubled clock, bounded-window opponent retargeting, and deterministic 900-tick/Rapier-isolated replay. DEV route and Chrome QA validate first paint, observed live duty time, focus-switch immutability and Reset. Physical iPhone Safari QA is not claimed.

**PR #465 remains Draft/HOLD with one cumulative commit. No merge, deployment, remote database changes or official-match linkage without separate owner authorization.**

## ME-PLAYER-30 — recent observed duty-change evidence (2026-11-10)

**Local DEV Match Engine laboratory only.** The per-player inspector has a static-first-paint **Duty changes (2s)** readout. It independently records exactly 22 canonical real 60Hz duty assignments on every physical player tick, whether or not the **Players (22)** panel or any player focus is enabled. The selected player shows the number of observed assignment changes in the current **120-tick/2-second** rolling window and, when present, the latest observed tick/time with actual before/after assignment labels and any explicitly referenced opponent IDs. Retargeting an actually observed zonal-screen or recovery opponent also counts. **Tick zero and the earliest retained point are baselines, never fictitious changes; zero observed changes is reported explicitly.** No prediction, tactical command, possession claim, cause or result is inferred.

The isolated `createObservedAssignmentTimeline(maxTicks)` captures a frozen bounded ring of canonical 22-player duty snapshots. Recording validates all physical canonical identities, finite measured player XY/velocity, actual team-aligned assignments, all opponent IDs and contiguous ticks **atomically** before appending any record. `summarizeObservedAssignmentTransitions(timeline,id)` validates the full frozen ring, enforces 22 canonical entries and contiguous tick history, and returns a frozen change count and latest explicit before/after event for the selected body. Reset/Apply rebuilds the observer and clears focus and timeline, without affecting player positioning, real movement, ball physics or match clocks. Five Node tests cover first paint/immutable baseline, witnessed press handoffs, genuine opponent retargeting, malformed/stale atomic rejection, 900-tick deterministic replay and Rapier ball isolation. The DEV route and real Chrome test also check neutral initial UI, playback observations, focus-switch noninterference and reset.

**One grouped Draft/HOLD PR #465. No merge, production/Preview deploy, remote database writes or official match integration without separate owner approval.** Do not claim physical iPhone Safari signoff from Chromium CI.

## ME-PLAYER-29 — inspect real current tactical assignments (2026-11-10)

**Local DEV 11v11 Match Engine LAB only.** The existing **Inspect player** focus now reports a neutral-first-paint **Current assignments** row. It labels only the selected real player's explicit current 60Hz pressing, covering, zonal screening, space support, weak-side balance and defensive recovery records, including actual referenced opposing-player IDs when present. If more than one explicit assignment appears, all are shown rather than inventing exclusive intent or priority. With no explicit assignment, the observer says **Goalkeeper role** or **No explicit assignment**, not a fabricated tactical activity. The existing Recent paths (2s) toggle now emphasizes the selected player's actual recorded XY trail in white while keeping the other 21 historical trails subdued. The observer still supports menu or pitch marker selection and Reset/Apply clears the focus.

Pure frozen `inspectObservedPlayerAssignments(snapshot,history,id)` first validates the current real 22-body and immutable bounded history through ME-PLAYER-28's inspector. It then checks same-team assigned player IDs and opposing-player IDs in that team's actual recorded snapshot; invalid/cross-team/duplicate/stale records are rejected before producing a frozen list. None of this changes tactical assignments, collisions, movement, physics, the world clock, ball interactions or official match authority. Five Node tests cover initial mirrored pressers and neutral players, every current explicit assignment type, simultaneous assignments without invented exclusivity, bad identity/team or stale samples, and 900 deterministic ticks plus Rapier ball isolation. DEV route and actual headless Chrome verify labels, selected historical path contrast, unchanged simulation time/player position after focus changes, and Reset. Physical Safari QA is not claimed.

**PR #465 remains Draft/HOLD and one cumulative commit; no merge/deploy/remote DB/official results integration without owner approval.** The previous ME-PLAYER-28 full CI gate was blocked by an unrelated Admin Chromium Settings hostname mismatch (`localhost` versus `app.localhost`), not by the Match Engine targeted test. New exact-head validation must be checked independently.

## ME-PLAYER-28 — read-only one-player observation (2026-11-10)

**Local DEV 2D lab only.** The previously hidden-by-default **Players (22)** panel now has one accessible native **Inspect player** selector (No focus, Home #1–11, Away #1–11) and a neutral-first-paint **Selected player** readout. A mouse click or mobile tap *directly on a numbered live player marker* sets the exact same observer focus using the pitch renderer's existing physical XY/canvas projection; clicking empty turf is ignored. The focused marker receives a white ring and its **actual current** team, number, role, XY, speed, observed blocker (if any) and last-2-second real path/net displacement are reported. Both keyboard selection and canvas tapping work without player movement commands. Reset/Apply clears observer focus and shows the neutral readout; hiding the panel hides the highlight without affecting simulation.

Pure `pickObservedPlayerAtCanvasPixel` does nearest-body hit testing with a bounded pixel radius, using the same projection as the pitch, validating finite actual marker locations. Pure, frozen `inspectObservedPlayer` verifies a canonical 22-body snapshot, known identity/role, synchronized complete historical samples, current XY consistency and blocker ID before computing observed path vs net distance. **No steering, possession, ball contact, tactics, new match authority, future prediction, remote write or physics mutation.** Five new Node cases cover neutral immutability, Home/Away hit zones, live per-body actual path/velocity, forged/stale observation rejection, and 900-tick deterministic/Rapier isolation. The DEV route and actual headless Chrome check available options, observed status, dropdown selection, clicking a real player, ignoring empty turf and no simulation tick/position change. This is experimental and physical Safari QA is not claimed.

**PR #465 remains one grouped commit in Draft/HOLD. No merge/deploy/remote database or official match integration without owner authorization.**

## ME-PLAYER-27 — measured travel vs net displacement over the last 2s (2026-11-10)

**Local DEV laboratory, read-only observer only.** The **Players (22)** panel now includes **Recent distance / net (2s)** for Home and Away. The first number is mean per-player **actual physical path distance** (sum of successive observed 60Hz XY steps); the second is mean **net displacement** between first/last observed positions. Distances are averaged over all eleven physical bodies per side. The difference captures turning, sidesteps or returning over the same bounded window; it does **not** assert tactical quality, possession, stamina, speed capabilities or player intentions.

Pure, frozen `summarizeObservedTrailDistances(history,team)` validates all 22 canonical identities, equal and contiguous 60Hz sample times, current snapshot tick, pitch bounds, finite coordinates and the existing maximum 120-tick history. Invalid history is rejected and never mutates the existing observer. Initial first paint and Reset show 0.00 m / 0.00 m; reads reflect only already recorded position history, with no extra simulation ticks, predicted paths, player commands, new physics, match outcome changes, remote writes or asynchronous work. Five Node tests cover neutral/reset, a mirrored real right-angle turn, sliding-window limits, fabricated/unsynced input rejection, and 900-tick deterministic/ball-isolated replay. DEV route and Chrome QA check first paint, positive physical distance after playback, no toggle-induced time/distance changes and reset.

**PR #465 remains Draft/HOLD with one grouped cumulative commit; no merge, production/public Preview deployment, remote DB action or official match integration without separate authorization.**

## ME-PLAYER-26 — bounded observed paths for live movement QA (2026-11-10)

**Local DEV laboratory only.** The **Players (22)** observer has a new, initially-off, keyboard accessible **Recent paths (2s)** toggle that shows thin translucent 22-player history trails on the same top-down pitch, beneath the existing velocity vectors and player markers. Every point is a current actual player X/Y sampled after an authoritative 60Hz kinematic step; there are no predicted coordinates, route hints, possession claims or invented future movement.

A new pure and separately instantiated `createObservedPlayerTrails(maxTicks)` observer records immutable `{tick,x,y}` points for exactly 22 known players, allows only contiguous 60Hz sample ticks, validates pitch bounds, IDs and every body **atomically** before changing its bounded ring, and retains at most **120 ticks / 121 points** per player (2 seconds of motion). First paint records tick 0, **Reset/Apply creates a new empty previous history with only the new tick-0 sample**, and showing/hiding the display never alters tactics, players, ball, world time or player velocity. The data is owned by the LAB viewer, not the canonical match engine or D1. Snapshot copies and points are frozen. Five Node tests cover neutral/first paint/reset, exact ring bounds and mirroring, atomic malformed input, deterministic time/identity, and 900-tick bounded/ball-isolated replay. DEV route and real Chrome assert initially-hidden toggling, actual changed canvas pixels after physical ticks, no toggle-induced time/player movement and Reset. Physical Safari signoff is not claimed.

**PR #465 remains a single cumulative open Draft/HOLD PR. No merge/deploy/shared Preview/remote DB or official match integration without separate owner authorization.**

## ME-PLAYER-25 — current-motion telemetry and velocity arrows (2026-11-10)

**Local DEV Match Engine LAB only.** The 22-player top-down inspector now reports frozen `observedMotion` per side: moving/stopped at **0.2 m/s**, actual hard-kinematic blocked count, and mean observed speed. Pure, finite-validated `summarizeObservedPlayerMotion` requires exactly eleven distinct current bodies per team. `observedPlayerVelocityVector` maps actual XY/VX/VY to a clamped, frozen visual arrow scaled to **0.4 seconds of current speed**; it is not a future prediction or tactical destination.

An initially-off, accessible **Velocity vectors** button inside hidden-by-default **Players (22)** draws team-coloured arrows below numbered player markers. A static-first-paint **Observed motion** row updates from live 60Hz snapshots. Toggling changes only the drawing, never the clock, player commands, hard-body collision guards or canonical Rapier ball physics. Five Node tests cover neutral/reset/frozen baseline, mirrored XY/VX/VY/pitch clipping, actual movement and collision counts, malformed/duplicate observations and 900-tick deterministic isolation. Local route and Chrome QA verify first paint, toggle on/off and unchanged clock/players. No physical Safari signoff claimed.

**Single Draft/HOLD PR #465; no merge, deploy, shared Preview or remote D1 writes without separate owner approval.**

## ME-PLAYER-24 — current all-body safety for short rejoin handoffs (2026-11-10)

**Experimental local Match Engine LAB only.** ME-PLAYER-23 checked the original real teammate blocker before starting or maintaining a velocity-aware tactical handoff, but did not yet inspect every OTHER observed player on the immediate handoff segment. New pure, frozen, finite-validated `measureObservedHandoffCorridor(player,bodies,cue)` measures the real current-XY separation of ALL other teammates, opponents and goalkeepers from a geometrically capped **0–2.5m cue segment**, requiring **at least 1.25m centre clearance**. The moving outfielder must occur exactly once among the observed bodies with matching current coordinates. Duplicate IDs, non-finite or stale player observations are rejected. No player movement is predicted and no physics is fabricated.

A handoff will not start if any other real body crowds that current segment. An already active handoff is rechecked every 60Hz tick, cancelling immediately if a newly observed body crowds its cue. Normal tactical assignments, the previous original-blocker and new-duty cancellation checks, 7m/s speed cap, 0.98m hard collision separation and isolated canonical Rapier ball remain authoritative. Frozen read-only `handoffCrowding:{home,away}` shows current crowd-blocked handoff attempts (`blocked`) and cumulative cancellations of previously active handoffs (`cancelled`). The optional hidden-by-default Players (22) panel adds one **Handoff crowding** row. Five targeted Node tests cover neutral/reset, real teammate/opponent/keeper obstruction, mirrored cue clearance and range, malformed/stale observations, and 900-tick deterministic all-player bounds and canonical ball isolation. DEV route and real Chrome readout assertions have been extended; human Safari signoff is not claimed. This is not global pathfinding or a future movement guarantee.

**PR #465 stays Draft/HOLD: no merge, deployment, remote D1 write or official match integration without separate owner authorization.**

## ME-PLAYER-23 — brief current-velocity tactical rejoin handoff (2026-11-10)

**Experimental manager-driven LAB only.** ME-PLAYER-22 confirms that a sidestep is physically complete (≤0.65m from its *current* waypoint and ≥1.25m from the real blocker) and that the original blocking teammate is clear of the next ≤3m observed tactical return corridor. ME-PLAYER-23 reduces one remaining abrupt change of *requested travel direction* when that temporary lateral waypoint is discarded. A pure finite-validated frozen `observedVelocityRejoinTarget(player,tacticalTarget,remainingTicks)` uses the **actual current player XY and VX/VY**, the **current unassigned tactical target** and a remaining **0–24 deterministic-tick clock** to produce a **short at-most-2.5m local direction cue** for the existing kinematic controller. It gradually blends the observed current movement heading into the current tactical direction with an initial measured-heading weight of **at most 0.7**, decaying to zero over **24 × 1/60s = 0.4s**. A stopped (<0.5m/s), perpendicular/backwards, near-destination or unassigned-out-of-scope player gets its normal tactical target without any invented motion; the local cue is pitch-bounded. This is a temporary *target-direction* handoff, not instantaneous position movement, a cached waypoint, a hidden physical force, or a claim of possession.

The private per-free-outfielder handoff clock is armed **only after an actually completed and safe ME-PLAYER-21/22 sidestep** and only when an observed-velocity cue is meaningful and the **same original teammate’s currently measured XY** also clears that cue’s next short corridor. During the following maximum 24 movement ticks the cue is **recomputed every tick from fresh current player velocity and tactical goal**, with the actual blocker refreshed via the existing 30-tick same-blocker cooldown ID (no stored or stale teammate XY). A newly unsafe cue, disappeared real blocker, invalid velocity direction or new dedicated pressing, covering, screening, weak-side balancing or selected open-space support assignment immediately cancels the handoff. Any newly confirmed detour supersedes it. Actual 60Hz speed cap 7m/s, acceleration/braking/turning, pitch clamps, all-22 ≥0.98m hard separation and canonical Rapier ball authority remain unchanged; this is not predicted route safety or global pathfinding.

New frozen read-only `rejoinHandoffs:{home,away}` reports the number of currently active handoff clocks and cumulative started handoffs. The hidden-by-default **Players (22)** panel gains one **Rejoin handoffs** observer row, without direct steering. Five Node tests cover phantom-free first paint/reset, pure smooth observed-velocity heading adaptation and mirrored teams, safe fallback for backwards/stopped/short goals and newly observed blockers, finite/invalid inputs and no stale XY use, and 900-tick deterministic 22-player movement/physics isolation. Route and real headless Chrome first-paint/moved/relocated/observed readouts extended; no physical mobile Safari QA claimed.

**One cumulative open Draft/HOLD PR #465. No merge, deployment, remote D1 writes or official match integration without separate owner authorization.**

## ME-PLAYER-22 — guard tactical rejoin with the original blocker’s observed short corridor (2026-11-10)

**Managerial research LAB only; no steering or official match integration.** ME-PLAYER-21 safely releases an eligible unassigned outfielder's temporary sidestep waypoint after it has actually reached within **0.65m** of the current blocker-relative waypoint while remaining **at least 1.25m** from the actual same-team blocker. ME-PLAYER-22 adds one conservative requirement before rejoining the player's normal tactical target: the next **up to 3m straight geometric corridor** from the outfielder's **current physical XY** toward **this tick's actual tactical target** must remain at least **1.25m from the real teammate who caused the blocked movement**. Pure finite-validated `measureObservedDetourRejoinCorridor(player,blocker,tacticalTarget)` computes the closest current blocker distance to the clamped 0–3m segment, returning frozen `{observedM,minimumGapM,safe}`. The computation never infers future player motion, possession or any ball contact; it only checks the **original observed same-team blocker**, not other live bodies, a complete route, or future safety.

When ME-PLAYER-21's actual safe waypoint-arrival condition is true, the normal free-outfielder detour controller additionally checks this current local corridor. A clear short corridor releases the waypoint, restores this tick's already-computed autonomous tactical goal, resets stall evidence and starts the existing 30-tick same-blocker reactivation guard. **A blocked current corridor does not count as a successful detour completion:** the existing lateral target remains in force and the unchanged 24-tick low-progress/180-tick lifetime watchdog can still release it as an unsuccessful route. This is **not** a new pathfinding solver, moving-obstacle prediction or guarantee against all subsequent collisions. No changes to ME-PLAYER-17/21 priority assignments, all-22 hard non-overlap, deterministic 60Hz movement, pitch/speed/braking/turning, or independent Rapier ball.

New read-only frozen `detourRejoin:{home,away}` reports **how many currently eligible detours had a safely reached waypoint but a blocked observed short rejoin corridor in this step**. The hidden-by-default **Players (22)** observer gains one **Unsafe tactical rejoin** line; no interactive player targeting. Five new Node tests cover phantom-free neutral/reset, safe mirrored corridor, a reached waypoint that nevertheless has an unsafe forward corridor, finite input/short-segment/3m horizon behavior, and 900-tick deterministic 22-player separation, pitch/speed, and canonical Rapier ball isolation. DEV route and actual headless Chrome first-paint/moved/relocated/observed readouts are checked. No physical Safari QA asserted.

**Single cumulative Draft/HOLD PR #465**; no merge, deploy, D1 remote writes or official simulation changes without separate owner authorization.

## ME-PLAYER-21 — release completed local bypass waypoints on real safe arrival (2026-11-10)

**Managerial-only research LAB; no direct steering.** ME-PLAYER-17/20 uses real 60Hz hard-body collision evidence to assign a temporary same-team-blocker detour waypoint to an otherwise free outfielder, select and hold its side deterministically, retry guard a released blocker, and abandon physically stagnant/off-course or overlong routes. ME-PLAYER-21 explicitly detects when the player **already reached a safe current local waypoint**, rather than perpetually following that temporary lateral target. A new pure, finite-validated `reachedObservedDetourWaypoint(player,blocker,waypoint)` accepts only an eligible actual outfielder, **the currently observed same-team blocker XY**, and **the current tick's recalculated waypoint**. Completion requires **player-to-waypoint distance at most 0.65m** AND **actual player-to-blocker clearance at least 1.25m**. Merely being near the waypoint while too close to the obstacle is not a success; missing/cross-team blockers and invalid XY are rejected. This is positional evidence only, not a predicted interception, ball touch or a possession claim.

The existing `detourTarget` checks arrival **only after** confirming the real blocker is present and a valid target-relative waypoint still exists. A safe observed arrival immediately **releases the detour and returns the already determined normal autonomous tactical target** through the unchanged 60Hz kinematic/acceleration/collision pipeline. The same-blocker 30-tick retry cooldown and saturated-stall reset apply exactly as for other releases. Higher-priority pressing, covering, screening, weak-side balance, assigned open-space support and goalkeeper rules remain untouched. Existing outfield clearance, crossing smoothing, line cohesion and real-threat recovery are preserved. A waypoint is **not** full pathfinding, and a count of completed waypoints is not proof of downstream tactical match performance.

The frozen read-only `detourCompletions:{home,away}` counts **actually reached local bypass waypoints**, initially zero and reset reproducibly. The hidden-by-default **Players (22)** panel gains one **Detour completions** observer row; no direct movement UI. Five Node QA scenarios cover neutral/reset, safe arrival and Home/Away mirror, unsafe/new blocker or malformed samples, existing 30-tick retry compatibility without mutating any physical XY, and 900-tick deterministic 22-player pitch/speed/non-overlap with isolated canonical Rapier ball physics. DEV route and real headless Chrome first-paint/movement/refresh assertions extended. Physical Safari QA, deployment, remote D1 writes, and official match integration are not claimed.

**One cumulative open Draft/HOLD PR #465; merge requires separate explicit authorization.**

## ME-PLAYER-20 — real goal-directed progress instead of meaningless detour displacement (2026-11-10)

**Managerial-only experimental LAB.** ME-PLAYER-19 previously counted any real XY displacement during a confirmed teammate-block detour as progress. That could falsely reset stagnation for a player drifting sideways, oscillating in place or even moving away from the temporary bypass waypoint. ME-PLAYER-20 tightens the evidence using pure, finite-validated and frozen `measureObservedDetourAdvance(start,end,waypoint)`: compare the **actual pre- and post-physics XY distance to this tick's selected temporary detour waypoint**, and report the measured **physical path length**, **positive distance reduction**, and **distance increase** separately. This waypoint is the actual current-physics-step target, captured only for that step; it is not an invented teammate position, a prediction or a cached old target. Horizontal and vertical components are mirrored correctly between teams; a sideways/off-course physical move is **not counted as useful goal-directed progress**. Actual blocked movement still reports zero progress.

The existing pure 60Hz `advanceObservedDetourProgress` now consumes the **nonnegative actual toward-waypoint advance** (rather than undirected displacement). The existing **0.005m minimum useful advance**, **12-tick slow warning**, **24 consecutive subthreshold ticks to abandon**, **180-tick maximum route lifetime** and **30-tick same-real-blocker retry protection** are unchanged. A physically moving but wrong-way route therefore expires instead of being kept alive by nonproductive movement. Existing priority duties, same-team blockage confirmation, ME-PLAYER-18 stable side choice and the untouched 22-player collision rejection, movement speed/acceleration/braking/turning, pitch clamp and Rapier ball remain authoritative. This is not full pathfinding or ball-possession logic, and it adds no player steering UI.

Immutable observer-only `detourAlignment:{home,away}` tracks **currently off-course active detours** (moved at least 0.005m this step but advanced less than 0.005m toward the waypoint) and cumulative **backward-toward-waypoint ticks** (distance to waypoint increased by at least 0.005m). The hidden-by-default **Players (22)** panel adds one read-only **Detour alignment** row. Five new Node tests cover phantom-free neutral/reset state, actual forward versus sideways/backward/overshooting coordinates and Home/Away mirror, 24-tick oscillation detection and return to useful progress, malformed inputs and field-edge samples, and 900-tick deterministic 22-player speed/pitch/non-overlap plus isolated Rapier ball replay. Route and real Chrome first-paint/refreshed readouts extended. No manual Safari QA claimed.

**One cumulative open Draft/HOLD PR #465; no merge, deploy, remote D1 or official match integration without separate owner authorization.**

## ME-PLAYER-19 — physical detour progress and stalled-route termination (2026-11-10)

**Managerial-only experimental LAB.** ME-PLAYER-17/18 uses 12 actually blocked 60Hz steps from the same real teammate to activate a stable, bounded position-only waypoint, and protects released detours with the existing 30-tick same-blocker retry guard. ME-PLAYER-19 detects a route that is **failing to physically advance**: the engine records an active player's **real start-of-tick XY**, runs the unchanged kinematic controller including its hard player non-overlap rejection, and then compares with **real post-step XY**. This is actual displacement, not movement of a desired waypoint, extrapolated velocity, presumed possession, or predicted match event. Pure finite-validated, frozen `advanceObservedDetourProgress(previous,movedM)` tracks ticks on the active route and consecutive near-zero displacement: **under 0.005m per 60Hz step**, with a **12-tick warning** and **24-tick (0.4s) abandonment** if stagnation continues. For safety, even a moving active detour is capped at **180 ticks (3s)**. Pure `shouldAbortObservedDetour(progress)` applies those fixed thresholds; both helpers are deterministic, no wall-clock timers.

An abandoned route is released using the existing ME-PLAYER-18 cancellation path and **same-real-blocker 30-tick retry guard**, resetting the saturated 12-tick evidence and per-outfielder progress state. A newly activated route is measured only on subsequent physical ticks, not from an invented movement sample; pressers, coverers, screeners, weak-side balancers, assigned open-space runners and goalkeepers remain ineligible, and priority reassignments cancel any route immediately. This mitigates indefinite detour loops but does not promise successful pathfinding or prevent every future block. The real 22-player pitch limits, 7m/s speed, acceleration/braking/turning, 0.98m hard non-overlap and Rapier ball simulation remain unchanged.

The read-only, frozen `detourProgress:{home,away}` observer reports **currently slow active detours (at least 12 stagnant ticks)** and **cumulative abandoned detours**. The optional hidden-by-default **Players (22)** panel shows a single **Detour progress** row; it cannot steer/select players. Five new Node tests cover neutral telemetry and resets, exact physically stationary 24-tick abort and movement-based recovery, 180-tick maximum lifetime, finite/invalid input guards, and 900-tick deterministic whole-field movement, body non-overlap and canonical Rapier ball isolation. Route/first paint/real headless Chrome observer assertions extended. No physical Safari manual QA, official match integration, merge, deploy or remote D1 changes are claimed.

**One cumulative Draft/HOLD PR #465.** Separate owner authorization required to merge.

## ME-PLAYER-18 — stable detour-side selection and same-blocker retry guard (2026-11-10)

**Autonomous managerial LAB only.** ME-PLAYER-17 confirmed a real teammate's repeated hard `blockedBy` rejections for 12 consecutive 60Hz steps before allowing a temporary blocker-relative detour. ME-PLAYER-18 stabilizes that navigation intention **without simulating possession or permitting direct player movement**. Pure, deterministic `selectObservedDetourSide(target,player,blocker,players)` examines **both side routes using the currently observed XY of all 22 player bodies** and each candidate's actual field clearance. It favours a lane with at least **0.25m more usable clearance** than the existing stable player-ID default; otherwise retains the original default. Both candidate waypoints are computed with the existing pure `observedTeammateDetourTarget`, which now accepts an optional **+1/-1 side** while retaining the original 3-argument behavior; unusable or non-clear alternatives are not selected. **The side is chosen once at confirmed activation and held for the entire detour**, while waypoint coordinates continue to use *fresh current blocker XY* every tick. Neither a previously sampled teammate position nor an invented opponent is retained to steer the player.

A separate private per-outfielder retry state uses pure frozen `advanceDetourRetryCooldown(previous,releasedBlockerId)`: when a confirmed detour is released (blocker passed/out of range, waypoint invalid, real priority task takes over), it guards against reactivating **that same observed teammate blocker** for **30 fixed ticks (0.5s)**. An unrelated teammate may still qualify after 12 new real rejected steps. The cooldown progresses only on normal 60Hz match-engine ticks (no timer, background task or player AI control), and reset starts empty. Geometry-invalid release also clears the saturated stall counter. No detour is activated against opponents or without actual physical block evidence. Physical 7m/s limit, acceleration/braking, facing, pitch bounds, all-player 0.98m non-overlap and Rapier ball remain authoritative and unchanged; routes are intentions, not guaranteed successful obstacle avoidance.

Frozen read-only `detourStability:{home,away}` measures current players inside retry protection and the cumulative number of selected alternative-side routes; existing `detourRecovery` fields and semantics are preserved. The hidden-by-default **Players (22)** readout gains a single **Detour stability** row, without direct player controls. Five new Node tests cover neutral/reset, real spatial lane obstruction and mirrored stable choice, near-touchline inward preference and input validation, exact 30-tick deterministic retry guard, and 900-tick deterministic 22-player pitch/non-overlap/velocity plus Rapier ball isolation. Route and real headless Chrome checks extended. No manual Safari QA claimed.

**Single cumulative PR #465 remains Draft/HOLD.** No merge, deployment, remote D1 modification or authoritative match integration without separate owner approval.

## ME-PLAYER-17 — confirmed teammate blockage and bounded autonomous detour waypoints (2026-11-10)

**Managerial research LAB only; no manual movement or steering.** The existing 60Hz kinematic loop already rejects any new physical position that would put two of the 22 player bodies below the **0.98m centre-to-centre non-overlap threshold**, recording the actual `blockedBy` player ID and hard-stopping the attempted move. ME-PLAYER-17 builds a secondary *navigation intent* on that **real collision-rejection evidence**: for otherwise free **defenders, midfielders and forwards** only, `advanceObservedStall(previous,blockerId)` requires **12 consecutive blocked ticks** (0.2s) against the **same actual teammate**, never an opponent, before scheduling a sidestep. A different or absent blocker resets the evidence counter. Neither synthetic state nor unobserved threats may trigger a detour, and the goalkeeper is excluded.

The pure frozen `observedTeammateDetourTarget(target,player,blocker)` computes a **short local waypoint from the blocker's freshly observed current XY**, not its remembered coordinates, about **1.8m sideways and 0.25m behind** the blocker along the direction of the player's existing tactical goal; Home/Away direction and player-ID tie breaks are deterministic and mirror correctly. The detour remains only while the live blocker is within **3.2m**, in front on the active goal direction and closer than the requested tactical target. Passing it, moving out of range or losing valid blocker evidence releases the detour; pressing, goal-side covering, opponent-aware screening, weak-side balance or assigned open-space support responsibilities **immediately cancel** any detour and streak. The waypoint is a **position-only request through the unchanged physical 60Hz kinematic controller**, with no teleportation, hard collision bypass, fake pass, possession, match authority or new Rapier interaction; a blocked tick may still occur and no universal success guarantee is claimed. The pre-existing real-team clearance, crossing smoothing, recovery and line cohesion continue independently.

A frozen read-only `detourRecovery:{home,away}` observer counts **currently active confirmed detours**, **actual current-tick same-team physical rejections** and **cumulative detour starts**; initial and reset state is zero for both teams. The hidden-by-default **Players (22)** panel gets a single **Blocked-movement recovery** metric, without any way to steer the players. Five Node tests cover neutral first paint, same-teammate consecutive confirmation/hysteresis and input validation, geometrically bounded mirror waypoint, out-of-range / passed obstacle / priority cancellation and no teleports, and 900-tick deterministic pitch, velocity, 22-player separation and canonical Rapier ball isolation; DEV route and headless Chrome readout QA extended. Physical mobile Safari QA is not claimed.

**One cumulative Draft/HOLD PR #465**; no merge, deploy, remote D1 changes or production match integration. Separate owner approval is required before merge.

## ME-PLAYER-16 — bounded crossing-target transitions and observed-release (2026-11-10)

**Autonomous managerial research LAB only; no direct player movement input.** ME-PLAYER-15 uses actual outfield teammate XY/VX/VY to forecast provisional trajectory intersections up to 1.5s ahead and sets at most a 0.9m tactical *target offset*. ME-PLAYER-16 bounds how rapidly that offset may change, including when the observed velocity forecast appears, reverses or vanishes. The pure, finite-validated, frozen `advanceCrossingIntentOffset(previous,desired)` clips new desired corrections to **0.9m**, then caps the resulting per-tick XY-vector change at **4m/s × 1/60s ≈ 0.0667m**. This is **intent smoothing only**, not player acceleration or a physics impulse; existing separate 7m/s speed limit, acceleration/braking, turning and 0.98m no-overlap rejection remain authoritative.

A per-free-outfielder **private positional-offset** state is created at zero and updated at the same stable 60Hz cadence; exactly one current observed forecast may supply each desired offset, and a missing forecast supplies **zero**, releasing a residual *spatial offset* gradually back to unmodified formation/line intent. **No previous teammate identity, stale teammate position or velocity extrapolation is retained as new evidence.** If a real teammate is already within 5m (the ME-PLAYER-14 higher-priority same-team clearance), or the player takes pressing, goal-side covering, screening, weak-side balancing or assigned open-space support responsibilities, the residual crossing offset is immediately cleared rather than easing through the assignment. Goalkeepers remain excluded. ME-PLAYER-10/11 observed-opponent recovery/line easing, ME-PLAYER-12 line cohesion and ME-PLAYER-13/14 clearance remain separate and unchanged.

The read-only, frozen `crossingTransitions:{home,away}` summarizes **engaging**, **releasing** and **maximum spatial offset in metres** from the current private state, separately from the existing `crossingIntent` real-forecast/ETA observer. Initial state is settled for both teams; `reset()` is identical to a new research world. The hidden-by-default **Players (22)** panel gains one **Crossing transition** row without introducing direct steering controls. Five new Node tests cover pure bounded interpolation and invalid inputs, phantom-free first paint and mirrored resets, current observation and bounded spatial release without ghost forecasts, 780-tick live evidence and reproducibility, and 900-tick deterministic body separation with canonical Rapier ball isolation. Route and real headless Chrome observer tests extended. Physical Safari QA has not been signed off; no official match integration, merge, deploy, or remote D1 modification.

**One cumulative Draft/HOLD PR #465**, requiring separate owner authorization for any merge.

## ME-PLAYER-15 — observed-velocity teammate trajectory coordination (2026-11-10)

**Autonomous managerial LAB only.** After ME-PLAYER-13/14 actual-position teammate clearance, ME-PLAYER-15 adds a modest early *target-only* nudge to a **free outfielder** when two **real, same-team, non-goalkeeper** players appear headed toward a near intersection **before they become close**. A new pure frozen `forecastTeammateCrossing(player,players)` uses exclusively *this tick's actual player XY and VX/VY* (not a fabricated possession, pass, steering command, scripted endpoint, prediction about the ball, or match event). It computes constant-velocity closest approach, within a provisional **1.5s maximum horizon** and with **at least 0.1s lead**, filters for genuinely closing motion with **both teammates moving at least 1m/s**, with nonparallel/non-head-on heading difference (absolute velocity-heading cosine at most **0.85**, roughly 32°–148°), current pair separation **5–22m**, and projected closest approach below **2.5m**. A parallel/lane-merging or directly head-on pair is explicitly left to the existing real-distance clearance and hard collision guard rather than receiving a speculative crossing nudge; this also preserves Home/Away spatial mirroring in the older cooperative support test. The nearest-in-time qualified threat is chosen deterministically, with projected-separation and player-ID tie breaks. This is a short, hypothetical geometric extrapolation from sampled velocities, not a guarantee that players will follow that path or that a collision would occur.

The frozen pure `teammateCrossingTarget(normal,player,players)` generates a small offset **away from the estimated near-approach location**, capped at **0.9m** and proportional to the projected shortfall. A projected exact crossing gets a reproducible perpendicular-to-relative-velocity escape direction (mirrored for Home and Away). No state or lingering forecast identity is retained. A currently nearby teammate **inside 5m** defers entirely to the established actual-position ME-PLAYER-14 hysteretic clearance, rather than stacking competing avoidance offsets. Only free defenders, midfielders and forwards may receive this secondary positional intent **after** real-threat recovery, gentle line cohesion and high-priority tactical assignment decisions; pressers, coverers, zonal screeners, weak-side balancing defenders, open-space supporting runners, and both keepers remain unchanged. The physical **60Hz kinematic controller, 7m/s cap, acceleration, braking, turning, pitch bounds and hard all-22-player overlap rejection** remain untouched; no Rapier ball force or authoritative game state changes.

The hidden-by-default observer's frozen `crossingIntent:{home,away}` displays the count of **forecast-eligible free players in the preceding tick** and the smallest predicted time-to-closest-approach (or none). It is **not a confirmed future collision count**. One read-only **Potential crossing / closest ETA** row is added; no player controls. Five new Node QA scenarios cover neutral absence, genuine paired crossing/mirrored bounded targets, diverging/irrelevant/current-close no-op, deterministic ties/finite input and field bounds, plus 900-tick deterministic full-player spacing and canonical Rapier ball isolation. Chrome readout and DEV route static assertions extended. No physical Safari QA claimed.

**One cumulative Draft/HOLD PR #465**, no merge, deploy, remote DB, or official world modifications; separate owner authorization required.

## ME-PLAYER-14 — stable nearest-teammate clearance assignments (2026-11-10)

**Autonomous-managerial LAB only.** ME-PLAYER-13 introduced up to 1.25m *target-only* outfield spacing correction when the closest currently observed teammate is inside 5m. ME-PLAYER-14 addresses 60Hz jitter when two **real** same-side outfield teammates are nearly equally close: an eligible free player retains its current clearance neighbor until a different eligible outfielder is at least **0.75m closer**. The pure frozen helper `selectTeammateClearanceNeighbor(player,players,incumbentId)` recomputes all qualifying distances using this tick's actual teammate XY; tie selection is deterministic by ID. The previous neighbor ID is solely hysteresis, **never stale XY, an imagined opponent or ball possession**. The incumbent must still be inside the strict **5m** clearance zone. Leaving the zone or taking a higher-priority pressing/covering/screening/balancing/support assignment immediately clears the selection; a different real neighbor can take over naturally.

The pure ME-PLAYER-13 `teammateClearanceTarget` now optionally accepts the selected incumbent ID but retains its previous three-argument semantics and remains finite-validated, frozen, mirrored and pitch-bounded. The 5m threshold, 50% deficit gain, 1.25m maximum target shift, existing ME-PLAYER-10/11 threat recovery easing and ME-PLAYER-12 line cohesion are unchanged. Clearance still applies **only to unassigned outfield players**. No keeper steering, tackles, ball ownership, ball impulses, official match state, real players, manager control or physics integration. The established 60Hz 7m/s movement, acceleration/braking, turning, non-overlap and Rapier ball simulation remain isolated.

Read-only `teammateAvoidance:{home,away}` now provides the **currently active eligible clearance-player count** and **cumulative assignment switch count** for each team. Initial neutral state is 0/0 for both, and `reset()` creates the same neutral snapshot. The optional hidden-by-default **Players (22)** readout gains one `Clearance tracking` row, without exposing target IDs or interactive steering. Five Node tests cover neutral state, distance ties/hysteresis and mirror invariance, exact 5m expiry and stale-incumbent invalidation, 720-tick live evidence and switch counters, deterministic 900-tick body separation and canonical Rapier ball isolation. DEV static route and real Chrome tests extended. This is a provisional tactical heuristic, not a measured football performance improvement or manual mobile Safari approval.

**PR #465 remains single-commit cumulative Draft/HOLD**; owner approval required for merge. No remote D1, deployment or official fixture changes.

## ME-PLAYER-13 — local teammate clearance, no manual outfielder steering (2026-11-10)

**Managerial-only spatial intent, not a new physics engine.** The previous ME-PLAYER-12 keeps the defender/midfielder line means reasonably compact. ME-PLAYER-13 adds **local outfield teammate clearance** when one free player approaches another real, currently sampled same-team outfielder. A pure deterministic `teammateClearanceTarget(normal,player,players)` selects the nearest live teammate based on **current XY**, not name, opponent tracking, ball ownership or a predicted pass. The soft intent activates only below a provisional **5m neighbour distance**, nudges away at **50% of the deficit**, and caps the extra positional target displacement at **1.25m**; a deterministic player-ID tie-breaker covers equidistant or coincident points (Home/Away mirrored X). Existing 60Hz velocity, acceleration, deceleration, orientation, field bounds and hard 0.98m player-to-player non-overlap remain completely unchanged, and no force is applied to Rapier's ball.

Only **otherwise free defenders, midfielders and forwards** receive this secondary nudge, **after** coordinated recovery, release and line-cohesion intentions for defenders/midfielders. The goalkeeper, assigned pressers, coverers, zonal screeners, weak-side balancers and the dedicated open-space runner keep their respective targets unchanged: local avoidance must not supersede their responsibilities. It is a **soft crowding reduction**, not a hard 5m spacing guarantee and not player collision control, tackle, ball contact or control over possession. Finite input, missing-neighbour no-op, and team filters are explicit; opposing players and the keeper are not fictional outfield teammates.

Frozen observer-only `teammateProximity:{home,away}` is calculated from **post-step actual XY**, counting each pair of same-team outfield players **once** if separation is below 5m and showing the measured minimum separation (14m for both 4-3-3 teams at first paint). This remains a measurement, not a target, and never reads a created possession state. The optional hidden-by-default **Players (22)** observer adds the single row **Local crowding / nearest teammate**, without buttons or steering. Five new Node tests cover neutral formation, actual teammate-based bounded/mirrored nudges, deterministic equal-distance/overlap tie behavior and input validation, 720-tick live observed proximity and role priority checks, and 900-tick deterministic stress with no player overlap or Rapier ball regression. Route and real Chrome readout assertions extended. No manual physical Safari QA claimed.

**One cumulative Draft/HOLD PR #465**, no merge, deployment, remote DB write or official match integration.

## ME-PLAYER-12 — observed teammate line cohesion (2026-11-10)

**Managerial-only experimental positioning; no direct player input.** Independent of opponent threat and possession, each team's real, currently observed **four defenders and three midfielders** supply their actual line-mean X and Y positions. The mirrored X axis gives the **signed forward-facing depth gap** (initially 15m for both 4-3-3 formations); the difference in mean Y positions gives the **lateral centreline drift**. A pure, finite-validated `measureLineCohesion(players,team)` returns frozen measurements and soft position-only target corrections. Missing one of the two real line samples returns `null` instead of creating fictional players or tactical data.

These provisional **soft spatial** guidelines only begin correcting when depth gap falls below **10m** or exceeds **19m**, or lateral drift exceeds **6m**; the dimensions are not hard guarantees. Bounded role-specific intended adjustments move free **defenders up to 1.5m** and **midfielders up to 2.5m** toward appropriate separation, while at most **1m / 1.5m lateral** respectively pulls their centrelines together. Role-aware shifts operate on each player's **normal formation target** rather than their current position, so existing channels are preserved and movement still goes through the established **60Hz deterministic, 7m/s speed, acceleration, braking, orientation, pitch-bounds and no-overlap** controller. All target shifts are capped and mirrored across teams. Pressers, covering defenders, opponent-aware screeners, weak-side balancers, and open-space support assignments take precedence and are never overwritten by compactness; keepers and forwards do not receive it. ME-PLAYER-10/11 observed-opponent recovery and target easing remain independent: **team cohesion is never treated as an observed opposing threat or possession**.

Frozen read-only `lineCohesion:{home,away}` reflects actual measured team XY **after each movement step** (not promised future spacing). The optional hidden-by-default **Players (22)** observer adds one row, **Line gap / lateral drift**, formatted in metres for both teams. Five focused Node scenarios cover neutral/mirrored initial data, overwide and compressed gap corrections, pure bounds and malformed/missing evidence, live measurement alignment with actual players and protected role assignments, and deterministic 900-tick separation/pitch/velocity plus unchanged Rapier ball physics. Route and real Chrome readout tests are extended. This is not a calibrated tactical model or physical collision-based cohesion mechanism; no merge, deploy, official match data, remote D1 or manual physical Safari signoff is implied.

**Single cumulative Draft/HOLD PR #465**, with merge requiring separate owner authorization.

## ME-PLAYER-11 — bounded defensive-line transitions and recovery release (2026-11-10)

**Managerial movement, not direct player control.** ME-PLAYER-10 introduced role-specific formation-relative recovery intentions from an **actually observed** opponent in a defending team's third. ME-PLAYER-11 limits the **change in those intended positional offsets** to a provisional **8 metres per second** at the existing deterministic **60Hz** tick (at most 0.1333m per tactical step). This is **independent of and does not raise the existing 7m/s player physical speed, acceleration, braking, turning, hard separation and pitch bounds**. It is not a teleport, opponent prediction, a ball action or physics input.

Each defender/midfielder maintains a private **formation-relative XY intent offset**. While eligible for collective recovery, their offset follows the currently observed opponent's current target smoothly—even if the observed opponent or lane switches. When no currently valid opponent screen remains, the **desired offset becomes exactly zero**, and only the previously established *spatial offset* eases to neutral; **no stale opponent identity, position, possession or attack is preserved/invented**. Goalkeepers, forwards and newly prioritized pressers, covering defenders, zonal screeners, weak-side balancers and space-support runners do not inherit any recovery offset. For these priority roles, residual offsets are cleared immediately; their regular locomotion continues to obey physical caps.

A pure, finite-validated frozen helper `advanceLineIntentOffset(previous,desired)` implements the max-step, and frozen observer-only `lineTransitions:{home,away}` reports **engaging** (current real screen/eligible recovery), **releasing** (unassigned players whose old offset is still easing to zero) and maximum formation-relative offset in metres. The optional hidden-by-default **Players (22)** view gains a single read-only **Line transition** row (settled/engaging/releasing, both teams); it does not expose controls. **QA-PLAYER-11:** five Node tests exercise finite validation and per-tick bounds, neutral first paint without false threats, real opponent entry and bounded exit to fully neutral shape, mirrored team intent and lane handoffs with protected roles, 900-tick deterministic replay/no-overlap and unchanged Rapier ball isolation. DEV route and real Chrome observer assertions are extended; no physical Safari QA claimed.

**PR #465 remains one cumulative commit, Draft/HOLD**, not merged, deployed or wired into production gameplay/remote D1.

## ME-PLAYER-10 — coordinated defensive and midfield recovery (2026-11-10)

**Autonomous managerial LAB only.** In addition to ME-PLAYER-08 recovery and ME-PLAYER-09 weak-side defensive balance, unassigned recovery **defenders and midfielders** respond together to an actual opposing player already detected by the own-third zonal screen. Their responsibilities remain exclusive of goalkeeper, pressing, covering, screening, balancing and open-space supporting. Ball territory alone cannot activate this intervention; no possession, tackle, interception, keeper save or contact is invented.

`observedThreatProgress(team,opponentPosition)` normalizes the **real sampled opponent X** between 10m inside the defending half and the 52.5m goal line, clamped to 0–1. The frozen pure `coordinatedLineTarget` preserves the original ME-PLAYER-08 **4m goal-side / up to 3m lateral recovery** and adds provisional differentiated role responses: at full threat progress **up to 1.5m additional goal-side for defenders, 2.5m for midfielders**, and respective 6% / 10% additional movement toward the **actual observed opponent Y**, bounded to 1.5m per role. At the entry threshold, there is no added depth. Both teams mirror X geometry. These are spatial heuristics, not calibrated football AI or an approved tactical model.

Exactly the existing deterministic **60Hz, capped acceleration/braking, bounded orientation, pitch, and non-overlap** controller applies; none of the tactical changes are teleports or impulses to Rapier's ball physics. The frozen observer-only `lineResponses:{home,away}` holds the observed opponent ID, progress, actual assigned helper counts and extra intended depth in metres, **not actual positions or match possession**. The hidden-by-default Players (22) observer exposes a single read-only **Line response** row. QA-PLAYER-10 covers no invented activation, real screen/recovery linkage, smooth depth and role differences, input validation/clamps, mirrored responses and exit, deterministic 900-step stress with separation and unchanged canonical Rapier ball replay. Chrome tests retain no player steering and responsive viewport guards.

**PR #465 stays cumulative single-commit Draft/HOLD**; no merge, deploy, remote D1, official match integration, direct player controls or manual physical Safari signoff.

## ME-PLAYER-09 — observed-threat weak-side defensive balance (2026-11-10)

**Managerial-only laboratory:** when the opponent-aware own-third screen has already identified a **real opposing outfielder**, one otherwise unassigned defender keeps a weak-side channel rather than also converging on the observed threat. Candidate selection compares the defender's formation lane with the **real sampled opponent Y**, requires at least **10m separation**, and uses **3m assignment hysteresis**. The presser, goal-side coverer, screen defender, goalkeeper and runner are ineligible; the chosen weak-side defender is also excluded from the ME-PLAYER-08 collective recovery assignment. If no real opponent is observed, there is no weak-side duty even when the ball is deep in one third. There is no inferred ball possession or offensive/defensive match phase.

Pure, input-validated and frozen `weakSideBalanceTarget` adjusts the defender's normal formation target **2m goal-side** and by up to **2m laterally away from the observed opponent** (10% gain). The 60Hz deterministic locomotion, acceleration/braking, heading, field bounds and hard body separation remain unchanged. This is a position-only heuristic, not man marking, a block, a tackle, ball contact or validated tactics. Frozen `balances:{home,away}` and `balanceSwitches` appear as read-only rows in the optional hidden-by-default **Players (22)** observer; the assigned defender also has a passive colored marker. No user steering.

**QA-PLAYER-09:** tests for no fabricated balance, actual opposing player and exclusive duties, mirrored pure bounded targets, stable hysteresis/exit, deterministic 720-tick opposing-third stress, no player overlap and unchanged Rapier ball replay. Retain full prior browser/routing regression gates. One cumulative **PR #465 Draft/HOLD**, no merge/deploy/D1/official world updates or physical Safari signoff.

## ME-PLAYER-08 — observed-threat collective defensive recovery (2026-11-10)

**Scope:** When an **actual opposing outfielder** has advanced into a defending team's half close to the ball **and** the ball is in that team's own third, the existing ME-PLAYER-04 opponent-aware zonal screen identifies the threat. The new *position-only*, collective recovery logic takes **only that observed screen** as its activation signal. It does **not** infer possession, an attack, a tackle or a change of match phase from ball territory alone. If no real opponent qualifies, all collective recovery assignments remain **none**, even when the ball moves abruptly into a defensive third.

Eligible **otherwise unassigned defenders and midfielders** adjust their normal formation-support targets by up to a provisional **4 m toward their own goal**, plus a bounded **14% lateral shift toward the observed opponent** with a hard **3 m lateral maximum**. Goalkeeper, presser, goal-side coverer, zonal screening defender and open-space runner responsibilities take priority and remain excluded from collective recovery. No teleport: the amended targets use exactly the existing deterministic **60 Hz kinematic speed/acceleration/heading and body non-overlap constraints**. The helper `recoverySupportTarget` validates finite inputs, returns a frozen target and can be tested in isolation. These are *provisional spatial heuristics*, not calibrated defending or real player skills.

A frozen `recoveries:{home,away}` snapshot contains either `null` or a frozen `{opponentId,playerIds}` describing the real tracked opposition and assisting defenders/midfielders; `recoverySwitches` counts changes of the observed threat or activation (not every slight change in ball XY). The optional, hidden-until-requested **Players (22)** laboratory observer adds **Defensive recovery** and **Recovery changes** readouts. No new manager buttons, manual player selection, WASD, touch movement, passes, shots, interventions, keeper saves, physical ball impulses or possession attribution.

**QA-PLAYER-08:** five additional Node cases verify no fabricated recovery at first-ball territory entry, genuine opponent advance and separated outfield responsibilities, mirrored/finite goalside+lateral recovery targets, correct deactivation after ball exits own third and mirrored team assignments, deterministic 720-step rapid transitions with pitch bounds, velocity, body spacing and exact Rapier ball replay isolation. Real Chrome reads initial/central and one-step territory **none**, then verifies actual Home defensive recovery only after a real opponent has approached during a longer simulation, preserving no-keyboard/click steering and existing responsive viewport checks. No production gameplay, real-team/player catalog, world DB, deployment, merge or manual Safari approval; PR #465 is cumulative, single-commit **Draft/HOLD**.

## ME-PLAYER-07 — autonomous goalkeeper goal-angle positioning (2026-11-10)

**Managerial-only LAB:** each of the two goalkeepers (#1) has a dedicated **ball-angle positional target** rather than being moved through the generic formation shift. The target is calculated deterministically from the real Rapier ball XY **only** (no fictional save, interception, catch, keeper possession, shot on target, ball impulse, keeper manual command or game result). Both goalkeepers use exactly the same mirrored policy for the 105×68m pitch. The intended position advances conservatively when the ball is far from the keeper's own goal and retreats toward the goal when the ball is close, with a provisional **2.5–9m depth inside the goal line** and an **absolute maximum 5.5m lateral patrol** projected onto the goal-to-ball angle. This is a laboratory positioning heuristic, not a calibrated keeper model or guarantee of staying on the goal line.

The existing **60Hz movement acceleration, capped 7m/s speed, heading, pitch bounds and all 22-player non-overlap rejection** remain unchanged. Goalkeepers are never eligible to become pressers, covering defenders, zonal screeners or off-ball supporting runners. An exported pure `goalkeeperPosition(team,ballPosition)` helper rejects invalid teams/nonfinite input and returns a **frozen** `{x,y,depthM}` target. Immutable 60Hz player snapshots also expose `keeperTargets:{home,away}`, recalculated for the ball position of that tick. Target positions and observed player positions are intentionally distinguished: the keeper moves gradually and **does not teleport** to the target.

The optional, initially hidden **Players (22)** observer adds read-only **Goalkeepers XY** (their actual positions) and **Keeper target depth** (intended depth), plus an unobtrusive outline around each #1 marker. The team manager cannot steer an individual or invoke a save; the only input to keeper positioning is the same legitimate ball XY that drives other autonomous agents. The unchanged ball solver `me-01-physics-v4` receives no forces or player collider bodies, official world data/D1 and production pages remain untouched.

**QA-PLAYER-07:** five Node tests verify mirrored goal targets, depth/lateral clamps and projection, invalid state rejection, safe convergence without teleportation, exclusion of goalkeeper #1 from all outfield assignments, deterministic 60Hz rapidly changing ball motion, player speed/spacing/pitch invariants, reset and **exact Rapier ball replay isolation**. Real Chrome verifies read-only first-paint actual keeper coordinates and neutral target depths, genuine autonomous movement after 2s without user input, opposite third changes producing reversed keeper target depths, unchanged no-WASD/click steering and desktop viewport/regression checks. No physical iPhone Safari signoff, authorized merge, remote database or deploy.

## ME-PLAYER-06 — teammate-aware cooperative support spacing (2026-11-10)

**Scope:** improve the previous *off-ball* corridor selection, not the authority or touch model. The 22-player Match Engine laboratory remains a purely **managerial, autonomous** simulation; no WASD, player selection, click-to-move, fictional possession, pass, shot, tackle, ball impulse or official match outcome is added. The existing **ME-PLAYER-01–05** movement, pressing, goal-side covering, zonal screening, speed/turn limits, collision rejection and deterministic 60 Hz scheduler are preserved.

When a supporting outfielder searches the two lateral targets in the **opponent's third only**, the candidate is now scored against **both real opposing players and real teammates other than the chosen runner**. Previously it considered only opponent clearance and a small preference for the formation lane. The new provisional LAB score rewards up to **6m nearest-teammate clearance** (weight **0.4**) and penalizes a candidate within that range (weight **2** per metre of shortfall). The source and a separately exported **pure scoring function** are used to test a manufactured spatial conflict: a channel 10m from an opponent but 1m from a teammate must lose to a channel 6m from an opponent and 10m from a teammate. The selected runner remains the eligible midfielder/forward nearest to the ball in formation space, with the existing 3m player-selection and 2.5m channel-selection hysteresis; it does not request the ball.

Snapshots add a finite nonnegative **`teammateClearanceM`** to each immutable `supports` assignment, sampled *before the 60Hz movement step* against other player XY positions (never estimated after movement or fabricated). The optional **Players (22)** observer panel, initially hidden, displays **Teammate spacing** alongside **Space clearance** and existing change counts; all labels and readouts are non-interactive. The candidate score expresses a *preference* to maintain team spacing, **not a guaranteed invariant of at least 6m** or a physical collision model: the existing minimum body separation remains the actual constraint.

**QA-PLAYER-06:** six new Node checks confirm the cooperative preference with a controlled crowded-lane fixture, finite input rejection, no run in neutral territory, exact sampled opponent/teammate distances, mirrored Home/Away decisions, assignment stability under small ±0.15m ball jitter, rapid opposing-third replay identity and original velocity/spatial invariants. The existing 114 Node tests and 8 DEV routing checks remain required, with one real-Chrome regression validating a live observer-only spacing readout, its initial empty state, and unaffected keyboard/pitch-click steering prohibition. No production UI, official player attributes, data writes, deploy, merge or physical Safari signoff. PR #465 stays **Draft/HOLD with one grouped commit**.

## ME-PLAYER-05 — autonomous open-space support occupation (2026-11-10)

This isolated Match Engine LAB extension adds **one autonomous off-ball supporting runner per team when the ball is in the *opposite* third**. It does **not** assert that the team owns the ball, has a passing opportunity, is attacking, or should shoot. The decision uses **real simulated opponent XY positions** and preserves the original pressing, covering and zonal screening responsibilities: eligible agents must be midfielders or forwards and may not simultaneously hold those roles.

The chosen free agent follows two possible channels **8 m behind the ball** and **11 m to either side**, clamped to the pitch. Each candidate channel is scored using actual minimum distance to opponent positions, with a small formation-lane preference. Stable player/side selection uses a provisional **3 m assignment** and **2.5 m channel hysteresis** against sub-meter changes in ball position; assignments end outside the opposite third. The selected player moves toward the point through the same bounded deterministic 60Hz kinematic controller, never teleporting, moving the ball, touching a player collider, requesting a pass or directly obeying a user key. All values are exploratory LAB constants and are **not validated football tactics**.

Immutable read-only diagnostics `supports: {home, away}` expose the chosen `playerId`, lateral `lane`, frozen `target:{x,y}`, and actual sampled `clearanceM` to opposing players. `supportSwitches` records assignment/lane changes. The optional **Players (22)** panel adds "Open-space runs", "Space clearance" and "Run switches", with a distinct marker outline for an active runner; it remains invisible at initial paint and has **no steering or player selection control**. These are observations only, not management instructions or official match events.

**QA-PLAYER-05:** new Node tests cover no invented support in central territory, actual opponent-based channel choice, mirrored half-court cases, no simultaneous pressing/covering/screening assignment, lane selection stability across ±0.15 m ball jitter, safe target clamping at a touchline, deterministic rapid-third transitions, player separation and velocity limits, immutable snapshots and reset. Real Chrome inspects no default support, Home/Away support in opposite thirds and the read-only clearance/counts; all legacy ball physics replay, no-steering, viewport and route/security suites remain unchanged. No claim of real possession, validated AI, ball contact, external player data, deployment, remote DB or physical Safari QA. One cumulative PR #465 remains **Draft/HOLD**, no merge without separate authorization.

## ME-PLAYER-04 — opponent-aware, position-only zonal screen (2026-11-10)

**Why:** Previous autonomous player movement was driven by ball location and predefined formation anchors, without observation of opposing players. This research-only step introduces one **opponent-aware zonal screening defender** when the ball is in the defending team's own third and an *actual* opposing outfielder has advanced at least **10m into that team's own half** within **22m of the ball**. The deterministic selector uses opponents' currently simulated XY locations (not invented threats or ball ownership); the 30m press-entry/34m incumbent-hold precedence is also corrected so small ball oscillations do not cancel a legitimate incumbent. It assigns the nearest suitable defender by formation geometry, excluding the current ball presser and goal-side coverer. A **3m hysteresis** threshold for choosing the tracked opponent and the defender reduces assignment flicker; assignments expire when no qualifying opponent remains or the ball leaves the team's own third.

**Movement intent:** the screening defender moves via the *existing* capped 60Hz kinematic process toward a provisional position **4m goal-side** of the real opponent and **2.5m to one side of that opponent's lane**. This is an **off-ball spatial screen, not a tackle, interception, defensive duel, collision, individual instruction, ball possession event or finalized man-marking model**. All 22 agents remain autonomous with the original position, heading, speed, free-space acceleration, spacing and pitch-boundary safeguards. A proximity collision is a hard kinematic stop (not a measured physical impulse); the blocker is recorded explicitly in each player's frozen snapshot as `blockedBy`, so such stops are not incorrectly described as ordinary bounded deceleration. No gameplay changes, ball-force updates, physics tuning, goalkeeper participation, real-player data, D1 or deployment.

**Observer-only instrumentation:** immutable snapshots include `screens: {home,away}` (either null or a frozen `{defenderId,opponentId}` pairing) plus cumulative `screenSwitches`. The `Players (22)` toggle remains only a visibility option; the hidden-at-first-paint panel now reports the screening assignments and switch counts, without adding keyboard, touch steering, individual selection or direct control. Only one screening assignment per side, and none where there is no **observed** threat. Ball territory continues to be location-only, not possession.

**QA-PLAYER-04:** five Node tests check no fabricated threat at kick-off, actual opponent entry and a separate defender taking a goal-side screen, stable assignments during sub-meter ball jitter, mirrored response on the opposite team, read-only snapshot contracts, no goalkeeper or direct user controls, deterministic replay, 60Hz velocity / spatial invariants and no effect on the existing Rapier ball trajectory. Real Chrome checks initial / midfield "none" telemetry, then observes an actual incoming opponent threat and reads the displayed screen, while preserving existing viewport, routing, mobile, diagnostics and keyboard/click no-steering guards. This is a preliminary tactical heuristic, not validated football intelligence.

## ME-PLAYER-03 — automatic defensive cover & own-third compactness (2026-11-10)

**Managerial observation; zero direct player control.** When the ball enters a team's **own third**, assign one additional **covering defender** who is distinct from that team's current pressing player. The cover assignment is a deterministic nearest-formation role choice, with a **3m challenger advantage threshold** to prevent second-by-second responsibility flicker. The intended position lies **6m goal-side of the ball and 3m into a distinct lateral channel**, so the defender covers space behind the presser instead of pursuing the same ball location. The other team's cover assignment is **none** outside its own third. These movement goals are expressed only through the existing capped 60 Hz kinematic step; the ball remains unaffected.

Supporting defenders in their own third contract their lateral anchor spacing by a provisional **12%** and midfielders by **6%** in addition to the existing symmetric ball-flank narrowing, without suppressing role-based lines, speed limits, player spacing, pitch boundaries or smooth heading. Goalkeepers are never eligible for pressing/cover assignments. Both covering assignment and cumulative change counts are emitted in **frozen read-only diagnostic snapshots**. The 22-player LAB renders "Goal-side cover" and "Cover switches" only when **Players (22)** is visible, while **Players (22)** remains a view-only toggle; there are no movement keys, individual selection, ownership claims or direct managerial intervention.

These are **provisional position-based defensive rules**, not evidence that a footballer is marking an opponent or winning possession: the model has **no possession event, pass, ball touch, opponent-intent model, offside evaluation, collision impulse or final tactics configuration**. The ball's neutral territory cannot be interpreted as team possession or a definitive attack/defence phase. The only universal grass model and active \`me-01-physics-v4\` remain byte-for-byte unchanged, along with official world results.

**QA-PLAYER-03:** five Node cases check correct own-third entry/exit, distinct non-goalkeeper cover assignment, stable selection at lateral lane boundaries, a measured goal-side post-step covering position, own-third defender compactness versus an uninvolved side, fast-ball deterministic replay, pitch/velocity limits and player spacing. Real Chrome checks read-only "none" at centre, Away defender cover in the positive-X third, Home defender cover in the negative-X third, and that keyboard/pitch clicks do not steer agents. Keep PR #465 one grouped commit, Draft/HOLD, no merge/deploy/remote D1 and no implied manual Safari sign-off.

## ME-PLAYER-02 — stable pressing and measured tactical shape (2026-11-10)

**Autonomous, observational and isolated** extension of ME-PLAYER-01, inside the same cumulative Draft/HOLD PR #465. The existing 22-player 60Hz agents still follow the actual Rapier ball XY and cannot be steered by the manager. A formation-based pressing selector now applies **3m incumbent hysteresis** (if a candidate is only marginally nearer to the ball, keep the existing presser), with explicit **30m entry / 34m hold** limits. This reduces pathological 60Hz assignment flicker as the ball crosses a formation-lane midpoint. Only outfield players may press. This is tactical *intent* accounting, not actual possession or tackling.

Supporting agents retain their separate goalkeeper/defender/midfielder/forward anchor lines and now **narrow their lateral formation width gradually near either touchline**, up to a provisional 16% lane contraction, while still shifting in response to the ball. All movement remains bounded by the exact ME-PLAYER-01 velocity, acceleration, turning, pitch-edge and non-overlap constraints; no teleportation or ball impulse has been added. A frozen diagnostic snapshot exposes the neutral longitudinal ball third (home/middle/away), lateral lane (negative-Y/central/positive-Y), each side's *observed* width/depth and mean defender/midfielder/forward X lines, plus cumulative pressing assignment switches. **Ball territory explicitly does NOT imply ball ownership, attack/defence phase, or possession.** This small policy is not a finished tactical engine, offside model, player attribution or sporting rule.

**Laboratory UI:** the existing **Players (22)** button still only controls marker visibility. When shown, it additionally reports ball territory, support-line width and press-switch counts. No player select, WASD, direction buttons, click-to-move or new managerial intervention controls. It remains invisible on first paint until explicitly requested, preserving established LAB viewport geometry and all ball-only metrics.

**QA-PLAYER-02:** five new deterministic Node tests cover snapshot immutability, formation line geometry, a deliberately oscillating ball at the pressing boundary, justified presser switching, all ball thirds and lateral lanes (including clamped inputs), narrower but non-collapsed supporting lines near the flank, rapid switching stress, collision/velocity/heading safety and replay identity. Real Chrome also inspects the new read-only metrics, verifies a genuine simulated ball relocation updates the territorial label, and confirms that keyboard and pitch clicks cannot steer agents. Existing Node routing/security, real-Chrome viewport, UI and Rapier-ball isolation checks remain required. No manual Safari sign-off, new AI-licensed datasets, production API, database, deployment or merge.

## ME-PLAYER-01 — autonomous 11v11 managerial movement foundation (2026-11-10)

**Football Architect is a football management game, not a manually controlled action game.** The 22 players operate entirely autonomously. There is **no player selection, keyboard steering, WASD, on-screen D-pad or direct tactical teleport control**. The manager observes the match simulation; later authorized systems can set tactics and squad instructions, but the user never pilots an individual footballer.

`src/player-movement.mjs` creates 22 neutral placeholder agents (mirrored 4-3-3, goalkeeper/defender/midfielder/forward roles) on one 105×68m field. Each 60Hz tick uses the **actual existing simulated ball XY** to select a formation-proximity presser for each team (outfield players only), make the two opposing pressers approach their respective sides of the ball, and shift other agents' role-specific supporting positions with the ball. Non-pressers reposition rather than standing still when ball moves. Movement is deterministic with immutable snapshots, 7m/s maximum speed, bounded acceleration (9m/s²), braking (12m/s²), turn rate (6rad/s), pitch boundaries, and minimum player separation. These numbers and rudimentary behaviors are **illustrative laboratory parameters, not an approved tactical match AI or validated human biomechanics**. AI makes independent decisions in the lab; it does not execute real passes, ball possession, tackles, collision impulses, match results or formation tactics selected by a manager.

**Local-only display:** the ball-only LAB still starts with its stable first-paint layout and existing physics diagnostics. A **Players (22)** visibility toggle merely shows/hides 22 team markers, player numbering, facing and automatically chosen pressing highlights with read-only Home/Away forward coordinates; it does **not** control player behavior. The autonomous 22-player world advances alongside every ball physics tick, even while its display is hidden. Reset rewinds both systems. No Rapier ball modifications or official competition/club/roster/DB integration.

**QA-PLAYER-01:** automated Node tests verify 11v11 role initialization, absence of any direct steering/selection API, autonomous movement without user input, contextual ball-following, actual 60Hz deterministic state, velocity/turn bounds, no pitch exits or player overlaps, frozen snapshots, pathological ball input rejection, and exact independence from the `me-01-physics-v4` Rapier ball. Secure localhost-only DEV routing and real Chrome checks confirm there are **no keyboard player movement handlers, player selects or movement buttons**, while 22 markers automatically move with the simulation clock and legacy viewport/theme/dialog regression remains green. No mobile-Safari physical signoff is claimed. PR #465 stays Draft/HOLD pending merge authorization.

## ME-PHYS-26 — 3D first-impact spin and energy audit (2026-11-10)

**No physics activation or tuning.** Five *disposable* 60Hz Rapier worlds use the exact same existing match ball, collider and universal 0.80m/s² grass. Launch-only diagnostic rotation initializes no spin, +Y topspin, −Y backspin, +Z and −Z sidespin at 6 rev/s. Every launch has 4m/s forward velocity and 2m underside clearance, with no initial vertical velocity or aerodynamic force; the existing spin setter is reused with Magnus explicitly disabled. The normal LAB and gameplay remain unchanged.

At the first measured transition from negative to positive vertical velocity within the surface-contact band, capture actual before/after 3D linear/angular velocity; the same ball's contact-point tangent slip `(vx−rωy,vy+rωx)`; effective time-step vertical rebound ratio; horizontal impulse effect; spin change; and the first post-contact apex (where observed). The auditable energy ledger is `0.5*m*|v|² + 0.5*I*|ω|² + m*g*clearance` for each sampled state. Record both losses and increases; report any positive difference instead of concealing a potential solver artifact. The before/after states straddle **one full integration step**, which includes gravity and contact response: this ratio is *not* the configured material restitution, and the measured energy delta does *not* isolate a pure contact impulse. The bottom-tangent slip is a surface velocity proxy, not a Rapier contact-force output.

**Metrics → ME-PHYS-26:** five-row measured report (no spin, ±Y, ±Z) with incoming/outgoing vertical speed, first rebound height, tangent slip, outgoing forward speed, change in spin, total mechanical energy retention and separately observed positive energy gain. Existing LAB-05 2m drop and rebound reference remain untouched. The report's findings are **simulator-only**: no actual pitch-specific rebound measurement or certified ball calibration is inferred.

**QA-27:** direct Rapier Node tests cover five trajectories, first contact timing, rebound observables, signed ±Y friction/slip response, symmetric ±Z behavior, finite component energy sums and solver energy upper bound, immutable values, deterministic replay and active-LAB isolation. Secure DEV route exposes only the new diagnostic module on loopback; real Chrome verifies the five measured table rows and existing mobile/modal/theme/navigation regressions. QA is automated by the assistant, not represented as manual Safari acceptance. No change to `me-01-physics-v4`, no per-pitch variability, new data/licenses, remote D1, deploy or merge. PR #455 stays Draft/HOLD with one grouped commit.

## ME-PHYS-25 — signed side-lift input decomposition (2026-11-10)

**Read-only scientific bookkeeping of the same simulated shots — no new ball physics.** Following the ME-PHYS-24 published-trial sanity check, we need to distinguish the effect of the ball's full translational velocity input from the effect of its angular spin input. Without a matched real 3D flight measurement, these can only be separated **within each of the two provisional models**, not as real-world causal contributions. A change in velocity includes changes in **speed AND flight direction**, not speed alone.

The pure, uncalibrated module `src/lift-input-qa.mjs` consumes the **existing 24 disposable ME-PHYS-23 Rapier flights** and their now-preserved full 3D linear/angular snapshots (the same 60Hz initial and 0.8s preimpact ticks). For the +Z sidespin case and λ=0/0.20/0.50s⁻¹ in both models, it evaluates **four instantaneous force permutations** of the unchanged Magnus Y-lift law: `F(v0,ω0)`, `F(v1,ω0)`, `F(v0,ω1)` and `F(v1,ω1)`. The symmetric 2-order (Shapley) split assigns half the change along each order to the corresponding input; the two contributions sum exactly to the observed *model-evaluated instantaneous* change in Y lift. This is a mathematically exact **input accounting**, not a decomposition of the ball's trajectory or a claim that one physical mechanism has been experimentally verified.

**Metrics → ME-PHYS-25:** six-row table with launch and 0.8s signed Y-lift, velocity-vector contribution, spin-vector contribution, total change and numerical closure residual. Previous/candidate models remain separate, so their different coefficient formulas do not get mixed. The new source module does not create additional Rapier worlds or introduce any physics force, drag or torque. Active LAB state and replay are unchanged; universal grass remains 0.80m/s² and the research decision stays **NO GLOBAL CALIBRATION / HOLD**. No source-file downloads, license/data requests, remote D1, deployment or merge.

**QA-26:** Node covers deterministic pure 2×2 algebra, actual Rapier vector fidelity, closure within floating precision, signed side force, damping sensitivity, read-only active engine and malformed input guards; DEV route security ensures localhost-only access; real Chrome checks six rendered data rows, closure and existing mobile/dialog/theme/replay regressions. These software tests do not validate realism. No manual Safari sign-off is claimed.

## ME-PHYS-24 — published spin retention evidence / scientific HOLD (2026-11-10)

**One observational cross-check, no fitting or gameplay activation.** [The 2020 free-flight angular-speed study](https://www.mdpi.com/2504-3900/49/1/88) reports that **one** spinning football (trial 1, approximate text/figure values) fell from **5.8 to 5.7 rev/s over 0.8 s**, while its *translational speed* decreased from **18.8 to 14.7m/s over 1.0s**. These are **different durations**: measured angular retention ≈**98.28%** (1.72% loss) over 0.8s, compared with translational retention ≈78.19% (21.81% loss) over 1s. The authors attributed the major drop in side force mainly to loss of ball speed rather than angular speed. This is a *single approximate, unmatched specimen, vertical-axis spin* observation; it neither validates universal angular damping nor 3D top/backspin. No raw trajectory was ingested or extrapolated to a universal law.

**Only a scientific sanity gate:** the spin-retention-evidence.mjs module combines the source's two explicit interval endpoints with **actual pre-contact 0.8s Rapier angular snapshots** already measured by the isolated ME-PHYS-23 cases (no new world or force model). The three intentionally illustrative λ rates 0/0.20/0.50s⁻¹ retain about 100.0/85.21/67.03% spin over that time, or lose 0/14.79/32.97%. Hypothetical 0.20 and 0.50 lose about **8.6× and 19.1×** as much spin fraction as this one reported trial; that fact is *a mismatch flag*, **not** a fitted alternative λ nor a gameplay default. Their selected rates remain bounded research stress tests. The equivalent exponential rate from two approximate published endpoints is display-only context, not a measurement of physical torque or a calibration.

Metrics → **ME-PHYS-24** shows three rows of actual measured previous/candidate Rapier retention and loss, ratios to the single-trial loss, and an explicit **HOLD** decision. The published article is linked and the separate 0.8/1.0s time intervals are labelled. No changed constants, replay/ball physics version, pitch variants, external files, license requests, D1, deployment or merge.

**QA-25 (automatic):** focused Node tests verify literal source context, numerical ratios/units, actual 0.8s pre-impact Rapier retention in both models, immutable scientific-gate objects, malformed observation rejection, and no mutation of a live LAB world; DEV route tests verify loopback-only module access and HTML labels; real Chrome checks row values, accessible link, HOLD note, retained first-paint controls, old metrics and desktop/mobile/theme/modal behavior. Manual visual sign-off is not claimed and is not a prerequisite for this research-only iteration.

## ME-PHYS-23 — measured in-flight spin decay sensitivity (2026-11-10)

**Diagnostic-only hypothesis, NOT a physically calibrated spin law.** In Rapier v4 (and both research aerodynamic models), airborne angular velocity remains constant absent contact because aerodynamic torque is not modelled. This experiment adds a launch-only diagnostic option (rate 0–1 per second, zero default), applying exp(−λ/60) after each fixed 60Hz airborne tick. Its three cases are **0 / 0.20 / 0.50 per second**, chosen to demonstrate sensitivity, NOT measured from a football. At zero the setter is never invoked, and no roll, bounce or normal LAB scenario can activate it. The accepted physics-v4 replay and one universal 0.80m/s² grass model remain unchanged.

**24 disposable worlds:** four spin-axis directions (±Z sidespin, +Y topspin and −Y backspin) × three rates × both existing provisional aerodynamic models. Each launch starts at 15m/s forward, 10m/s vertical, 6rev/s spin. Metrics → ME-PHYS-23 reports measured spin, Y/Z at 1s and detected first impact, plus an actual spin-vs-time chart over 0–1.5s for +Z. No post-contact sample is shown as airborne. No external data, licensing, DB, player attributes, deployment, gameplay physics, version bump or merge.

**QA-24 F01–F05:** focused tests validate strict option gating, exact λ=0 old-v4 parity, reset, deterministic angular decay and energy, both model axis-sign ordering, 24 disposable Rapier worlds, active-world isolation, private route and actual Chrome pixels/mobile/dialog regressions. Human owner visual acceptance and a real measured rotational-drag dataset remain separate scientific gates.

## ME-PHYS-22 — measured 3D spin-axis comparison (2026-11-10)

**Software diagnostic only, not ball calibration.** The ME-PHYS-21 decision to retain BOTH provisional aerodynamic models is unchanged. Ten disposable 60 Hz Rapier launches compare no spin, ±Z sidespin, +Y topspin and −Y backspin (6 rev/s), always from the same forward 15 m/s and vertical 10 m/s initial velocity. The unchanged cross-product law ω × v produces opposite Y bends under ±Z spin, downward force under +Y and upward force under −Y; those effects are simulated, not evidence of a real same-specimen lift coefficient.

Advanced settings → Metrics → ME-PHYS-22 shows initial Y/Z lift, signed Y and ball-underside Z at 1 second, measured first-contact times, and a genuine pre-impact XZ elevation chart. Solid lines show the literature candidate and dashed lines the older model, all on the same metre scale. No contact/bounce samples are misrepresented as free flight. The active LAB seed, tick, replay, core physics-v4, single universal grass model (0.80 m/s²) and official world remain unchanged. No coefficient tuning, license requests, third-party source files, global Cd/Magnus, DB, deploy or merge.

**QA-23 E01–E05:** focused Node tests check 10 worlds, sample/contact fidelity and immutability, signed axis response, vertical height and contact ordering, reproducibility and active-world isolation. Route QA verifies strict loopback-only delivery; real Chrome checks table values, colored chart pixels and existing desktop/mobile/dialog regressions. These tests do not certify ball realism or scientific activation.

## ME-PHYS-21 — retain both research aerodynamics; coefficient parameterization audit (2026-11-09)

**Owner-authorized continuation / decision:** **RETAIN BOTH DIAGNOSTIC MODELS — NO GLOBAL CALIBRATION.** After the ME-PHYS-20 animation QA, avoid tuning the constants to visually reduce a 30m/s sidespin curve without an independent ball-specific measurement. The older `Cd(v)+linear capped Cl(Sp)` proxy and newer `Cd(v)+spin drag+saturating Cl(rev/s)` 2011-inspired candidate remain side-by-side research alternatives. **Neither is declared a realistic universal gameplay flight model.** No new request for license/data access; no third-party raw measurements; no gameplay/production/deploy/remote D1/merge/replay change. PR #455 remains one grouped commit, Draft/HOLD.

**Mechanistic comparison — not a fitted experiment:** The previous research lift law `Cl_old=min(0.25,0.6*Sp)`, with dimensionless `Sp=|omega_perp|*R/|v|`, explicitly decreases as forward speed increases for a fixed rpm (outside cap). [Linthorne & Patel (2011)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3737918/), citing Linthorne & Everett (2006), model a 2D punt kick with `Cl_candidate=0.25*(1-exp(-0.5*spin_rev_s))`, independent of the ball's forward speed when perpendicular spin rpm is fixed. This is an empirical 2D approximation, **not** a universal 3D force law; extending it to arbitrary 3D angular velocities is a separate hypothesis. For a 0.11m ball at +6 rev/s at exactly 30m/s horizontal, the two formulas give approximately `Sp=0.138`, `Cl_old=0.083` versus `Cl_candidate=0.238` — about **2.86×** the instantaneous lift force at the *same* velocity, density and ball frontal area. This directly explains the **direction of the difference** in the existing 30m/s Rapier animated diagnostic (1.63m versus 3.97m lateral displacement after 1s), without claiming its actual observed flight is accurate. At lower speeds, the older model can reach its 0.25 cap and exceed the candidate; neither is universally stronger.

**Code and visible decision:** `src/aero-model-review.mjs` is a **pure static** force audit across horizontal speeds **7/15/30m/s** and actual 0/3/6rev/s perpendicular side-spin. It calls the *existing* `magnusLift()` and `literatureCandidateForces()` functions at an identical 3D instantaneous state, returning dimensionless Sp, old/new Cl, old/new Cd, spin-drag increment, force magnitude ratio and immutable scientific/replay gate flags. No tuning, new Rapier simulations, force profile selection or new pitch controls. ME-PHYS-17 Metrics contains the compact **ME-PHYS-21 Coefficient parameterization audit** 9-row table and the explicit decision `RETAIN BOTH DIAGNOSTIC MODELS — NO GLOBAL CALIBRATION`, with `Gameplay approved: NO` and references to the appropriate equations. Do not present instantaneous Cl ratios as trajectory-error measurements or claim new 3D experimental validation.

**QA-22 automated:** Node verifies 0-spin exact parity, cap and spin drag units, 3 speeds × 3 rpm values, the high-speed ratio and low-speed inversion, frozen data/constant gameplay spec and no active-world state mutation. DEV routing strict host tests include the new pure module. Real Chrome verifies 9 exact table rows, formula outputs and textual HOLD/decision, plus prior source/metrics/mobile/visual UI tests. The existing literature candidate remains experimental and current matching 0.80m/s² natural grass field stays single and unchanged.

**Future decision:** maintain research-only A/B comparisons until a separate owner-authorized product decision about activating one universal default ball flight model. The two published parameterizations alone, with unmatched ball specimens, cannot select a winner or scientifically justify numeric changes to drag or Magnus. No real-flight accuracy claim is made.

## ME-PHYS-20 — visual motion correctness and accessibility QA (2026-11-09)

Continuation of #452 on the existing one-commit PR #455 Draft/HOLD. **No new physics coefficient, new simulated force, real-world calibration or dataset use.** ME-PHYS-19 visual playback had two identifiable quality defects in source review: a strict **80ms per-frame clamp** could make 1× playback slower under intermittent rendering, and a rapidly updating `role=status` could cause excessive assistive-technology announcements. The overhead zoom was also derived only from the selected spin sign, making ±Z comparison potentially shift the visual scale.

**Corrections:** `flightPlaybackWallTime()` is an exported pure monotonic timestamp helper. Playback starts from the first `requestAnimationFrame` timestamp plus the paused seek offset, respecting full elapsed presentation time instead of dropping frame gaps; it still clamps exactly to the last *recorded* contact and uses no new solver step. Pausing/resuming starts a new timestamp origin while retaining the cursor; `visibilitychange` stops animation whenever the document becomes hidden, so hidden-tab duration cannot cause an unreviewable jump. Both signs at the selected forward speed now share the same X/Y plot bounds, preserving an identical pixels-per-metre zoom across ±Z, in addition to fixed X/Y 1:1 scaling.

**Motion telemetry / accessibility:** the live visual status reports signed **previous/candidate lateral Y** and horizontal XY separation in metres at the synchronized sampled time; DOM dataset properties hold exact rounded values for QA. The per-frame status uses `aria-live=off`, while a separate visually hidden, `aria-live=polite` status announces **only airborne/contact phase transitions**, never every animation frame. Transport remains keyboard accessible, never autoplaying; Close/Escape resets, and the active LAB tick/seed and canonical game replay are never modified.

**QA-21 focused Node/Chrome:** pure tests check wall clock under 16ms and 400ms frame intervals, pause-resume offset, termination clamp, invalid times and unchanged Rapier state. Real Chrome checks 30m/s ±Z 6rev/s signed 1-second lateral Y against actual Rapier readings (old ±1.63m, candidate ±3.97m), physically identical XY scale after sign flip, continuous numeric telemetry, live-region phase-only announcements, the earlier Play/Pause/Reset/Close/Escape tests and mobile 320/390 viewport regression. Results are **software/motion consistency checks**, not proof that a real ball bends by 3.97m.

## ME-PHYS-19 — synchronized animated old-vs-candidate flight (2026-11-09)

**Owner-authorized diagnostic visual review** within issue #452 / PR #455 Draft/HOLD. This milestone makes the already observed ME-PHYS-18 pre-impact 60Hz Rapier flight paths playable, not a new aerodynamic experiment or force calibration. Match engine physics-v4, official games, one universal ball/grass with 0.80m/s² rolling resistance, default no Cd/Magnus and replay remain **unchanged**. No new licensing or data-access requests, raw external dataset imports, merge, deploy or D1 operations.

**Pure path sampler:** `src/flight-playback.mjs` exports `prepareFlightPlaybackPair(caseRow)` and `sampleFlightPlaybackPair(pair,timeS)`. It accepts a single already-measured ME-PHYS-18 same-speed +/-Z shot with previous/candidate results. Validates finite monotonic pre-contact snapshots and a first-contact point for *each* model; retains only frozen copies/references of source records. Interpolates **only within** the existing observed 0.1s pre-contact intervals and the last fixed-step contact point. When `t >= firstContactTimeS`, that ball is **frozen at first contact**, while the other may still be airborne until its separate impact. The pair's playback duration is the greater of the two contact times. Positions/elapsed times remain metres/seconds from actual Rapier diagnostics; no new force estimates, terrain variation, spin evolution model or post-bounce replay.

**Metrics → ME-PHYS-19 Synchronized shot animation — previous vs candidate:** A native speed selector (7/15/30m/s) synchronized with the ME-PHYS-18 selector, side-spin selector +Z/−Z at 6rev/s, **Play/Pause**, **Reset** and a keyboard-operable range slider (0.01s time steps). One top-down view retains **equal X/Y pixels per metre** and one side view uses separately labelled X/Z axes. Previous model = teal outline circle; candidate = amber filled circle; faint full pre-contact paths and bold visited paths share the **same time**. Contact crosses appear only after the corresponding observed first impact. Text reports both models' independent 'airborne/contact' status and contact times. No autoplay, including users with reduced-motion preferences; closing the dialog via Close/Escape cancels the animation frame and resets the animation to t=0. Selecting speed/spin also pauses and resets. The user can scrub and observe static states without starting playback; the active LAB world, its seed, simulation tick and replay are untouched.

**QA-20 automated scope:** pure tests cover synthetic 0/0.25/0.5/1.25/1.5s interpolation, independently clamped impact, malformed point streams, frozen state and all actual real-Rapier speed/spin pairs. Chrome CDP checks painted canvas pixels in both views at 1s, seek to final contact, speed/spin reset, Play/Pause measured wall time and pause invariance, Escape during playback and clean reopen, Dark/Light, responsive mobile 320/390px modal scrolling and prior LAB-01–05/ME-PHYS-07–18 regressions. No physical plausibility proof is claimed: high-speed +Z candidate 3.97m lateral deflection at 1s is the simulator's value only. No change to the literature candidate coefficients or rollout decision.

## ME-PHYS-18 — real Rapier 2D pre-impact trajectory visual QA (2026-11-09)

Continuation of issue #452 / Draft/HOLD PR #455. ME-PHYS-17 showed a substantial **computed** 1s lateral displacement difference for a 30m/s forward launch with ±6rev/s sidespin: **old 1.63m vs new 3.97m**. These numbers are real fixed-step Rapier results but are **not observed real football kicks or calibrated plausibility targets**. No experiment or publication provides a same-launch independent 3D holdout for our hybrid candidate. Accordingly, avoid tuning coefficients solely until a desired curve is achieved.

**New visual instrument:** the existing independent 18-world matrix now retains immutable **sampled pre-contact paths** (once each 6 fixed steps, i.e. 0.1s), a separately labelled first-contact point and an exactly sampled 1s position. The forward X and lateral Y coordinates are measured in metres **relative to the launch origin**; vertical Z is underside clearance above the single grass plane. Samples at or after the first Rapier-detected collision are excluded from the path, with the collision marked as a distinct endpoint. Never extend the chart through a bounce and call it free flight.

Advanced settings → Metrics → **ME-PHYS-18 Visual pre-impact shot trajectory QA** shows:
- Native launch-speed selector **7 / 15 / 30m/s**, initially 30m/s; only this graph's rendering changes (not the active LAB world).
- **Top-down XY plot with true 1:1 metric X/Y axis scale**, recalculated and labelled in pixels per metre for each speed. Curves: previous (+Z solid cyan, −Z dashed cyan), candidate (+Z solid amber, −Z dashed amber), no-spin gray. Dot = actual 1s Rapier state; cross = first contact. No artificially exaggerated lateral axes.
- Separate labelled **XZ elevation** view with independent axis scaling, for apex/flight-height context, using the same measured pre-contact positions. Color and dash conventions match top down.

**Automated QA-19** must verify three speed states produce distinct graphs but reproducible pixels on reselection, curves exist as colored **painted traces** (not legends), zero-spin old and candidate tracks are identical, opposing spins have mirrored lateral tracks, time samples progress strictly up to contact, 1s markers use the actual step, active seed/tick are preserved, Dark/Light and Close/Escape work, and 320/390px retains internal modal scrolling. The suite also guards older LAB-01–05 and ME-PHYS-07–17 results, DEV route isolation and the one shared 0.80m/s² grass profile.

**Decision:** this diagnostic QA may establish that the displayed curve accurately depicts our own solver, but **cannot establish whether the 30m/s, 6rev/s sideways bend is realistic** without an independently observed kick. The literature-informed aerodynamic candidate remains opt-in in separate launch-only diagnostics; default Cd=0/Magnus=OFF, `me-01-physics-v4`, match/world data, deployment and D1 remain untouched. No new licensing/outreach tasks, no merge without owner authorization.

## ME-PHYS-17 — one universal literature-informed aerodynamic candidate (2026-11-09)

**Owner continuation:** build a single provisional flight model **using published equations without further permission/outreach requests**. This is deliberately NOT a fitted or experimentally validated law for the eventual Football Architect ball. No raw data imported. One 430g, 11cm ball, one default 0.80m/s² grass, and one set of aerodynamics for all pitches. The canonical `me-01-physics-v4` stays unchanged with Cd=0 and Magnus OFF by default. New physics is accessible **only for disposable launch diagnostics**, not normal LAB-02, competitions, game events, D1, replay, production, deploy or merged main.

**Science versus modelling assumptions:** [Linthorne & Patel (2011), *Journal of Sports Science and Medicine* 10(1):203–214](https://pmc.ncbi.nlm.nih.gov/articles/PMC3737918/) model a goalkeeper's soccer-ball punt with a lift fit attributed there to Linthorne & Everett (2006): `Cl=0.25×(1−exp(−0.5×spin_rev_s))`, and describe an approximately `+0.014 Cd per revolution per second` spin-drag increase based on Asai et al. (2007). Those equations refer to a **2D spin orientation** and are approximations from different experiments, not calibrated coefficients from our reference ball. We extend the spin rate to the component **perpendicular** to the instantaneous 3D flight velocity for lift direction; we use total actual Rapier spin magnitude for spin drag (bounded to +0.12). The baseline remains the previous [Euro 2024-inspired Cd(v) prototype](https://kjss.sports.re.kr/v.35/2/392/21) with two measured points near 19 and 32m/s and **hypothetical** low-speed interpolation points. Consequently the combination is an **experimental hybrid**, not a measured one-ball dataset or a scientific calibration. The negative/reverse Magnus effect reported by [Ward et al. (2023)](https://doi.org/10.1007/s12283-023-00409-5) is **not** implemented; no aerodynamic torque or spin-decay law is fitted.

**New code:** `src/literature-aero-candidate.mjs` computes vector drag (opposed to velocity), transverse Magnus (along `omega × v`), `Cd=Cd(v)+min(0.12,0.014×spin_rev_s)`, `Cl=0.25×(1−exp(−0.5×perpendicular_spin_rev_s))`. It returns separate force vectors, coefficients, dot-power and immutable diagnostic provenance, with validation/bounds. `createEngine(...,{diagnosticAerodynamicProfile:'literature-2011', diagnosticMagnusSpinRadS:{x,y,z}})` selects this candidate **only on a launch**; explicit spin must be provided (zero allowed); conflicting fixed/variable drag switches and disabled Magnus are rejected to avoid double-applying forces. All coefficients are computed from **current real Rapier linvel/angvel each 60Hz step**, without mutating default physics. The option persists through `reset()`.

**A/B evidence:** `runLiteratureCandidateDiagnostics(RAPIER)` compares the new law to the previous `Cd(v)+linear capped Magnus` proxy in **18 independent Rapier worlds**: vx 7/15/30 m/s × spin 0/±6rev/s about +Z × 2 modes, matched seed, launch velocity, position and physical initial spin. It reports Cd/Cl at t=1s, signed lateral offset, apex/first-ground-contact time and first-flight XY distance. No spin leakage or sign asymmetry; zero-spin profile matches the original Cd(v) baseline. Actual simulated trajectories are evidence of solver implementation, **not held-out real-world validation**.

**UI:** Advanced settings → Metrics → **ME-PHYS-17 One-ball literature-inspired aerodynamic candidate** adds a 0–8rev/s comparison chart (current Cl curve uses explicitly fixed 20m/s for a fair spin-parameter illustration; candidate Cl uses perpendicular spin rev/s) and 9 matched A/B table rows. Claims and sources are labelled `PROVISIONAL DIAGNOSTIC — NOT A CALIBRATED UNIVERSAL BALL`. Real Chrome must verify actual colored lines, all 9 rows, notes and mobile modal scrolling. Node must test exact formulas, bounds, lift orthogonality/drag dissipation, ± spin mirror, zero-spin parity, conflicting switch rejection, reset determinism, active world isolation, and old LAB-01–05/ME-PHYS-07–16 regressions.

**Next gate:** use these tests to decide whether a candidate is plausible enough to proceed with motion/replay architecture. Do **not** promote it as an independently validated ball model or enable globally based only on synthetic A/B results. Earlier licensing/email request drafts are **not part of this milestone** and no outreach is performed. The PR stays one grouped commit Draft/HOLD, no merge/deploy/D1 without owner authorization.

## ME-PHYS-16 — Ward et al. (2023) source audit (NOT a calibration)

**New relevant source:** Ward, M., Passmore, M. A., Spencer, A., Hanson, H. & Lucas, T. (2023), *The effect of surface geometry on the aerodynamic behaviour of a football*, Sports Engineering 26:33. DOI: https://doi.org/10.1007/s12283-023-00409-5. The published article states **Creative Commons Attribution 4.0** with attribution and third-party-material exceptions; this does not authenticate any separately supplied raw dataset or automatically grant rights to non-public source files.

**What the paper actually measures:** Loughborough wind tunnel tests with nonspinning drag versus speed (typically 10–30 m/s), fixed-ball orientation force measurements, and transient spinning side-force coefficient **Cy** at **100/200/300/400 rpm**, with four repeated deceleration sweeps per spin rate and mean coefficients in 1 m/s speed bins. The same *tested 3D-printed football designs* were evaluated in multiple modes; Brazuca and Telstar18 were included as comparative real balls. At some combinations of spin and Reynolds number the side-force coefficient reverses sign (reverse Magnus). The test specimens are NOT selected Football Architect game balls, and the paper's printed curves are not an authenticated downloadable source file. The paper describes force-balance support/shaft interference and uncertainty constraints.

**Scientific correction to earlier decision logs:** it is **not** true that no experiment has ever measured drag and spinning side force on the same football specimen. Ward (2023) provides a strong experimental lead. The actual unresolved requirements are (a) an authenticated, machine-readable, *compatible* same-specimen speed/spin coefficient dataset for an explicitly selected reference specimen, (b) signed 3D force-axis mapping, calibrated uncertainties and source permission where applicable, and (c) independently observed 3D pre-contact flight tracks with full launch/spin state, held out by shot/session. The Ward article alone does not satisfy these gates. Existing gate count **1 available, 1 partial, 5 missing** remains unchanged for the selected game reference ball.

**Implementation:** Add source candidate `ward2023-geometry` to the existing ME-PHYS-13 inventory; label it **PARTIAL / no holdout**, distinguish the article's CC BY 4.0 from Soccer Ball 3D's non-commercial CC BY-NC-SA 4.0, and update single-ball gating explanations. No extra graphical panels, no coefficient curves digitized from images, no imports, no new simulated experiments. The source metadata is immutable and automatically checked by the existing Node and Chrome tests.

**Next concrete external step:** prepare a targeted, **UNSENT** request for same-specimen raw measurements and reuse permissions to the corresponding author. Confirm whether data are available separately, with data access conditions, and whether there are recorded observed spinning flight tracks for the *same* sample. Do not send emails, download raw files or activate global coefficients without owner authorization. No merge/deploy/D1/official-world change.

## ME-PHYS-15 — independent 3D flight scoring protocol, numerical test only (2026-11-09)

ME-PHYS-14 prepares time-stamped candidate tracks; ME-PHYS-15 creates the next **offline numerical comparator** without importing any third-party dataset or declaring a model scientifically calibrated. The pure `src/trajectory-validation.mjs` exports `evaluateFlightTrajectory({observed,predicted,maxGapS,coordinateConvention})` and `generateDisposableBallPrediction(RAPIER,createEngine,{scenario,options,seconds})`. Coordinates must be 3D **ball-center metres in identical xyz axes**, with a common **time origin**; input is limited to one ordered track, bounded values, finite times and no track-ID mixture. Predicted 60 Hz states are linearly interpolated only between adjacent model samples with a bounded gap; **no time extrapolation, hidden scale, rotation, translation fitting or phase inference**.

Outputs: 3D MAE/RMSE, independent X/Y/Z RMSE, maximum and endpoint error, *translation-invariant* displacement RMSE and per-observation checkpoints; all are labelled numerical and `scientificVerificationComplete:false`, `licensePermissionVerified:false`, `approvedForGameplay:false`. Unlike absolute RMSE, displacement RMSE removes a constant origin shift but does **not** correct clocks, orientation, camera triangulation error or unrecorded spin. Never compare post-impact/partial occluded tracks as an airborne aerodynamic validation without a verified impact-phase mask. See [research/trajectory-holdout-protocol.md](research/trajectory-holdout-protocol.md) for measurement and independence conditions.

Node tests use only **synthetic Rapier trajectories** to establish reproducibility, exact-zero self-comparison, known 5 m translation, drift, interpolation and input-failure handling. Identical self-comparison is a software sanity test, **not real-world predictive accuracy**. Existing gameplay (`me-01-physics-v4`, zero drag/Magnus by default and one universal 0.8m/s² grass) and all previous ME-PHYS stages remain unchanged. Metrics contains a read-only ME-PHYS-15 limitations notice; no raw import UI or external fetch. One-commit PR #455 remains Draft/HOLD, no merge, deploy, D1 or commercial dataset use.

## ME-PHYS-14 — offline triangulated ball track adapter / data-request pack (2026-11-09)

**Authorized continuation** on #452 in one grouped commit Draft/HOLD #455. Original single-ball physics v4 is untouched: 430g ball, 0.11m radius, Cd=0 and no Magnus by default, one 0.8m/s² grass profile. No real third-party dataset import, coefficient fitting, global activation, merge, deploy or D1 changes.

**Primary source:** [Soccer Ball 3D, CVPR Workshops 2026, DATA.md](https://github.com/lukaszgrad/ball3d/blob/main/DATA.md). The release declares `track/ball_3d-gt.csv` as triangulated ground-truth 3D ball position in **decimeters** (`x,y,z`) and `file_name` as a **0-based frame index**. Track segmentation uses `track_id`; video `fps` is in `sequence_metadata.json`. Velocities and accelerations, when present, are in dm/s and dm/s². **The released annotation/preprocessing/3D GT material is CC BY-NC-SA-4.0/non-commercial academic research**, so the project does NOT download or bundle the files, and access for potential game/commercial use requires written rights review. Raw broadcast footage has separate rights. Independent observed spin rates and the exact tested Trionda specimen are not documented for this dataset.

**Implementation:** `src/ball3d-trajectory-adapter.mjs` is a pure **offline** converter for an explicitly supplied *small, licensed or synthetic* CSV excerpt. It requires `file_name,track_id,x,y,z`, handles CSV quotations/escaped double-quotes, caps size/rows, rejects malformed headers, invalid numeric values, NaN/Infinity, negative/non-integer/duplicate/out-of-order frame indices within a track, and unsafe clip/track labels. Accepts numeric or rational `fps` (e.g. `30000/1001`), converts coordinates `dm/10 → m` and frame-index/`fps` → seconds, and preserves original distinct track identities as prefixed sample/track IDs. It uses the existing `inspectCalibrationDataset()` to return **format-only** validation. It does **NOT** assume recorded velocity/spin, infer Magnus from trajectory curvature, identify the physical ball, or validate source permission. All result objects keep `approvedForGameplay:false`, `licensePermissionVerified:false`, `sameSpecimenAerodynamicsVerified:false`. No data uploader, network fetch, external files or actual CVPR dataset is added.

**QA-15:** Node fake-only fixture tests cover dm→m and rational FPS, source IDs, deterministic conversion, bad/duplicate frames, malformed CSV, non-finite values, invalid clip IDs, short tracks, preservation of active Rapier state, and non-commercial research labels. DEV route-host guards enforce no public access; Chrome asserts a read-only ME-PHYS-14 panel and all prior Metrics behavior, responsive 320/390, keyboard Escape and prior LAB-01–05/ME-PHYS-07–13 regressions.

**External evidence packet:** `research/data-access-request.md` includes two **unsent** draft author/data-maintainer requests, precise experimental metadata questions, and a permission/scientific gate checklist. It does not assert availability of raw same-specimen Cd(v)+Cl(v,spin) data nor consent to use restricted benchmark files in a commercial game. Actual outreach, file access, reproduction and calibrated model selection remain separate explicit decisions.

## ME-PHYS-13 — qualification of real scientific inputs / 3D flight holdouts (2026-11-09)

**Owner-authorized research-only intake foundation**, issue #452, single-commit Draft/HOLD PR #455. The requirement is **one real-ball-derived universal Football Architect model**, but **NO** new Cd(v) or Magnus coefficients are activated. One 430g / 11cm ball, one 0.80m/s² grass, default Cd=0/no Magnus, physics-v4 replay all remain unchanged. **No raw third-party files were downloaded, bundled or distributed.** No deployment, D1 or merge.

**Source follow-up (verified 2026-11-09):**
- [Hong & Asai Trionda 2026](https://www.mdpi.com/2311-5521/11/5/128) describes six non-spinning orientations of one specimen, observed wind-tunnel Cd/Cl/Cs, and simulated flight. Its Data Availability Statement says original contributions are included *in the article*; we have **not** verified a separate machine-readable speed × spin matrix or independent measured flight holdout. Do not claim one exists or fabricate digits from plotted images.
- [Measurements of a spinning soccer ball (2020)](https://www.mdpi.com/2504-3900/49/1/88) presents observed flight/side force on a **different specimen**, including time-averaged Cs and Sp; it cannot by itself validate a Trionda Cd(v)+Cl(spin) pair.
- [CVPR Workshops 2026 Soccer Ball 3D](https://lukaszgrad.github.io/soccer-ball3d/) releases triangulated 3D reference tracks. Its [DATA.md](https://github.com/lukaszgrad/ball3d/blob/main/DATA.md) names `track/ball_3d-gt.csv` with `file_name` (0-based frame), `track_id`, `x,y,z` in **decimeters**, `x_velocity,y_velocity,z_velocity` in dm/s; sequence FPS lives in `sequence_metadata.json`. Source usage is **CC BY-NC-SA-4.0 / non-commercial academic research**, with specific raw-video restrictions. These are valuable for a future *observed flight reconstruction benchmark* but do not document the same physical Trionda specimen or measured angular velocities. Do **not** import into Football Architect's commercial/production assets or redistribute source video without legal permission.

**Machine-readable intake contract, pure offline local validator:** `src/calibration-dataset-intake.mjs` exposes frozen metadata `CALIBRATION_DATASET_CANDIDATES`, input schema `CALIBRATION_INTAKE_FIELDS`, `inspectCalibrationDataset()` and `inspectCalibrationBundle()`. Only three roles are accepted: `drag`, `spin`, `trajectory`; every dataset declares source URL, specimen identity, source/acquisition group, usage-rights description and bounded rows. Drag/spin rows require physically bounded finite speed/spin/coefficient values, uncertainty and axis; trajectory frames require distinct IDs, track ID, time in seconds and finite 3D positions in metres. Timestamps must increase per track, with at least two frames per track. Convert external dm to m and frames to seconds *before intake*, using verified dataset FPS and segment IDs. Never infer spin from a visually curved trajectory or treat flight-model predictions as ground-truth observations.

**Independence protocol:** require the same independently confirmed physical specimen for all three roles and a separate *original acquisition group* for held-out flight, not merely different row IDs or a random frame split of the same kick. The intake validator rejects mismatched declared specimen IDs, duplicate frames, missing source metadata, invalid physics fields and matched acquisition groups for holdout. It does **not** authenticate a claimed specimen or license from user-supplied strings. Any valid synthetic example is only a **structural candidate** and always returns `scientificVerificationComplete:false`, `licensePermissionVerified:false`, `approvedForGameplay:false`. Model calibration requires manual scientific/rights verification, consent/permission where required and an independent held-out predictive-error review.

**Metrics and QA-14:** Advanced settings → Metrics → **ME-PHYS-13 Verified dataset intake and flight holdout** lists three actual research sources and their different evidence roles, displays explicit source/use/rights warnings, and remains read-only. Node tests use **clearly fake synthetic fixtures only** for corrupted coordinates, timestamps, duplicate IDs, mismatched specimens and holdout leakage, plus positive *schema-only* cases proving that format validity can never approve physics. Real Chrome checks rows, legal warning, Dark/Light, Escape and mobile scroll. DEV-only module host guards and all previous LAB-01–05/ME-PHYS-07–12 regressions must remain green.

**Follow-up blocked on real data and rights:** obtain raw same-specimen Cd(speed) and direction-resolved Cs/Cl(speed,spin,axis) with uncertainty and measured spin decay, a complete initial-state log and independently recorded 3D flight trajectories. Alternatively seek permission to use Soccer Ball 3D **solely for general trajectory benchmark research**, carefully marking it as a different-specimen test, not calibration ground truth. Any global coefficient switch or replay-version change is a *separate decision*.

## ME-PHYS-12 — one-ball reference selection readiness and evidence gap (2026-11-09)

**Owner-authorized diagnostic research, not global aerodynamics calibration.** One physical fictional ball across every Football Architect match. Canonical specification **0.43 kg, radius 0.11 m**, fixed 0.80m/s² universal grass and unchanged `me-01-physics-v4`. No new game-ball species, surface/weather/stadium profiles, production drag/Magnus, official fixture changes, D1 or deployment. The scientific evidence for one universal **Cd(v)+Cl(v,spin)** law is still incomplete; do NOT mark the physics as calibrated.

**New research since ME-PHYS-11:** [Hong & Asai, *Fluids* 11(5), 128 (May 2026)](https://www.mdpi.com/2311-5521/11/5/128), *Orientation-Dependent Drag Crisis and Flight Response of the FIFA World Cup Match Ball Trionda*. One Trionda specimen, **six stationary orientations**, three wind-tunnel repeats per condition and a 7–35m/s speed scan. This is **nonspinning** wind-tunnel evidence, not a measured Magnus force curve; the authors explicitly exclude spin dynamics, aerodynamic torque and observed independent 3D landing tracks from their trajectory model. They support local **linear interpolation of measured Cd speeds**; the paper reports leave-one-out Cd reconstruction MAE **0.00111** for linear interpolation versus **0.00297/0.00220** for third/fifth-order polynomials (paper-specific reconstruction experiment, NOT a verified Football Architect predictive error).

**Same-ball orientation counterexample (paper-derived, not gameplay variation):** paper Table 2 / section 3.2:
- **A-90**: subcritical mean Cd **0.348**, supercritical **0.241**, full-range mean **0.266**; modeled 2D no-spin long-kick range **48.65 m** at `v0=30m/s`, 30° at sea level.
- **B-90**: subcritical mean Cd **0.330**, supercritical **0.201**, full-range mean **0.231**; corresponding modeled range **51.68 m**.
- Span **3.03 m** (about 6.04% of the mean of these two computed ranges) for the **SAME specimen at two fixed orientations**. These are numerical simulations based on measured speed-dependent drag, **not measured free-flight landings**, **not** two different footballs or any per-pitch effect. Real spinning balls do not remain in one frozen orientation.
- The authors' [March 2026 Trionda paper](https://www.mdpi.com/2076-3417/16/6/2808) similarly reports wind tunnel data at approximately 1m/s increments between 7–35m/s and **nonspinning** orientation comparison. The Data Availability section states underlying data are obtainable from authors on reasonable request; do not invent a downloadable joint spin dataset.

**New gated engineering artifact:** pure `src/universal-ball-readiness.mjs` stores the project's **single-ball spec** and links to sources for Euro 2024 Cd, single-Trionda same-specimen no-spin orientation results, and 2020 unrelated-specimen spin averages. It explicitly separates specimen identities, distinguishes measured Cd and Cs from derived simulation outputs, and provides **seven source-readiness gates** (1 available, 1 partial, **5 missing**). Required inputs before any global approval: a compatible **same-ball** speed-resolved Cd map including the crisis region, signed side-/top-/backspin force vs speed and spin, uncertainties, measured rotational decay and **independent observed 3D trajectories**. Altering specimen labels cannot produce a PASS automatically.

**Read-only Metrics:** Advanced settings → Metrics → **ME-PHYS-12 Single-ball calibration readiness gate** displays source-backed A-90/B-90 ranges and three regime-specific mean Cd columns, a chart with distinct static-orientation simulations and seven evidence-gate rows; prominent `CALIBRATION HOLD — EVIDENCE INCOMPLETE`, no global settings. Node tests assert exact source numbers, stage/go-no-go, source mismatch, frozen references, malicious label parity, reproducible unchanged active 60Hz Rapier world. Headless Chrome checks drawn chart colors, 2+7 rows, notes, modal Dark/Light, Escape, desktop fit, 320/390px scroll and DEV host policy. All prior LAB and ME-PHYS experiments remain unchanged.

**Next scientific gate:** paired raw Cd(speed) and directional Cs/Cl(speed,spin,axis) measurements and uncertainty for a selected specimen, with full independent held-out measured flight trajectories (including initial angular velocities). Do not fit the universal game law from different match balls' sample means or treat paper-generated trajectories as held-out measurements. No merge, deploy, D1 or replay-version change under this block.

## ME-PHYS-11 — evidence audit before selecting one universal ball (2026-11-09)

**Owner authorization:** continue scientific calibration *research and read-only diagnostics* on #452 / one-commit Draft/HOLD PR #455. This block **does not select or change** the universal game's drag/lift coefficients, canonical v4, replay, active ball, grass, official world, deployments or D1. All existing LAB-01–05 and ME-PHYS-07–10 remain intact.

**Reproducible provenance, no inferred measurements:**
- [Hong, *Korean Journal of Sport Science* 35(2), 2024, Tables 2–3](https://kjss.sports.re.kr/v.35/2/392/21): Euro 2024 football Cd = **0.21 at Re≈3×10⁵ (roughly 19m/s)** and **0.24 at Re≈5×10⁵ (roughly 32m/s)**, with reported drag-crisis speed near 12m/s. These two points are already *anchors used to construct* the ME-PHYS-08 Cd(v) prototype; a zero residual is **not independent validation** of its full curve, especially below the drag crisis.
- [Tsukuba spinning curve-kick measurements, *Proceedings* 49(1), 2020, Discussion](https://www.mdpi.com/2504-3900/49/1/88): **mean side-force coefficient Cs** and **mean spin parameter Sp** pairs `(Sp,Cs)=(0.18,0.21),(0.22,0.24),(0.34,0.29)`. The coefficients were *time-averaged per kick* in horizontal side-force analysis with approximately vertical spin axes, **not** direct instantaneous `Cl(Sp)` readings for a Euro 2024 specimen or arbitrary 3D topspin/backspin.
- Existing directional, capped **prototype** `Cl = min(0.25,0.6×Sp)` yields **0.108,0.132,0.204** at the three reported mean Sp values, hence a purely *indicative* signed Cs–Cl comparison of **−0.102,−0.108,−0.086** (prototype minus observed mean Cs). Their mean absolute difference is **0.098666…**, but this is **not a validated calibration error**: coefficient definitions, time averaging, geometry and specimens differ.
- Different ball surface constructions materially alter Cd and Magnus response ([2021 EPL football wind-tunnel analysis](https://www.nature.com/articles/s41598-021-89162-y), [2026 World Cup ball comparison](https://pubmed.ncbi.nlm.nih.gov/42437765/)). Never combine unrelated experiments into a supposedly measured **single** calibrated ball without explicit transfer assumptions and independent validation.

**Implementation:** a pure, frozen `calibration-evidence.mjs` module contains only five source-labelled anchors and a read-only comparison against the existing `speedDependentDragCd()` / current Magnus proxy slope/cap. `readAerodynamicCalibrationEvidence()` reports reference provenance, signed residuals, mean absolute *indicative* deviation, four scientific blockers and a specific future gate. It is included in `runPhysicsDiagnostics()`, shown in Advanced settings → Metrics → **ME-PHYS-11 Aerodynamic calibration evidence audit** using two new canvases and two short tables. The experimental proxy curves and source dots are visually distinct. No new physics forces, scenario flags, variants, storage, worker, remote calls, model fitting, mass/inertia or replay-version changes.

**QA-12:** exact-head focused Node validation of all five published numbers, proxy values, sign/delta arithmetic, validity bounds, frozen report, reproducibility and active-world isolation; local-only HTTP assets and CSP/host guards; headless Chrome checks two charts' *actual painted pixels*, 2+3 rows, clarity about anchor non-independence and Cs versus Cl, themes, Escape, 320/390px scrolling and unchanged world tick/seed. Do not claim Safari visual sign-off from Chrome tests.

**Readiness gate:** obtain a paired **speed × spin coefficient map for a single selected reference ball** with uncertainties, independently measured held-out flight trajectories, lift/topspin behaviour and spin decay; decide appropriate negative Magnus and drag-crisis handling. Only then propose and authorize one universal gameplay model. No merge, deploy or D1 action under this milestone.

## ME-PHYS-10 — combined Cd(v) + Magnus sensitivity, diagnostic only (2026-11-09)

**Owner-authorized research scope:** same single-commit Draft/HOLD PR #455 and issue #452. This is not a switch-on of drag/lift in gameplay, D1, public output or existing LAB-02. The canonical `me-01-physics-v4` remains unchanged.

**Matched control architecture:** `createEngine` now accepts `diagnosticAirDragModel:'speed-dependent'` and `diagnosticMagnusSpinRadS:{x,y,z}` together **only** in launch diagnostics. To compare modes without changing the ball's rotational initial condition, `diagnosticMagnusLiftEnabled:false` disables only the Magnus **force** while retaining the exact same initialized Rapier angular velocity. This strict boolean switch requires a valid diagnostic spin vector and survives `reset()`; it never changes any default simulation. For a zero-spin launch, lift has no effect. The Cd(v) curve remains bounded and sampled from real 3D speed per tick; the lift force remains perpendicular to velocity and is based on real Rapier angular speed.

**Experiment matrix:** 36 independent `60 Hz` Rapier worlds: **3 initial vx values 7/15/30m/s** × **3 initial spins (0, ±6 rev/s about Z)** × **4 modes** (no aerodynamic forces, Cd(v) only, Magnus only, Cd(v)+Magnus). All use the same seed, initial x/y/underside height, vy=0 and vz=10 (LAB-02-derived for side-spin symmetry), 430g ball, 11cm radius, gravity, windless air and single grass setting (0.80m/s²). Within each vx/spin comparison every mode receives identical initialized *physical spin*, including the no-force and drag-only controls. Normal LAB-02 remains vy=2, Cd=0, no lift.

**Metrics and scientific limits:** first-contact time, XY travel, apex height/time, lateral Y offset at 1s, actual spin at 1s, instantaneous Cd/Cl, translational kinetic + gravitational potential energy change at 1s and lift's instantaneous power (F_lift·v). Five pre-impact checkpoints (t=0/0.5/1/1.5/2s) per 4-mode group are truthfully marked `Not observed` when after contact. Symmetry, zero-spin parity, constant initial-spin matching, deterministic reset, bounded forces and absence of significant energy creation by the *transverse lift force* are tested. Rapier integration can change measured mechanical energy slightly; this observation excludes rotation and must NOT be represented as a directly integrated aerodynamic-work measurement.

**Visualization & QA:** Advanced settings → Metrics → ME-PHYS-10 adds a mid-speed matched ±Z lateral chart, four-mode distance chart, all 36 measured runs, and 45 × four-mode checkpoint table, with explicit hypothesis/source and normal physics caveats. Node and headless Chrome tests check the full matrix, parity, sign symmetry, mode flags, plot pixels, Dark/Light, Close/Escape, 320/390 mobile modal scroll, active-state preservation and existing LAB-01–05/replay/security invariants.

**Not calibrated to a real ball:** Cd(v) is a piecewise speed-dependent approximation informed by [Hong (2024)](https://kjss.sports.re.kr/v.35/2/392/21) plus hypothetical knots; the nonnegative capped `Cl=min(0.25,0.6×Sp⊥)` is an illustrative test-only law. [NASA's explanation of the Magnus direction](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-of-a-soccer-ball/) supports orientation but not the numeric coefficients. No negative Magnus, wind, weather, variable field profile, aerodynamic torque, player interaction, simulation architecture change or replay-version bump.

**Gate:** exact-head targeted and required FULL evidence, documented QA-11 Chrome acceptance. Global activation or production calibration requires a separate owner approval; never merge PR #455 under this work authorization.

## ME-PHYS-09 — Magnus side-spin / top-spin flight experiment (2026-11-09)

**Owner-authorized diagnostic only; Draft/HOLD PR #455, one grouped commit.** Initial spin is **physically assigned to the Rapier ball body**, not a cosmetic trajectory, with `createEngine(...,{diagnosticAirDragCd:0.24,diagnosticMagnusSpinRadS:{x,y,z}})`. This option accepts only a finite vector up to 80 rad/s, is strictly launch-only and cannot be combined with the speed-dependent Cd(v) sensitivity mode in this controlled comparison. Default no-spin/no-drag LAB-02 remains untouched and canonical engine snapshots/replay retain `me-01-physics-v4` without any bump or legacy resimulation.

**Physics & research:**
- [NASA soccer-ball lift](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-of-a-soccer-ball/) explains the force direction perpendicular to both ball velocity and spin axis: `F_M = 0.5 ρ A Cl |v|² unit(ω × v)`. In project coordinates `+X` is forward, `+Y` across the pitch, `+Z` up: `+Z` side-spin curves toward `+Y`; `+Y` topspin produces downward lift; `−Y` backspin produces upward lift.
- [Flight tracking (2020)](https://www.mdpi.com/2504-3900/49/1/88) measures football spin, speed and side-force coefficient with `Sp = rω/U`. [Wind tunnel study (2016)](https://www.sciencedirect.com/science/article/pii/S1877705816306361) reports dependence on spin parameter and occasional **negative Magnus** near specific Reynolds/spin conditions, which this small proxy does **not model**.
- The deliberately **uncalibrated** `Cl=min(0.25,0.6×Sp_perp)` with `Sp_perp=r|ω_perp|/|v|` is a continuous bounded, nonnegative sensitivity curve; **0.6 and 0.25 are hypotheses, not coefficients fitted to those papers.** It never claims to represent every real match ball or drag-crisis effect. The force uses measured `body.angvel()` and `body.linvel()` at each of 60Hz Rapier steps, clears persistent forces before recomputing drag + lift and applies no extra torque.

**A/B protocol:** five independent worlds, fixed seed and identical `vx=11, vy=0, vz=10`, underside `Z=0.8m`, 430g ball, 11cm radius, gravity, `Cd=0.24` and one universal 0.8m/s² grass. `vy=0` is a documented modification of LAB-02 for precise sideways mirror symmetry; the normal LAB-02 preset remains `vy=2` with no drag or Magnus. Cases: **no spin**, **+6/−6 rev/s side spin about Z**, **+6 rev/s topspin about Y**, **−6 rev/s backspin about Y**. Compare actual 1s lateral/height, spin and lift coefficient, first-contact time/XY distance, maximum underside height, spin sign symmetry and checkpoint samples **before** first ground contact. Changes in `translational kinetic + gravitational potential` energy at 1s are observed only, do not include rotational energy and do not estimate isolated Magnus work. Do not imply lift creates energy; force is perpendicular to instantaneous velocity.

**Visible diagnostic:** Advanced settings → Metrics → **ME-PHYS-09 Magnus spin / flight A/B**, with side-spin bending chart, topspin/backspin height chart, five-run metrics table, 25 checkpoint cells (honest Not observed if already landed) and spin/coefficient caveats. The panel remains localhost-only and independently scrollable; default browser first paint, active scenario/seed/tick, replay and all previously accepted experimental metrics remain unchanged. Route/security, deterministic reset, sign direction/symmetry, finite force vectors, bounded Cl, no accidental physical-profile changes, headless Chrome and normal viewport checks are in the targeted suite.

**Pending gate:** exact-head targeted and required repository CI, then **manual QA-10 M01–M05**. No merge, deploy or D1/official world modification. Selecting any universal Magnus or Cd model is a separate owner decision.

## ME-PHYS-08 — speed-dependent drag research, diagnostic only (2026-11-09)

**Owner authorized:** one experimental Cd(v) increment in #452 / Draft-HOLD PR #455. The accepted QA-08 (B01–B05) and every existing LAB-01–05, ME-PHYS-07 fixed-Cd comparison, universal grass model and canonical `me-01-physics-v4` remain unchanged. No official fixture, production drag, D1, deploy, or physics replay-version bump.

**Evidence and limits.** [Hong (2024), Korean Journal of Sport Science 35(2), pp.392–400](https://kjss.sports.re.kr/v.35/2/392/21), Euro 2024 ball wind tunnel: reported critical speed around **12 m/s**, with **Cd=0.21 at ~19 m/s** and **Cd=0.24 at ~32 m/s** (table 2–3). [NASA's soccer-ball aerodynamics explainer](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-on-a-soccer-ball/) explains why Cd varies with Reynolds number and transitions rapidly through the drag crisis. The 2026 [Goff et al.](https://www.sciencedirect.com/science/article/pii/S3051268926000577) measurements find different minimum speeds and post-critical Cd for different modern balls, reinforcing the uncertainty in transferring any one curve to a fictional universal ball.

**Diagnostic proxy, not an empirically fitted coefficient:** `speedDependentDragCd(speedMps)` uses continuous piecewise-linear interpolation with these frozen nodes:

| Instantaneous 3D airspeed (m/s) | Cd | Evidence |
| ---: | ---: | --- |
| 0 | 0.40 | hypothesis; not directly measured |
| 7 | 0.36 | hypothesis; not directly measured |
| 12 | 0.20 | illustrative transition value; **only the approximate critical speed** comes from the cited study |
| 19 | 0.21 | published Euro 2024 wind-tunnel value |
| 32 | 0.24 | published Euro 2024 wind-tunnel value |
| 35 | 0.24 | capped endpoint; **not independently measured** |

The curve is finite, continuous, positive, bounded, and clamped at higher speeds; interpolation across the critical regime is **not a replacement for a full measured Cd(v) dataset**. The low-speed nodes are test inputs designed to expose model sensitivity, **not calibrated football truth**. No selection between balls, pitches, weather or stadiums has been added.

**Isolated experiment:** use `createEngine(RAPIER,{preset:'launch',...},{diagnosticAirDragModel:'speed-dependent'})`. The new mutually exclusive enum mode cannot coexist with `diagnosticAirDragCd>0` and is rejected outside launch diagnostics. Each fixed tick clears the previous force, measures actual 3D velocity, evaluates Cd(v) and applies the same opposing quadratic drag equation as ME-PHYS-07. Default/no-option Cd=0 still takes the identical original path; `reset()` preserves model choice, and only the disposable experiment sees this model.

**Multi-speed comparison:** `runSpeedDependentDragDiagnostics` creates **nine independent fixed-seed Rapier worlds**: LAB-02-style launches with `vx=7/15/30 m/s` and unchanged initial `vy=2, vz=10`, position and ball properties, for each mode `Cd=0`, `Cd=0.24`, and `Cd(v)`. Report measured first-ground-contact time, XY distance, apex height/time, coefficients at release/1s, and the **change in actual mechanical energy from t=0 to t=1s** (not direct integrated aerodynamic work; it also contains discrete solver error). Four `0/0.5/1/1.5s` height/distance checkpoints per mode, no trajectories after first impact used for flight summaries. Changing only the launch `vx` across groups lets us test coefficient sensitivity, not claim all launch speeds are the 3D vector magnitude.

**Local UI:** Advanced settings → Metrics → **ME-PHYS-08 Speed-dependent Cd(v) research** adds an evidence-marked coefficient curve, 3-mode distance chart, nine-run metrics table, and pre-impact checkpoint table. **Clarification after QA-09:** Launch vx denotes only the X component; Cd at release and 1s is computed from the *total 3D ball speed*, including vy/vz. The Metrics footer says **no default/gameplay physics parameters are changed**, since the diagnostic does vary experimental coefficients. The dialog scrolls independently; neither current world state nor public routes are modified. Node tests validate interpolated knot continuity/bounds, invalid and conflicting modes, deterministic reset/default parity, full 3-speed finite values, no active-state mutation and energy loss against the zero-Cd baseline. Real Chrome checks render rows/charts and retain viewport/replay regressions.

**Acceptance:** targeted exact-head Node/Chrome, existing routing, and owner-visible **QA-09** of chart labels, the provenance distinction between measured and hypothesized Cd nodes, nine runs/metrics, Dark/Light/mobile modal and unchanged LAB-01–05/replay. No merge without separate authorization. A single calibrated global Cd(v) remains a *future explicit decision*, not implied by this diagnostic.

## ME-PHYS-07 — controlled aerodynamic drag A/B, diagnostic only (2026-11-09)

**Owner accepted QA-06 and QA-07, then authorized an isolated aerodynamic drag experiment.** No production drag setting has been selected, no other forces are introduced, and no prior default behavior is changed. The accepted `me-01-physics-v4` identity continues to describe LAB-01–05.

**Physical equation and input scope:** `F_drag=-0.5*rho*Cd*A*|v|*v`, with `rho=1.225 kg/m³`, projected ball area `A=π*(0.11m)²`, ball mass `m=0.43kg`. This is quadratic air resistance opposite actual ball velocity, based on the [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/). There is **no wind vector, Magnus/side-force lift, variable air density, or field-condition setting**.

**Literature candidate, not a validated global value:** `Cd=0.24` is an illustrative constant for a non-spinning soccer ball. [Goff et al. (2026), Nike Flight vs Puma Orbita](https://www.sciencedirect.com/science/article/pii/S3051268926000577) measured a Nike ball average `Cd≈0.244` over the **18–35m/s post-critical regime**, whereas the accepted LAB-02 launch has initial `|v|≈15m/s`; therefore **the study does not directly calibrate this experiment's launch speed**. Drag crisis and panel design can make Cd speed-dependent. The numerical trial is a controlled sensitivity example, *not* a measured Football Architect ball's universal aerodynamic profile.

**Rapier safety:** `createEngine(RAPIER,scenario,{diagnosticAirDragCd})` rejects nonfinite/out-of-range Cd values (0–0.6) and Cd>0 on non-launch presets. The default is `Cd=0`, so LAB-01–05 and canonical replay remain untouched. Drag is applied only above the surface, with `RigidBody.resetForces(false)` **at every tick** before computing the current velocity-dependent force; Rapier forces otherwise persist and accumulate in future steps (see [Rapier forces docs](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)). Diagnostic reset preserves Cd. Grass rolling resistance remains the **one universal** default `0.80m/s²`, independent of air experiments.

**A/B method:** independently simulate the **same LAB-02 start and seed** in two disposable Rapier worlds at 60Hz, one drag-free and one `Cd=0.24`. Continue until each trial's **first actual CCD ground contact**. Compare measured first-flight time/distance, maximum underside height and apex time, plus six pre-contact checkpoints. Never compare bounces after landing as free flight. The drag-aware contact detector checks **local one-step translation correction**, not accumulated horizontal deviation from the ideal drag-free path. Both simulations use identical restitution, mass/inertia, floor, gravity and initial position/velocity, so aerodynamic force is the **sole changed parameter**.

**UI:** Advanced settings → Metrics includes **ME-PHYS-07 · Air drag A/B experiment**, height curves and measured numbers/flight checkpoints. Default LAB-02 remains drag-free. Research caveat is visible; no gameplay drag toggle is introduced. Diagnostics remain read-only, localhost-only, and separately scrollable in the modal.

**Verification:** dedicated Node and real Chrome tests for default Cd=0 exact-replay equivalence, rejecting invalid or non-launch Cd, monotonic loss in forward travel/apex at Cd>0, correct single-step force clearing, deterministic reset/replay, absence of wind/Magnus, no active-world mutation, preserved one-field physics and prior LAB/tests. Manual **QA-08** will review drag-free vs drag-only comparison before any candidate coefficient can be approved globally. No merge, production, D1, deployment or material profiles in this phase.

## ME-PHYS-06 — drag-free airborne flight baseline (2026-11-09)

**Next controlled diagnostic slice:** LAB-02 is already an airborne 3D trajectory, but the current Rapier solver models **gravity only during flight**, with **no aerodynamic drag, wind or Magnus force**. ME-PHYS-06 quantifies that baseline before selecting/calibrating any new aerodynamic parameters. No force, gameplay data, turf coefficient, collider, seed, Z interpretation or physics replay version changes; `me-01-physics-v4` remains authoritative.

- A fresh disposable LAB-02 experiment starts with the unchanged preset `x=-18m, y=-3m, underside Z=0.80m, vx=11m/s, vy=2m/s, vz=10m/s`, gravity `-9.81m/s²`, and records fixed 60Hz snapshots over 3.5s. Measurements stop at the **first real Rapier collision** with the ground, not at a guessed landing time.
- An independent ideal continuous-time reference computes `XY(t)=XY0+vXY0*t`, `Z_under(t)=Z0+vz0*t-0.5*9.81*t²` and its exact contact/apex time. **Actual Rapier integration is semi-implicit/discrete** and may differ slightly in vertical height/time even with no aerodynamic force. The experiment reports that deviation as an observation, not as evidence for air drag.
- **Metrics → LAB-02 flight baseline** displays first contact time, first-flight horizontal distance, maximum underside height and apex time: Rapier versus the ideal reference, a height chart, and six pre-impact checkpoints at `0 / 0.25 / 0.50 / 1 / 1.50 / 2s` with horizontal and vertical errors. The comparison uses independent physics worlds; opening it does **not advance or alter** the active simulation or its canonical replay.
- Targeted Node and Chrome checks validate the absence of extra horizontal forces, numerical boundedness vs analytic flight, correct landing detection, consistent underside-clearance Z, deterministic measurement and unchanged LAB-01–05 and protected route behavior.
- **No new global aerodynamic constant is selected in this step**; before proposing air resistance or spin lift, use a traceable experiment/reference and adjust one new force at a time, retaining the single grass/pitch behavior established by ME-TURF-ONE.

## ME-TURF-ONE — one universal pitch model (owner approved 2026-11-09)

All stadiums and matches share **the same one set of grass/ground material coefficients**. Do **not** implement dry/wet pitch physics, grass-height, artificial/natural variants, stadium- or weather-specific material parameters, optional field profiles or random friction. The `0.45/0.80/1.50m/s²` sensitivity runs above are **DEV-only diagnostic comparisons**, never gameplay pitch presets. The current global baseline stays **0.80m/s²** until one future owner-approved and evidence-backed revision replaces that single value globally.

## ME-PHYS-05 — evidence-based natural-grass rolling sensitivity (2026-11-09)

**Owner-authorized, diagnostic-only natural-grass calibration gate.** After QA-05 PASS, the reference surface is **normal, level natural grass** (not artificial FIFA-certified turf). The current `GRASS_ROLL_DECELERATION=0.8 m/s²` has **not** been replaced or silently tuned: the available natural-grass evidence establishes a broad envelope, not a unique optimal constant.

### Evidence, method and limitations

- **Historical natural-grass observation:** S. W. Baker, *Standards for the Playing Quality of Artificial Turf for Association Football* (1989), [ASTM STP25348S, DOI 10.1520/STP25348S](https://store.astm.org/stp25348s.html): in six **natural-turf pitches used by professional clubs**, almost 90% of observed rolling deceleration values lay between **0.45 and 1.50 m/s²**. This is a descriptive sample from specific pitches/weather, not a universal modern-grass specification or a FIFA requirement. The midpoint is not demonstrably more correct for a generic pitch than the existing 0.8. Grass height, moisture, firmness and test method can substantially affect measured roll.
- **Modern protocol:** [FIFA Natural Playing Surfaces Programme](https://fwctickets.fifa.com/innovation/standards/natural-playing-surfaces/fifa-quality-programme-for-natural-playing-surfaces) validates natural fields by repeated measurements and **does not offer a natural-grass certification**, because conditions change with the weather. Never substitute FIFA **artificial-turf roll distance** bands or a 1-m-height ramp for a controlled **4m/s already-rolling launch**: those protocols have different initial energy and spin conditions.
- **One-coefficient A/B:** create three independent `roll`-preset 3D Rapier worlds starting at `x=0,y=0,Z=0` with **4.00 m/s** initial velocity and **100% matched initial rolling spin** (`omegaY=4/0.11≈36.36 rad/s`). Vary **only grass rolling deceleration** between the study's reference endpoints **0.45**, current **0.80**, and **1.50 m/s²**, using the `diagnosticGrassRollDecelerationMps2` *engine option*, never the normal scenario input. The option is limited to grounded roll diagnostics, accepts only finite values 0.3–2m/s², and is preserved by `reset()`. The existing default path remains exactly 0.8, as before: no physics version bump from `me-01-physics-v4`, no modified mass (430g), radius (11cm), inertia, restitution, friction or timestep.
- **Measured, not assumed:** fixed samples at **0, 0.5, 1, 2, 4, 6, 8, 10 and 12 seconds**, captured over a 13s observation window, report **horizontal speed, cumulative distance, actual bottom-contact slip**, sustained stop and distance to stop. An independent least-squares fit of the **actual speed curve from 0.5–2s** yields the observed effective rolling deceleration (which can differ slightly from the configured value due to Rapier contact and spin). The maximum slip in the regression window is reported so a poor pure-roll fit cannot be hidden.
- **UI:** Advanced settings → Metrics includes **Natural-grass sensitivity** as an independently scrolling section below the existing spin experiment. Three-color speed chart, configured-vs-measured table, stop-distance differences against 0.8 and nine checkpoints. An in-panel link provides the actual ASTM source and explicitly says the band is **not certification**.
- **Decision from currently available evidence:** **retain 0.80 m/s² as a provisional normal-grass baseline** if its *measured* steady rolling rate is inside 0.45–1.50 m/s²; the literature does not justify silently choosing 0.45 or 1.50 for the unspecified Football Architect pitch. No alternative grass or pitch profiles are planned or allowed by the owner; future evidence can only revise the one universal coefficient with separate authorization. This diagnostic makes that later calibration measurable without simultaneously retuning sliding friction.

**QA-06 / acceptance:** compare all three speed curves, measured coefficients vs setpoints, 1s and stop distances, check active world/replay unchanged, Dark/Light and no-scroll, and understand that a broad empirical envelope does not uniquely validate the current coefficient. The only real-world validation of a particular modelled pitch is a matched measurement protocol. No official match, D1, cloud deploy or merge is part of this slice.

## ME-PHYS-04 — sliding-to-rolling contact diagnostics (2026-11-09)

**Owner-authorized, controlled A/B comparison. No change to the accepted core physics constants or `me-01-physics-v4` canonical replay identity.** The initial launch, ball radius `0.11m`, mass `0.43kg`, thin-shell moment `(2/3)mr²`, restitution `0.62`, 60Hz timestep, gravity, turf friction and rolling resistance `0.8m/s²` remain frozen.

- Three **independent 4.00m/s grounded roll simulations** start at the exact same coordinates. Only the initial angular velocity differs: **0% spin** (full initial slip), **50% of pure rolling spin** (half slip), or **100% pure rolling spin** (initial contact slip ≈ 0). The compatible angular velocity is `omega = (-vy/r, vx/r, 0) × fraction`. For travel in +X, the ball rotates in +Y; the bottom contact-point slip is `(vx-r*omegaY, vy+r*omegaX)`. This defines a physically meaningful direction rather than arbitrary topspin/backspin signs.
- `createEngine(RAPIER,input,{diagnosticInitialRollFraction})` accepts a bounded fraction `0–1` **only for grounded `roll` experiments**. The default `0` invokes no extra spin setter and preserves the already-approved LAB-01–05 behavior. The option is **not** user-exposed as a normal scenario field; tests verify invalid/airborne use is rejected and diagnostic `reset()` preserves initial spin. Rapier's angular velocity is measured, not inferred from translational speed.
- Deterministic samples at **0, 0.10, 0.25, 0.50, 1, 2, 4, 6, 7 seconds** report speed, slip at the contact point, **measured angular speed (rad/s)**, cumulative XY travel, **horizontal translational kinetic energy** `0.5*m*v_xy²`, **rotational kinetic energy** `0.5*I*|omega|²`, total kinetic energy and total energy retained versus each run's own initial energy. Because matched rolling starts with *more* total energy than zero spin, the comparisons label starting spin and report both components; energy-retention percentages should not be interpreted as identical initial-energy tests.
- The **transition to nearly pure rolling** is detected only when `contact slip <= 0.10m/s` is sustained for at least **0.20 simulated seconds**, with the ball still moving and touching the grass. This is a diagnostic threshold, not a universal material law. It can be `0.00s` when rolling starts fully matched, or `Not observed` if the test window does not contain a sustained transition. Stop time and distance are separately observed over 7 seconds.
- The existing **Metrics** native modal adds a third section: slip-speed comparison chart, per-spin **roll-match/stop time, travel distance, speed at 1s, energy kept at 1s**, and the full sub-second checkpoint table (speed/slip/kinetic energy). These measurements use disposable Rapier worlds, do not mutate the active LAB-04 run, do not add any height to the main page, and do not alter official match data.
- Targeted Node and real Chrome regressions assert physically grounded initial slip `4/2/0m/s`, reproducible trajectories, no-spin compatibility with the preceding 4m/s baseline, energy accounting, monotonic speed and distance changes, preserved replay and protected routing. Manual **QA-05** will decide whether the slip/rolling response looks convincing. No friction/restitution retuning occurs until review of the measured A/B data and any grounded turf evidence.

This is a **model diagnostic**, not a real-grass certification, and it does not yet model kick impulse shape, air drag or Magnus forces.

## ME-PHYS-03 — measured bounce decay and rolling A/B (2026-11-09)

**Diagnostic-only slice. No change to physical constants, collision bodies, restitution, rolling physics, fixed timestep or canonical replay version (`me-01-physics-v4`).** Previously accepted LAB-01–05 remain unchanged.

- `match-engine/src/physics-diagnostics.mjs` creates **independent disposable Rapier worlds**, not references to the live laboratory world. Runs fixed-seed `LAB-05` from **Z=2.00m** for **15 simulated seconds**, then `LAB-04` from 0.00m underside clearance with `vx = 2.00, 4.00, 6.00m/s` for **12 simulated seconds** each.
- Each detected bounce contact records **time of impact**, elapsed time since preceding impact, **next resolved apex height** (maximum underside clearance), and a **potential-energy retention fraction** (`apex / previous apex` at the same gravity and mass). The first ratio uses the 2m drop. Below 1.5cm, tiny solver fluctuations are not falsely declared complete apexes. Impacts with no resolved apex show `Not resolved`, never a fabricated zero.
- **Sustained rest time** is the first time after which all remaining observations stay below strict near-ground/velocity thresholds, with a minimum one-second observation tail. If it cannot be established in 15 seconds, the result explicitly reads `No sustained rest observed within 15.00 s`. This is an **observational criterion**, not a physical proof of everlasting rest.
- The roll measurements report **horizontal speed, cumulative 2D path distance, and contact-point slip speed** at 0, 1, 2, 4, 8 and 12 seconds, plus final XY position. A read-only `angularVelocity()` on the engine exposes the actual Rapier angular velocity without modifying canonical snapshots, so `slip_xy=(vx-r·ωy, vy+r·ωx)` quantifies the sliding-to-rolling transition. They measure sustained stop time and distance at stop. If the ball is not observed stopping, its distance is explicitly the **distance at the end of the 12s window**, never mislabeled as the stopping distance. 4m/s is the A/B baseline, with 2m/s and 6m/s as comparisons; the original fixed `0.8m/s²` surface resistance remains frozen.
- A **Metrics** button shares the existing Advanced settings action row. It opens a compact, keyboard-accessible native modal with first-bounce sequence table, rolling speed/time curves, stop/distance comparison, and exact six-checkpoint speed/distance table. Modal content scrolls independently on short/mobile screens; the page field and Advanced settings panel retain their existing geometry and first-paint behavior. Closing the modal returns focus to Metrics. Its creation never modifies the active simulator's tick, seed or state.
- Unit/integration regressions verify all measured rows, physical monotonicity within solver tolerance, deterministic A/B results, plausible rest observations, unknown/unobserved reporting, browser modal accessibility and layout. **The observed curves remain provisional** until owner QA-04; no restitution or drag retuning is authorized by this diagnostic slice.

The intent of ME-PHYS-03 is to **measure, not adjust**, so any later calibration can modify one coefficient at a time with an explicit before/after comparison. Official fixtures, players, D1 and production routes remain isolated.

## ME-PHYS-02 — match-ball mass, shell inertia and LAB-05 bounce calibration (2026-11-09)

**Owner-authorized first calibration slice; experimental DEV-only physics, not FIFA certification.**

- **Mass:** the previous `ColliderDesc.ball(0.11).setDensity(0.4)` implies approximately `0.00223 kg`, which is over 190 times below the Law 2 match-ball mass `410–450 g`. The new constant `BALL_MASS_KG=0.43` sets a representative regulation mass explicitly. References: [IFAB Law 2](https://www.theifab.com/laws/latest/the-ball/), [Rapier collider mass properties](https://rapier.rs/docs/user_guides/javascript/colliders/).
- **Rotational inertia:** model an ideal thin spherical shell as `I=(2/3)mr²`, with `r=0.11 m` and `m=0.43 kg`, so `I≈0.00346933 kg·m²` equally about the three axes. Use Rapier's `ColliderDesc.setMassProperties`, not `setDensity`, to avoid adding a second mass. The exact mass and principal inertia **read back from the live Rapier body** must match. The collision geometry is still spherical. This is a simple inflated-ball proxy; real panel distributions and deformations remain out of scope.
- **Physics version:** `me-01-physics-v3` → **`me-01-physics-v4`** to invalidate previous-version deterministic snapshots. All other physics constants (gravity, 3D coordinates, Z underside clearance, rolling resistance `0.8 m/s²`, existing ground/ball restitution `0.62`) remain unchanged in this initial slice, enabling an A/B diagnosis rather than changing everything at once.
- **LAB-05 — Ball Bounce (2 m):** named dropdown preset, ball underside initially `Z=2.00 m` with zero initial velocity/spin; same setup height defined in the [FIFA Turf Test Method 2024-01](https://www.sporteimpianti.it/wp-content/uploads/2024/04/FIFA-TTM-I-Layout-v8.pdf). The Ball height chart shows the path as before, with an inline readout of **the first measured rebound apex** once reached.
- **Objective reference only:** [FIFA Quality Pro artificial-turf reference](https://www.asociaceut3g.cz/stahuj/FIFA-TestRequirements%204_2024I-v9.pdf) is `0.60–0.85 m` first rebound from a 2 m release under specified testing conditions. The experiment's grass collider is not necessarily certified artificial turf; a numerical match **does not validate real-life grass behavior**. Do not claim that mass change alone causes the rebound amplitude to change: for a free-falling ball under uniform gravity, mass cancels; the amplitude is mostly driven by restitution, the solver and surface model.
- **Tests:** validate actual Rapier mass and all 3 inertia principal axes, trajectory finiteness, first impact time, energy loss (first rebound lower than release), first apex range and deterministic replay after reset; preserve LAB-01 to LAB-04 regression tests, strict local-only routing and no-scroll browser layout. The first-rebound number is a calculation from fixed-step physics states, **not** a guessed fixed label.

**Deferred decisions:** more accurate football-shell construction, calibrated natural-grass restitution (including measured data), aerodynamic drag, Magnus, contact stiffness and spin. Do not merge/deploy or change official match data under this slice without separate authorization.

## ME-Z-01 — height reference: ball underside above ground (2026-11-09)

**Owner-approved input convention:** `Z` in Advanced settings and in versioned `ScenarioInput` means the **distance between the underside of the ball and the grass plane**, in metres. A ball touching the surface has `Z=0.00` and does not require a fabricated 1 cm offset. X/Y remain on the same field axes, and all velocities, collision shapes and gravity remain unchanged.

- `BALL_RADIUS = 0.11 m`; the Rapier rigid body's **physical center Z** is `toCenterHeight(input.z) = input.z + BALL_RADIUS`. Thus `Z=0.00` creates a rigid body at `center.z=0.11`, `Z=0.50` at `center.z=0.61` and `Z=2.00` at `center.z=2.11`.
- The readonly physics snapshot's `ball.position.z` remains **center-height in metres** (authoritative internal physics state). The interface, positional diagnostic, height display and elevation graph use `toGroundClearance(centerZ)=max(0,centerZ-BALL_RADIUS)`, clamping tiny contact penetration to zero. Do **not** apply this offset to X/Y or velocities. The chart baseline now represents contact of the ball's underside with the pitch.
- `PRESETS.roll.z=0.00`; `PRESETS.drop.z=3.00` and `PRESETS.launch.z=0.80` are also underside clearances. All six numeric editors retain two visible decimals and ±1 step buttons; Z allows `0.00–30.00` and rejects negative input. Real ground contact remains resolved by Rapier with numerical tolerance; there is no visual fake +1 cm gap.
- Canonical physics/replay version changes **`me-01-physics-v2` → `me-01-physics-v3`** because Z's input-to-physics mapping changed. Old v2 snapshots must never silently be replayed under the new convention.
- Tests cover the center/clearance round-trip, exact initial ground contact, nonnegative user height, negative Z rejection, all preset values and both deterministic replay and rolling friction. Chrome validates that the visible height and edited Z are both 0.00 at the start of LAB-04.

This is a coordinate-consistency correction for the private ME-01 laboratory; official scores, production fixtures, club data and the legacy simulator are untouched. Manual owner visual acceptance of the adjusted Z and pitch trajectory is still required.

## ME-GRASS-01 — grass rolling resistance evaluation (2026-11-09)

**User observation:** the ball keeps rolling indefinitely even though turf friction should reduce its speed. The original isolated physics core supplied Rapier collider `setFriction(0.65/0.45)` and restitution `0.62`, but no rolling resistance, linear damping or angular damping. Contact friction primarily opposes *sliding*. A rolling sphere in an otherwise lossless rigid-body model can continue moving with practically constant speed. This is a physics gap in the ME-01 prototype, not a UI rendering problem.

**Provisional fix (candidate, needs user physical-behaviour acceptance):**

- Introduce explicit **grass rolling deceleration `0.8 m/s²`** (`GRASS_ROLL_DECELERATION`), within the ball-deceleration range `0.45–1.5 m/s²` reported by an ASTM study of football playing surfaces (https://store.astm.org/stp25348s.html). This is a sensible *first comparison point*, not calibration/validation for every type or condition of grass.
- In Rapier's fixed `1/60 s` step, after the contact solver, apply an opposing horizontal velocity decrement `Δv = min(|v_xy|, 0.8 × dt)` **only** while the ball is near the level grass and vertical speed is low. Scale its rolling angular velocity by the same proportion, preventing persistent spin from feeding motion back through contact friction. Set horizontal movement/spin to zero beneath a small stop threshold (`0.04 m/s`), but never clamp a partial 1-unit user input.
- Airborne trajectories and falling balls are **not** affected by this turf-only rolling rule; gravity, ball radius, collisions, restitution and legacy official game scores remain unchanged.
- Physics snapshot version changes from `me-01-physics-v1` to `me-01-physics-v2`, intentionally reflecting different dynamics while retaining the same versioned replay contract.
- Add the explicit **LAB-04 — Ball Roll (Grass)** preset, starting at `x/y = 0`, `Z = 0.00 m` (underside clearance; formerly center-based `0.12 m`), `vx=4.00 m/s`, and add a compact live **Ground speed** readout in m/s. Users can test Play/Step/Reset, stop distance/time, optional changed velocity, and LAB-03 replay comparison without modifying any official football match.
- Automated tests require slowing within 1 simulated second, stopping and remaining stopped within 8 seconds, no damping in midair, bounded roll distance and same-build deterministic replay. Real headless Chrome exercises the preset, Speed readout and compare action. Other viewport and strict local-only route checks remain required.

**Limitations:** rolling speed alone is not complete football-ball realism. Slip-to-roll transitions, wet/long grass, spin, bounce restitution, aerodynamic drag, Magnus effect and FIFA-standard ball-roll measurements require later calibration with empirical data and independent approval. Do not claim full physical realism or server/Cloudflare runtime feasibility from this isolated lab.

## Simplified laboratory layout (ME-01 usability review)

The user-facing laboratory is purposefully minimal. Default view prioritizes the pitch, then the single-step controls and scenario dropdown; the right column contains the elevation chart and a closed native **Advanced settings** disclosure. Four large statistics cards, repeated version badges, diagnostic labels, duplicate section titles and other nonessential copy have been removed. Technical details and the LAB-03 deterministic replay action are preserved within Advanced settings; `id` contracts and seed/scenario logic remain unchanged. A new visible **Height** value is driven by the actual 3D engine snapshot. The lab retains Graphite & Petrol tokens, Dark/Light, original custom dropdown controls and unchanged canonical sidebar. Targeted HTML/JS assertions verify hidden advanced configuration and always-visible controls; visual QA in Chrome is still required.

## Field size maximization within desktop viewport (2026-11-09)

The owner requested another increase in the pitch size, **only while keeping the full interface in view without scrolling**. The first two percentage-based attempts exceeded the viewport at 1280×720 and 1366×768; the revised width cap uses a viewport-height offset to account for the app header, controls, and footer. The desktop canvas width now uses `min(100%,1200px,calc(154dvh - 540px))`; at 768px tall or shorter, `min(100%,1200px,calc(113dvh - 218px))` is used. At heights of 1000px and above, a 10px lower cap offset preserves footer visibility in the largest tested desktop viewport. Width is also limited by the actual left column, so the pitch never pushes the side panel out of the page. The original 105:68 proportions and complete pitch markings are unchanged.

Automated **real-browser** viewport fit checks cover **1280×720, 1366×768, 1440×900, 1600×900 and 1920×1080** with Advanced settings both open and closed. They fail on scroll overflow, clipping, unexpectedly small pitches or stretched proportions. Mobile must remain usable and may scroll instead of clipping. **Recorded Chrome measurements and the actual CI result—not the CSS alone—are the acceptance evidence.** The canonical sidebar, dark/light themes, Rapier engine and DEV-only isolation are unchanged.

## Advanced numeric controls — canonical site arrows and two-decimal display (2026-11-09)

The six Advanced settings numeric editors (X/Y/Z and Vx/Vy/Vz) no longer use browser-native number spinners. Each now uses two small **Football Architect `language-chevron` SVG arrows** in a compact site-token-styled input frame, with explicit **+1.00 / -1.00** steps. `ArrowUp` and `ArrowDown` on the focused numeric input apply the same exact ±1.00 step. An existing fractional component is retained (`3.25 → 4.25 → 3.25`), and the displayed input always uses **two decimal places** on preset load, clicking arrows, keyboard steps, and blur. Manual decimal typing remains unrestricted while editing, then is formatted to two decimals when committed. Inputs still use numeric semantics and accessible names.

Labels have been changed from wrapping `<label>` elements into **inert captions**; clicking their text no longer focuses/animates the input. Only the input surface and its arrow buttons have hover/focus styling. The Seed caption is inert as well. Arrow buttons are disabled whenever an exact full-unit step would exceed the existing core range (X ±48m, Y ±30m, Z 0.12–30m, velocities ±60m/s), rather than changing by a partial value. The bottom-limit example `Z=0.80` has a disabled -1 arrow; +1 gives `1.80`.

No numeric step restarts the physics automatically; **Apply & restart** remains the only way to commit changed inputs to the simulation. The already approved canonical sidebar, viewport fit, renderer, physical dynamics and strict DEV-only route protections remain unchanged. Node tests verify the stepping/precision rules; real Chrome DOM tests verify labels, arrow buttons, keyboard, disabled bounds and fixed-decimal values. Chrome visual parity in Dark/Light still needs owner review.

## Screen-fit refinement — larger field and compact Advanced settings (2026-11-09)

The owner requested a **slightly larger pitch while keeping the entire desktop lab visible without scrolling**, including when Advanced settings is open. The field width ceiling changes from `min(100%,640px,66dvh)` to `min(100%,740px,78dvh)`, preserving the 105:68 aspect ratio. At desktop viewport heights 720px or less, the cap is reduced to 73dvh to avoid overflowing. The local lab has tighter top/bottom workspace padding, smaller control gaps and a more compact footer; the site-wide layout is unchanged.

Advanced settings is now organized into **two single-line XYZ groups**: Position (m) and Velocity (m/s), with three small fields per row; a compact seed entry, Apply & restart and Compare replay, plus two short diagnostic lines. The replay result stays hidden until a comparison runs. The ball height chart scales with viewport height, allowing both panels to fit side by side with the larger pitch on typical desktop dimensions. Theme, canonical sidebar, scenario inputs, replay and physics remain intact.

**QA contract:** check desktop Chrome at 1280×720, 1366×768 and 1440×900, in both themes, with Advanced settings open/closed; verify the central scroll pane's `scrollHeight <= clientHeight + 1`, all buttons and the graph visible, and unchanged pitch proportions. Mobile and very short windows must continue to scroll rather than clip controls. An automated headless Chrome viewport test now measures actual scroll, field size and Advanced settings geometry at those three desktop dimensions, plus a 390px mobile fallback. **The test result must pass on the current PR head before claiming desktop no-scroll PASS; owner visual QA remains independent.**

## Fit-to-screen pitch and complete line markings (2026-11-09)

The field canvas is now **bounded by both available width and viewport height** (at most 640 CSS pixels wide and 66dvh wide on desktop), preserving the 105:68 field aspect ratio so the pitch, controls and key readouts fit normal desktop viewports without page zoom. Mobile still reflows naturally; scrolling to secondary panels may remain necessary on small devices. The green drawing area itself is centered, not a full-width empty green frame.

The standalone diagnostic drawing module `src/pitch-markings.mjs` projects physical XY coordinates using **one uniform pixels-per-meter scale**, leaving room for goals behind both goal lines. In addition to the previously shown touchlines, halfway line and center circle it now paints **both penalty areas, both 5.5 m goal areas, 11 m penalty marks, the two outside penalty arcs, center mark, all four 1 m corner arcs, and both goal frames**. These are drawn even during physics WebAssembly initialization; paths and the ball use exactly the same mapping. No physics, collision or official-world data is changed.

Advanced settings now uses the **same SVG `language-chevron` path and 180° expansion behavior** as Football Architect's standard dropdowns (not a Unicode chevron). Targeted automated tests assert geometry, ratios, correct line shapes, server routing and markup; browser visual review remains required.

## Visual interface alignment (ME-01 UI refinement)

The DEV-only page now reuses Football Architect's own `/assets/landing.css`, `/assets/app.css`, and `/assets/theme.js` (dark/light preference) alongside a small local-only `lab.css`. It uses the existing career shell classes (sidebar, topbar, page typography, panels, footer), existing `language-trigger` / `language-menu` / `language-option` dropdown presentation, and the same app theme toggles. No shared CSS or public route was changed.

Scenario and playback-speed selectors use keyboard-accessible custom listboxes: click/tap; Arrow Up/Down; Home/End; Enter/Space; Escape; Tab/outside dismissal. Selecting a scenario updates the same hidden input and starts the same physics restart as before. Speed changes still affect playback only, not the fixed timestep. JS/CSS is restricted to the local DEV handler. Verify visual parity in both themes on Chrome, at mobile widths, and via keyboard; no browser PASS is claimed by server integration tests alone.

## Canonical sidebar integrity (ME-01 navigation correction)

The initial lab page had a manually recreated sidebar. It incorrectly omitted existing **Explore, Guide, Profile and the expandable Competitions sub-navigation**. This has been replaced with **the exact sidebar from the checked-in generated `dashboard/index.html`**, extracted by a DEV-only pure renderer. It adds only **Development → Match Engine** immediately before the existing bottom/secondary group. All existing items, icons, headings, order and persisted Competitions expansion state are preserved.

The same one-item Development addition appears on existing app pages **only** in the canonical loopback app DEV server; there are no changes to public templates, generated app files, production route registry, or the LAN/shared-preview host. The lab loads the unchanged canonical sidebar CSS and evolution script. Its first-paint bootstrap derives from the same canonical source with one DEV-only adjustment so that **Match Engine**, not Dashboard, is highlighted on `/dev/match-engine`; a dedicated test asserts the remainder of the bootstrap is byte-identical. Profile navigation continues using the canonical script.

These guarantees are covered by exact-markup regression tests and local-app-vs-public/other-host route tests; actual browser QA (including responsive layout, persisted expansion, theme, keyboard, navigation) remains a separate acceptance step.

## Design and boundaries

- Physics: **3D**, meter/second units, XY ground plane, Z up, gravity Z=-9.81 m/s². `dt=1/60 s` is an experiment setting, not an approved future production gameplay frequency.
- Module: pinned `@dimforge/rapier3d-deterministic-compat@0.21.0`, embedded WASM, loaded from a **specific local node_modules path**. **No CDN or wildcard file server.** It is a *candidate* until real installation/browser/runtime tests confirm performance and reproducibility. The compatibility module is served as local `dist/rapier.mjs` (the upstream `.mjs` distribution, not the old `.es.js` filename).
- Core: `src/core.mjs` has no DOM, HTTP, D1 or Football Architect world imports. The dependency is injected behind an API boundary; coordinates and snapshots are independent of the renderer.
- Local browser: `src/lab.mjs` and `lab/index.html`, served only through explicitly allowlisted DEV routes in `tools/dev-standings-preview.mjs`. No new published paths, production routes, or site-wide bundler.
- Engine scenarios are deterministic because they do not yet draw randomness; `seed` is an input/receipt identity placeholder. `canonicalSnapshot` rounds values for inspection and comparison, not for physical stepping or security-grade attestations.
- Floor and ball restitution, friction, mass and bounce are **provisional**. ME-02 adds calibrated spin/air drag/restitution/material tests; ME-03 introduces player bodies and movement.
- Security: explicit app-host+loopback+DEV checks, no recursive directory listing, local-only source map, CSP, no public artifact changes. **Do not** silently add a LAN exception for the physical iPhone QA: agree a separate safe plan.

## Acceptance and remaining proof

**Automated:** `tests/core.test.mjs` covers input rejection, 3D gravity, ball floor contact, launch, same-build replay and scenario differences. `tests/lab-route.test.mjs` asserts strict local access and public artifact exclusion. CI is targeted to this slice. The benchmark prints metrics but **does not claim a performance threshold or Workers compatibility**.

**Manual owner QA (pending real browser run):**
- [ ] LAB-01 visually falls, makes ground contact and bounces; top-down remains stable while side view shows height.
- [ ] LAB-02 has visible horizontal movement and a height arc; changed impulse yields changed path.
- [ ] Play, Pause, Step one tick, Reset, speed factor and parameter restart work.
- [ ] LAB-03 reports identical state for unchanged input; no premature statistical validation.
- [ ] Browser console has no errors. Observe WASM loading, initialization and first usable frame.
- [ ] Responsive keyboard/focus and Safari behaviour are checked only when safely accessible.
- [ ] Report actual bundle/init/memory/tick metrics from authorized Node and browsers; do not invent measurements.
- [ ] Review failing tests or runtime incompatibilities before marking Rapier as accepted.

This prototype is not an 11v11 match engine and is **not integrated** with authoritative Football Architect match results. No merge, deploy or database operations are authorized by this README.
