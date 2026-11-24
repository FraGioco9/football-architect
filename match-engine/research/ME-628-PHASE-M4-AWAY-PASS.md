#628 — Phase M4: authentic AWAY CONTROL PASS and post-PASS run parity

## Source-bound symmetry
- Introduce an explicit AWAY CONTROL ball at (+4.96 m, 0) moving -0.3 m/s from tick zero. Mirror only the original CONTROL receiver staging and actor identity before creation. No in-flight reposition, fake event, or secondary engine.
- The existing private Rapier shoe contact bridge still captures the only same-tick START. The existing uniform policy still selects a PASS and its recipient from the observed ordered 22 players. The original executor alone applies the real impulse.
- Require the authentic selected-side #10 shoe START, original Rapier-applied impulse, `action: pass`, selected-side #9 recipient, and actual subsequent 60 Hz receiver displacement. A ball nearby or a selected side is NEVER evidence of a football pass.
- Preserve the previous HOME CONTROL and opponent-first test (opponent-first remains HOME-only); AWAY has ONLY the bounded `receive` research scene.
- `createControlledMovementLab(...,'post-pass',{side:'away'})` delegates to the same closed `createControlledActionLab(RAPIER,'control',{controlSide:'away'})`; it never imports or reconstructs a second pass policy.

## Negative controls and acceptance
- Reject AWAY CONTROL with opponent-first, side override without receiver opt-in, invalid ball sign/velocity or unsupported action-side combinations.
- Node tests verify real HOME and AWAY exclusive START at tick one, same-world executed PASS with correct original recipient, deterministic replay, read-only receiver motion and minimum 0.98 m separation. Desktop Chrome Movement LAB exposes HOME/AWAY scene selection and observed path while keeping official pass completion, possession and result false.
- M4 does not certify real opposition defending a completed pass, dynamic physical player-body collisions or the ordinary match. Phase M acceptance requires further evidence on those gates. Phase I/T/F and C2–C5/D1–D5 remain OPEN.
- Draft/HOLD #633; no Ready, merge, deployment or remote D1 changes. Safari/iPhone testing N/A for this desktop-only research LAB.
