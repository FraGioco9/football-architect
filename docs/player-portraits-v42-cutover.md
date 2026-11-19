# V4.2-only identities — merge before image generation

**Decision (2026-11-19):** the V4.2 identity code can be merged before creating
any new player portraits. Image generation, visual approval and image
publication belong to a **separate post-merge workstream**.

**Safety:** GitHub merge, Cloudflare Worker deploy, and DEV D1 migration are
three separate operations. None of them is performed by the tools described
here; each remote operation needs its own explicit owner authorisation.
No previous V3/V4/V4.1 identity backups or compatibility are retained after
the separately approved migration.

## Phase 1 — code merge (NO image generation, NO D1 migration)

- Required exact-head CI: new-player preview and commit, 1/multi-player
  V4.2 transactions, exclusive-version schema, player-page fallback and
  staging/migration tests.
- Public player detail exposes an image reference **only if** D1 reports
  `schema_version='player-portraits-v5'`,
  `prompt_version='player-portrait-v4.2'`, `status='approved'`,
  and the exact canonical asset path for that player.
  The browser does **not** infer approval from the existence of an older
  `/assets/players/portraits/<id>.webp` file. With all profiles pending, it
  shows the existing silhouette, even if an old WebP still exists.
- This PR does not generate or approve any photos, does not update DEV D1,
  and does not trigger a preview deployment. The merge **alone** does not
  activate V4.2 identities in an existing database. Until migration 0033
  is applied, V4.2-only generation commits cannot write against the old
  portrait constraints; they fail closed instead of persisting partial data.

## Phase 2 — separately authorised DEV D1 identity cutover (images NOT needed)

1. Check the exact intended D1 environment and current permanent roster.
   The audited DEV roster has **150** permanent IDs **44–193**. A count or
   ID change blocks cutover pending a fresh audit. Do not reuse DEV
   fingerprints for another environment.
2. Export only the read-only SQL in
   `tools/prepare-player-portrait-v42.sql` to a private local JSON file.
   The SELECT contains current players and their frozen *original generation
   candidates*, never prior portrait snapshots.
3. Materialise the **new V4.2 identities only**, outside Git:

   ```powershell
   node tools/prepare-player-portrait-v42.mjs --input C:\Temp\verified-player-drafts.json --out C:\Temp\private-v42-snapshots.json --expected-count 150 --expected-manifest 86361e5ecd809b9b0ec25fd92f1d9f2647319d781dd490325e21b54ae1d62095
   ```

4. Create the *identity-only* private staging SQL. This works **without any
   images or image-QA manifest**:

   ```powershell
   node tools/prepare-player-portrait-v42-cutover.mjs --snapshots C:\Temp\private-v42-snapshots.json --out C:\Temp\private-v42-stage.sql --expected-count 150 --expected-manifest 86361e5ecd809b9b0ec25fd92f1d9f2647319d781dd490325e21b54ae1d62095
   ```

5. After **separate** approval of remote D1 staging and migration, apply
   the private staging statements and confirm 150/150 exact permanent
   IDs, unique V4.2 fingerprints and no roster drift.
6. Apply migration `backend/migrations/0033_portrait_v42_replacement.sql`
   only in the approved environment. The populated-world preflight fails
   if any player is missing a new candidate, or if an old profile is missing.
   It constructs the complete new profiles table before dropping old rows
   and the historical identity-backup table.
7. Read-only verify **150 V4.2 records, all `status='pending'`,
   `asset_key=NULL`**, no old versions, no legacy backup and no
   cutover-stage tables. The generated player records are preserved.
   The player page continues to show the silhouette.

The migration is **destructive and irreversible by design**. Do not perform
a D1 cutover through PR merge or an automatically triggered deployment.
Do not copy an old face or carry its prior approved status into V4.2.

## Phase 3 — post-merge portraits, separately authorised later

- Produce one original transparent PNG image **per approved V4.2 snapshot**,
  without using any old portrait as a face reference.
- Validate individual traits, transparency, complete head and torso framing,
  then convert each independently to a 320×362 transparent WebP.
- Check unique real WebP bytes/hashes, explicit human visual QA and owner
  approval before publishing a new image.
- **Only when that image is published and approved** should its corresponding
  V4.2 database row be updated to `approved` with the exact canonical
  `asset_key`. Until then the public API exposes a null image reference,
  even if old static WebP bytes remain on the origin.
- Coordinate image publication, D1 approval and site availability: these
  operations are **not one cross-service transaction**. Keep the silhouette
  until the new asset is present. Remove outdated image assets when the
  image-replacement workstream is authorised.

## Future new players

A generator approval assigns permanent numeric IDs and writes each new
`player-portraits-v5` / `player-portrait-v4.2` snapshot as
`pending`, `asset_key=NULL` in the same transactional batch.
No photo is generated automatically. Public pages show the silhouette
until the relevant V4.2 image is independently approved.
