# ACTIONS-B02 — basic goalkeeper lateral dive approach and physical parry

User priority: finish BASIC actions before tuning parameters.

- Both goalkeepers use original 22-player identities; one original 60Hz mover.
- For an actual inbound goalward ball, the goalkeeper computes a lateral
  intercept *target* from current ball position/velocity. The normal mover
  still enforces acceleration, speed, turning and separation. This is an
  approach toward a dive, **not** an animated airborne dive, teleport or catch.
- A separate physical `save` attempt occurs only when the ORIGINAL keeper
  gets an exclusive authentic same-tick Rapier shoe START. Only the existing
  closed executor applies a bounded impulse to the original Rapier ball.
- The directional foot parry is a deliberately provisional basic action:
  **saveConfirmed:false**, **officialSave:false**, **officialGoal:false**.
  An actual goal stop, glove save, catch and airborne animation remain open.
- Single existing unified Scenario dropdown; separate SAVE HOME/AWAY
  before-tick-zero fixtures, no additional launcher or manual player steering.
- Acceptance: HOME/AWAY genuine native shoe START and applied impulse,
  measured keeper lateral acceleration/ball travel and 3D trajectory,
  deterministic replay, missing-contact and wrong-direction negatives,
  protected DEV route, original action scenes and Chrome UI.

No finished football result, possession award, gameplay tuning, merge, deploy
or remote database mutation.
