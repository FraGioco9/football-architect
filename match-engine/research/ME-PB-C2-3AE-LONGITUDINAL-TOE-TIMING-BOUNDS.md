# C2.3ae — genuine Rapier closest shoe toe timing: optimistic longitudinal budget (read-only)

## Goal
C2.3ad's TARGETED exact-head 771/771 PASS established that among the six actual
AWAY physical modes the best previously accepted C2.3aa geometry reaches a
retrospective **0.0995m** sampled static surface clearance at tick668,
fraction **0.625** (10.4ms into a real 60Hz physical interval).
The actual ball sits **+0.3310m ahead of the oriented shoe centre**, versus
the existing 0.105m forward shoe core half-length, and also has -0.0918m
local lateral and +0.0175m local vertical offsets. None of these proxy
measurements constitutes a true Rapier START or a natural SHOT; the 35m
shot-zone deficit is still 0.681m.

## Implementation
Reuse exactly the **12 real 720-tick 22-player HOME/AWAY Rapier worlds** and
13th independent AWAY replay already registered in
tests/player-ball-carry-foot-lateral-lead-ab.test.mjs. No additional full
physics simulations or runtime, AI, collider, movement, ball, policy, scoring
or production changes. For each 650–690 authentic-source AWAY step, take
the C2.3ad actual-before/after shoe + ball frames and its interpolated
closest surface sample. Express the distance of the ball in *front of the
toe*, or behind the heel, relative to the same existing shoe half-length,
0.020m rounding and 0.110m ball radius. The ball's remaining exterior
lateral/vertical distance consumes a coupled share of the fixed 0.130m
rounded-shoe-plus-ball geometry envelope. Explicitly report frames where
**forward displacement alone** could never bridge that lateral/vertical miss.

For the positive longitudinal deficit, derive a purely optimistic
lower-bound time 1000*distance/7 milliseconds and compare it with
(1 - retrospective_fraction)*1000/60 milliseconds left in the same
interpolated frame. The simplifying assumptions are deliberately generous:
**frozen ball, immediate maximum 7m/s, perfect alignment and no turn or
acceleration cost**. These are NOT actual physical opportunity windows;
the real ball moves and the shoe changes angle. A positive/negative
budget flag only describes this counterfactual. Preserve the original
read-only physical witness, genuine Rapier shoe START/ACTIVE, 35m shooting
policy, source authentication and independent replay.

## QA and acceptance
A new pure adversarial unit test checks a 0.100m toe deficit with a 6.25ms
frame remainder, a fully reachable control, an orthogonal-axis miss where
forward translation alone cannot close, a heel-side miss, malformed/future
fractions and nonfinite inputs. Keep one registered existing physical test
(the script already lists it) and compact per-mode counts, best real-sample
metrics and fixed checkpoint evidence; no invented shoe event/goal or
conclusion based on hypothetical swept geometry. Full exact-HEAD registered
ME-01 plus independent FULL/Site/Browser/Admin evidence are required before
claiming acceptance. The parent C2 gate stays OPEN, **11/20 (55%)**, until
physical shoe START plus naturally selected shot policy is genuinely
observed; do not merge/deploy/Preview or access remote D1.
