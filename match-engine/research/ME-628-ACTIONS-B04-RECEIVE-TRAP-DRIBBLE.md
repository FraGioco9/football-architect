# #628 ACTIONS-B04 — basic receive/trap and dribble attempt

User's accepted sequence: **finish real basic actions before numerical tuning**.

Two explicit Action LAB entries reuse the SINGLE canonical, original 22-player
Rapier world. **No new ball impulse code or new action executor exists**:
- **TRAP**: original HOME/AWAY #10 genuine physical PASS at tick 1,
  original #9 separate exclusive native Rapier shoe START (tick 30),
  M25's actual bounded cushioning impulse on the same real ball. Witness
  means *attempted first-touch control*, NOT completed reception or possession.
- **DRIBBLE attempt**: the identical original PASS and first TRAP plus
  an independent exclusive #9 shoe START at tick 63. The already existing
  M27/M30 source-gated 1.35 N·s actual second shoe-ball tap releases
  the ball. Native END at tick 65 and an independent authentic same-#9
  START at tick 136 are observed by M30. The ORIGINAL action at the third
  START is still CLEARANCE. Witness means a *physical multi-touch
  dribble attempt*, not successfully maintained dribble/possession.

`createBasicReceiveDribbleObserverB04` is read-only and checks genuine
current-tick shoe START, current Rapier solver manifold, source-authenticated
physical impulse, team/actor, original prior pass, M25 cushion, M30 tap,
M30 original native END + new START sequence. It cannot create a physical
event or declare possession, reception, completed trap/dribble, or match score.

Both modes are side-switchable HOME/AWAY in the SAME unified Scenario selector,
with mirrored pre-start setups and original movement/position/contact speed
limits. Original CONTROL experimental dropdown is preserved separately.
No second LAB launcher, additional Rapier World, fabricated native shoe,
teleported ball/player, or match authority.

**Open:** official ball ownership and control, competitive opponent duel,
successful dribble, goalkeeper catch, goal/out-of-play/restarts, match clock,
actual generated players/teams and full match acceptance. All numeric
parameters are intentionally provisional until base-action functionality
is complete.

PR #633 remains Draft/HOLD, no merge, Ready, deploy or D1 changes.
