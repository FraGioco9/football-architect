# Shared DEV/Preview D1 — read-only preparation and activation gate

Status: **Draft/HOLD**. No remote D1 migration, write, import, Worker deploy, or GitHub merge is authorized by this change. This runbook prepares a future approved cutover; it does not synchronize two separate databases automatically.

## Existing infrastructure (verified read-only on 2026-11-11)

- Shared nonproduction D1: `football-architect-dev`; pool label: `dev-preview`.
- Two Cloudflare Worker deployments, `preview` and `football-architect-preview`, already bind `DB` to the **same** nonproduction D1. Production is not used here.
- The cloud D1 has migrations through `0018_owner_permissions_insert_guards.sql`; `generated_players` and `player_generation_drafts` do **not yet exist**.
- Pending schema migrations, in order: `0019_player_email_change.sql`, `0020_player_generation.sql`, `0021_player_numeric_ids.sql`. Do **not** apply these to Cloudflare without a fresh, explicit remote-mutation authorization, target verification, and backup.
- `/api/environment` is already a fail-closed nonproduction handshake. `tools/shared-nonproduction-proxy.mjs` rewrites permitted origin/cookies safely and retains auth/CSRF checks. It proxies the Worker, not raw D1 SQL.

## Explicit local modes

**Isolated local D1 (unchanged):**
```powershell
node tools/dev.mjs
```
Starts the loopback frontend and local Wrangler Worker/D1. Does not access cloud data. `--lan` remains local-only.

**Shared DEV/Preview Worker (only after approved remote schema/deployment):**
```powershell
node tools/dev.mjs --shared https://football-architect-preview.giocolifrancesco.workers.dev
```
Starts **only** the loopback site/app frontend. The destination is locked to the *exact* verified Cloudflare Worker hostname, never an arbitrary Workers.dev tenant. Before starting, performs anonymous read-only GET checks of:
1. `/api/environment`: exact origin, `pool=dev-preview`, `sharedWorld=true`, `separateSignIn=true`;
2. `/api/world`: authoritative world generation exists;
3. `/api/players/page/1`: the deployed Worker supports the public Players API.

If any check fails, nothing starts; there is **no fallback** to a local DB or arbitrary HTTPS/production target. The same-origin bridge uses the existing strict Host/Cookie/CSRF and response-size rules. No local Worker is started. All Admin writes through the shared frontend would affect the remote **nonproduction** D1: do not operate Admin write controls until that behavior is separately approved.

Open `http://app.localhost:2000/players`; Preview uses its own HTTPS domain. Both then use the same deployed Worker/D1 and should return the same public player IDs and counts.

## Prepare the 11 local players (offline only)

These steps read and export your **local** D1. Store dumps/bundles outside the Git repository, never in GitHub issues, PRs, chat or CI artifacts; the backup may include private credentials and the bundle contains private player attributes and draft audit history.

1. Stop `node tools/dev.mjs` with Ctrl+C. Synchronize the feature branch and confirm local migration `0021_player_numeric_ids.sql` has been applied. Check `SELECT COUNT(*) FROM generated_players` returns **11**, IDs 1–11, and payload IDs are integers.
2. Export an independent full local backup:
```powershell
cd backend
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:USERPROFILE "Desktop\fa-local-d1-$stamp.sql"
npx wrangler d1 export fa-admin-world-local --local --output "$backup"
if ($LASTEXITCODE -ne 0 -or !(Test-Path $backup)) { throw "Local backup failed" }
cd ..
```
3. Create an offline transfer bundle containing **only** 11 persisted player records and their committed generation batch receipts (never account/password/session rows):
```powershell
python tools/prepare_player_transfer.py --source "$backup" --expected-count 11 --dry-run
$bundle = Join-Path $env:USERPROFILE "Desktop\fa-players-transfer-$stamp.json"
python tools/prepare_player_transfer.py --source "$backup" --expected-count 11 --output "$bundle"
if ($LASTEXITCODE -ne 0 -or !(Test-Path $bundle)) { throw "Transfer preparation failed" }
```
The tool refuses old text/UUID player IDs, missing 0021, nonconsecutive 1–11 IDs, mismatched embedded IDs, incomplete batches, and count mismatch. It never connects to any service, never applies remote migrations, and never replaces an existing bundle. The JSON has a SHA-256 integrity field and `remote_import_authorized=false`.

## Remote activation (requires **separate explicit authorization**)

Before doing anything to the remote D1, verify ownership and exact database UUID/Worker bindings using a read-only check. Do not substitute the local placeholder D1 UUID or any Production binding.

1. Back up the remote `football-architect-dev` D1 separately, retaining a rollback copy and checking schema/version and existing players; do not overwrite remote users, permissions, profiles, calendar or world state.
2. After owner approval, apply only pending migrations `0019`, `0020` and `0021` in order to this specific remote D1; verify `generated_players.id` is `INTEGER PRIMARY KEY AUTOINCREMENT`.
3. Prepare a target-specific **transactional, guarded** importer for the offline player-only bundle, after verifying the remote current world generation, season, zero player rows, no conflicting batch IDs, and a clean source integrity digest. Rebind the new players to the remote world generation/season; never import local world/session/account tables or reset the remote world. Preserve numeric IDs 1–11 and private gameplay fields, and map/record original batch provenance explicitly.
4. Independently authorize and deploy an exact-HEAD nonproduction Preview Worker/public artifact containing the Players API and current backend. Do not deploy Production.
5. Verify remote row count = 11, IDs = 1–11, JSON IDs match, and a subsequent approved generation starts at 12. Confirm `/api/players/page/1` responses agree on both local shared DEV and remote Preview.
6. Keep isolated local D1 for tests, not as a sync source after cutover. Never automate DEV↔Preview imports with every page refresh or deploy.

The actual **remote import code/commands are deliberately withheld** until the remote target schema and existing data are rechecked after authorization; a guessed import script against the live D1 would risk overwriting other accounts or generating invalid foreign-key/audit relationships.

## CI exact-head Preview package (new, no deploy)

Pull request #496 now builds an immutable Cloudflare Preview package automatically on an approved branch change via `.github/workflows/cloudflare-preview-package.yml`. The workflow:

- checks out the **exact PR head SHA** without persistent GitHub credentials;
- installs the pinned Node/Wrangler toolchain and invokes `backend/tools/prepare-preview.mts` (which stages a guarded static site and compiles the Worker using `wrangler deploy --dry-run`);
- verifies the manifest, SHA/tree, fixed account/DB/origin and Players assets;
- uploads the checked package as a short-lived Actions artifact, containing `manifest.json`, `wrangler.json`, `bundle/`, and `assets/`.

**This is a packaging step only.** It never has a Cloudflare secret and never deploys, merges, migrates or writes to D1. The existing `publicationAuthorized:false` on the manifest is deliberately retained. The bundled Worker and frontend are both needed; serving one without the other leaves `/players` broken.

Remote D1 received the 11 source players (IDs 1–11, nine audited batches) under the owner's prior explicit authorization; no new import is needed. Before separately releasing, verify `/api/players/page/1` returns 11 and no private fields, `/api/environment` returns the correct nonproduction pool, and `/players` displays the same IDs locally and on Preview. Keep the two existing Preview Worker names isolated from Production. Never use the local-only `backend/wrangler.toml` as the release config.
