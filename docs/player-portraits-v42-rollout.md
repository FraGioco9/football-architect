# V4.2-only portrait remake — rollout ledger

Owner decision (2026-11-18): V4.2 is the sole **target** for every player,
including single-nationality players. Recreate the faces from their new
version-pinned descriptions, rather than preserving V4.1 faces for anyone.

## Verified starting state (DEV D1, read-only)
- 150 permanently generated players; 150 existing portrait profiles.
- 23 `approved` V4.1 profiles with published WebP assets; 127 `pending` V3 profiles without approved assets.
- Verified 150/150 permanent player JSON records against their **unique,
  exact original committed draft** (including frozen initial physical stats,
  stripping only the permanent `id`). No problematic IDs.
- No DEV D1 records, image assets or published statuses were changed by this read.

## Version and scope
- V4.2 canonical face is seeded once from permanent ID, nationalities and
  verified name-catalogue provenance. Recomputed complexion, hair texture,
  hair colour, eye colour and compatible hairstyle are frozen. Existing V4.1
  face structure and initial-attribute physique remain inputs.
- One-nationality players **also** use V4.2. There is no V4.1 default or
  single-nationality exception.
- New player generation and portrait text export target V4.2 on the branch.
  The schema-only migration `0033_portrait_v42_replacement.sql` is staged.
  Legacy schema/prompt pairs remain readable for rollback until cutover.
- The 23 published V4.1 portraits are all scheduled for replacement. No
  existing photo is a source image/reference for a new face.

## Release checklist (separate gates)
- [x] Read-only 150-player frozen-data provenance audit.
- [x] V4.2 generation/export defaults and version-pair migration **coded**.
- [ ] Exact-head tests / required CI green.
- [ ] Build and freeze 150 V4.2 snapshots from verified initial player data.
- [ ] Generate **one independent original transparent image per player** (150
      separate invocations); never collages, mixed identities or older versions.
- [ ] Verify each source alpha, head/torso framing, 320x362 transparent WebP,
      traits and human visual QA; owner reviews before approval.
- [ ] Guarded backup of all 150 pre-cutover portrait rows (including existing
      status and image paths) with exact row-count/content checks.
- [ ] Separately authorised remote migration, cutover, upload/publication,
      site deployment and PR merge. Keep rollback paths for the 23 old images.

Until every gate is satisfied, the branch remains Draft/HOLD, DEV D1 stays as
is, and the public images remain unchanged. "Sole target" does not mean
retroactively rewriting approved published photos without QA.
