# #628 B06b-H2b2b1 — original live player SHOT under the match referee

## Objective
Move the **existing** uniform 22-player Rapier native SHOT selector into the **actual private B06b 60Hz regulated match session**, without importing any extra simulator or declaring an unearned score. This is the first bounded, source-positive on-field player action within B06b. All 90-minute and earlier H1/H2a/H2b2a defaults must stay exactly as before.

### Real source and geometry
- Opt-in `researchLiveShotSide='home'|'away'` for a **shortened, non-opening, DEV-only** original-world fixture. Original ball starts at x=±30, y=0, **initial vx=vy=vz=0**, so the ball is not moving toward goal before a player actually kicks it.
- Existing `initialResearchShotLineup` is reused in both original core and mover: original #10 is placed 0.28 m behind the ball **only before physical tick zero**. All 22 IDs, roles, 60Hz movement, player separation, canonical Rapier foot solver and the existing uniform action policy are unchanged.
- The existing `createPrivatePhysicalActionExecutor` applies its own original same-ball SHOT impulse only if the authentic native single shoe START and football policy allow it. The same original B05 referee sees the action as authenticated `lastVerifiedTouch`.
- The original read-only B06 timeline independently rechecks the original policy action shape, assigned team/player, same-tick Rapier solver manifold, exclusive shoe START, ball coordinates, real applied impulse, and two distinct clocks before recording `native-shot-physical-attempt`.
- This is **not** a goal, shot on target, possession, save, legal match or scorer attribution. A future goal, if any, is determined **only** by subsequent original full-ball crossing B05/B06 evidence. The goal line is never inferred from the action name.
- During halftime/dead-ball pauses only, the original action executor advances its one real tick without applying an unrelated uniform impulse. The same original separate native kickoff source is still required, preventing double kicks on one authentic shoe START.
- `fullFootballActionCoverageVerified:false`, `realFull90MinutesVerified:false`, `officialMatchResult:null`. This is no official match authority or database access.

### Scope and next blocks
A source-positive **SHOT attempt** under a running B06b match clock and B05 referee is progress, not closure of H2b2b. Still required: a player-origin physical shot that subsequently crosses the goal line, verified scoring touch or conservative ambiguity, multiple genuine actions and separate restarts/throw-ins/corners/goal kicks across uninterrupted real play, then source-complete 90-minute official integration and full QA. No parameter tuning until base actions are integrated.

Exact HEAD CI evidence and HOME/AWAY real-physics values to be reported in the linked issue after verification. PR #633 **Draft/HOLD**: no Ready, merge, deploy, remote D1 or world writes.
