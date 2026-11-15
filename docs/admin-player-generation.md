# Players — preview, approval and environment persistence

This feature extends `/admin/players` with server-owned previews and explicit approval.

## Execution
1. An Admin with `admin.access`, `admin.world.read` and `admin.world.write` configures the generation fields (Auto means canonical defaults except for Seed, which receives a fresh cryptographically random value for each preview; explicit seeds stay reproducible). The page sends `POST /api/admin/players/preview` with an authenticated session, same-origin header and CSRF token. The Worker runs a **generated pure mirror of the Node player generator** against the pinned 50-country first-name and surname catalogs.
2. The preview response shows the entire proposed cohort in paginated rows. A private, time-limited preview is saved in `player_generation_drafts`, but **`generated_players` remains unchanged**. The browser never supplies an unverified player payload to the commit endpoint.
3. The operator reviews the exact preview, enters `GENERATE PLAYERS` and clicks Generate in environment. `POST /api/admin/players/commit` transacts live authorization, world generation/season, draft identity, complete insert and approval status as one D1 batch. A repeated commit is idempotent and cannot create duplicates. **Only after a successful commit**, the form advances to a new seed derived from that draft's unique UUID, invalidates the completed preview and enables the next one; the success receipt remains visible. Failed commits do not rotate the seed.
4. Successful players are stored in `generated_players`, with permanent, monotonically increasing positive integer IDs, initial/current age, all attributes, and development aptitude. `entry_season` is stored as row metadata, and `club_id` is deliberately deferred. `GET /api/admin/players` returns count and the latest 100 generated players to authorized Admins.
5. Editing any option invalidates the browser draft; expiration, authorization revocation, world reset/season change or mismatched preview identity prevent a commit. A Season 0 reset preserves already committed generated players (and their portrait profiles) and clears only outstanding uncommitted generation drafts.

## Public directory
- `GET /api/players` (first page) and `GET /api/players/page/{n}` (50 per page, with bounded path-only page numbers) read the **current world's** approved `generated_players` rows. They never generate or mutate data.
- The Worker uses `projectPublicFootballerProfile` to allowlist numeric ID, display name, country, positions, current persisted age, height and preferred foot. Internal attributes, development aptitude, seed, preview and batch metadata are never sent to browsers.
- `/players` renders these responses in the existing six-column table; a temporary loading row never claims the database is empty. The local DEV bridge allows anonymous GET and strips cookies/CSRF headers. No new D1 migration.
- Only the selected environment's persisted players are shown. Local D1 records are not copied to GitHub or other environments.

## Local development preview troubleshooting
- `/admin/players` requires the DEV API bridge to forward `POST /api/admin/players/preview`, `POST /api/admin/players/commit` and `GET /api/admin/players` to the **running local Worker**; the bridge must support large, bounded player previews. Ordinary private APIs retain their 64 KiB response cap.
- If the backend returns `players_preview_unavailable`, verify that the **local-only** `0020_player_generation.sql` migration has been applied to the same persisted D1 database used by the Worker. Never apply it remotely without separate authorization.
- The Admin must have `admin.access`, `admin.world.read` and `admin.world.write`, an authenticated Player session and a valid CSRF token. The page shows the API error code after the preview error label.

## Deployment boundary
- D1 migration: `backend/migrations/0020_player_generation.sql`. **No remote migration, database write or deploy is performed by this PR.** Apply the migration to the explicitly selected environment only after authorization, before deploying a Worker serving this interface.
- The Worker uses the environment's existing `DB` binding and Player authentication pool. No cross-environment copy is permitted. Local DEV and remote preview/production pools remain isolated by existing environment configuration.
- The generator source of truth is `tools/players-generation-trial.mjs`. Run `node tools/build-players-runtime.mjs` after changes; `--check` is enforced by targeted parity QA.
- The country source catalogs in the repository include entries marked `production_ready:false` and upstream licensing notes; **production rollout must be separately reviewed**. These source restrictions are not bypassed by the feature.

## Verification
- `node --test tests/players-generator-runtime-parity.test.mjs`
- `node --test tests/admin-page.test.mjs`
- Backend D1 tests: `npm --prefix backend test`, especially `backend/tests/players-generation-runtime.test.ts`
- Admin browser test: `tests/admin-settings-browser.mjs`

The preview phase does not persist permanent players, and the UI never runs a generation without an explicit approval action.

## Immutable portrait variables — PLAYER-PORTRAITS-04 (#629)

The new additive local-first D1 migration `backend/migrations/0026_player_portrait_profiles.sql` introduces private `player_portrait_profiles` snapshots. After Admin preview approval, `commitPlayerGeneration` reserves permanent IDs from the SQLite AUTOINCREMENT high-water mark, checks the unchanged sequence inside a single D1 batch, and commits **both** player records and their immutable portrait variables in the same transaction. A raced sequence changes fail closed without partial players; the original draft can be retried. No prompt appears in the public player JSON.

Only the face catalogue seeded by permanent ID and the creation-time four athletic ratings determine an initial portrait snapshot. The prompt is **not stored in D1**: an authorized admin read of `GET /api/admin/players/portrait?playerId=N` materializes the V3 media-day prompt from the private snapshot using the version-pinned Worker-safe generator (`backend/src/player-portrait-core.mjs`). It never uses evolving current physical attributes to change an approved appearance. No AI is invoked and no Admin portrait UI is added.

The three previously owner-approved DEV photos can be associated using the separate, guarded **manual** script `backend/manual/portrait-approved-dev-backfill.sql`, only after verifying the selected DEV pool and granting **separate explicit authorization** for applying the migration and writing the backfill. The file is deliberately outside `backend/migrations/`: migrations **never** silently attach DEV IDs 44, 98 or 145 in other environments. Approved WebP bytes are untouched. No cloud upload, external AI job or production DB migration is part of this implementation.

Targeted QA: `node --test tests/player-portrait-core.test.mjs`, `npm --prefix backend test -- player-portrait-runtime`, `python -m unittest discover -s backend/tests -p test_player_portrait_profiles_migration.py`, and exact-head CI. The old GitHub manifest, prompt exporter and PNG pilot utilities are not merged into runtime source.
