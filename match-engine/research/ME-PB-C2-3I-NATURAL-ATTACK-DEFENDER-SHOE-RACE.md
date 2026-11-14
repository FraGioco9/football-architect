# C2.3i — Natural attacking-third shoe/actor race (read-only)

Issue #480, cumulative Draft/HOLD PR #481. Keep exactly the canonical
unmodified 22-player HOME IT / AWAY DE scenes, two independent Rapier
worlds, real 60Hz replay, same ball drop, physical policies and forces.

Only inspect the bounded 680–704 tick window. Preserve each frame's
actual ball XY and velocity, goal-range shortfall, post-step goal lane,
nearest attacking and rival outfielder BODY-to-ball gaps, plus real
Rapier START+ACTIVE shoe IDs and the actual optional physical action.

AWAY previously came 0.681m short of entering the 35m shot region
at tick 693. A genuine opposing HOME-7 shoe PASS at tick 694 occurred.
Keep that physical event as a regression check, not an AWAY shot.

**No authorization from these observations:** body proximity is not
shoe contact, a post-step open lane is not pre-impulse eligibility,
and genuine rival contact is not an automatic interception/recovery.
Never inject a shoe, impulse, shot, player relocation or scoring event.
C2 remains OPEN pending real HOME and AWAY natural 22-player shoe shots.

Acceptance of this research subgate requires exact-HEAD test and
real-world replay CI. The top-level 11/20 milestone counter stays 55%.
