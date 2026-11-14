# C2.3l — Natural HOME/AWAY physical A/B, original vs carry support

Issue #480, Draft/HOLD PR #481. Read-only test and evidence, **no
further tactical/physics modifications**.

## Question

C2.3k produced 53 *real movement-duty frames* following AWAY physical
PASS tick 292 and genuine CARRY tick 546; it did **not** produce a
natural policy-selected shot. Is the support physically useful, and
what blocks the natural shot, in both genuine home and away sessions?

## Controlled measurement

Run independently initialized Rapier fixture sessions from the
**same canonical 22-player formation and same physical ball seed**:
- HOME IT baseline vs HOME IT `autonomousCarrySupport:true`
- AWAY DE baseline vs AWAY DE `autonomousCarrySupport:true`

Both sides retain `{autonomousActions:true,autonomousCarry:true}`.
Exactly 720 true 60Hz physics ticks each. No repositioned players,
injected shoe START, extra action, teleported ball or fake shot.

Measure source-authenticated shoe START+ACTIVE, actual policy actions,
pass/carry/shot events, post-step live-ball progression relative to
each team's goal, min post-step distance to *unchanged* 35m shooting
range, shot-zone frames, attacker/defender real body-ball gaps,
post-PASS support and C2.3k relay lifetime, role assignments and
physical ball x/y/vx at fixed checkpoints 292, 480, 520, 532, 533,
546, 547, 567, 600, 640, 680, 690, 693–695, 700 and 720.

**QA finding and regression fix (C2.3l):** exact-head #43464870544
first detected a stale genuine HOME carry. The prior real CARRY
at tick212 remained stored past its 150-tick tactical validity, and
the new helper mistakenly threw TypeError instead of quietly removing
that movement authorization. This is a **valid observed expired
physical event**, not a forged source. Validate immutable Rapier
provenance first, then return null for expired/pre-PASS real carry;
future, fake or malformed sources still throw. Normal tactics and
normal ball mechanics remain unchanged. HOME may have zero relay.

Require each baseline/opt-in pair to be **identical in ball,
22 player positions, real shoe feed and authentic action** until
the first independently verified real carry-support relay event.
Never equate post-step ball geometry with genuine exclusive shoe
SHOT eligibility. No invented improvement; track negative or
unchanged delta with the same rigor as positive results.

For the AWAY unmodified baseline assert the prior known physical
tick693 0.681m shortfall and tick694 HOME #7 authentic shoe PASS.
Never require the opt-in to have any shot, nor claim C2 completion
without separately authenticated HOME + AWAY policy-selected real
shot triggers. Separate C3 dribble and C4 recovery rules remain
blocked pending dedicated approval.

## Acceptance

Register the new test in the explicit Match Engine Node test script;
exact-head targeted CI must pass, with any measured ball/duty
difference explicitly reported. Existing C2.3k independent-world
replay and full fixed suite remain intact. Parent #480 continues
at 11/20 = 55%, PR stays Draft/HOLD; no deploy, merge, remote D1
or production scoring integration.
