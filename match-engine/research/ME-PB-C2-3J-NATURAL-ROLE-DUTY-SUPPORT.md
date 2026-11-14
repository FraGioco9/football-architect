# C2.3j — Natural pass-support / pressing role provenance

Issue #480, Draft/HOLD PR #481. This is a source-matched extension of
the accepted C2.3i independent 22-player Rapier HOME/AWAY natural
720-tick replay. No new formation, movement decision, role override,
shot zone, shoe collider, impulse or scoring authority.

Bounded checkpoints: physical ticks 520, 530, 532, 533, 546, 567,
600, 640, 680, 690, 693, 694, 695, 700 and 720. For each:
- Use canonical same-tick `contactDecisionObservation.duties` to
  report the actual movement duty of attacking #9, attacking #10 and
  defending #7, paired with **real** post-step Rapier actor XY and gap
  to the same measured ball XY.
- Capture the existing genuine post-PASS attack-support-run actor,
  team, originating physical shoe PASS tick, lifetime (at most 240
  ticks), real tactical target, chosen movement phase and ball gap.
- Preserve original same-tick shoe START IDs and applied physical action.
- Independently count frames carrying a valid support-run for the
  trial's team and last actual source pass tick.

Goal: diagnose whether ordinary tactic support expired or was
assigned to a different forward before the AWAY last-35m near miss at
tick 693, and why the defending HOME-7 arrived first and genuinely
passed at tick 694. **All findings remain measurements, not authority
for a policy change.** Do not call body proximity a shoe contact or
change game success, possession or scoring fields.

No new human-approved tactical rule is inferred. C2.3/C2 remain
OPEN until authentic natural HOME/AWAY shoe-selected shots; C3/C4
gameplay qualification also requires separately approved football
rules. Top-level remains 11/20 (55%).

Acceptance requires targeted exact-HEAD Rapier/Node/Chrome QA; no
merge, deploy, Preview publication, remote D1 or generated players.
