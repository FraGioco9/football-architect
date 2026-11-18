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
- Read-only V4.2 recomputation using the exact PR module source for all 150
  identities: 150/150 prompt-renderer validation PASS, 150 unique fingerprints,
  every identity stable against gameplay age/position changes.
- 128 single-nationality players and 22 dual-nationality players; for duals,
  first/surname source membership was cross-checked with both country catalogues.
- Canonical audit manifest is the sorted JSON array
  `[[id, appearance_fingerprint, family_background, body_profile, complexion], ...]`.
  SHA-256: `86361e5ecd809b9b0ec25fd92f1d9f2647319d781dd490325e21b54ae1d62095`.
- Key checks: #47 `3afeeb55beb39b3b` (NGA cue), #49
  `1900ea8b921ce560` (FRA cue), #190 `b8057d217b228ff6` (NGA cue).
- No DEV D1 records, image assets or published statuses were changed by this read.
  Read-only snapshots were validated in memory, not saved remotely.

## Version and scope
- V4.2 canonical face is seeded once from permanent ID, nationalities and
  verified name-catalogue provenance. Recomputed complexion, hair texture,
  hair colour, eye colour and compatible hairstyle are frozen. Existing V4.1
  face structure and initial-attribute physique remain inputs.
- One-nationality players **also** use V4.2. There is no V4.1 default or
  single-nationality exception.
- New player generation and portrait text export target V4.2 on the branch.
  Migration `0033_portrait_v42_replacement.sql` is staged as a destructive
  V4.2-only reset: historical portrait rows are deleted at execution, and
  earlier schema/prompt pairs are rejected. No backup is created.
- The 23 published V4.1 portraits are all scheduled for replacement. No
  existing photo is a source image/reference for a new face.

## Offline preparation of private V4.2 identities

Use the read-only query in `tools/prepare-player-portrait-v42.sql`
against the **correct** environment and save its D1 JSON response outside the
repository. This includes current player payloads and verified *initial*
generation drafts, **not** historical portrait identities.

```powershell
node tools/prepare-player-portrait-v42.mjs --input C:\Temp\verified-player-drafts.json --out C:\Temp\private-v42-snapshots.json --expected-count 150
```

The tool verifies frozen name, nationality, initial age, height and foot against
the original committed draft, while allowing current gameplay age, attributes,
position and career status to evolve. **Only original-draft attributes** define
the portrait. It checks unique IDs, V4.2 version, unique fingerprints and
canonical prompt replay, then writes
**only** new V4.2 snapshots with `flag: 'wx'` (no overwrite). For the audited
DEV roster, its manifest SHA-256 must equal the audit hash above. Any different
hash indicates source/code/catalogue drift and blocks cutover. The private
snapshot file should only be created when required for the later authorised
activation, not during this read-only audit.

## Release checklist (separate gates)
- [x] Read-only 150-player frozen-data provenance audit.
- [x] V4.2 generation/export defaults and exclusive-version migration **coded**.
- [x] New schema ensures the JSON snapshot's V4.2 version and player ID
      match its database row; idempotent commits require complete V4.2 profiles.
- [x] Previous exact-head FULL CI green (bd44c245).
- [ ] Required FULL CI on this final audit commit, including 1/6-player commit,
      missing-profile retry, 150-player cutover simulation and embedded snapshot
      version/ID constraints.
- [x] Recompute and validate all 150 canonical V4.2 snapshots in memory;
      independently reproducible full-roster manifest digest above.
- [x] Prepare a local/offline V4.2-only snapshot exporter with strict
      original-draft provenance checks; private snapshot files are NOT committed.
- [ ] Materialize final frozen private V4.2 package at cutover readiness,
      after a fresh exact-ID and fingerprint check.
- [ ] Generate **one independent original transparent image per player** (150
      separate invocations); never collages, mixed identities or older versions.
- [ ] Verify each source alpha, head/torso framing, 320x362 transparent WebP,
      traits and human visual QA; owner reviews before approval.
- [ ] After validation of all replacement identities and images, obtain
      separate authorisation for the **irreversible** D1 reset that removes
      all 150 previous portrait rows, including 23 approved asset references.
- [ ] Atomically load the 150 V4.2 profiles and verify exact player ID, count,
      fingerprints and new approved asset references; no V3/V4.1 profiles
      or old identity backups may remain.
- [ ] Separately authorised remote migration, cutover, upload/publication,
      site deployment and PR merge. No historical identity rollback.

Until every gate is satisfied, the branch remains Draft/HOLD, DEV D1 stays as
is, and the public images remain unchanged. Applying the V4.2-only migration
without the validated replacement identities would leave the profile table
empty and detach the old approved images; do not execute it independently.
