# Football Architect — individual V4.1 re-QA prompts (2026-11-17 policy)

The owner approved realistic, non-perfectionist V4.1 QA. These are **eight self-contained second-message prompts**, with an explicit player ID, name, fingerprint and body class. Use each only in its corresponding image chat. They **DO NOT** create or modify an image.

- [#49 — Gianfranco Patry](49.md) — `243e072c6cd86198`, `lean-fit`
- [#53 — Paolo Lacasa](53.md) — `5a1bae96432df5f4`, `average-fit`
- [#54 — Massimo Bottineri](54.md) — `9ed4ab37138bc09a`, `average-fit`
- [#55 — Mario Bodi](55.md) — `518256f221ccf658`, `average-fit`
- [#56 — Ferdinando Guerriero](56.md) — `2e29062272c334fe`, `average-fit`
- [#62 — Angelo Mazzuca](62.md) — `a00e0e83a582feb0`, `average-fit`
- [#98 — Arthur Kiesel](98.md) — `1a25525aa385aac5`, `lean-fit`
- [#148 — Craig Leaman](148.md) — `59756ee2a93dab36`, `lean-fit`

For each actual candidate, inspect the source pixels and cross-reference its original ImageGen generation ID or PNG SHA-256 against issue #646. A previous FAIL is not reversed solely by changing the policy: the *same actual image* must be re-reviewed and a new issue comment added. Different candidates under one ID can have different QA results. PASS WITH NOTE = PASS for local candidate QA only. Publication/integration requires separate approval.

The **23 image-generation prompts remain unchanged**, including their frozen identity descriptions. New QA thresholds are in [the post-generation QA reference](../portrait-image-only-qa.md).
