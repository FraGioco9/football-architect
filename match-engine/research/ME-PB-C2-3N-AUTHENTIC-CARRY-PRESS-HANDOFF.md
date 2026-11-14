# C2.3n — Bounded real-CARRY presser/support handoff (DEV-only)

## Goal / evidence

C2.3m showed genuine AWAY-10 support was still physically eligible
at tick600 (source PASS tick292, CARRY tick567) but lost assignment
because it became the nominal `presser`, despite no authenticated
ball control. On AWAY tick693 the shoe static clearance remained
2.951m; HOME-7 reached actual Rapier shoe START and PASS at 694.
C2.3l demonstrated merely extending support for 53 frames did not
improve live-ball travel or generate a genuine SHOT.

## Explicit, closed experimental policy

Local fixture only, sealed opt-in:
`{autonomousActions:true,autonomousCarry:true,
autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true}`.

When the *actual previous same-world* shoe-PASS and later physical
same-team shoe-CARRY still satisfy the existing bounded support
helper, and the forward candidate for `post-carry-support` would
be selected as that team's presser, allow the actual CARRY actor
to retain/take presser duty **only** when that exact same actor
qualifies under the standard presser selection and is within
12 metres of the *current live ball*, measured at canonical
22-player XY. Otherwise do nothing. The canonical pressing
selection, generic defensive rules and all other modes retain
their old behavior by default. The relay lasts no longer than
the inherited 150 ticks from actual carry and 480 ticks from
prior real PASS. The forward's target remains the existing
2m forward / 2.5m lateral post-CARRY support target.

The change is a duty assignment only. No pressing speed buff,
no privileged pass/shoot action, no change to 60Hz movement,
7m/s speed, separation, facing, Rapier colliders/solver,
ball impulse, 35m shot region, 2.4m shooting lane, official
possession or scoring. The actual carrier may already have
higher-priority real-CARRY chase; that is an existing real
movement intent and not a guaranteed second presser touch.

## Verification and gate

Two actual 720-tick HOME IT / AWAY DE 22-player fixture A/B
world pairs using original `autonomousCarrySupport` vs new
handoff opt-in. Independent third AWAY exact replay, genuine
Rapier shoe START+ACTIVE/physical action source audit, initial
identical physical worlds, no pre-handoff divergence, sealed
configuration rejection and RESET. Assert AWAY tick600
carries support instead of `press`; HOME remains unchanged.
**Do not** assert a successful football outcome or invent a
natural shot. Measure absolute real ball advance, 35m shot-zone
shortfall, real shoe START, genuine SHOOT, and role continuity.
C2 top-level gate still 11/20 (55%) until an actual source-
authenticated natural HOME and AWAY SHOT; C3/C4 independent.

No merge or deploy or remote D1. One cumulative Draft/HOLD PR #481.

## First exact-head QA correction

The first C2.3n registered Node run #43470638505 failed only in the
new forensic test: at tick567 another genuine physical CARRY START
occurred, but that frame's 60Hz *pre-step movement* still cited the
prior authenticated CARRY tick546. The test incorrectly treated the
just-produced tick567 CARRY as the source of the movement that preceded
it. The correction considers only source PASS/CARRY events with
`action.tick < frame.physicsTick` when checking support provenance.
This is a test-only chronology fix. The actual mover, Rapier physics,
football action policy and opt-in tactical branch are unchanged.
