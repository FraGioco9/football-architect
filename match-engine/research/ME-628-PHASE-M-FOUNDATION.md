# ME-NEXT #628 — Phase M1: individual 60 Hz kinematic source extraction

**Scope:** first bounded foundation slice, on a standalone main-based Draft/HOLD PR. No changes to football decisions, tactics, results, official match API, Rapier ball or physical shoe contact.

## Implementation
- The existing canonical 22-player mover retains identities, observed XY, autonomous target assignment, the 0.98 m separation guard, deterministic replay and reset.
- The previously inline free-space acceleration, braking, speed cap, pitch clamping and facing functions now live in `src/individual-kinematics.mjs`. Identical 60 Hz parameter values are used and the canonical mover runs collision rejection before updating orientation.
- The new module is served on the explicit DEV-only import route and is not included in public publication paths.
- Node regressions cover mirrored HOME/AWAY progress, braking, turning, pitch limits, invalid numeric evidence, and canonical 22-player deterministic replay. CI exact-head targeted and desktop Chrome acceptance are still required.

## Not yet certified
This is a behavior-preserving source extraction, **not** a new football result or completed Phase M. Controlled movement scenario menu and independently verified approach/deceleration/turn/support/after-pass/recovery cases remain next Phase M work. C2–C5 and D1–D5 remain OPEN. Do not infer ball contact or official outcomes from movement goals.
