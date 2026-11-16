# #628 ACTIONS-B05b — source-positive original last touch

Three new DEV-only scenarios under the existing single Scenario menu:
`throw-in`, `corner`, `goal-kick` with mirrored HOME/AWAY origins.
No original B05a scene is removed. `basicSourcePositiveRestartSetup`
relocates **only** the original last-toucher (#10) and eligible restart
taker (#9) before simulation tick zero; all unchanged 22 player ids,
roles, kinematics, original physical shoe bridge and one Rapier ball.

An actual shoe START against current-tick original Rapier solver and
nonzero geometric manifold can supply authenticated last touch.
An independently measured full-ball line crossing determines the
restart type and opposite team. The same original Rapier rigid body
is then placed at a legal dead-ball restart point by the existing
exact-tick B05 gate, with velocity reset; this is **not** a foot kick
or a legal hand throw. Missing or ambiguous genuine last shoe START
retains the B05a unresolved outcome.

The next functional addition must authenticate the actual taker and
real same-ball set-piece impulse. For a throw-in, a provisional hand
release mechanism must be clearly distinguished from original Rapier
shoe START and from a legally confirmed hand throw; the latter is not
currently modelled. No official match possession/result, merge,
Ready, deployment or remote DB mutation.
