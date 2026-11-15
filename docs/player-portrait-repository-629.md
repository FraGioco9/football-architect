# PLAYER-PORTRAITS-04 (#629): repository manifest and prompts

**Status:** Implemented repository-file foundation on stacked Draft/HOLD branch `feat/629-portrait-prompt-manifest`. It depends on the unmerged portrait planner in PR #609. It does **not** connect the Cloudflare Worker creation transaction to the portrait table, deploy, mutate D1 or call an AI/image service.

## Files

| File | Purpose |
| --- | --- |
| `data/players/portrait-templates/v3.txt` | The shared, fixed version-3 media-day photo prompt. The compiler verifies byte-for-byte parity with #609's canonical `buildPortraitPrompt`; older approved prompts cannot silently change |
| `data/players/portrait-manifest.json` | The **source-controlled, immutable ID-keyed visual profiles**. Each record stores face traits and fingerprint, primary/secondary nationality context, body archetype/conditioning, image approval state and local static asset path |
| `data/players/portrait-prompts.json` | A **generated**, checked-in single file with complete prompts by permanent numeric ID; never hand-edit |
| `tools/build-player-portrait-prompts.mjs` | Offline `--check`, `--write`, and append-only `--sync --input` commands. No network, D1, R2, API keys, paid models or GitHub tokens |

The manifest currently holds the three owner-approved images from merged PR #625 and no invented records:
- **#44 Giacinto Lello (ITA):** long oval face, deep brown complexion, short auburn/coily hair, green eyes, clean-shaven, balanced-athletic and natural conditioning. Approved asset `44.webp`.
- **#98 Arthur Kiesel (GER):** rounded face, light olive complexion, dark-blond slightly wavy short curly hair, brown eyes, mustache/stubble, lean-athletic and endurance conditioning. Approved asset `98.webp`.
- **#145 Steven Sellen (ENG):** rounded face, very deep brown complexion, blond loose curly medium hair, brown eyes, clean-shaven, power-athletic and natural conditioning. Approved asset `145.webp`.

### Evidence

The three permanent IDs, names, citizenship fields and physical values were verified using a **read-only SELECT** from the preexisting `football-architect-dev` D1 database on 2026-11-15, with zero writes. Raw physical metrics were **not committed to the portrait manifest**: only their approved visual category and conditioning are stored. The identity traits are from the canonical, ID-only V1 SHA-256 appearance catalogue in #609; they match the three approved sample descriptions.

The build table is unchanged: `mobility=(speed+agility)/2`. Power-athletic when strength >=72 and strength-mobility >=8; lean when mobility >=72 and strength <=47; lean-athletic when mobility >=67 and strength <72; otherwise balanced-athletic. Stamina defines subtle (1–34), natural (35–74) or endurance (75–99) conditioning. Nationality is **context only**, never ethnicity or skin-tone inference.

## Commands (Node 22, Windows PowerShell)

```powershell
node --test tests/player-portrait-repository.test.mjs
node tools/build-player-portrait-prompts.mjs --check
node tools/build-player-portrait-prompts.mjs --write
```

To **add new committed players** later, prepare an expressly authorized *read-only public players export* containing only numeric `id`, `display_name`, `nationality`, `secondary_nationality` and public `strength/speed/agility/stamina`, then:

```powershell
node tools/build-player-portrait-prompts.mjs --sync --input .\\players-public.json
node tools/build-player-portrait-prompts.mjs --check
```

The command fails on preview IDs, duplicate IDs, unsupported nationalities, missing stats, raw private fields, prompt changes, noncanonical face fingerprints, version mismatch or unsupported template edits. Existing snapshots are preserved unchanged, even if live stats or nationalities later change. Newly imported IDs are `pending` with no image asset. The repository file updates only when the operator reviews and commits the resulting Git diff.

## Boundary of this change

- No Admin UI is needed.
- No repository file is written directly from a Cloudflare Worker. A Worker cannot push Git commits and should not hold GitHub credentials.
- This initial source-controlled snapshot is not automatically synced with all DEV/Preview or Production players. #629 still needs **separate Worker-compatible commit-time private D1 snapshots, a migration, an authenticated read-only export and end-to-end QA**. The offline `--sync` step will consume those snapshots once that phase is authorized and implemented.
- No extra player image is generated and no image is changed. Approval of the three existing photographs does not approve future generations.
