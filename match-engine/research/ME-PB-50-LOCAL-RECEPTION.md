# ME-PB-50 / Match Physics V1 B2 — genuine local reception integration

**Scope:** integrate the already validated B1 exclusive local ball-control
state with a closed, internally driven **real** Rapier 60Hz match loop
containing all 22 canonical kinematic shoes and one physical ball.
This is a research-only session, not official match possession or a
change to production, deployed LAB, database or published stats.

## One trusted source, no externally forged evidence

The factory in
`match-engine/src/player-ball-local-reception.mjs`
owns its own Rapier engine, player movement coordinator and B1 state.
The **only** independent physics tuning input is a single common
`globalResponse`, default 1.00 within the existing permitted range.
No boot/individual/player/grass coefficients, arbitrary action
impulses or independent collider tuning are accepted. The initial
ball roll scenario is only the actual physical initial condition.

Each parameterless `step()` performs the following synchronously:

1. Read the genuine previous ball XYZ position from owned Rapier.
2. Advance all 22 canonical players by one bounded 60Hz movement frame,
   using the exact same previous actual ball.
3. Integrate that one movement frame and the real ball through the
   owned physical Rapier world; read the true START/END/ACTIVE
   shoe-collider event stream from the SAME completed tick.
4. Update the pure B1 finite-state observer from those in-process
   physical snapshots and measured player–ball co-motion.
5. Return only deeply frozen read-only physical frames and local
   ownership facts; the caller cannot inject fake contacts/owners,
   send a frame to `step()` or mutate the world through the adapter.

On malformed, missing, out-of-order or otherwise invalid internally
generated evidence, fail closed and dispose the session. There is no
recovery by skipping physical ticks. `reset()` creates a fresh
independent deterministic world with the SAME one response and
starting physical scenario and invalidates the old session.
`dispose()` releases the Rapier world and prevents further calls.

## Real acquisition vs. initial touch

In the pinned unmodified physical 22-player scene, the first Away #10
contact starts tick1 and reaches genuine local control at tick7
only after six qualifying measured consecutive physical frames.
Control is lost on measured instability or by the real END at tick19.
The independent Home #10 contact START tick127 is *not* a reception,
because it ends at tick130 after fewer than six frames; it remains
contested, with owner null. A NEW real START tick141 can only yield
Home #10 control at tick146 after six valid physical frames.
This is neither an artificial pass nor a claim about official match
statistics. No objects are attached to the ball, and no impulse
is added by the reception model.

Integration acceptance includes independent full replay, deterministic
reset, baseline separately stepped Rapier/movement comparison, genuine
no-contact negative, short-contact rejection, all 22 players, private
physical source, prohibited external state injection and
single-response 0.85/1/1.15 bounded tests. Observer ON/OFF world
physics and foot contact traces must remain identical.

## Remaining steps

B2 completes when new tests and exact-head Chrome/security/Node
targeted CI are green. It verifies **local reception**, not normal
live match control. **A1/A4** remain unsigned until production
integration is separately authorized. **B3** will implement physical
retention, controlled ball guidance and release WITHOUT teleports;
**B4/B5** will cover opposition challenges and adversarial stability.
Do not add scientific aero calibration or individual footwear knobs.

Live checklist and gate-based progress:
https://github.com/FraGioco9/football-architect/issues/480 .
PR #481 is Draft/HOLD, no merge or deployment authorized.
