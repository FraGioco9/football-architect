# ME-628 — Fast plausibility QA checkpoint

**Goal:** credible, understandable football actions; not exact biomechanical reproduction. Do not restart shoe-contact/sub-tick optimization unless a specific visible defect has been observed.

## Existing automated evidence

The existing [ME-01 exact-head run](https://github.com/FraGioco9/football-architect/actions/runs/44449324435) passed native Rapier tests, routing/security, Chrome LAB interaction and Play/Pause/Step/Reset. This is **functional evidence**, not an owner-confirmed **visual quality** pass; no suitable LAB screenshots were attached to this run.

Deep 10-arm toe/recovery and seven-arm Sprint cadence/track research suites are now **opt-in** via `FA_MATCH_ENGINE_DEEP_RESEARCH=1` and no longer run on every commit. The 60-seed safety/regression checks and Chrome functional QA remain part of ordinary ME-01. Dedicated M17/M18/M19/M20 and 90-minute research workflows now trigger on their **own analysis sources** rather than unrelated Match Engine changes. The mandatory FULL evidence gate and ordinary site/security checks are unchanged.

## Four-scene short owner visual review

Use the DEV Match Engine LAB at `http://localhost:2000/` with the visible main-field Action scenario selector; no separate 11v11 panel. Play a short sequence and observe the actual field:

| Scene | Plausible visual behavior | Not required |
| --- | --- | --- |
| **Carry Solo** (`carry-solo`) | Ball rolls naturally as the player runs with it; no repetitive violent bounces, floating ball or teleport | Exact native shoe START count / perfect gait |
| **Goalkeeper 1v1** (`keeper-1v1`) | Attacker approaches and keeper reacts credibly to the real ball | Forced save / goal |
| **2v1 Overload** (`overload-2v1`) | Defender and two attackers move on the correct pitch at a believable scale | Perfect tactical intelligence |
| **3v3 Duel** (`duel-3v3`) | Several players move sensibly; physical contacts do not produce absurd jumps or motion | Complete 11v11 match rules |

Check HOME/AWAY in Carry Solo plus one opposed case. Confirm **Pause**, one **Step**, and **Reset**. **PASS** only when the owner sees no clear, repeatable visual defect; otherwise note *scene / side / variant / tick / observable symptom* for one bounded fix.

**Owner visual signoff: PENDING.** Automated success does not constitute visual acceptance.

## Then proceed to base match actions

Prioritize end-to-end visible chains: shot → flight/outcome, pass → receiver opportunity, cross → receiver opportunity, defender challenge → genuine ball response, goalkeeper → observed reaction, restart → continuous play. Choose one **missing user-visible behavior** at a time. Use small HOME/AWAY samples and focused tests; do not add broad parameter surveys or infer official goals/possession without real match authority.

**PR #633 remains Draft/HOLD; no merge, deployment or DB mutation is part of this checkpoint.**
