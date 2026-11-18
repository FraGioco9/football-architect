# V4.2-only portrait cutover — authorised release procedure

**Status:** Draft/HOLD. No remote D1 mutation, deploy, portrait generation,
asset publication or PR merge is authorised by preparation alone.

This release permanently replaces *every* earlier portrait identity.
**No backups, no V3/V4/V4.1 identity compatibility and no rollback to an
earlier identity are permitted.** Historical SQL migration sources remain
in Git only to keep migration history executable; the cutover drops the old
portrait identity-backup table.

## Why migration 0033 is gated

Migration \`backend/migrations/0033_portrait_v42_replacement.sql\` now rejects
a non-empty world **unless every permanent player** has a validated, unique,
approved V4.2 candidate and a matching new 320×362 WebP asset reference.
It inserts all candidates into the new V4.2 table *before* dropping the
old one, then removes the staging table and the historical backup.
A completely empty world (zero players, zero old profiles, zero candidates)
may install the V4.2 schema without staging.

If no stage, a partial stage or a mismatched roster is present, the
migration fails closed **before** touching old portrait rows. Temporary
guard/stage tables from a failed preflight contain no prior identities.
Do not run the migration as a standalone reset in a populated world.

## Preparation (read-only D1; NO image generation)

1. Record the exact environment, code SHA, permanent player IDs and count.
   For the audited DEV roster the expected count is **150**, IDs **44–193**,
   and the deterministic V4.2 manifest SHA-256 is:

   \`86361e5ecd809b9b0ec25fd92f1d9f2647319d781dd490325e21b54ae1d62095\`

2. Export only the read-only SELECT in
   \`tools/prepare-player-portrait-v42.sql\` for that **same** environment.
   The export includes current player payloads and original draft candidates;
   it does not select the old portrait profiles or any backup identities.
3. Generate the private V4.2-only snapshot package outside the repository:

   \`\`\`powershell
   node tools/prepare-player-portrait-v42.mjs --input C:\Temp\verified-player-drafts.json --out C:\Temp\private-v42-snapshots.json --expected-count 150 --expected-manifest 86361e5ecd809b9b0ec25fd92f1d9f2647319d781dd490325e21b54ae1d62095
   \`\`\`

   The tool refuses any source/manifest drift, duplicate player ID,
   non-canonical identity, missing original-draft evidence or destination
   overwrite. It tolerates changed gameplay attributes but always derives
   the portrait from **frozen original** attributes.
   The output contains **new V4.2 snapshots only**.

## Image generation and approval — currently DEFERRED

Generate one NEW original portrait per frozen V4.2 identity, never using
an earlier face as an image reference. For all 150 IDs, perform source
alpha/quality QA, 320×362 transparent WebP QA, correct full hair/torso
framing, and explicit owner visual approval. Publish no asset yet.

After approval, prepare a private image-QA JSON file:
\`\`\`json
{
  "format": "player-portraits-v42-image-qa-v1",
  "images": [
    {
      "player_id": 47,
      "appearance_fingerprint": "3afeeb55beb39b3b",
      "approved": true,
      "sha256": "<actual SHA-256 of NEW 47.webp>"
    }
  ]
}
\`\`\`
The example shows the required schema for one entry; the real manifest
**must contain exactly 150** independently approved files and real hashes.
Do not use the placeholder text as a real hash.

The staging tool uses the physical WebP files to verify actual SHA-256,
alpha-capable WebP format, 320×362 dimensions and one-to-one portrait ID
and fingerprint. It **cannot** automate subjective visual QA or prove
the picture is an original; human approval is a separate gate.

## Stage creation (requires separate authorisation; DO NOT RUN NOW)

Generate the offline staging SQL outside Git. It contains ONLY new V4.2
identities and newly approved image paths; it does not read old portraits.

\`\`\`powershell
node tools/prepare-player-portrait-v42-cutover.mjs --snapshots C:\Temp\private-v42-snapshots.json --image-qa C:\Temp\approved-v42-images.json --assets-root . --out C:\Temp\private-v42-stage.sql --expected-count 150 --expected-manifest 86361e5ecd809b9b0ec25fd92f1d9f2647319d781dd490325e21b54ae1d62095
\`\`\`

The generated SQL **does not run automatically**. After separate owner
approval, apply it to the intended D1 environment, confirm exactly 150
staged candidates and exact ID coverage, and verify the approved new image
bytes are present for publication. A failed or partial staging import is
safe from old-identity loss: migration 0033 will reject it. Do not
re-run a partially imported SQL blindly; inspect and reconcile candidates.

## Activation — every gate separately authorised

- Confirm the environment, exact release HEAD, passed CI, 150 live IDs,
  new V4.2 manifest hash, 150 approved WebP hashes, and staged completeness.
- Coordinate the **non-atomic** boundary between Git image assets and D1:
  use a maintenance or portrait-serving hold, so users never see old faces
  paired with new identities. D1 migration and website publication are **not**
  one cross-service transaction.
- Obtain explicit separate approval to publish the 150 **new** approved
  WebPs, apply remote migration 0033, deploy application code, and merge PR.
  Do not treat approval of one action as approval of the others.
- After cutover, verify 150/150 approved V4.2 profiles, exact IDs, asset
  references, no legacy-version rows, no staged candidates, and no legacy
  identity-backup table; run public visual and browser QA.
- On any failed preflight, **stop**: do not bypass migration guards or
  restore earlier portrait identities. Correct the new V4.2 package and
  repeat its verification before requesting activation.

For subsequent new players, approval of a generation batch stores a
**pending** V4.2 profile in the same D1 batch as each permanent player.
An image is NOT generated automatically: the placeholder is used until
that player's separately approved portrait is available.
