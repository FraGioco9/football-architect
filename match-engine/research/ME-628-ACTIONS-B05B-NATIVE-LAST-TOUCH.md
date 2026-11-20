# #628 ACTIONS-B05b — source-positive original last touch

Three new DEV-only scenarios under the existing single Scenario menu:
`throw-in`, `corner`, `goal-kick` with mirrored HOME/AWAY origins.
No original B05a scene is removed. `basicSourcePositiveRestartSetup`
relocates **only** the original last-toucher (#10) and eligible restart
taker (#9) before simulation tick zero; all unchanged 22 player ids,
roles, kinematics, original physical shoe bridge and one Rapier ball.

An actual shoe START against current-tick original Rapier solver and
nonzero geometric manifold is now the *only* authorizer for a single,
bounded **4.0 N·s** DEV-local outbound impulse on the **original ball**.
The original ball starts nearly stationary within the field,
so it must be a real kick before the out-of-play line crossing. This
research-only kicker is separate from official match scoring and cannot
create synthetic shoe STARTs or assign possession.
An independently measured full-ball line crossing determines the
restart type and opposite team. The same original Rapier rigid body
is then placed at a legal dead-ball restart point by the existing
exact-tick B05 gate, with velocity reset; this is **not** a foot kick
or a legal hand throw. Missing or ambiguous genuine last shoe START
retains the B05a unresolved outcome.

B05b also uses the original #9 taker held at a **pre-tick-zero**
research standby target by the same constrained mover (not teleported
while playing). Once the real source-positive restart is placed:
- **CORNER** is placed within 1 metre of the corner flag; the original
  #9 must get its own NEW exclusive native Rapier shoe START and solver
  manifold before the original ball receives a provisional corner kick.
- **GOAL KICK** likewise requires a separate native original #9 shoe START
  and applies a same-ball physical kick inwards.
- **THROW-IN** has no simulated hands. Original #9 must be spatially near
  the verified throw-in location. An isolated original-ball impulse from
  approximate hand height is labelled
  `provisionalHandReleaseWithoutHandCollider:true`, not a native hand
  contact or legally confirmed throw-in.

Both the source kick and a different, later restart impulse use the
original ball. No extra world/player teleport/official match authority. For a throw-in, a provisional hand
release mechanism must be clearly distinguished from original Rapier
shoe START and from a legally confirmed hand throw; the latter is not
currently modelled. No official match possession/result, merge,
Ready, deployment or remote DB mutation.
