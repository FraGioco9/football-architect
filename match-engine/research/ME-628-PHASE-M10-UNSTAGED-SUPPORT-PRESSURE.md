#628 Phase M10 — ordinary 22-player opponent-aware support under native physics observation

## Claim limited to source evidence

This LAB reads the EXISTING autonomous `createPlayerMovement()` with **no options** and the accepted original `INITIAL_PLAYERS` formation. Unlike M8/M9, no opponent is moved, no `researchBodyEncounter` option, no fixture-specific target is assigned, and there is no before-tick-zero player relocation. Every player follows the original mover's 60Hz rules, including 7m/s speed, turn/brake limits and 0.98m hard interplayer separation.

M-17 starts only the original Rapier ball at mirrored `x=±27m`, which is already the established M6 support-lane test ball. M-18 starts the original ball at central `x=0`, identical to established M6 neutral negative. The ball is never teleported mid-session. Both run the M9 DEV-only one-world/one-native-queue shoe-and-body observer, action executor disabled.

## Current real physical/behavioral measurements

- Source-of-truth support assignment is the original `frame.supports[side]` (player, current lane and sampled target). No fallback support target is synthesized. Support path counts only consecutive actual runner XY for the same original assigned player and the same lane; positive target advance uses the actual source target.
- Opposing pressure is **only** the independently assigned original `frame.pressers[oppositeSide]`, matched to one of the 22 current opposing actor IDs. Its *actual measured* consecutive XY displacement is counted only while the same support runner and same opposing presser persist. The current presser-to-runner and presser-to-target distances are observed, not assigned. No pass interception, man-marking or physical contest is inferred from the assignment.
- Independently resample the minimum clearance from the original 11 opposing player positions to the selected support lane after the mover tick. The original support policy measured previous positions, so differences are bounded by real 7m/s × 1/60s movement; exceedance is a hard error.
- A **support-under-observed-opposition witness** requires a real support assignment, measured support runner path >0.5m, actual target advance >0.35m, the same original presser's measured path >0.25m and movement on a positive number of consecutive ticks, plus the current original Rapier 22-body bridge and shared event queue. No fixed duration, fake opponent, target steering or football match action counts.
- Neutral M-18 has the same physical bridges and original 22-player mover, but no original support assignment in the neutral ball territory; it cannot report a support/pressure witness without genuine assignment. Source shoe/body collision events are independently exposed even if zero; no requirement to force a body START in ordinary play.

## Acceptance gates

Node deterministic HOME/AWAY 60Hz replay, original 22 identities and paired ordinary/neutral scenarios, original clearance bound, 0.98m separation, <=7m/s, no body-feedback application without real native contact, original M1–M9 and five genuine Action LABs unchanged, DEV-only route security and Chrome desktop interactions. Original Rapier physical START must be reported only if the queue genuinely emits one; absence remains absence.

**Not a Phase M sign-off:** this proves movement and opponent-aware support while both native observation systems are running with real ball physics. It does **not** by itself prove spontaneous body-body impacts, dual-contact gameplay action outcomes, an interception, a tackle, a successful pass, or 11v11 readiness. Those remain separate release gates before Phase I/T/F. C2–C5/D1–D5 remain OPEN. PR #633 stays Draft/HOLD; no merge, deployment or remote DB mutation.