# ME-PB-53 / Match Physics V1 B5.2–B5.3 — read-only ambiguity guard

**Status: B5.2 targeted CI PASS (633/633); B5.3 expanded matrix pushed for new exact-head CI; B5.4/final V1 acceptance remain open.**
This is DEV-only evidence, not an official match possession or gameplay contract.

`src/player-ball-ambiguity-guard.mjs` constructs its own private B4 contest
session. The only physical source is the chained local 60Hz Rapier world with
the canonical 22 players. No caller may inject a ball, frame, contact, owner,
tackle, kick, pass, impulse or release. No new physics parameter.

On each completed real step the wrapper checks the continuity of the active
Rapier shoe START/ACTIVE/END ledger, append-only B4 START/loss/acquisition
records, canonical identity/team, exact 60Hz tick, prior-owner loss and at most
one owner. Ownership requires the source's verified new START, one active shoe,
and at least the existing six qualified ticks. It detects ambiguity without
promoting a contact, a CCD position clamp, a transient or a later opponent
owner into an official tackle/interception or kick.

The output is a frozen read-only report; a nonqualifying contact remains
owner-null, while a later opposing owner after a measured free/contested gap
is only a later owner. Source failures close the session. Reset builds an
independent Rapier world; prior snapshots remain immutable.

Initial B5.2 focused tests compare against a separately stepped genuine B4
Rapier world through the known natural owner-loss/short touch/new physical
START cycle, plus a no-contact scene and closed no-injection/reset checks.
**Do not mark B5.3 or B5.4 complete on the strength of these focused tests.**
B5.3 adds `tests/player-ball-ambiguity-adversarial.test.mjs`:
- True 155-tick two-world 22-player Rapier A/B identity for ball, foot
  START/ACTIVE/END, owner and loss/acquisition; explicit onset 1, control 7,
  stability loss 15, physical END 19, short opposing contact 127–130,
  fresh START 141, next owner 146 with 130 free/contested ticks and NO
  inferred direct tackle/interception.
- True no-touch world and independent deterministic replay.
- Independent true 22-shoe Rapier **bounce** using B1 authority, never
  passing a forged bounce through the **roll-only** B2→B5 session. Airborne
  control is always null; the measured ball returns to the turf.
- **SYNTHETIC UNIT NEGATIVES ONLY**: same-tick START+END and dual shoe
  entries; malformed IDs, versions, duplicate events, timestamps, nonfinite
  motion, mismatched prior ownership and physical clock. These are not
  real simultaneous shoe contact observations.
- B5 trusted session replay/reset, immutable per-tick evidence, quarantined
  injection arguments, and global-response 0.85/1.00/1.15 A/B with only
  one scalar for every shoe/player/pitch.

B5.3 requires new exact-head focused tests before final PASS attribution.
B5.4 separately requires broad CI acceptance, including resolving any
unrelated Browser QA FULL evidence blocker. Existing Browser timeout on
B5.2 head `119a770`: `tests/int24-browser-qa.mjs:51` stats waitForFunction,
not proven caused by this isolated Match Engine code. No blind FULL retries.

No change to `src/core.mjs`, LAB UI, gameplay, player data, scoring,
boots/turf, remote D1, Preview or production. PR #481 remains Draft/HOLD.

Tracking: https://github.com/FraGioco9/football-architect/issues/480
