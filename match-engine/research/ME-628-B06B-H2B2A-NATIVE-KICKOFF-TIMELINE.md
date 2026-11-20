# #628 B06b-H2b2a — source-audited native goal kickoff and provisional two-half mini report

**Draft/HOLD; research-only.** This adds no artificial original ball event, player teleport, second Rapier World, official goal, match possession, or remote DB state.

The H2b1 deterministic HOME/AWAY real full-ball goal at source tick 12 (initial ball in motion **before tick 0**, not an authenticated shoe SHOT) was already independently scored by B05/B06. Same-world dead-ball placement is a separate event. This slice now records the **third distinct physical event** only after the actual opposing `*-10` shoe's exclusive Rapier START/manifold and original ball impulse at source tick 93. The B06 ledger independently checks same-tick foot and solver snapshots, previous authenticated exact goal/restart ticket, winning team direction, real original ball position and explicit lack of official authority. A duplicate, wrong actor, missing contact or forged time is rejected.

The new event `kickoff-physical-attempt` contains **physical tick** and **played-clock tick**, preserving suspended goal-approach time rather than inflating the football clock. It deliberately does not declare possession, a legal completed match, or an authentic player-scored goal. Snapshots expose the last authenticated original goal kickoff and keep the referee score read-only.

The additional HOME/AWAY full mini test attempts to run the **same 22 players, one ball, and original Rapier world** through: physical goal, same-body centre placement, real opposing native shoe kickoff, first-half played ticks, actual halftime ball placement, separate second-half AWAY shoe kickoff, and physically executed mini full-time. The provisional final record contains immutable original B06 match events, confirmed physical goal kickoff receipts and source/physics-vs-played tick counts. The real 90-minute default path is unchanged; short tests cannot claim 90-minute completion.

### Still open — H2b2b
- Genuine player shoe-originating shot followed by goal in the *continuous* match (this goal still starts with a pre-tick-zero moving ball)
- Repeated actual native football actions, multiple independent goal/out-of-play events and restart taking across continuous play
- Physically verified HOME/AWAY throw-ins (hands remain unmodelled), corners, goal kicks and source-complete provisional tabellino
- Full official match authority and real clubs/players integration later; **parameter balance last**

**No Ready, merge, deploy or D1 remote writes.**
