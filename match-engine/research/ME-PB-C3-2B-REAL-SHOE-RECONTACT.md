# C3.2b — real serial same-shoe recontact, candidate

Status: implementation and actual HOME/AWAY Rapier acceptance pending. This is strictly local/DEV experimental research, not official football gameplay.

## Physical rule

Only an earlier exclusive genuine Rapier shoe START + ACTIVE that actually applied the 0.42 N·s ground-only carry impulse can open the candidate. The ordinary 60Hz mover first attempts to establish shoe clearance using a target 0.8m behind the **live** observed ball, then pursues a 0.02m behind-ball target **only after the actual same shoe's Rapier END has been observed**. The existing 150-tick bounded research window still applies. Same 7m/s speed, acceleration, turn, 0.98m player separation and unmodified Rapier foot/ball response. These are movement *intentions*, not injected events, moved rigid bodies, privileged possession or contacts.

The C3.1 read-only observer now separately audits an actual source carry, subsequent Rapier shoe **END**, and a **new** isolated genuine START by the SAME canonical actor on a strictly later tick, with at least 0.20m physically measured ball travel in the team's attack direction, **and** a second independently authenticated 0.42 N·s carry impulse from that new real shoe START. A new teammate/opponent START, ambiguous overlapping active feet, missing END, insufficient actual forward ball progress or 150-tick expiry cannot complete that candidate. A genuine later Rapier shoe START may lead to another action only via the unchanged uniform action policy; its existence is not itself a dribble or a possession ruling.

The immutable proof contains both real collision ticks, intervening END, measured 3D ball path and attacking displacement. `dribbleConfirmed`, `officialMatchResult`, and official possession/scoring remain absent. Original fixture formations, research-shot controls and the standard owner-selected LAB UI are unaffected.

Acceptance requires actual independently replayed 22-player HOME and AWAY fixtures with verified serial contacts, negative no-contact and synthetic invalid-event contract checks. Synthetic vectors alone never qualify. Do not check C3.2b / C3 or increase overall 11/20 progress until the real-world witness and exact-head CI pass. No merge, remote DB or deployment.

## Reproducible physical fixture CLI (opt-in, no official result)

The `physical-fixture-runner.mjs` research tool now accepts `autonomousCarry:true` **only** together with `autonomousActions:true`. Default mode and previous output schema remain unchanged. The explicit mode additionally reports read-only `physicalCarryDiagnostics`: real carry impulses, strictly verified ground carry recontacts, interrupted candidates, and the latest authentic Rapier START/END/START evidence. Zero verified contacts is a valid **FAIL/PENDING witness**, not a simulated success.

On Windows PowerShell with Node 22 after `npm ci --prefix match-engine`, run these **separately** from the repo root:

```powershell
$fixture = @{ id='season:1:IT-1:N01:IT-1:IT-2'; competitionId='IT-1'; marker='N01'; day=1; round=1; homeClubId='IT-1'; awayClubId='IT-2' }
$home = @{ fixture=$fixture; scenario=@{preset='roll'; seed='c3-2a-real-home'; x=-4.96; y=0; z=0; vx=0.3; vy=0; vz=0}; ticks=600; autonomousActions=$true; autonomousCarry=$true }
($home | ConvertTo-Json -Depth 12 -Compress) | node match-engine/tools/physical-fixture-runner.mjs
$away = @{ fixture=$fixture; scenario=@{preset='roll'; seed='c3-2a-real-away'; x=4.96; y=0; z=0; vx=-0.3; vy=0; vz=0}; ticks=600; autonomousActions=$true; autonomousCarry=$true }
($away | ConvertTo-Json -Depth 12 -Compress) | node match-engine/tools/physical-fixture-runner.mjs
```

The two commands provide isolated signed-direction examples; the existing **mirrored real Rapier test** `node --test match-engine/tests/player-ball-carry-real-shoe-pursuit.test.mjs` is authoritative for the exact HOME/AWAY acceptance because it fixes both fixture teams, checks repeated replay, genuine END and strictly same-actor physical second carry impulses. The 3-tick CLI test merely proves opt-in and output quarantine. No acceptance gate may be closed on CLI smoke checks alone.
