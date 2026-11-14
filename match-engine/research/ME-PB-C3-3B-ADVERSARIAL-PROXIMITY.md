# Match Physics V1 — C3.3b adversarial physical carry audit

**Candidate implementation; exact-head Rapier CI pending.** Preceding [C3.3a #43255311486](https://github.com/FraGioco9/football-architect/actions/runs/43255311486) passed 725/725 Node tests and complete general CI. Top-level C3 remains **OPEN**; a second same-player physical shoe START and a small actor–ball gap are **not automatically football dribbling or possession**.

## No new physics and no product decisions

The existing sealed, read-only 60 Hz same-world Rapier proximity observer now retains:
- measured *horizontal* actor–ball gap on each frame and the independently observed 3D ball and 2D actor path;
- diagnostic-only number of frames outside the existing 1.25 m near band, longest consecutive out-of-band run, ball-behind-player frames (signed goal direction, mirrored for HOME/AWAY), and lateral offset frames beyond a **diagnostic** 0.75 m;
- five explicit mutually exclusive interruption reasons when a pending same-player carry is interrupted: `opponent-shoe`, `teammate-shoe`, `ambiguous-shoes`, `expired` (after 150 physics ticks) and `unverified-second-start`. Cumulative totals must equal the interrupted-window count;
- last immutable interrupted window, including the actual foreign shoe IDs (where applicable), physical displacement and prior END provenance. A second unrelated Rapier shoe START/ACTIVE **irreversibly invalidates** the original candidate. An opponent/teammate contact is evidence of interruption, **not** automatic tackle/interception.

These numbers do not alter the actor's target, player acceleration, physical shoe contacts, ball velocity, ball attachment or scoring. The existing C3.2b authenticated second physical START+0.42 N·s impulse and actual END remain prerequisites for any fully observed window. `ballControlConfirmed:null`, `dribbleConfirmed:null`, `officialMatchPossession:false`, `officialMatchResult:null` are invariant. The 1.25/0.75 m bands do **not** encode new product rules.

## Independent regression and real-Rapier gate

1. Four **synthetic-only contract tests** intentionally exercise adversarial feed-shaped vectors: opponent shoe, teammate shoe, simultaneous contacts, expiry, missing physical END, unverified second touch and unrealistic wide-gap/lateral/behind-ball pairs. They prove there is **no false carry-window continuity or implied possession**. They do **not** prove a real Rapier contact, even when the test supplies a fabricated read-only C3.2b witness.
2. The existing mirrored HOME/AWAY 600-tick 22-player pinned-Rapier deterministic carry tests continue to validate real second same-player shoe impulses and gap windows. Any reported opponent/teammate interruption must match a genuine per-frame Rapier START/ACTIVE. **Zero opponent starts in an authentic carry fixture are a valid negative**, not grounds to place an artificial opponent near the ball.
3. Independent accepted real 22-player C3.1 fixtures also witness natural successive **teammate and opponent** Rapier shoe STARTs with carry opt-in OFF. The new C3.3b regression explicitly proves those genuine foreign contacts still produce ZERO physical carry/proximity windows and no dribble/possession. This crosschecks natural opponent-event provenance separately from the uninterrupted carry proof.
4. The opt-in research CLI `autonomousActions:true,autonomousCarry:true` now exposes interruption counters and the last interruption, without changes to the primary on-site owner-controlled situation LAB or its public routes.

**Acceptance boundary:** C3.3b is an adversarial **observer/diagnostic** milestone, not a dribble rule or a confirmed successful tackle. Acceptance requires the new synthetic negatives plus unchanged real-Rapier HOME/AWAY recontact and close-proximity QA and exact-head CI. For a full C3 decision, later requirements include genuine pressured opposition fixtures proving actual interruptions, and an explicit independently approved gameplay rule classifying when repeated real contact is a dribble. No merge, DEV/Preview/Production deploy, schema or D1 writes are authorized.
