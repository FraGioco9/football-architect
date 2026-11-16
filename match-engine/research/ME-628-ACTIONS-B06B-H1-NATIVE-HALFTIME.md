# Issue #628 — B06b H1: genuine half-time ball placement and independent second-half native shoe kickoff

**Functional-first rule:** deliver football lifecycle breadth before tuning individual parameters. The B06a goal/out/referee remains untouched outside explicit B06b DEV opt-in.

## Exact physical authority

- **Original 22-player mover and same original 60Hz Rapier ball + shoe bridge** across both halves. No second ball/World, no fabricated native foot START, no player teleport.
- Only the exact, genuinely elapsed original physics half-time tick **162000** (45:00) allows an isolated DEV `b06bOriginalHalftimePlacement` to reset the **same physical ball** at the centre circle and stop its velocity. Halftime placement itself is explicitly **not** a performed kick and never awards possession.
- `away-10` is the bounded research second-half taker; after halftime its **target** changes toward centre (no direct position writes). The unchanged canonical 7m/s speed, acceleration, steering and 0.98m separation still apply. Only a **new independently observed same-tick original Rapier shoe START** + current solver contact manifold while the real ball lies at centre authorizes a physical outbound `-0.65 N·s` impulse on the SAME ball.
- While that player physically approaches, Rapier world time and movement continue **one genuine physics tick at a time**, but the match game clock holds **45:00**. The first subsequent tick **after** a genuine native kickoff starts the second period. The session must stop at exactly 324000 **played** ticks. It may have more physics ticks than game clock ticks due to the actual paused halftime approach.
- The existing B06a event ledger remains read-only and receives the original physics ticks. A separately opt-in B06b permit extends its physical-tick ceiling by at most 7200 (120s of real halftime physics), not its football clock.
- Explicitly unresolved out-of-play evidence blocks further match progress; no guessed throw-in or goal-kick ownership, and no fabricated goal. The new regulation prototype produces only `provisionalScore` / `final` research outcomes; `officialMatchResult:null` remains enforced.
- **A research mini-period of e.g. 120 physical ticks** permits quick deterministic genuine Rapier integration tests without 324000 ticks. Miniature completion must expose `abbreviatedResearchRun:true` and **`realFull90MinutesVerified:false`**. This is *not* evidence of 90 minutes. The normal 45-minute constant remains 162000 exact physics ticks.

## Acceptance and next gate

Quick exact-head Node and DEV route tests should show the real ball at centre at mini halftime, true second-half away-10 native foot START and applied original-ball impulse, a frozen game clock during the original on-field approach, continued original 60Hz physics and no official scoreboard changes. Reject unsequenced/early halftime and sources without a new native shoe START. Default physics and all prior Action LABs are unchanged; no new dropdown or duplicate control panel.

**B06b H2 remains OPEN:** physically execute **all 324000 played ticks** at real 60Hz, verify genuine elapsed half-time transition and full-time event export, integrate source-positive dead-ball restart handling during a whole game (including real initial kickoff, if missing), and then connect real players/clubs and official results. No skipped ticks, accelerated 90:00 assertion or claimed completed regulation before a real 90-minute run. Do not merge, deploy or write remote D1; PR #633 stays Draft/HOLD.
