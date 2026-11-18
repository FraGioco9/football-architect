# Player portraits V4.2 — canonical portrait version (rollout in HOLD)

## Name provenance and casting

- Citizenship is not ethnicity. Country name catalogues record **name-bank membership**, not ancestry or population genetics. The V4.2 algorithm is used only for fictional footballer casting and never infers a real person's race.
- The current dual-national name generator chooses name-bank sources for given names and surnames, but does not persist the original source draw. The V4.2 read-only exporter instead checks whether each name occurs uniquely in one of the player's two country catalogues. Both/neither = `unknown`; unknown names are never assigned an invented source.
- A surname uniquely in the secondary catalogue makes the secondary fictional background anchor 85% likely; when both given name and surname are uniquely secondary, the fictional family anchor is secondary with certainty (but visual traits remain diverse). A primary surname makes it 15% likely (35% if the given name is uniquely secondary). Other cases use balanced intermediate probabilities. The chosen anchor is fixed once the snapshot is created.
- Four broad artificial artistic priors — complexion, hair texture, hair colour and eye colour — use the chosen family anchor, with 15% influence from the other nationality. All available options have positive probabilities. **These are not real-world demographic frequencies, not obligatory looks, and not labels for real people.** All other facial details retain V4.1's individual variation.
- Example: fictional ITA/NGA player Matthew Tiamiyu has a surname in NGA's catalogue and not ITA's. The model therefore prefers an NGA family-background cue, while allowing individual variation.

## Frozen snapshot contract

- Schema `player-portraits-v5`, prompt `player-portrait-v4.2`, independent seed `football-architect:portrait-identity:v4.2`.
- Snapshot records the two nationalities, `name_origins` (first/last), one frozen `family_background` cue, version-pinned appearance traits/fingerprint and athletic body profile/variation. Never store a raw name or game age in the portrait snapshot.
- Renderer recomputes the seed, background cue, all face traits, fingerprint and frozen body variation. Any tampered or extra snapshot fields fail closed.
- V4.2 is the **only supported persistent portrait identity** after cutover. All 150 V3/V4.1 profile rows and any legacy identity-backup table are removed at activation, without archival copies. Pure generation never calls an image API. The V4.1 trait sampler is reused internally to construct V4.2 identities; this is an implementation detail, not runtime or database compatibility.

## Read-only V4.2 candidate workflow

Use an initial-data export already verified for the correct environment. Supply each ID, `name` or `first_name`/`last_name`, `nationality`, `secondary_nationality`, frozen initial physical attributes, and `initial_verified:true`.

```sh
node tools/export-player-image-prompts.mjs --input verified-initial-players.json --out ./private-v42-prompts
node --test tests/player-portrait-v42-family.test.mjs tests/player-portrait-v41-diversity.test.mjs tests/player-portrait-chatgpt.test.mjs tests/player-portrait-chat-export.test.mjs
```

The exporter without `--version` uses V4.2. The previous V4.1 export option is rejected. The ChatGPT handoff exports `buildChatGptFamilyV42PortraitExecutionFromSnapshot` and includes the new canonical prompt verbatim. Continue single-image, native alpha and visual/technical QA rules.

## Activation is blocked pending separate authorisation

The existing DEV D1 database still has 23 approved V4.1 and 127 pending V3 portraits. Migration `0033_portrait_v42_replacement.sql` is an **irreversible, destructive V4.2-only cutover**: it deletes every old portrait row, destroys the prior identity-backup table, and starts with an empty V4.2-only table. It retains the 150 `generated_players` records, but *not* previous portrait descriptions or asset associations. There is no legacy-version read path, backup or rollback. To avoid a missing-portrait window, execute only when 150 independently validated V4.2 profiles and replacement portraits are ready for an explicitly authorised cutover. New image files must not be published or associated with a player before QA. No remote D1 migration, deletion, publication, deployment or merge is authorised by this code-only preparation; obtain separate approval for each protected step.
