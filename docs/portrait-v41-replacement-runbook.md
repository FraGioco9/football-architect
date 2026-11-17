# #646 — Replace the 23 legacy portraits with canonical V4.1 (release runbook)

**Status: Draft/HOLD implementation, NOT RELEASED.** PR #648.
**Owner decision:** all 23 supplied player portraits are PASS; DO NOT re-run image QA or generate images.

## Scope

Exactly IDs **44–63, 98, 145, 148**. Their **WebP assets have
already been replaced on the Draft branch** at the existing public paths,
so the public Player Detail image loader already refers to the new bytes.
Do not change or rewrite identities for any other players. Legacy V3/V4
portraits outside this 23-player set remain unchanged.

Version-pinned canonical identity and physique source: the 23 headings in
[portrait-image-prompts-all.md](portrait-image-prompts-all.md). The frozen
V4.1 seed, traits and expected fingerprints must never be re-generated from
mutable gameplay attributes. The 23 file hashes are in
[the integration manifest](portrait-v41-integration-batch-2026-11-17.json).

## What replaces the prior version

1. **Public asset files:** all 23 existing
   `assets/players/portraits/<id>.webp` files now contain owner-supplied
   V4.1 derivatives on the branch. No alternate V3 image is served for
   these IDs after a separately approved release.
2. **V4.1 private snapshot contracts:** schema
   `player-portraits-v4`, prompt `player-portrait-v4.1` with frozen
   per-ID fingerprint, 24 traits, body class and deterministic body variation.
   The existing V3 rows must be replaced, **not supplemented by duplicate
   active rows**. One active row per ID remains the contract.
3. **Schema support:** migration
   `backend/migrations/0031_portrait_v41_replacement.sql` extends the
   existing profile table's allowed version pair without modifying any
   existing data; creates an empty per-ID V3 backup table for rollback.
   The separate migration must not be run automatically in a live
   environment without an authorised release decision.
4. **Guarded data cutover:** the pure function
   `prepareV41PortraitCutover` accepts EXACTLY 23 owner-verified
   records, 23 existing V3 profiles and 23 **frozen initial attribute**
   objects. It verifies ID, player name, current V3 approval, historic
   nationality, asset key, frozen V4.1 fingerprint and physique class
   before preparing any SQL. Wrong/missing data = fail closed.
5. **Legacy operator SQL:** existing
   `backend/manual/portrait-*-approved-dev.sql` and
   `backend/manual/portrait-approved-dev-backfill.sql` are historical
   **V3-only** operator instructions. They are superseded **for these
   23 IDs**. Do NOT reapply them after V4.1 replacement. Preserve Git
   history and backup records; do not use the old V3 fingerprints to
   verify the new images.

## Offline dry run (no remote data writes)

Prepare a local *read-only* export file with the following fields:

```json
{
  "manifest": { "entries": [], "missing_ids": [] },
  "players": [
    { "id": 44, "payload_json": "<complete existing generated_players payload_json>" }
  ],
  "profiles": [
    {
      "player_id": 44,
      "schema_version": "player-portraits-v2",
      "prompt_version": "player-portrait-v3",
      "snapshot_json": "<complete immutable existing V3 JSON>",
      "status": "approved",
      "asset_key": "assets/players/portraits/44.webp",
      "created_at": 1600000000
    }
  ],
  "frozen_initial_attributes": {
    "44": { "strength": 73, "speed": 69, "agility": 82, "stamina": 64 }
  }
}
```

The JSON above is **shape illustration only**: it has ONE row and dummy
timestamps and is not ready to run. Populate *all 23 IDs*. The
`manifest` must be the actual 23-row version from this PR. Never
substitute current mutable attribute values for independently
verified *initial* stats. Keep actual private exports OUT of Git.

Prepare the guarded plans OFFLINE with Node 22:

```powershell
node tools/prepare-portrait-v41-cutover.mjs --input .\private-23-frozen.json --out-prefix .\private\portrait-v41
node --test tests/player-portrait-v41-cutover.test.mjs tests/player-detail.test.mjs
python -m unittest backend/tests/test_portrait_v41_replacement_migration.py
```

The generator emits `portrait-v41-apply.sql`,
`portrait-v41-rollback.sql` and `portrait-v41-audit.json` locally,
without touching D1, the site or the repository. It refuses to
overwrite existing files. If any one of the 23 records is not proven,
no usable plan is produced.

## Release gate — separate owner approval

**Not executed by this PR:** no DEV, Preview or Production D1 changes;
no remote schema migration, asset publication, release, merge or deploy.

After separate authorisation and exact-HEAD CI:

1. Confirm the GitHub asset SHA/manifest, chosen 23 player IDs,
   versioned snapshots and the 23 archived original V3 records.
2. Apply **only** the additive/rebuild compatibility migration 0031
   in the explicitly authorised target environment; verify schema,
   row counts and old profiles are unchanged.
3. Execute the 23-row guarded V4.1 cutover in a **single atomic D1
   transaction/batch** with 23 backup inserts and 23 corresponding
   profile updates. Demand 23 affected rows for *each* operation and
   reject anything else; never assume raw SQL can safely do a
   multi-environment one-shot execution.
4. Verify all 23 records are `approved`, tagged
   `player-portraits-v4`/`player-portrait-v4.1`, with the exact new
   fingerprint and unchanged existing WebP asset key. Check protected
   preview and public player detail behavior, then publish only after
   the user specifically authorises it.
5. To roll back, revert the 23 WebP changes via Git and restore
   exact V3 rows from `player_portrait_v3_replacement_backup` using
   the guarded rollback SQL in the authorised target. Keep versioned
   backups until a separate archival decision; **never delete
   unrelated players or reset the world**.

## Verification and current risk

- **PASS recorded earlier:** all 23 image candidates, according to the
  owner. Not re-QA'ed here.
- **TECHNICAL staging evidence:** 23 transparent lossless 320×362
  images and manifest hash/margins already documented.
- **Known provenance limitation:** uploaded PNG bytes are not hash-equal
  to the earlier issue #646 candidate PNG SHA-256. The owner has
  explicitly confirmed the 23 supplied portraits. Retain this
  traceability note; do not fabricate an exact historic hash match.
- **CI failure on previous HEAD:** `tests/player-detail.test.mjs`
  pinned the old V3 WebP `VP8X` layout and hard-coded old hashes and
  <50kB budgets. The replacement contract reads hashes from the
  committed V4.1 manifest, supports valid lossless `VP8L`, keeps
  alpha/dimensions/manifest and public-artifact checks. This is a
  **contract update, not another image-identity QA**.
- Current PR remains Draft/HOLD. Exact-head CI evidence, remote data
  migration and release remain separate gates.
