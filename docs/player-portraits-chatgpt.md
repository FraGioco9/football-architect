# Player portraits — canonical, reusable workflow

This repository contains the **generic rendering, QA and publication pipeline**, not a catalogue of prompts, approval reports or SQL commands for individual footballers. Approved photographs are the only intentional player-specific files in source control: `assets/players/portraits/<positive-player-id>.webp`. Historical migration files remain in repository history for migration-order integrity, but are not supported portrait versions.

## Identity and input authority

- Each player is identified by its numeric `generated_players.id`; personal identity data and initial attributes come from the corresponding committed `player_generation_drafts.candidates_json` entry or another independently verified immutable source.
- Do **not** derive an immutable face/body identity from changing gameplay attributes, a current roster, the player's name, ethnicity assumptions or another picture.
- A portrait profile is stored in `player_portrait_profiles`: `schema_version`, `prompt_version`, immutable `snapshot_json`, `status`, `asset_key`, `created_at`. **Only** `player-portraits-v5` / `player-portrait-v4.2` is valid after the authorised cutover. Older stored portrait versions are not supported.
- Active modules: `backend/src/player-portrait-family-v42.mjs`, `backend/src/player-portrait-name-origins.mjs`, `backend/src/player-portrait-chatgpt.mjs`, and `tools/export-player-image-prompts.mjs`. V4.2 may internally reuse V4.1 sampling utilities but never supports its stored snapshots.
- The V4.2 contract contains an immutable seed, frozen traits/fingerprint, fictional family-context cue and frozen physique. All new portraits, including single-nationality players, use V4.2.

## Generate one candidate (no automatic publication)

1. Select **one** player ID. Retrieve the current profile and verify the initial physical attributes against the committed generation batch. Use only the requested environment; never assume a DEV player ID refers to the same person in Production.
2. For the image-only ChatGPT flow, supply the verified entry to `tools/export-player-image-prompts.mjs` (local/offline). Usage: `node tools/export-player-image-prompts.mjs --input verified-initial-players.json --out ./private-image-prompts`. Keep exports out of Git.
3. Generate a **new original image from text**. The first ImageGen message must contain only canonical visual information. Do not use an old portrait as an image-edit target or feed the image back as a facial reference.
4. Review the actual PNG pixels and the **same player-specific immutable identity** using `docs/portrait-image-only-qa.md`, `docs/player-portraits-v4-qa.md` and `tools/portrait-png-preflight.mjs`/`tools/portrait-v4-qa.mjs`. An inaccessible original means technical QA is NOT VERIFIED. PASS WITH NOTE is PASS; a materially wrong identity/anatomy/physique fails.
5. After separate owner approval, create a clean alpha-preserving 320×362 WebP derivative, measure framing, inspect on light/dark backgrounds and stage at `assets/players/portraits/<id>.webp`. No per-player hardcoded JavaScript route, asset allowlist entry or repository manifest is needed. The committed filename represents the explicitly reviewed published asset. A missing image displays the silhouette.
6. Record generation ID, real hashes, version, identity/physique, QA and owner approval in the relevant GitHub issue or release record **outside per-player repository files**. Git object history tracks the precise published asset bytes. Do not confuse technical acceptance with publication consent.

## Database cutover — V4.2 only, no old identity storage

- Existing migration files `0026` and `0031` stay immutable to preserve migration order for new local databases; they do not establish continuing compatibility.
- Migration `backend/migrations/0033_portrait_v42_replacement.sql` removes **all** previous portrait rows and deletes the old portrait-backup table. After it is applied, only `player-portraits-v5` / `player-portrait-v4.2` can be stored.
- No old identity backups, compatibility mode or historical-portrait restoration paths are created. The migration is **destructive**: old portrait descriptions, statuses and asset associations cannot be recovered from D1 afterward.
- Do not activate this migration until all 150 replacement identity snapshots and their image/QA plan are ready for a coordinated, owner-authorised cutover. Independent application would leave an empty portrait table. The `generated_players` records are unaffected.
- Remote D1 writes/deletions, WebP publication, deployment and PR merge each require separate authorisation.

## Public assets and first paint

- `assets/player-detail.js` constructs the canonical portrait URL only for a loaded, confirmed numeric player ID, **never** for protected Admin draft preview.
- `tools/publication-guard.mjs` publishes only regular files with canonical positive integer names and the `.webp` extension from the committed portrait directory. No PNGs, QA exports or per-player SQL can enter the public package.
- Image/error handlers keep the portrait and fallback mutually exclusive; layout dimensions remain reserved during loading. The public package is checked against the source files by the publication guard.

## V4.2 — only supported portrait workflow (rollout staged)

The image-only exporter now defaults to V4.2, and attempts to select V4.1 or V3 are rejected. Use independently verified, **frozen initial player data** to build `player-portraits-v5` / `player-portrait-v4.2` descriptions. The two nationality catalogues and the given/surname membership inform fictional casting without assuming real ancestry. See [V4.2 family-context design and cutover](player-portraits-v42-family-context.md) and [150-player rollout checklist](player-portraits-v42-rollout.md). No images or remote D1 records have been changed by this preparation.
