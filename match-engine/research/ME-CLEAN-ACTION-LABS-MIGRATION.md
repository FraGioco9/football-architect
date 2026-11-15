# Action LAB clean migration — source-bound adaptation of #621

Issue #620, original [Draft/HOLD #621](https://github.com/FraGioco9/football-architect/pull/621), cleanup chain [#622](https://github.com/FraGioco9/football-architect/pull/622) → [#624](https://github.com/FraGioco9/football-architect/pull/624) → [#626](https://github.com/FraGioco9/football-architect/pull/626).

## Scope and reason

Do not retarget the historical #621 directly to #626: its branch contains the 71+ research commits from original Draft #481 and imports optional tactical/universal-world code not in the clean foundation. The new **cleanly based** small Draft branch copies the action-menu, compact dialog and genuine-physics readouts, but intentionally replaces the old `createUniversalMatchBallSession` and legacy reception/exchange simulators.

All five Action LABs instantiate exactly **one** `createEngine` from the clean core, with **both** opt-ins `diagnosticPlayerFootContactsEnabled:true` and `diagnosticAutonomousFixtureActionEnabled:true`. They use only the existing canonical `createPlayerMovement()` for real 22-player 60Hz foot frames, and actual `footContactSnapshot()` + `uniformAutonomousActionSnapshot()`. The separate prior physics LAB engine is disposed while the dialog is open and reinitialized on close. No new ball world, artificial START, manually injected impulse, official scores, possession, tackle or dribble confirmation.

## Five LABs: distinguish presentation from acceptance

- PASS: original shoe-origin pass. **Must have** one genuine Rapier START + applied same-tick impulse. HOME mirrored source tests in the clean core and original #626 HOME/AWAY private action test prove this baseline.
- SHOT: the canonical starting formation has no player automatically in the attacking-third shot window. Merely placing the ball at x=30 **does not stage a real shoe shot**. Render as **unobserved** until a genuinely eligible shoe START and open original shot lane. Additional controlled HOME/AWAY starting arrangements and actual SHOT flight witness remain OPEN.
- CHALLENGE: physically measured AWAY foot-ball START is an opponent's foot collision, **not** a tackle, interception or change in possession. Do not infer defensive success.
- CONTROL: needs a **separate same-team receiving shoe START after a real prior pass**; the old bespoke local receive script is not copied. No trap, official possession or pass completion is awarded.
- CARRY: allows the original bounded carry action flag, but only a genuine chosen `carry` plus the same-tick shoe START and Rapier impulse counts; if original physical policy instead selects PASS, **do not award dribble**.

The scenario catalog and controller are pure/DEV-only; the classifier only validates structural source records. Their physical origin is trusted exclusively when they come from the encapsulated Rapier engine. The Chrome UI must show **Waiting/No witness** when the real action has not occurred.

## QA and incomplete work

- [ ] Current clean-stack exact-head targeted Node and Chrome PASS, no regressions in original LAB
- [ ] PASS positive physical witness, Chrome verified
- [ ] CONTROL receiving shoe witness without legacy simulator
- [ ] SHOT HOME/AWAY staged physical positive, 3D trajectory after authentic real shoe START
- [ ] CARRY source-bound positive, contested vs unopposed negative
- [ ] CHALLENGE opposing real contact (no successful tackle), negative/no-contact/ambiguous START
- [ ] Full Chrome + iPhone Safari manual QA after positive scenarios
- [ ] Once independently approved, integrate in dependency order and retire old #621 without losing its original research

Do not mark #480 C2/C3/C4 complete. The old accepted 11/20 technical count is unchanged. All PRs remain Draft/HOLD; no merging, deployment or remote DB writes.
