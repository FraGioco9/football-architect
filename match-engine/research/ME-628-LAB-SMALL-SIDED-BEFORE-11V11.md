# #628 — Small-sided situations FIRST, before 11v11

**Product pivot (owner request)**: do not proceed to full-match 11v11/longer event integration before the real physical situations below have been tested and iterated. Existing 90-minute duration tests remain non-authoritative evidence; they are not complete football match gameplay.

## New visible Match Engine Lab exercises

1. **S-01 · 1v1 vs goalkeeper** — forward #10 versus the real opposing #1, two physics shoe colliders.
2. **S-02 · 1v1 + goalkeeper** — forward, defender #2 and opposing #1, three active shoe colliders.
3. **S-03 · 2v1 + goalkeeper** — forwards #9/#10 against defender #2 and goalkeeper #1, four physical shoe colliders.
4. **S-04 · 2v2 + goalkeeper** — attackers #9/#10 versus defenders #2/#3 and goalkeeper #1, five physical shoe colliders.
5. **S-05 · 3v3 + goalkeeper** — forwards #9/#10/#11 versus defenders #2/#3/#4 and goalkeeper #1, seven physical shoe colliders.

All five exercises support HOME and AWAY mirrors, one original Rapier World, original ball, original 60Hz policy, and actual native player movement and shoe collisions. Only initial positions are staged before tick zero. Unused canonical identities remain in the validated movement frame for existing compatibility, **but have no Rapier shoe colliders and are excluded from teammate/opponent decisions**. Neither visual filtering alone nor the old 22-shoe simulation counts as a legitimate small-sided exercise.

Physical SHA/TACKLE/SAVE/GOAL outcomes must be supported by source-positive evidence: the existing original uniform policy applies a ball impulse only with a genuine exclusive shoe START. The original B05 referee and B06 read-only timeline independently observe actual ball exit/goals. No automatic scored goal, catch, tackle success, completed pass, possession or official result.

## UI cleanup

- Original single Scenario selector now shows **4 ball physics + 5 small-sided situations + 6 advanced movement scenes** (15 entries, 3 groups).
- Remove obsolete introductory 17 one-action and 24 early/redundant movement items **from the visible picker** to avoid distracting from 1v1/2v2 refinement.
- **Do not delete** established old test catalogues, physics code or negative controls. Their hidden modal options and existing Node regression tests remain for reproducibility and protection.
- No new 11v11 panel, no extra launcher, no world/gameplay DB writes.

## Acceptance and next QA

- Build each exercise using true 2–7 Rapier shoe colliders and verify same-tick native START/manifold and original impulses; inactive identities can never produce native ball contacts.
- HOME/AWAY replay deterministic with 22 canonical movement *identities* but only selected physical participants. Verify no illegal inferred outcomes, and source-positive exit before stopping.
- Per-exercise real QA: goalkeeper approach/dive and parry; defender pressure and ball pursuit; pass/support and receiver recontact; overload 2v1; lane choice, shot attempts and outcomes on full-ball geometry; multi-step physics when no event occurs.
- Keep PR Draft/HOLD and #628 full match H2b2b2 explicitly blocked until situational QA approval.
- Do not tune gameplay physics parameters yet, merge, deploy or touch remote D1.
