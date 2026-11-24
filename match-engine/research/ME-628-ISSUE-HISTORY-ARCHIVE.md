# #628 archived issue body (before base-actions-first reset)

This is the full original 2026-11-16 issue body, preserved verbatim below so changing the issue's main checklist does not discard historical research.

---

## Checklist — remaining work

**Progress:** individual movement and Rapier physics are working; [PR #633](https://github.com/FraGioco9/football-architect/pull/633) remains **Draft/HOLD**. Keep the list short; technical evidence stays in the PR/research files.

- [x] 22 autonomous players: acceleration, turning, pressing, support and safe spacing.
- [x] Authentic Rapier body/shoe contacts and bounded player-physics feedback.
- [x] Natural second-defender pressing support (M20), compared against baseline.
- [x] Use the original Scenario dropdown for all 39 situations; remove duplicate LAB launchers (including M14–M20).
- [ ] Complete QA of every LAB scene: both sides, controls, mobile/desktop and safe physics.
- [x] Verify genuine second-defender duty stability and physical contact duration (M22).
- [ ] Confirm at least two genuinely simultaneous natural Rapier body contacts (no artificial collisions).
- [x] Observe real post-contact ball motion and separation (M24).
- [x] Improve genuine receiver first-touch ball travel with bounded Rapier impulse (M25).
- [x] Observe genuine repeat shoe contact with a nearby autonomously moving defender (M26).
- [x] M27: choose actual second-touch hold in space or clearance under pressure.
- [x] M28: measure 120 actual Rapier follow-through ticks after a held second touch; no official possession.
- [x] M29: verify native shoe force/manifold and distinguish active pair from independent new touches.
- [x] M30: real HOME/AWAY shoe END + exclusive recontact on Rapier.
- [x] M31: audit genuine opponent pressure; no shoe-ball duel authenticated.
- [x] M32: genuine pursuit; native opposing contact still OPEN.
- [ ] Demonstrate sustained ball control and official possession with physical proof.
- [ ] Implement genuine ball control, tackles, interceptions and possession decisions.
- [ ] Connect team tactics and available squad players to the match engine.
- [ ] Integrate a complete official match: timing, score, restarts, events and result.
- [ ] Pass full match-engine, browser and end-to-end acceptance; close remaining Phase M / I / T / F requirements.

**Current milestone:** M32: closer to ball; no native opposing START or possession.

<details>
<summary>Historical research notes and technical evidence</summary>


## #628 Historical Phase M16 — original-source native shoe/body continuity (Draft/HOLD)

**Exact branch HEAD [`87fe82b`](https://github.com/FraGioco9/football-architect/commit/87fe82bba17098a43d406ed1f7cbe5ed71f2c1e6)**, same [Draft PR #633](https://github.com/FraGioco9/football-architect/pull/633). Added opt-in genuine pre-solver shoe/body continuity `researchShoeBodyHandoff:true`: next physical player movement is bounded from **both** the previous accepted canonical body and actual previous Rapier shoe pose (<=7m/s each), and facing from both original <=6rad/s angles. The original body feedback rejects unrecoverable shoe source atomically; ordinary mover, M13 historical behavior, all five Action LABs, one native Rapier world/queue, original collider radii, 22 players, >=0.98m global separation and no football action authority remain protected.

**Real focused M16 source results:** original legacy M15 reproduced **8/16** blocked trials; M16 completes **16/16 full 225-tick** paired HOME/AWAY cases, **0 blocked**, 9 native body STARTs, 6 native shoe STARTs, 85 accepted original body corrections, 74 bounded movement/facing clamps, no negative-control corrections and **peak 1** concurrently active native body pair. Full 32-run M15 research suite also passes all Node tests on previous HEAD `beaaa2f`, but its Chrome viewport was BLOCKED due missing local DEV module allowlist. Exact HEAD `87fe82b` adds **loopback-only DEV allowlisting** of `native-shoe-body-handoff.mjs` with explicit public/non-DEV negatives. **[ME-01 #43798037787](https://github.com/FraGioco9/football-architect/actions/runs/43798037787) SUCCESS on exact HEAD:** 349/349 Node, 10/10 route/security, Chrome viewport, five Action LABs, Movement LAB interaction and CPU benchmark. The full M15/M16 rolling-ball matrix **completed 32/32 original 225-tick runs with zero physical blockers**, 16 full feedback/control pairs, 14 real native body STARTs, 20 native shoe STARTs, 137 accepted canonical body corrections, 0 observation corrections; maximum concurrent Rapier body pairs **1**. FULL / Site / Browser / Admin still in progress at last verification. **Do not claim broad green yet.**

[Research contract](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M16-SHOE-BODY-HANDOFF.md). **Remaining M gate:** actual source-proven >=2 simultaneously active Rapier body-pair evidence, never synthetic; extended 192-run CLI not claimed executed. Phase M, I/T/F, C2-C5/D1-D5 still OPEN; no Ready, merge, deploy or remote D1.

---

## #628 Historical M15 — moving-ball native multi-pair search (Draft/HOLD)

**HEAD [`8bfd763`](https://github.com/FraGioco9/football-architect/commit/8bfd7636f631fb4fc9b4e90712320efa648a2485)** on [PR #633](https://github.com/FraGioco9/football-architect/pull/633). One-world original 22-player Rapier rolling-ball survey; real START/END pair ledger, source-only feedback/control and shoe/body fail-closed blockers. **Focused ME-01 [#43796219597](https://github.com/FraGioco9/football-architect/actions/runs/43796219597) SUCCESS** (345/345 Node, 10/10 route/security, Chrome Action/Movement LAB and benchmark). 32 attempted ×225 ticks: **24 complete, 8 fail-closed (shoe/body handoff)**; 8 complete feedback/control pairs; 5 real body STARTs, 14 shoe STARTs, 52 accepted corrections, **0 control corrections**. Peak simultaneous native body pairs **1**: **NO positive multi-pair acceptance**. [M15 evidence](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M15-MOVING-BALL-CONCURRENT-PAIRS.md). FULL/Site/Browser/Admin pending at checkpoint. Phase M and I/T/F remain open; **Draft/HOLD**, no merge/deploy/D1.

---
## #628 Historical Phase M14

M14 source evidence: 32 original fixed-territory Rapier runs, 10 real native body STARTs, 18 shoe STARTs, 68 accepted canonical feedback corrections, 0 observational control writes, 2 same-tick shoe/body STARTs, peak one active pair. The pitch-edge velocity fix and exact-head ME-01/FULL/Site/Browser/Admin results are retained in [PR #633 history](https://github.com/FraGioco9/football-architect/pull/633) and [M14 research doc](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M14-NATURAL-MULTICONTACT-AUDIT.md).

---
## #628 Phase M13 — real unstaged native body feedback applied to canonical 22-player mover (Draft/HOLD)

**Current exact PR HEAD [`0eeee7d`](https://github.com/FraGioco9/football-architect/commit/0eeee7dff4264bd4f68a869e9239b904b5401d6e).** Three grouped M13 commits (one implementation + two bounded QA corrections); changes confined to Match Engine source, DEV LAB, tests and research. Existing [PR #633](https://github.com/FraGioco9/football-architect/pull/633) stays **Draft/HOLD**, issue #628 OPEN; no merge, deploy or D1.

- Added **isolated paired research-only** `createPlayerMovement({researchOpposingPressConvergence:true,researchUnstagedNativeBodyFeedback:true})` and `createEngine` `diagnosticUnstagedBodyFeedbackEnabled:true` requiring **one original Rapier ball World**, **one shared native collision queue**, all 22 genuine original body colliders **radius 0.49m**, genuine shoes+ball, original zero-staged 22 lineup. Normal/default mover, M12 no-feedback, M8 controlled feedback, and all five physical Action LABs unchanged. No action executor/possession/tackle/foul/pass result; no synthetic collision or collider enlargement.
- New source-only `reconcileUnstagedNativeBodyResponse` rejects stale/duplicate ticks, missing original world, altered ordered 22 players, fake/missing native `rapier-body-start` and ended pairs, wrong radius/mode/counts. Substitutes **only active original Rapier contact actors' actual post-solver XY**; first screens the COMPLETE 22-player candidate for >=0.98m gap, 105×68 pitch bounds and <=7m/s per original 60Hz prior XY. Only accepted corrections update actual canonical coordinates/velocity/heading; rejected responses are fully atomic (including **zero XY delta must not mutate velocity or heading**). Every physical tick MUST be acknowledged once before the next; bridge never teleports Rapier bodies.
- DEV Movement LAB **M-21** feedback enabled vs **M-22** same original unstaged collision and shared shoe/body native events with feedback disabled. HOME/AWAY deterministic parity and original 22 identities; recorded true Rapier START **tick 67** on both sides, physically accepted first correction **tick 67**, **three genuine canonical corrections** per enabled 160-tick session; disabled control recorded the **same native body START and shoe START, zero canonical corrections**. Original minimum 22-body gap **0.98066965m**, maximum speed **7m/s**, no fabricated action authority. Valid source body collision is NOT an awarded tackle.
- [M13 research contract and limits](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M13-AUTHENTIC-UNSTAGED-FEEDBACK.md).

**M13 exact-head ME-01 [#43791515281](https://github.com/FraGioco9/football-architect/actions/runs/43791515281) SUCCESS**: **339/339 Node**, **9/9 routing/security**, original five Action LABs, Chrome desktop original M1–M12 plus M-21/M-22 interactive positive/negative both sides, viewport and benchmark PASS. Safety tests reject forged pair, stale/double acknowledgment, wrong identities, artificial 100m solver displacement without partial write, and genuine native contact with **no XY correction leaves even velocity/facing unchanged**. Exact-head `scope` and `head-exact` SUCCESS.

**Broader exact-head checks still in progress at last poll:** [FULL #43791515263](https://github.com/FraGioco9/football-architect/actions/runs/43791515263), [Site #43791515326](https://github.com/FraGioco9/football-architect/actions/runs/43791515326), [Browser #43791515180](https://github.com/FraGioco9/football-architect/actions/runs/43791515180), [Admin #43791515173](https://github.com/FraGioco9/football-architect/actions/runs/43791515173). No broad PASS claim until actual conclusions are available.

**Remaining gates before closing Phase M:** extended independent multi-contact/non-centre source-state coverage and safe genuine native shoe/body cohabitation under applied feedback, natural play constraints rather than fixed laboratory territory; monitor canonical pressure, lines and motion post-feedback. Phase I/T/F and C2–C5/D1–D5 still OPEN. No Ready/merge/deploy/remote DB or match results.

---
## #628 M12 exact-head acceptance update — 2026-11-16

**Current exact HEAD [`3710a55`](https://github.com/FraGioco9/football-architect/commit/3710a55b4e7ea7682a85144813d851eba1048b3e)** on existing [Draft/HOLD PR #633](https://github.com/FraGioco9/football-architect/pull/633). No Ready/merge/deploy/remote DB, issue #628 stays OPEN.

**[ME-01 targeted #43788138996](https://github.com/FraGioco9/football-architect/actions/runs/43788138996) SUCCESS on exact HEAD**: **334/334 Node, 9/9 routing, desktop Chrome viewport, original five Action LABs and M-19/M-20 HOME/AWAY interactions, benchmark PASS**. `head-exact` and `scope` SUCCESS. Last commit `3710a55` updates only the legacy M10 text assertion to prove that M10 has no staged players while M12 independently enables the opt-in press-target flag; no physical feature code changed since the successful source audit `7b06bd3`.

**Actual source evidence, not inferred proximity**: original unstaged 22-player formation, actual Rapier ball and two independently assigned real pressers, explicit opt-in `researchOpposingPressConvergence:true` only; native player bodies are original 0.49m radius and the original all-22 minimum gap >=0.98m remains in force. In 12 mirrored 225-tick source-world trials the shared native Rapier queue emitted **4 real body collision STARTs** (centre HOME/AWAY tick **67**, `away-10|home-10`; middle-halfspace HOME tick **152** and AWAY tick **155**, `away-11|home-11`). At the first centre contact the original canonical minimum gap was **0.980667m**; native solver XY passed the read-only 0.98m all-player candidate gate (**0.985669m**). The default policy and M-20 negative produced **zero** body STARTs. Chrome at tick 100 demonstrated one native START for M-19 HOME/AWAY and zero for M-20, without changing normal Action LABs.

**Important limitation:** M12 proves genuine spontaneous collision events only in the new **opt-in research presser convergence policy**, not general gameplay. Native feedback is NOT applied to the unstaged canonical mover; no official body collision/tackle, interception, possession or pass outcome. Other original ball territories produced no collision. Phase M is not closed.

**Broader exact-head QA pending**: [FULL #43788138997](https://github.com/FraGioco9/football-architect/actions/runs/43788138997), [Site #43788139020](https://github.com/FraGioco9/football-architect/actions/runs/43788139020), [Browser #43788139018](https://github.com/FraGioco9/football-architect/actions/runs/43788139018), [Admin #43788138993](https://github.com/FraGioco9/football-architect/actions/runs/43788138993). Do not claim they are green until their actual conclusions are available.

**Next M13 gate:** source-authenticated unstaged Rapier solver response must be gated and applied to the *same* original 22-player mover, with all-player 0.98m and 7m/s, source event queue retained and an independently tested dual shoe/body action safety boundary. Phase I/T/F and C2–C5/D1–D5 still OPEN. PR remains Draft/HOLD.

---
## #628 Phase M12 — source-observed autonomous opposing press convergence (Draft/HOLD)

**Current exact PR HEAD:** [`4c4ae1d`](https://github.com/FraGioco9/football-architect/commit/4c4ae1d8b8f7a3e84b0b5bf7b52ec080322c6129), feature `7b06bd3` + M-19/M-20 LAB `aaabf3e` + one M10 test-only assertion update `4c4ae1d`. Existing PR #633 remains **Draft/HOLD**, issue #628 OPEN. No merge, deploy, DB mutations or ordinary match authority.

- Root cause from M11: both original pressers targeted fixed x=ball.x ±1.8m, holding opponents at a 3.6m target separation. M12 adds **isolated opt-in** `createPlayerMovement({researchOpposingPressConvergence:true})`, with unchanged 22-player initial formation. Both ORIGINAL independently assigned current pressers engage the *actual current Rapier ball* only when BOTH are within 6m and their real opposing gap is <=12m, with bounded 9m/15m hold hysteresis. NO scripted player pair/ball teleport, no body collider skin enlargement and no other research options permitted. All original 60Hz, <=7m/s, 0.98m and turn/brake safeguards remain. The normal default mover and original Action LABs are unchanged.
- Extend original M11 one-world / one-native-queue 12-state HOME/AWAY 225-tick audit using actual source positions and source-triggered M12 policy. **Genuine Rapier body START observed in 4/12** sessions, from independently assigned original opposing pressers: centre HOME/AWAY `away-10|home-10` **tick 67**; middle-halfspace HOME `away-11|home-11` **tick 152**, AWAY same pair **tick 155**. Positive centre canonical minimum gap **0.980667m**, physical source first-tick response passes read-only all-22 0.98m/speed gate. The original policy control has zero body STARTs; body-observer OFF has zero physical body events. 8 of 12 M12 trials have authentic shoe-ball starts. No synthetic contact and no claimed tackle/possession.
- Added DEV Movement LAB **M-19 native opposing press convergence** and **M-20 exact same original ball/formation with press policy OFF**: visible original opposing pair and engagement flag, actual native body START(s), smallest physically measured opposing pair gap, original 22-body/one-queue diagnostics and HOME/AWAY Chrome interaction. Node deterministic 110-tick positive and negative replay. No official football action or authoritative body feedback is activated.
- [M12 research/limits](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M12-NATURAL-PRESS-CONVERGENCE.md), reproducible `cd match-engine && npm run audit:opposing-convergence`. Legacy original M11 audit remains behaviorally unchanged by default.

**M11 prior HEAD `e617cb1` FULLY GREEN:** ME-01, FULL, Site, Browser, Admin and exact-head/scope SUCCESS. Historical; not M12 acceptance.

**M12 evidence:** First feature-only exact HEAD `7b06bd3` [ME-01 #43787240432](https://github.com/FraGioco9/football-architect/actions/runs/43787240432) **SUCCESS** (333/333 Node, 9/9 route/security and Chrome existing Action LABs). New M-19/M-20 initial `aaabf3e` [ME-01 #43787709837](https://github.com/FraGioco9/football-architect/actions/runs/43787709837) ran **all M12 new source and LAB tests PASS** (333/334 total), but one *old M10 textual regex* did not permit the new additive M12 scene; no physical/code feature failure. Updated ONLY that regex on current HEAD `4c4ae1d` preserving M10 isolation. **Current exact-head CI running, not yet certified:** [ME-01 #43787888022](https://github.com/FraGioco9/football-architect/actions/runs/43787888022), [FULL #43787888057](https://github.com/FraGioco9/football-architect/actions/runs/43787888057), [Site #43787888035](https://github.com/FraGioco9/football-architect/actions/runs/43787888035), [Browser #43787888015](https://github.com/FraGioco9/football-architect/actions/runs/43787888015), [Admin #43787888083](https://github.com/FraGioco9/football-architect/actions/runs/43787888083). Do not claim exact HEAD pass before results.

**Next M13 gate:** independently reconcile actual solver XY for *source-authenticated unstaged* Rapier body-contact pairs under the original all-22 0.98m and <=7m/s rules, without breaking the shared shoe/body queue or five accepted physical Action LABs. Until independently proven, read-only admissible response is NOT an applied physical movement or official tackle. Phase M/I/T/F and C2–C5/D1–D5 OPEN. HOLD: no Ready, merge, deploy or remote D1.

---
## #628 Phase M11 — audited original 22-player native contact search (Draft/HOLD)

**Current exact PR HEAD:** [`e617cb1`](https://github.com/FraGioco9/football-architect/commit/e617cb1fa919eda580d3c6e209f0e16954f652d0). PR #633 Draft/HOLD, issue #628 open. One grouped 5-file M11 research commit. No merge, deploy, D1 changes or gameplay action authority.

- Added `match-engine/src/unstaged-body-contact-audit.mjs`: 12 **closed authentic ball start locations** × HOME/AWAY (24 original-world trials; fixed 160 ticks each) with **unchanged `INITIAL_PLAYERS` and `createPlayerMovement()` NO options**. Never move/stage/teleport an original player or ball mid-run; 60Hz with original 0.98m hard gap and <=7m/s. Original one-Rapier-ball-world, one-event-queue M9 native shoe+22-body observation only; original M8 collision-skin enlargement NOT used.
- Actual native body STARTs must be sourced to this tick's Rapier `EventQueue.COLLISION_EVENTS`, 22 original identities and cumulative per-tick totals. Track physical nearest pair, nearest **opposing** pair, canonical gap and current actual original support/press presence. **A near miss cannot count as a collision.** Preserve independent native shoe START counts.
- Read-only `screenNativeBodyResponse` screens solver XY of only a **currently active true Rapier START-confirmed pair** against canonical pitch, all 22 pair gaps >=0.98m and displacement <=7m/s/60Hz. It does NOT write back to the mover, produce an action or certify an unstaged body collision if Rapier did not produce it. Forged native active pairs rejected. Negative control runs original ball+mover with native shoe/body observers OFF; 24-case matrix and selected replay deterministic.
- Added reproducible offline `cd match-engine && npm run audit:unstaged-body`, Node contract tests and [M11 evidence/acceptance boundary](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M11-UNSTAGED-CONTACT-AUDIT.md). No new scene or 11v11 gameplay panel.

**M10 prior exact HEAD `e111ad6` FULLY GREEN:** ME-01 (326/326 Node, 9/9 routing and Chrome), FULL, Site, Browser, Admin, exact-head and scope all SUCCESS. Historical; does not certify M11.

**M11 exact-head targeted QA SUCCESS:** [ME-01 #43785336236](https://github.com/FraGioco9/football-architect/actions/runs/43785336236): 330/330 Node, 9/9 route/security, original five Action LAB and M1–M10 Chrome interaction/viewport + benchmark PASS. **24 authentic original-world trials ×160 ticks**, no stage or target overriding: **0 genuine Rapier body STARTs**, **0 physically admissible active native contact candidates**, minimum native body gap **1.71327m (same-team)** and minimum opposing native gap **3.00694m**. Authentic shoe-ball START observed in **8/24** seeds, actual original support assignments in **16/24**; no fabricated contacts. The absence is itself the M11 release blocker—**Phase M body collision acceptance remains OPEN**. `head-exact` and `scope` PASS. **Broader exact-head checks in progress:** [FULL #43785336198](https://github.com/FraGioco9/football-architect/actions/runs/43785336198), [Site #43785336218](https://github.com/FraGioco9/football-architect/actions/runs/43785336218), [Browser #43785336228](https://github.com/FraGioco9/football-architect/actions/runs/43785336228), [Admin #43785336276](https://github.com/FraGioco9/football-architect/actions/runs/43785336276). No broad PASS claim until completed.

**Next release gate:** if the original mover produces no real Rapier body START in this sweep, report this physical constraint honestly and design a physically grounded, un-staged opposing convergence change in a separate M step. Never fabricate contact by enlarged body colliders, moved player starts, synthetic events or a fake tackle. Phase M/I/T/F and C2–C5/D1–D5 remain OPEN. Draft/HOLD: no Ready/merge/deploy/DB.

---
## #628 Phase M10 — unstaged original support and opposing presser with live native physics (Draft/HOLD)

**Current exact PR HEAD [`e111ad6`](https://github.com/FraGioco9/football-architect/commit/e111ad65d0e55b6f228f3d4baa772f147c4fbb09)**. Initial M10 feature `a11b915` plus minimal M10 research-isolation fix `e111ad6`: shared native physics must NOT trigger M9's controlled player staging. PR #633 remains Draft/HOLD. No merge, deploy or remote D1.

- New M-17 `pressure-support`: the original canonical 22-player formation, ORIGINAL `createPlayerMovement()` with no injected targets, original real-ball territory at x=±27m, and original source-assigned `supports[side]` plus opposing `pressers[otherSide]`. Source-bound readout measures consecutive runner advance toward the actual original opponent-aware lane, and the **same real opposing presser's actual XY path**. Independently checks the source pre-step lane clearance against current 11-opponent XY within the original 7m/s × 1/60 step bound.
- New M-18 `pressure-neutral`: original ball at centre and same physical observers; must NOT invent support or a pressure witness without actual original support assignment.
- Both M10 scenes run 22 genuine shoe and 22 native body proxies through M9's one Rapier ball World and one native collision/force event queue, with football action executor OFF. **No before-tick-zero player staging, forced player-target override, or fake contacts.** Physical body/shoe starts may be 0 in natural movement; counts must come only from the actual native events and do not prove a tackle or possession. No physical mover reconciliation in this unstaged research mode yet.
- Deterministic HOME/AWAY 230-tick Node replay and 180-tick Chrome interaction tests, original 0.98m hard separation, 7m/s bound, no official possession/pass, old M1–M9 contracts retained. [M10 evidence and limits](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M10-UNSTAGED-SUPPORT-PRESSURE.md).

**M9 exact HEAD `607cdd0` FULLY GREEN:** ME-01 (324/324 Node + 9/9 route Chrome original Action & Movement LAB), FULL, Site, Browser, Admin, exact-head and scope all SUCCESS. This historical result does not qualify M10.

**M10 targeted QA SUCCESS on exact HEAD:** [ME-01 #43783754591](https://github.com/FraGioco9/football-architect/actions/runs/43783754591): 326/326 Node, 9/9 routing, Chrome desktop all five Action LABs, M-17/M-18 HOME/AWAY interactions, benchmark and viewport PASS. At 180 ticks actual support lane runner path **18.15m** and target advance **18.03m** both sides; genuine assigned opposing presser traveled **15.34m HOME / 15.06m AWAY**; one genuine shoe START each; **zero native body collision STARTs** in unstaged play (do not claim otherwise). Neutral control: no support, no pressure witness, no shoe/body STARTs. First `a11b915` ME-01 failed because M10 incorrectly inherited M9 staging; `e111ad6` isolated the flags and all targeted checks PASS. Current `head-exact` and `scope` PASS. **Broad exact-head CI still running:** [FULL #43783754532](https://github.com/FraGioco9/football-architect/actions/runs/43783754532), [Site #43783754667](https://github.com/FraGioco9/football-architect/actions/runs/43783754667), [Browser #43783754599](https://github.com/FraGioco9/football-architect/actions/runs/43783754599), [Admin #43783754558](https://github.com/FraGioco9/football-architect/actions/runs/43783754558). No broad PASS claim before completion.

**Next gate:** source-authenticated genuine *unstaged* native body contact under real autonomous opposing movement, together with actual pressure-aware support and safe all-22 physical response. Do not equate actual presser assignment/proximity with a tackle or official action. Phase M and I/T/F plus C2–C5, D1–D5 remain open. No Ready, merge, deploy or remote DB.

---
## #628 Phase M9 — one native Rapier shoe/body event queue (Draft/HOLD)

**Current exact HEAD [`607cdd0`](https://github.com/FraGioco9/football-architect/commit/607cdd0b7a0ff6ca6f522e69c1d1d294885cb9d8)**; #633 stays Draft/HOLD, #628 open. Two grouped M9 commits (source bridge + authentic combined-event fixture and regression assertion); no merge, deploy or remote D1.

- A new explicit **DEV-only, action-disabled** flag `diagnosticSharedContactEventsEnabled:true` allows the original native 22-shoe bridge and native 22-body bridge inside **the same original ball Rapier World**, with exactly **one Rapier `EventQueue`**, one `world.step()`, one collision drain and one contact-force drain per 60Hz tick. Dispatch native same-tick events to the independently existing shoe and body observers, preserving original source attribution and original unshared defaults.
- In shared mode only, ball and shoe collision category/filter **0x0001/0x0001**, body **0x0020/0x0020**. This explicitly excludes body collisions with ball/shoes while preserving real shoe-ball contact and genuine body-body START. Nothing awards a pass, tackle, interception or possession; genuine shoe START and genuine body START are reported **separately**.
- New M-15 **Shared native shoe + body events**: the original 22-player M8 opposing-forward controlled encounter, with one genuine stationary ball at x=-0.25m HOME / x=+0.25m AWAY, staged strictly *before tick zero*. It now verifies BOTH real native shoe-ball START and native body-body START plus checked mover feedback **within the very same original Rapier World and single event queue**. M-16 **Shared contacts OFF** uses the same movement/ball and must yield zero shoe/body events. Separate same-world Node control confirms the genuine shoe START and physical ball trajectory match the accepted shoe-only original. No fabricated contact, no match action.
- Added deterministic HOME/AWAY, native shared queue evidence, opt-in rejection guards, DEV-only UI and browser tests. [M9 technical note](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M9-SINGLE-NATIVE-QUEUE.md). All five original Action LABs continue in their existing independent unshared mode.

**M8 prior head `59896f5` FULLY GREEN**: ME-01, FULL, Site, Browser, Admin and exact-head/scope all SUCCESS. Historical, does not approve M9.

**M9 exact-HEAD targeted PASS:** [ME-01 #43782090023](https://github.com/FraGioco9/football-architect/actions/runs/43782090023) — 324/324 Node, 9/9 route/security, original five Action LABs + desktop Chrome M-15/M-16 and viewport/benchmark PASS. **Within one M-15 source session**, HOME and AWAY each show authentic shoe START at **tick 1** (2 total), genuine body START and first accepted original mover feedback at **tick 14**, 97 checked physical mover responses in 110 ticks, canonical 0.98m separation protected. M-16 negative has zero shoe/body events and zero feedback; separately verified shoe-only reference matches native source and ball trajectory. The old first-M9 run #43781608197 had all three new M9 tests passing, but overall FAILED due solely to obsolete M2 textual prohibition; that test was fixed on current SHA and M2 remains shoe-free. **Current broader exact-head QA in progress:** [FULL #43782090033](https://github.com/FraGioco9/football-architect/actions/runs/43782090033), [Browser #43782090028](https://github.com/FraGioco9/football-architect/actions/runs/43782090028), [Site #43782090040](https://github.com/FraGioco9/football-architect/actions/runs/43782090040), [Admin #43782090035](https://github.com/FraGioco9/football-architect/actions/runs/43782090035). `head-exact` and `scope` PASS; do not claim wider PASS until complete.

**Next M gate:** prove physically contested *non-staged* movement and support under real pressure, validate coexistence with actual authorized physical action impulses before graduation, and keep 0.98m, <=7m/s and match authority isolated. Phase M/I/T/F, C2–C5/D1–D5 OPEN. No Ready, merge, deployment or DB mutations.

---
## #628 M8 — true native body contact and bounded canonical feedback (2026-11-16)

**Current exact HEAD:** [`59896f5`](https://github.com/FraGioco9/football-architect/commit/59896f5cea92ab4a65cc86872cb9cf4627c1521a); PR #633 stays **Draft/HOLD**, issue #628 open. No merge, deploy, remote D1 or default player-action modifications.

**Implementation:** Two DEV-only controlled encounter scenarios M-13/M-14. An explicitly staged pair of original HOME #10/AWAY #10 players at ±0.72m **before tick zero** approaches via the original fixed-60Hz mover and original hard 0.98m guard. M-13 uses native dynamic 22-player colliders in the SAME original Rapier ball World, with a disclosed encounter-only 0.51m collider radius (M7 default 0.49m). Native `EventQueue.COLLISION_EVENTS` authenticates collision START. Only pair-active real post-solver XY samples can be fed back into the original mover, after checking 22-body order, pitch bounds, <=7m/s and all-pairs >=0.98m. Same-tick acknowledgment prevents advancing an unacknowledged world; no second world, synthetic collision or shoe/ball events. M-14 is the otherwise identical body-disabled negative.

**Evidence:** [ME-01 #43779494065](https://github.com/FraGioco9/football-architect/actions/runs/43779494065) **SUCCESS on exact HEAD**: 321/321 Node, 9/9 route/security, desktop Chrome five original Action LABs and Movement LAB M-13/M-14, viewport and benchmark PASS. HOME/AWAY mirrored deterministic replay, first actual native Rapier body START **tick 14**, first bounded mover response accepted **tick 14**, **97 accepted responses in 110 ticks**, minimum actual canonical all-player gap **0.985m**, observed maximum speed **4.5m/s**. Negative: zero native START and zero feedback, minimum gap **0.980m**. Node confirms body-only physics leave the accepted ball trajectory unchanged.

**Important limit:** This proves a **controlled contact-and-feedback fixture**, NOT naturally occurring full-match contact, a tackle or possession. Shoe+body event queues are still intentionally mutually exclusive. Phase M is NOT closed. Read [M8 evidence and limits](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M8-NATIVE-RECONCILIATION.md).

**Wider exact-HEAD checks pending**: [FULL #43779494111](https://github.com/FraGioco9/football-architect/actions/runs/43779494111), [Site #43779494134](https://github.com/FraGioco9/football-architect/actions/runs/43779494134), [Browser #43779494100](https://github.com/FraGioco9/football-architect/actions/runs/43779494100), [Admin #43779494079](https://github.com/FraGioco9/football-architect/actions/runs/43779494079). `head-exact` and `scope` PASS; no wider PASS claim before those jobs finish.

**Next:** design and verify a **single, source-authenticated native shoe/body event queue** without changing the accepted five Action LABs; physically contested ordinary player motion, support response under pressure, and full 22-player collision authority need independent acceptance before Phase I/T/F. C2–C5/D1–D5 remain OPEN. HOLD: no Ready/merge/deploy/DB.

---
## #628 M7 exact-head QA update — 2026-11-16

**Current PR HEAD [`64dcf0e`](https://github.com/FraGioco9/football-architect/commit/64dcf0e2f8e75454caf57e58d7fb821e6703507c)** (M7 implementation `ed53679` + one minimal test-only field-name correction). No changes to physical code after `ed53679`. Existing Draft/HOLD #633 remains open.

**[Targeted ME-01 #43777463276](https://github.com/FraGioco9/football-architect/actions/runs/43777463276): SUCCESS at exact HEAD** — 318/318 Node tests, 9/9 route/security tests, desktop Chrome viewport, original five Action LABs plus M-11/M-12 Movement LAB real interactions and benchmark PASS. Both HOME/AWAY create all 22 native colliders in the SAME ball Rapier World, while control M-12 reports 0. Ball trajectories unchanged by body-only groups. In the tested 140-tick canonical scenes: **zero native body collision START events**, with max source-vs-body XY drift ~0.00008044m; this is an honest negative, NOT an accepted positive body collision. M6 independently established native colliders' real impact in a separate two-body world. Neither result grants authoritative player-body response to the 22-player mover.

**Current wider gates pending:** [FULL #43777463309](https://github.com/FraGioco9/football-architect/actions/runs/43777463309), [Site #43777463290](https://github.com/FraGioco9/football-architect/actions/runs/43777463290), [Browser #43777463269](https://github.com/FraGioco9/football-architect/actions/runs/43777463269), [Admin #43777463314](https://github.com/FraGioco9/football-architect/actions/runs/43777463314). `head-exact` and `scope` PASS. M7 broader acceptance pending.

**Next:** physical response reconciliation into the canonical 22-player state AND a genuine positive player-body contact in an independently verified same-world controlled situation, eventually compatible with original shoe/ball event authority. Phase M, I/T/F and C2–C5/D1–D5 still open. HOLD: no Ready, merge, deploy or remote DB changes.

---
## #628 Phase M7 — same-world 22 native Rapier player bodies, research-only (Draft/HOLD)

**Current exact HEAD [`ed53679`](https://github.com/FraGioco9/football-architect/commit/ed5367908e3831e48c4078fba84a176d16ab1766)** on existing PR #633. One grouped M7 commit; no merge, deploy or remote D1.

- Added an explicit opt-in `diagnosticPlayerBodyCollidersEnabled` that creates **22 dynamic Rapier player-body colliders in the SAME original Rapier ball World**, with BODY-only collision groups. Original ball, turf, genuine shoes and the five accepted Action LABs remain outside these new physical interactions.
- Original 60Hz `createPlayerMovement` ordered output is the only accepted velocity source. Validates identity, role, tick, speed, and continuity; reads true native Rapier START/END collision events, native solver positions, minimum physical distance and maximum divergence from canonical mover. **The native physical positions are not fed back to the kinematic mover**, and body/shoe concurrent mode is explicitly rejected until reconciled. Thus this is NOT yet accepted authoritative football player-body physics, tackle, possession or interception.
- DEV-only Movement LAB M-11 `22 Rapier body observers` / M-12 `Bodies OFF` (HOME/AWAY), real 22-player field and source-only metrics. Added Node deterministic replay, malformed-frame, isolation-from-ball, negative/positive-observation and Chrome UI tests; no second world.
- [M7 source and limitations](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M7-SAME-WORLD-22-BODIES.md).

**Previous M6 exact HEAD `5cf498f` FULLY GREEN:** 315/315 Node, 9/9 routing, ME-01 Chrome, Site, Browser, Admin, FULL SUCCESS. Historical; not approval for M7.

**M7 exact HEAD QA running:** [ME-01 #43777337836](https://github.com/FraGioco9/football-architect/actions/runs/43777337836), [FULL #43777337816](https://github.com/FraGioco9/football-architect/actions/runs/43777337816), [Site #43777337850](https://github.com/FraGioco9/football-architect/actions/runs/43777337850), [Browser #43777337823](https://github.com/FraGioco9/football-architect/actions/runs/43777337823), [Admin #43777337837](https://github.com/FraGioco9/football-architect/actions/runs/43777337837). Do not claim M7 PASS before exact-head check evidence.

**Next gate M8:** native body response must reconcile into canonical mover and coexist with original physical shoe/ball events under one gated event queue, with verified 0.98m separation and under-pressure support. Phase I/T/F, C2–C5 and D1–D5 remain OPEN. **Draft/HOLD; no Ready, merge, deploy or DB writes.**

---
## #628 Phase M6 — measured support lane + isolated native Rapier body impact (Draft/HOLD)

**Current exact HEAD** [`5cf498f`](https://github.com/FraGioco9/football-architect/commit/5cf498f3812fab57df2944c8c5a44bafbff721ab) on existing PR #633. One grouped M6 commit (8 files); no merge, deploy or D1 changes.

- **M-09 Support lane**: existing original 22-player 60 Hz `frame.supports` is the only source for actual free runner ID/side/lane/target, measured consecutive runner path and true target approach, and opponent/teammate clearance. Unmodified original support policy, no new strategic AI or fake pass.
- **M-10 No support**: neutral-ball negative must not conjure a support assignment. Both sides use actual Rapier ball world but with shoe and action authority disabled.
- **Separate isolated Rapier body-pair probe** with two real dynamic colliders, original canonical radius and native `EventQueue.COLLISION_EVENTS`. A genuine collision START plus measured solver velocity change (and diverging no-contact negative) proves only native Rapier body-contact instrumentation in that disposable pair world. It is **NOT** a body contact in the canonical match 22-player world, nor a certified tackle, interception or possession.
- Deterministic HOME/AWAY Node tests for real support/negative and Rapier impact/no-contact plus Chrome interactive UI tests; technical boundary and remaining gate documented in [M6 notes](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M6-SUPPORT-BODY-BASELINE.md).

**Historical M5 `2c9b5a2`:** ME-01 [#43774825259](https://github.com/FraGioco9/football-architect/actions/runs/43774825259) SUCCESS. Broad M5 gates were still running at last recorded checkpoint; do not extrapolate.

**M6 exact-head targeted QA SUCCESS:** [ME-01 #43775543666](https://github.com/FraGioco9/football-architect/actions/runs/43775543666) at `5cf498f` — 315/315 Node, 9/9 routing, desktop Chrome original Action+Movement LAB, 1280×720 and 1440×900 viewport, benchmark PASS. M6 real current XY support HOME/AWAY #9 each ~23.00m at tick 220; neutral negative 0.00m; independent native Rapier two-body collision-positive and diverging negative tests PASS. **This does not qualify as integrated 22-player Rapier body collision.** Broader exact-head checks: [FULL #43775543651](https://github.com/FraGioco9/football-architect/actions/runs/43775543651), [Site #43775543723](https://github.com/FraGioco9/football-architect/actions/runs/43775543723), [Browser #43775543669](https://github.com/FraGioco9/football-architect/actions/runs/43775543669), [Admin #43775543680](https://github.com/FraGioco9/football-architect/actions/runs/43775543680); verify their conclusions before claiming broad acceptance.

**Remaining Phase M:** actual Rapier player-body physics coupled to ALL canonical 22 players (not merely the isolated probe) and verified support lane under genuine physically contested play. Phase I decisions, Phase T tactics, Phase F and C2–C5 / D1–D5 remain OPEN. Draft/HOLD, desktop-only, no Ready/merge/deploy/remote DB.

---
## #628 Phase M5 — original opponent movement + Rapier shoe-ball contest (Draft/HOLD)

**Current exact HEAD [`2c9b5a2`](https://github.com/FraGioco9/football-architect/commit/2c9b5a280982a383b3eb0faf8fa795032ac4a0e9)**. Eighth grouped commit (one source-and-test block plus one minimal assertion fix) on existing #633; no merge, deploy or remote DB. At previous M5 SHA `396bf24`, the three new source tests all PASS: real HOME PASS tick 1, original AWAY #7 shoe START tick 91, 4.897 m opposing movement, min contested XY gap 1.196 m. Overall targeted CI was FAIL from an obsolete M3 source call regex; this test-only assertion is fixed on current HEAD.

- New **M-08 Opposing shoe contest (HOME)** in the same desktop Movement LAB. It reuses exactly the accepted `createControlledActionLab(RAPIER,'control',{controlScene:'opponent-first',controlSide:'home'})`, including genuine HOME #10 Rapier PASS and genuine AWAY #7 shoe-ball START. No second physics engine or authority.
- A positive movement+contact witness requires **original PASS**, actual intervening **AWAY #7 sampled 60 Hz XY motion**, and a **later original Rapier opponent shoe-ball START**. Displays measured opponent path, closest sampled inter-player distance and real opposing event tick; highlights the genuine opposing player.
- **Kinematic 0.98 m separation is not a Rapier player-body collision.** The UI and evidence explicitly leave player-body contact, tackle, interception, possession, completed reception and official score UNVERIFIED. AWAY opponent-first is gated off because no equivalent actual source has been accepted.
- Added M5 deterministic Node authentic and negative replay tests, Chrome positive/reset/side-lock tests, menu entry, documentation [M5 evidence](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M5-CONTEST-EVIDENCE.md). All previous M1–M4 scenarios remain.

**Previous M4 `3dcafea` full acceptance:** exact-head ME-01, FULL, Site, Browser and Admin all **SUCCESS**. These are historical and DO NOT validate the new M5 SHA.

**M5 exact-head targeted QA SUCCESS:** [ME-01 #43774825259](https://github.com/FraGioco9/football-architect/actions/runs/43774825259) on `2c9b5a2` — **312/312 Node**, **9/9 routing**, desktop Chrome viewport, original five Action LABs and new M-08 Movement LAB interactive witness/reset, benchmark PASS. Original HOME PASS tick 1 → genuine AWAY #7 shoe-ball START tick 91; 4.897 m real opponent path before shoe event, min observed contested-player XY gap 1.196 m. This is NOT a Rapier player-body collision or certified interception. **Broader exact-head gates pending:** [FULL #43774825180](https://github.com/FraGioco9/football-architect/actions/runs/43774825180), [Site #43774825171](https://github.com/FraGioco9/football-architect/actions/runs/43774825171), [Browser #43774825138](https://github.com/FraGioco9/football-architect/actions/runs/43774825138), [Admin #43774825177](https://github.com/FraGioco9/football-architect/actions/runs/43774825177). `head-exact` and `scope` PASS; no broad-gate PASS claim before completion.

**Next after M5:** true Rapier player-body contact / physical contest evidence and the missing verified support-lane movement, before closing Phase M. Phase I/T/F and C2–C5/D1–D5 OPEN. **Draft/HOLD, no Ready/merge/deploy/remote D1.** Desktop Chrome only; Safari N/A.

---
## Phase M4 QA correction — 2026-11-15 (current HEAD)

**Current SHA [`3dcafea`](https://github.com/FraGioco9/football-architect/commit/3dcafea839ff9040fb8261b6996c39ae865d9515)** on existing #633 Draft/HOLD, after two limited fixes to M4: `d5ab30e` threads `controlSide` into the original Action LAB; `3dcafea` explicitly resets HOME before the comparative Chrome test, so previous AWAY selector state cannot cause a spurious HOME assertion. No Rapier physics or football policy values changed in these fixes.

At previous SHA `d5ab30e`, **309/309 Node** and **9/9 routing** tests, Chrome viewport passed; the full interactive Chrome test stopped at a stale selection assertion before AWAY's final browser assertion. The actual true-HOME/true-AWAY Rapier source evidence had already passed the dedicated M4 Node tests. Do not claim that previous overall ME-01 was successful.

**Current exact-head checks:** **[ME-01 #43770814715](https://github.com/FraGioco9/football-architect/actions/runs/43770814715) SUCCESS** at exact `3dcafea`: **309/309 Node**, **9/9 routing**, actual Chrome viewport, five original Action LABs plus Movement LAB HOME/AWAY real interaction, CPU benchmark. The genuine Rapier HOME #10 and AWAY #10 PASS at tick 1 was verified independently by source tests; in Chrome, both #9 receivers travelled **8.42m post-PASS** by tick 100 (min player gap **4.39m**, measured speed **7m/s**) with no awarded possession or completed reception. Broader current-head gates pending: [FULL #43770814750](https://github.com/FraGioco9/football-architect/actions/runs/43770814750), [Site #43770814745](https://github.com/FraGioco9/football-architect/actions/runs/43770814745), [Browser #43770814718](https://github.com/FraGioco9/football-architect/actions/runs/43770814718), [Admin #43770814684](https://github.com/FraGioco9/football-architect/actions/runs/43770814684). No FULL/Site/Browser/Admin PASS claim before final check-run evidence.

Historical checkpoint from previous stage: **Current exact-head checks:** [ME-01 #43770814715](https://github.com/FraGioco9/football-architect/actions/runs/43770814715), [FULL #43770814750](https://github.com/FraGioco9/football-architect/actions/runs/43770814750), [Site #43770814745](https://github.com/FraGioco9/football-architect/actions/runs/43770814745), [Browser #43770814718](https://github.com/FraGioco9/football-architect/actions/runs/43770814718), [Admin #43770814684](https://github.com/FraGioco9/football-architect/actions/runs/43770814684) pending at checkpoint. No current-HEAD PASS claim until completed. Original M3 previous exact HEAD `ed499e8` FULL/Site/Browser/Admin/ME-01 all SUCCESS.

**HOLD: no merge, deploy, remote D1, or implicit Phase I/tactics acceptance.**

---
## Phase M4 — original physical AWAY post-PASS receiving motion (2026-11-15)

On existing [Draft/HOLD PR #633](https://github.com/FraGioco9/football-architect/pull/633), exact HEAD [`b3f5f86`](https://github.com/FraGioco9/football-architect/commit/b3f5f86fa07c083993ec252228c6f6dd1888431d) adds the bounded **AWAY CONTROL initial scene**, original Rapier shoe-only physical PASS by AWAY #10 intended for AWAY #9, current-frame receiving-run measurements in one canonical 22-player mover, negative proof gating, and actual desktop Chrome interaction. Existing HOME behavior, HOME-only opponent-first scene and legacy Action LAB contracts remain. No synthesized PASS or completed reception. Read [M4 source gates](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M4-AWAY-PASS.md).

**Previous M3 HEAD `ed499e8` fully SUCCESS** across ME-01, FULL, Site, Browser and Admin. **New M4 checks still running:** [ME-01 #43770492703](https://github.com/FraGioco9/football-architect/actions/runs/43770492703), [FULL #43770492686](https://github.com/FraGioco9/football-architect/actions/runs/43770492686), [Site #43770492711](https://github.com/FraGioco9/football-architect/actions/runs/43770492711), [Browser #43770492678](https://github.com/FraGioco9/football-architect/actions/runs/43770492678), [Admin #43770492701](https://github.com/FraGioco9/football-architect/actions/runs/43770492701). Do NOT claim new HEAD accepted until all gates pass. Keep Draft/HOLD; no merge, deploy, remote DB. Phase M physical contest and later Phase I/T/F remain separate and unaccepted.

---
## M3 — current implementation checkpoint (2026-11-15)

**Current-HEAD targeted QA SUCCESS:** [ME-01 #43769260290](https://github.com/FraGioco9/football-architect/actions/runs/43769260290) at exact `ed499e8`: 306/306 Node, 9/9 routing, Chrome viewport and interactive Action+Movement LAB, benchmark PASS. Real Chrome post-PASS: HOME #9 has 8.42 m post-PASS path from original HOME #10 PASS tick 1; goal-side response HOME/AWAY each 0.814 m from tracked opponent (min gap 1.0618 m), and no-opponent negative never awards recovery. FULL/Site/Browser/Admin remain pending at this checkpoint.

**QA correction (M3, current HEAD ed499e8):** the new M3 Node source tests all PASS on source commit `3d2c556`, including HOME genuine post-PASS receiver motion, HOME/AWAY measured 0.814m goal-side recovery and no-opponent zero response. The original overall ME-01 failed two obsolete M2 catalog assertions. They were fixed **without physics changes** in grouped commit [`ed499e8`](https://github.com/FraGioco9/football-architect/commit/ed499e8971b1ef6c6c352910f1a830f32ec3f7d9). Current verification: [ME-01 #43769260290](https://github.com/FraGioco9/football-architect/actions/runs/43769260290), [FULL #43769260324](https://github.com/FraGioco9/football-architect/actions/runs/43769260324), [Site #43769260299](https://github.com/FraGioco9/football-architect/actions/runs/43769260299), [Browser #43769260309](https://github.com/FraGioco9/football-architect/actions/runs/43769260309), [Admin #43769260334](https://github.com/FraGioco9/football-architect/actions/runs/43769260334). HOLD; do not claim current-head green yet.

[PR #633 Draft/HOLD](https://github.com/FraGioco9/football-architect/pull/633) advanced to 3rd grouped commit [`3d2c556`](https://github.com/FraGioco9/football-architect/commit/3d2c556feb8a1fc99c9e3e2e01dbc912b4a70433). M2's former HEAD `a21946a` completed targeted, FULL, Site, Browser and Admin **SUCCESS**; current M3 HEAD must be independently reverified.

**M3 delivered:** HOME-only post-PASS observed receiver motion using the *existing authentic* Rapier CONTROL PASS and the same 22-player mover (no second executor); goal-side movement only while the same real opponent remains assigned, HOME/AWAY; physically empty opponent-negative scenario; three compact DEV Movement LAB choices with source-aware readouts; deterministic Node and desktop Chrome tests. No artificial event, pass completion, possession, tackle or score. AWAY post-PASS **not yet physically proven** and deliberately rejected. [M3 design notes](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M3-SOURCE-EVIDENCE.md).

**New exact-HEAD jobs pending:** [ME-01 #43769093187](https://github.com/FraGioco9/football-architect/actions/runs/43769093187), [Site #43769093200](https://github.com/FraGioco9/football-architect/actions/runs/43769093200), [Browser #43769093197](https://github.com/FraGioco9/football-architect/actions/runs/43769093197), [Admin #43769093199](https://github.com/FraGioco9/football-architect/actions/runs/43769093199), plus required FULL gate. Keep Draft/HOLD, no merge, deploy, remote D1 or Phase I/T/F work.

---
## Phase M2 — controlled Movement LABs (2026-11-15, QA pending)

Existing [Draft/HOLD #633](https://github.com/FraGioco9/football-architect/pull/633) advanced to grouped second commit [`a21946a`](https://github.com/FraGioco9/football-architect/commit/a21946ac7e4db4133183bbb099a4fdfc9c703d72), preserving M1 and adding four mirrored HOME/AWAY movement-only DEV scenes (Approach, Brake, Turn, Recovery), compact on-field controls, measured motion/turn/braking/minimum separation, and real Chrome interactions. Same canonical 22-body mover + one real Rapier ball; **shoe colliders OFF**, so no artificial contact/action/possession/score. Recovery status is source-bound to a current canonical observed opponent. No tactical policy or 11v11 acceptance advanced. [M2 notes](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M2-LABS.md).

**M2 exact-HEAD [ME-01 #43755138265](https://github.com/FraGioco9/football-architect/actions/runs/43755138265) SUCCESS:** 303/303 Node, 9/9 routing, original Action LAB plus Movement LAB desktop Chrome interactive QA and viewport; HOME/AWAY witnesses for all four movement situations. Recovery minimum measured separation 1.0618m ≥ 0.98m. No certified foot contact/football outcome; FULL/Site/Browser still pending at this update.

**New exact-HEAD checks pending:** [ME-01 #43755138265](https://github.com/FraGioco9/football-architect/actions/runs/43755138265) (including real Action + Movement Chrome), [FULL #43755138177](https://github.com/FraGioco9/football-architect/actions/runs/43755138177), [Site #43755138223](https://github.com/FraGioco9/football-architect/actions/runs/43755138223), [Browser #43755138175](https://github.com/FraGioco9/football-architect/actions/runs/43755138175). Prior M1 PASS belongs to `cf6ef68` only. M2 **not accepted** until exact-HEAD QA. Draft/HOLD; no merge/deploy/remote DB.

---
## Phase M1 implementation checkpoint — 2026-11-15

**Open [Draft/HOLD PR #633](https://github.com/FraGioco9/football-architect/pull/633)** based on `main` `86bf13f70bef8f8ec7d74189f8948fa36941b2c8`; exact head [`cf6ef68`](https://github.com/FraGioco9/football-architect/commit/cf6ef68e13ed0811ea06ec2058a1c58146a57d04). Seven files / one grouped commit. Only source-bounded 60 Hz individual kinematics were extracted from the single 22-player canonical mover: acceleration, braking, turn-rate, pitch clamp. Existing targets, 0.98 m hard separation, Rapier shoe START/action contract and deterministic reset unchanged. Added mirrored HOME/AWAY tests, braking/heading/bounds/invalid evidence and canonical 22-player replay. New module remains DEV-only with route security negative checks. [Scope notes](https://github.com/FraGioco9/football-architect/blob/feat/628-individual-kinematics-foundation/match-engine/research/ME-628-PHASE-M-FOUNDATION.md).

**Exact HEAD #633 targeted result:** [ME-01 #43751166309](https://github.com/FraGioco9/football-architect/actions/runs/43751166309) SUCCESS, 300/300 Node + 9/9 routing + Chrome viewport 1/1 + benchmark. Five Action LAB Chrome interaction remains branch-filtered/SKIPPED; no claim of that specific test. Site/Browser/FULL jobs were still running at this checkpoint. 

**Verification pending at exact HEAD:** [ME-01](https://github.com/FraGioco9/football-architect/actions/runs/43751166309), [FULL](https://github.com/FraGioco9/football-architect/actions/runs/43751166312), [Site](https://github.com/FraGioco9/football-architect/actions/runs/43751166310) and [Browser](https://github.com/FraGioco9/football-architect/actions/runs/43751166505) are currently in progress; `head-exact` and `scope` have passed. No success claimed for jobs still running. **M1 is only the first source extraction**; approach/turn/deceleration/recovery Action LAB movement scenarios and the rest of Phase M remain OPEN. Do not begin individual policy, tactics or full 11v11 before Phase M acceptance. No merge/deploy/remote DB changes; Chrome desktop acceptance, Safari N/A.

---

## READY FOR PHASE M — 2026-11-15

**Dependency #620 completed and closed.** Clean Rapier foundation plus five controlled desktop Action LABs landed in `main` via #622/#624/#626/#627; final SHA [`31923ad`](https://github.com/FraGioco9/football-architect/commit/31923ad0e3a308d0063472bfd5c7018458ae0f68). Post-merge `head-exact`, `scope`, `landing`, `chromium` all SUCCESS (Site [#43749394468](https://github.com/FraGioco9/football-architect/actions/runs/43749394468); Browser [#43749394403](https://github.com/FraGioco9/football-architect/actions/runs/43749394403)). **Next work: Phase M only**, start a small main-based Draft/HOLD for real individual motion (orientation, acceleration, braking, turn), deterministic HOME/AWAY source-only tests and desktop Chrome QA. Do not import old tactical AI or claim ordinary 11v11 successes. No merge/deploy/DB changes without separate approval. Safari/iPhone N/A for DEV LAB.

---

> **Handoff da #620 — 2026-11-15.** Tutti i cinque Action LAB controllati e la fondazione Rapier sono stati accettati in desktop Chrome e integrati su `main` (`31923ad`) mediante #622/#624/#626/#627. **Resta da chiudere solo la verifica post-merge Site `landing` + Browser `chromium` su quel SHA, entrambi IN PROGRESS al checkpoint.** Dopo il loro SUCCESS, #620 può essere chiusa e questa issue può iniziare dalla **Phase M: movimento individuale**, in una nuova Draft/HOLD piccola e separata; non cominciare direttamente dalle tattiche o dal 11v11. Il LAB è desktop-only: Safari/iPhone e viewport mobile sono N/A per decisione del proprietario. Nessun deploy/DB/merge implicito.

## Dependency and owner-approved priority (historical initial gate; implementation now merged)

This is the **deferred successor to legacy [#480](https://github.com/FraGioco9/football-architect/issues/480)**, not a task to start immediately. The action-first order approved on 2026-11-15 is **cleanup and authentic controlled action LABs ([#620](https://github.com/FraGioco9/football-architect/issues/620)) → individual movement → individual decisions → collective tactics → ordinary full 11v11 and acceptance**. Long-term conceptual design remains in [#452](https://github.com/FraGioco9/football-architect/issues/452).

**Hard start condition:** finish and independently accept the clean foundation and five LABs in the Draft/HOLD [#622](https://github.com/FraGioco9/football-architect/pull/622) → [#624](https://github.com/FraGioco9/football-architect/pull/624) → [#626](https://github.com/FraGioco9/football-architect/pull/626) → [#627](https://github.com/FraGioco9/football-architect/pull/627) chain. In particular reproduce genuine, legal staged SHOT HOME/AWAY, receiving shoe contact, carry impulse, opposing collision, negative/ambiguous/no-contact cases and desktop/mobile QA. **Do not resume the old #481 P2/P3 tactical heuristics now.** No merge or remote DB change without separate authorization.

## Phase M — individual movement, AFTER actions

- [ ] Keep one canonical 60Hz mover with actual 22 players, player identity, orientation, acceleration, braking, turns and bounded speeds; preserve the approved **0.98m physical teammate separation** and genuine Rapier shoe-body authority.
- [ ] Run controlled LAB scenarios for approach, decelerate, turn, support lane, movement after pass, recovery and no-contact negative; measure real motion instead of teleporting or a special 11v11 control panel.
- [ ] Preserve physical action boundaries: a target or predicted contact must **never** create a Rapier shoe START, impulse, possession or official result.

## Phase I — context-dependent individual decisions, AFTER movement

- [ ] On-ball options can change with the observed context rather than forcing every player into a fixed PASS→CARRY→SHOT script.
- [ ] Keep the existing genuine same-tick **exclusive shoe START + policy action + physical impulse** as the only action executor. No separate shot/pass implementation.

## Phase T — support, defense and team tactics, AFTER individual decisions

- [ ] A supporting teammate seeks a playable lane and avoids trapping the carrier; nearest teammates and two defenders are considered **together**, not by independent sidesteps.
- [ ] Pressing, interception intent and recovery maintain defensive shape and do not steal an authenticated higher-priority role.
- [ ] Validate blocked-lane and multiple-defender situations without teleports, proximity-derived touches or the loss of 0.98m separation.
- [ ] Measure useful passing options, stalled time, legitimate progression and defensive responses, not minimum distance to a preselected shoe/waypoint.

- [ ] Separately review team formations/pressing/spacing, player roles, support passing angles, off-ball movement and goalkeeper behavior. These are new acceptance gates requiring objective scenario evidence; the old experimental #481 code is reference material, not an approved module to merge wholesale.

## Phase F — natural full-match integration, AFTER tactics

- [ ] Replay multiple **HOME and AWAY** ordinary-formation fixtures, with changed source player, location and pressure; no dependence on exact player IDs or a single tick.
- [ ] Read-only evidence distinguishes **intent → target/movement → real shoe contact → actual ball impulse → observed continuation**.
- [ ] A blocked attack can legitimately pass/reposition/recover: a negative shot scenario is **not** forced to shoot.
- [ ] A genuine spontaneous SHOT must satisfy the *unchanged* original shot-range/open-lane policy and same-tick exclusive Rapier shoe START, followed by real 3D ball flight.

- [ ] Build a **behavior scenario matrix**: open shot, no shot allowed, open/blocked pass lane, carrier crowded by teammate + two defenders, loose ball, opposition response, HOME/AWAY, zero-contact negative, reset, independent seed/fixture replay.
- [ ] Evaluate action provenance, real ball progress, choices when blocked, deterministic replay, safety, and per-scenario outcomes. Avoid a hard-coded golden 720-tick trace or a guaranteed shot in every scenario.
- [ ] Demonstrate a **genuine ordinary-formation natural shot** in independently verified HOME/AWAY simulations. Only then proceed to the C2 physical flight and whole-ball boundary proof.
- [ ] After C2, finish C3–C5, then D1–D5; do not advance the global % early.

## Historical C2–C5 and D1–D5 acceptance gates transferred from #480 (all OPEN)

The old baseline **A+B 10/10 plus C1 1/5 = 11/20 (55%)** is preserved only as a **historical gate count**, not a percentage of the new engine or a claim that future phases are complete. Physical PASS means an authentic pass impulse, **not necessarily a completed reception**.

- [ ] **C2 — Natural SHOT:** independently observed normal-formation HOME/AWAY real shoe START → eligible SHOT → actual impulse and subsequent 3D flight/boundary evidence; **open**. New P1–P5 work is prerequisite, **not** C2 completion.
- [ ] **C3 — DRIBBLE:** evidence-backed successive actual touches and advancement under an approved classification; not simply a carry intent.
- [ ] **C4 — INTERCEPTION / tackle / recovery:** actual opposing shoe contact plus approved, independently verifiable football outcome rules, not inferred possession.
- [ ] **C5 — AUTONOMOUS SEQUENCE:** independently replay a natural full 22-player control → pass/reception → shot **or** actual opposing interception, with no fabricated actions.
- [ ] **D1 — Determinism:** full-world replay/reset across accepted C1–C5.
- [ ] **D2 — Robustness:** adversarial, competing contact, invalid inputs, no-contact negatives.
- [ ] **D3 — Performance & CI:** fixed 60 Hz, CPU/memory, exact-HEAD targeted and separately required FULL evidence.
- [ ] **D4 — UI QA:** LAB desktop Chrome (1280×720 and 1440×900); iPhone Safari and phone viewport QA N/A by owner decision.
- [ ] **D5 — Release audit:** traceability, scope, security, and separately authorized merge/deploy decision.

## Engineering guardrails

- Canonical source contract: sealed actual Rapier collider events → sole same-tick shoe START + original physical gate → permitted physical impulse → independent later observed effects. No geometric/proximity-derived action or fake contact/possession.
- Original football policy can return PASS, SHOT, CARRY, CLEAR, REPOSITION or no action, and an unavailable SHOT must not be forced.
- Both HOME and AWAY, different actors/seeds, blocked lanes, contested ball, invalid-frame cases, reset/replay, normal 11v11 and independent full-physics trajectory evidence; no golden fixed 720-tick script or single actor.
- Keep separate targeted exact-HEAD CI from full release QA, protect main/preview/production and remote D1, grouped commits, Draft/HOLD until user authorizes merger.
- Legacy #480 is closed as superseded; historic research PRs #481 and #621 have also been **closed without merge**, with Git branches and evidence preserved. Do not reopen their superseded implementation plan. Track current controlled action completion in #620 and the clean Draft/HOLD #622 → #624 → #626 → #627 stack; only then resume these deferred phases.

**Status: READY FOR PHASE M / IMPLEMENTATION NOT STARTED.** Historical completed research/checkpoints in #480 are preserved there, but are not automatically accepted in the new architecture.

</details>

