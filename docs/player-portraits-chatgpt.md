# Player portraits — canonical, reusable workflow

This repository contains the **generic rendering, QA and publication pipeline**, not a catalogue of prompts, approval reports or SQL commands for individual footballers. Approved photographs are the only intentional player-specific files in source control: `assets/players/portraits/<positive-player-id>.webp`. Git history and issue comments retain historical integration evidence.

## Identity and input authority

- Each player is identified by its numeric `generated_players.id`; personal identity data and initial attributes come from the corresponding committed `player_generation_drafts.candidates_json` entry or another independently verified immutable source.
- Do **not** derive an immutable face/body identity from changing gameplay attributes, a current roster, the player's name, ethnicity assumptions or another picture.
- A portrait profile is stored in `player_portrait_profiles`: `schema_version`, `prompt_version`, immutable `snapshot_json`, `status`, `asset_key`, `created_at`. Version tags determine which canonical builder/renderer to use; do not silently rewrite an existing snapshot with a new version.
- Current generic modules: `backend/src/player-portrait-core.mjs`, `backend/src/player-portrait-diversity-v41.mjs`, `backend/src/player-portrait-chatgpt.mjs`.
- The V4.1 contract has an immutable seed, facial fingerprint, 24 descriptors, a frozen physique class and independently reproducible prompt. Previous V3/V4 contracts remain supported for historical and pending profiles.

## Generate one candidate (no automatic publication)

1. Select **one** player ID. Retrieve the current profile and verify the initial physical attributes against the committed generation batch. Use only the requested environment; never assume a DEV player ID refers to the same person in Production.
2. For the image-only ChatGPT flow, supply the verified entry to `tools/export-player-image-prompts.mjs` (local/offline). Usage: `node tools/export-player-image-prompts.mjs --input verified-initial-players.json --out ./private-image-prompts`. Keep exports out of Git.
3. Generate a **new original image from text**. The first ImageGen message must contain only canonical visual information. Do not use an old portrait as an image-edit target or feed the image back as a facial reference.
4. Review the actual PNG pixels and the **same player-specific immutable identity** using `docs/portrait-image-only-qa.md`, `docs/player-portraits-v4-qa.md` and `tools/portrait-png-preflight.mjs`/`tools/portrait-v4-qa.mjs`. An inaccessible original means technical QA is NOT VERIFIED. PASS WITH NOTE is PASS; a materially wrong identity/anatomy/physique fails.
5. After separate owner approval, create a clean alpha-preserving 320×362 WebP derivative, measure framing, inspect on light/dark backgrounds and stage at `assets/players/portraits/<id>.webp`. No per-player hardcoded JavaScript route, asset allowlist entry or repository manifest is needed. The committed filename represents the explicitly reviewed published asset. A missing image displays the silhouette.
6. Record generation ID, real hashes, version, identity/physique, QA and owner approval in the relevant GitHub issue or release record **outside per-player repository files**. Git object history tracks the precise published asset bytes. Do not confuse technical acceptance with publication consent.

## Database and rollback

- Migration `backend/migrations/0026_player_portrait_profiles.sql` introduced the V3 profile table. `0031_portrait_v41_replacement.sql` extends the schema to V4.1 and creates `player_portrait_v3_replacement_backup`. Preserve migrations **unchanged** for new installations and D1 migration history.
- The earlier DEV V3 → V4.1 rollout was completed. Historical per-player SQL, prompt bundles and integration manifests belong in Git history/issue records, not in the current generic repository.
- For subsequent migrations, construct a new **ID-scoped and owner-authorised** plan using independently verified frozen initial stats, exact expected fingerprints, audited original row values, backups and an atomic batch. Never run a universal bulk update or reuse one environment's IDs as another's.
- To roll back an already migrated player, first confirm the V3 backup exists and is unchanged, then explicitly restore the original row under a guarded D1 transaction and revert the corresponding WebP to the verified Git version. Preserve unrelated pending and approved profiles.
- DEV/Preview deployment, remote D1 writes and Production are separate permissions and release steps. A GitHub merge or a passed image QA does not authorise any other step.

## Public assets and first paint

- `assets/player-detail.js` constructs the canonical portrait URL only for a loaded, confirmed numeric player ID, **never** for protected Admin draft preview.
- `tools/publication-guard.mjs` publishes only regular files with canonical positive integer names and the `.webp` extension from the committed portrait directory. No PNGs, QA exports or per-player SQL can enter the public package.
- Image/error handlers keep the portrait and fallback mutually exclusive; layout dimensions remain reserved during loading. The public package is checked against the source files by the publication guard.
