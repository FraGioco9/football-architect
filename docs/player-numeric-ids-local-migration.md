## Numeric footballer IDs — local migration runbook

Permanent footballer IDs are positive, monotonically increasing D1 integers. A preview has no permanent ID; the approved commit assigns it using `generated_players.id INTEGER PRIMARY KEY AUTOINCREMENT`. Subsequent generations never reuse deleted IDs. Draft, world-generation, session and operation identifiers are unrelated security/audit tokens and remain opaque.

Migration `0021_player_numeric_ids.sql` upgrades previously generated players in place. All records are assigned numbers deterministically by `created_at ASC, previous id ASC`, then the same numeric ID is written to `payload_json.id`. Other fields and batch ownership are unchanged. Previously created draft candidate JSON loses obsolete player IDs; idempotent committed approvals remain valid. The historical migration `0020_player_generation.sql` must remain available to upgrade pre-existing stores.

### Apply to the **local** D1 only (from PowerShell)

Stop `node tools/dev.mjs` first. From the repository root, using the new feature branch:

```powershell
cd backend
$backup = Join-Path $env:USERPROFILE ("Desktop\fa-local-d1-before-player-ids-{0}.sql" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
npx wrangler d1 export fa-admin-world-local --local --output $backup
if ($LASTEXITCODE -ne 0 -or !(Test-Path $backup)) { throw "D1 backup failed; migration was not started" }
npx wrangler d1 migrations list fa-admin-world-local --local
npx wrangler d1 migrations apply fa-admin-world-local --local
if ($LASTEXITCODE -ne 0) { throw "D1 migration failed. Inspect the local database before restarting." }
npx wrangler d1 execute fa-admin-world-local --local --command "SELECT id,json_extract(payload_json, '$.first_name') AS first_name,json_extract(payload_json, '$.last_name') AS last_name FROM generated_players ORDER BY id;"
npx wrangler d1 execute fa-admin-world-local --local --command "SELECT COUNT(*) AS total,MIN(id) AS first_id,MAX(id) AS last_id,SUM(CASE WHEN json_type(payload_json,'$.id')='integer' AND json_extract(payload_json,'$.id')=id THEN 1 ELSE 0 END) AS matching_payloads FROM generated_players;"
```

For the user's known starting count of 11, expected verification is `total=11`, `first_id=1`, `last_id=11`, `matching_payloads=11` (assuming these are the complete pre-migration table). No remote D1, deploy, merge, or additional generation is required. Store the full export outside the repo; it may include credentials and private local account information. Start `node tools/dev.mjs` again after successful verification.

No chat-connected integration can access the user's Windows-local D1; the operator must run these commands in that environment.
