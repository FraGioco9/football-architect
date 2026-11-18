# Player portraits V4.2 — fictional family context (opt-in)

## Name provenance and casting

- Citizenship is not ethnicity. Country name catalogues record **name-bank membership**, not ancestry or population genetics. The V4.2 algorithm is used only for fictional footballer casting and never infers a real person's race.
- The current dual-national name generator chooses name-bank sources for given names and surnames, but does not persist the original source draw. The V4.2 read-only exporter instead checks whether each name occurs uniquely in one of the player's two country catalogues. Both/neither = `unknown`; unknown names are never assigned an invented source.
- A surname uniquely in the secondary catalogue makes the secondary fictional background anchor 85% likely; when both given name and surname are uniquely secondary, the fictional family anchor is secondary with certainty (but visual traits remain diverse). A primary surname makes it 15% likely (35% if the given name is uniquely secondary). Other cases use balanced intermediate probabilities. The chosen anchor is fixed once the snapshot is created.
- Four broad artificial artistic priors — complexion, hair texture, hair colour and eye colour — use the chosen family anchor, with 15% influence from the other nationality. All available options have positive probabilities. **These are not real-world demographic frequencies, not obligatory looks, and not labels for real people.** All other facial details retain V4.1's individual variation.
- Example: fictional ITA/NGA player Matthew Tiamiyu has a surname in NGA's catalogue and not ITA's. The model therefore prefers an NGA family-background cue, while allowing individual variation.

## Frozen snapshot contract

- Schema `player-portraits-v5`, prompt `player-portrait-v4.2`, independent seed `football-architect:portrait-identity:v4.2`.
- Snapshot records the two nationalities, `name_origins` (first/last), one frozen `family_background` cue, version-pinned appearance traits/fingerprint and athletic body profile/variation. Never store a raw name or game age in the portrait snapshot.
- Renderer recomputes the seed, background cue, all face traits, fingerprint and legacy-version body variation. Any tampered or extra snapshot fields fail closed.
- Existing V3, V4 and V4.1 snapshots, accepted photos and original V4.1 seed remain unchanged. This is opt-in only and makes no image/API/provider call.

## Read-only candidate workflow

Use an initial-data export already verified for the correct environment. Supply each ID, `name` or `first_name`/`last_name`, `nationality`, `secondary_nationality`, frozen initial physical attributes, and `initial_verified:true`.

```sh
node tools/export-player-image-prompts.mjs --input verified-initial-players.json --out ./private-v42-prompts --version v4.2
node --test tests/player-portrait-v42-family.test.mjs tests/player-portrait-v41-diversity.test.mjs tests/player-portrait-chatgpt.test.mjs tests/player-portrait-chat-export.test.mjs
```

The original exporter invocation without `--version` remains pinned to V4.1. The ChatGPT handoff exports `buildChatGptFamilyV42PortraitExecutionFromSnapshot` and includes the new canonical prompt verbatim. Continue single-image, native alpha and visual/technical QA rules.

## Activation is blocked pending separate authorisation

The active D1 `player_portrait_profiles` constraint, introduced by migration `0031_portrait_v41_replacement.sql`, accepts only V3 and V4.1. V4.2 cannot be persisted without a **new, separately approved D1 migration**; do not edit migration history. A future activation requires guarded write and rollback logic, version-aware export/runtime, exact-head CI, DEV/Preview QA and explicit owner approval. Do not change live D1, generate or publish assets, merge, or deploy based on this opt-in module alone.
