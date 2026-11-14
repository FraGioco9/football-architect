# ME-PB-52 — B4 lost / contested / later-owner audit (Match Physics V1)

**Draft/HOLD diagnostic only**. No gameplay promotion, network authority,
match possession counters, interception, tackles, scripted player actions,
new ball forces, shoe profiles, turf types or more physics tuning knobs.

## Physical authority and meaning

`src/player-ball-contest.mjs` builds a **private** B3 carry/release
session, which itself owns the trusted B2 60Hz Rapier world and
22-player canonical movement. It cannot accept an externally
supplied collision frame, ownership override, challenge or kick.

For each genuine completed physics tick, the observer verifies:

- Only one *local* owner after a real Rapier shoe START followed by
  at least six measured stable co-motion frames.
- The prior owner can be lost **BEFORE** shoe END due to physical
  instability. A contact beginning or continuing without qualified
  stability is `contested`, owner null; multiple active shoes must
  also always be contested and have no owner.
- A rising physical ball outside the existing foot-control height
  cannot retain an owner. No new height or material parameter is
  introduced, and the airborne guard uses the existing B1 constant.
- If another player later becomes a qualified owner, their exact
  physical shoe START is found in the private, cumulative Rapier event
  ledger. Acquisition must follow a real prior control loss and
  require the existing six stable ticks; there can never be a
  direct owner-to-owner jump during one physics step.
- When the new owner belongs to the opposing team **after a period
  of free ball**, record only
  `later-owner-after-prior-control-loss`. Do **NOT** declare a direct
  interception, tackle, physical pass, or official possession transfer.
  The genuine intermediate physical frames are preserved.

The append-only real START, owner-loss and acquisition records are
immutable and reproducible. A `reset()` creates a fresh, independent
physical B3/B2 world; `dispose()` closes the old session; no external
`step({playerId})` or `step({contact})` is allowed.

## Evidence and limits

The pinned 22-player rolling Rapier world has actual Away #10 shoe
START tick1, qualified local control tick7, loss to unstable co-motion
tick15, real shoe END tick19, then >100 ticks with no owner.
Home #10 contacts the same ball at tick127–130, but does not receive
control. After a **new** real shoe START tick141, Home #10 can become
a legitimate *later* local owner at tick146. This is an opponent
next-owner case, NOT a defender physically stealing a ball while
the previous player still controls it.

The integrated test compares B4 against a **separately stepped B3**
Rapier world at every 60Hz tick, and includes a true independently
launched Rapier bounce world with the existing B1 airborne-control
guard. A deliberately constructed two-shoe frame exercises
fail-closed arbitration **ONLY as a synthetic negative unit test**;
it is not claimed to be a real simultaneous Rapier contact.
Negative no-contact, reset/replay, option/input rejection and one
common scalar (0.85 / 1 / 1.15) are regression tests.

## What B4 does NOT prove

This does not demonstrate a direct active two-player tackle, a
measured collision with two shoes in the same frame, an official
interception, or possession in the production match loop.
`B5` should strengthen adversarial and ambiguous collision testing.
`C1–C5` will implement deliberate generic football actions after
the ball and its physical ownership source have been accepted.
No independent user-facing physical parameters are needed.

[Live acceptance checklist and percentages — issue #480](https://github.com/FraGioco9/football-architect/issues/480).
[Draft/HOLD PR #481](https://github.com/FraGioco9/football-architect/pull/481)
must not be merged or deployed without separate authorization;
no remote D1 writes.
