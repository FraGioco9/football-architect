# ME-PB-54 / A1.3a — executable fixture physics step producer

**Status: physically running, but A1.3 remains OPEN until the actual
season-scheduled backend producer adopts this engine under an explicit
authority boundary.** Do not mark A1 main complete, A4 complete, or
Match Physics V1 beyond 40% (8/20). PR #481 stays Draft/HOLD.

## Actual execution path

`match-engine/src/physical-fixture-step-runtime.mjs` owns a bounded
fixture-specific match physics clock at 60Hz. It consumes the **same
sealed A1.2 universal Rapier 430g ball and 22 physical shoe colliders**,
not a mock engine, fake contact events or a new physics solver.

- A fixture descriptor has the real backend `Fixture` shape:
  `id,competitionId,marker,day,round,homeClubId,awayClubId`.
  The season/club IDs, round and embedded canonical fixture identity
  are structurally checked and then copied/frozen.
- **Structural validation is not a cryptographic/season calendar
  attestation.** A separately submitted fixture may not be one of the
  scheduled fixtures. `fixtureCalendarVerified=false` at all times.
- `step()` and `advance(ticks)` execute real consecutive Rapier worlds,
  return immutable ball + real START/ACTIVE/END foot contact snapshots,
  and advance a canonical 60Hz physical clock. There is no injected
  `owner`, event, player frame, match command or external impulse.
  `reset()` replays from the frozen initial ball state and closes
  the old session. Each `advance()` is bounded to 1–600 ticks.
- `tools/physical-fixture-runner.mjs` is an **executable standalone
  physics runner**: accepts only a fixture descriptor, ball initial
  state, number of 60Hz ticks and optionally the single existing
  universal `globalResponse`; returns a real ball trajectory SHA-256
  evidence digest, physical foot event totals and clock. No database
  access, network requests, HTTP endpoints or result mutation.
- The provisional tactical movement is still exactly 22 fixed
  home/away placeholders, NOT a true roster. `rosterBound=false`.
  There is no possession, goal detection, official game actions,
  interception or tackle qualification. `officialMatchResult=null`
  and `productionScoringConnected=false`.

Command from `match-engine/`:

```bash
printf '%s' '{"fixture":{"id":"season:1:ENG-1:N01:ENG-1:ENG-2","competitionId":"ENG-1","marker":"N01","day":1,"round":1,"homeClubId":"ENG-1","awayClubId":"ENG-2"},"scenario":{"preset":"roll","seed":"fixture-physical-1","x":4.96,"y":0,"z":0,"vx":-0.3,"vy":0,"vz":0},"ticks":155}' | node tools/physical-fixture-runner.mjs
```

The example only demonstrates a **structurally valid fixture-shaped
input**, NOT an authenticated scheduled fixture or official match.

## A1.3 remaining authority boundary (MUST NOT be skipped)

The existing official backend actually creates sporting outcomes in
`backend/src/knockout-progression.ts` via
`simulateTemporaryMatch` in
`backend/src/temporary-simulation.ts`. It still writes and verifies
`temporary-score-v1` receipts in
`backend/src/lifecycle-command.ts`, and is NOT a physical match
loop. The new fixture runner is executable but is **not invoked by the
backend progression**. That is intentional to prevent silently
changing scores, match archive provenance, replay evidence, and the
remote D1. Real approved-calendar membership, roster binding,
goal/score authority migration, lifecycle/Worker build + data migration
are separate design and validation gates, not claimed here.

To complete A1.3:
1. Bind the real approved season fixture and current match roster to
   physical runtime inside an authorized match execution path.
2. Prove no unauthorized score overwrite, no result drift in the
   existing `temporary-score-v1` consumer, and no fake official goals.
3. Only then sign A1.3 and proceed to A1.4 exact-head full acceptance.

The tests prove genuine Rapier A/B against A1.2 in 155 ticks, replay,
no-touch and injection negatives, generic fixture shape, and two actual
independent CLI executions yielding the same SHA-256. They do not
test an official scheduled physics match because none exists yet.
