#628 M23 — one-source, causal football decision candidates (Draft/HOLD)

## Purpose
Begin the **football-interaction decision phase** without making a proximity measurement look like a completed tackle, interception, reception or possession. This phase only evaluates **observed real shoe/ball contact causality** from the existing exact Action LAB sources; it does **not** grant official football outcomes.

## Original closed-world evidence
The already existing Action LAB uses one Rapier engine ball and 22 physically registered original player shoes, and its genuine contact bridge returns started/ended/active shoe IDs each 60Hz tick. The original action executor permits a physical impulse **only** with an exclusive authentic current native shoe START. M23 adds a **read-only** `createPhysicalFootballDecisionObserver` called *inside* the already closed Action LAB on that same current engine frame.

- Verify 22 canonical player IDs/teams/roles and consecutive identical physics, mover and shoe ticks, actual ball state, and a fully reconciled native START→END shoe ledger. Never infer a shoe START from distance; reject unknown actor IDs, duplicate starts, unmatched ends, stale ticks or any fabricated action impulse claim.
- Accept a *prior physical pass* only after an **exclusive original Rapier shoe START, actual Rapier impulse, and an observed real pass target**. The PASS is physical, but its completion and any receiving possession remain unproven.
- A subsequent single real target-recipient shoe START (with no earlier opposing touch) yields `possible-post-pass-receiver-contact`. If an opponent's **real** shoe START comes first, yield `possible-opponent-pass-interruption`; a later recipient touch is **unclaimed**, never a successful reception of the interrupted pass.
- Ambiguous multiple shoe START or active shoe sources never become exclusive actor decisions. Ordinary contact or real opponent CHALLENGE START without a causal prior PASS remains `unclaimed-shoe-contact`, **not** a tackle.
- The raw post-step Rapier ball velocity includes turf/gravity and is never attributed to a player's foot without the already verified action source. No additional impulse, player movement, collision, match score or D1 change is made.

## Verifications
Existing HOME receiving CONTROL produces the original real PASS at **tick 1** and the genuine receiver shoe START at **tick 30**. The original opponent-first CONTROL has a real opposing AWAY #7 shoe START at **tick 91**, then a separate receiver touch at **tick 204** that can **not** recover proof of the prior pass. Original HOME and AWAY CHALLENGE both have a physically confirmed shoe contact; matched no-contact controls have zero witnesses and no new actions. The M23 regression performs actual Rapier tick replays, verifies deterministic evidence and all negative outcome boundaries; it is appended to the existing **ME-01** suite, with no new standalone CI. The original Scenario dropdown and all 39 LAB entries are unchanged. The M23 evidence is surfaced in the existing Action LAB readout only.

## Status
M23 is a **source-grounded candidate decision observer**, not yet a working control, interception, possession or tackle authority. Those need further real ball trajectory/control continuity and opponent challenge evidence, with an explicit outcome/transition contract; the #628 checkbox stays OPEN. The separate natural simultaneous multi-pair Rapier gate also stays OPEN. PR #633 remains Draft/HOLD: no merge, Ready, deploy or remote D1 mutation.
