# Players — preview, approval and environment persistence

This feature extends `/admin/players` with server-owned previews and explicit approval.

## Execution
1. An Admin with `admin.access`, `admin.world.read` and `admin.world.write` configures the generation fields (Auto means canonical defaults except for Seed, which receives a fresh cryptographically random value for each preview; explicit seeds stay reproducible). The page sends `POST /api/admin/players/preview` with an authenticated session, same-origin header and CSRF token. The Worker runs a **generated pure mirror of the Node player generator** against the pinned 50-country first-name and surname catalogs.
2. The preview response shows the entire proposed cohort in paginated rows. A private, time-limited preview is saved in `player_generation_drafts`, but **`generated_players` remains unchanged**. The browser never supplies an unverified player payload to the commit endpoint.
3. The operator reviews the exact preview, enters `GENERATE PLAYERS` and clicks Generate in environment. `POST /api/admin/players/commit` transacts live authorization, world generation/season, draft identity, complete insert and approval status as one D1 batch. A repeated commit is idempotent and cannot create duplicates. **Only after a successful commit**, the form advances to a new seed derived from that draft's unique UUID, invalidates the completed preview and enables the next one; the success receipt remains visible. Failed commits do not rotate the seed.
4. Successful players are stored in `generated_players`, with permanent UUIDs, initial/current age, all attributes, and development aptitude. `entry_season` is stored as row metadata, and `club_id` is deliberately deferred. `GET /api/admin/players` returns count and the latest 100 generated players to authorized Admins.
5. Editing any option invalidates the browser draft; expiration, authorization revocation, world reset/season change or mismatched preview identity prevent a commit. A Season 0 reset purges all generated players and outstanding drafts.

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
