# #628 ACTIONS-B03 — basic TACKLE and INTERCEPTION attempts

**Goal:** basic action coverage before tuning. Two genuine original
Rapier shoe-ball defensive impulses, never awards of possession.

- `tackle`: original defending midfielder / defender has genuine
  opposite-team outfielder inside 3.3m of the real near-stationary
  ball in the defending half. On native exclusive shoe START, a
  bounded 1.9 N·s toe-poke away from own goal becomes a real Rapier
  impulse. Opponent proximity is NOT proof of possession or of a
  successful tackle.
- `interception`: same original defending actor, opponent observed
  nearby, real ball moving goalward at >=1.25m/s. On independent
  native exclusive shoe START, a bounded 2.1 N·s deflection moves
  the original ball. An inbound trajectory alone DOES NOT prove
  a completed opponent pass. This is an interception *attempt*,
  not authenticated pass-success reversal.
- Original 22 IDs, canonical speed/turn/acceleration/separation,
  one current Rapier world and shoe collider. No defender teleport
  during simulation, forced contacts, extra collision proxy or
  second ball.
- Mirrored DEV-only pre-tick-zero TACKLE and INTERCEPTION fixtures
  plus actual HOME/AWAY deterministic 60Hz replay.
- Distinct original single Scenario dropdown entries for tackle
  and interception (4 ball + 9 action + 30 movement = 43 total).
- Original M23 strict exclusive START + original physical action,
  post-action observer forbids forged metadata and official claims;
  read-only trajectories must show genuine ball travel.

Still OPEN: confirmed ball recovery and possession, accurate
opponent-pass history / official interception, actual tackle winning,
fouls, multi-player duels, restarts, tactics and full match scoring.
Provisional distances and impulses are NOT calibrated. PR remains
Draft/HOLD: no merge, Ready, deployment or remote D1 mutation.
