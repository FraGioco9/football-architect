# V4.2-only portrait identity release ledger

## Owner-approved scope (2026-11-19)
- **V4.2 is the only supported persistent portrait identity** for every
  permanent player, including single-nationality players.
- **Merge the V4.2 source-code PR before image generation.**
  Images, alpha/visual QA and publication will happen in a later, separate task.
- No backup or compatibility with old V3/V4/V4.1 portrait identities.
- GitHub merge, Cloudflare deployment and destructive remote D1 migration
  are separate owner-authorised steps. No automatic remote operation.

## Verified starting state — DEV D1, read-only
- 150 players, IDs 44–193, 128 single-nationality and 22 dual-nationality.
- Old D1: 150 historical portrait profiles, 23 approved old WebP references.
- 150/150 permanent records reconciled to their unique original
  committed generator draft, including frozen initial attributes.
- All 150 V4.2 canonical prompts validated and deterministic; 150 unique
  fingerprints; 22 dual-national name-source matches audited.
- Exact SHA-256 manifest from sorted
  `[[player_id, appearance_fingerprint, family_background, body_profile, complexion], ...]`:

  `86361e5ecd809b9b0ec25fd92f1d9f2647319d781dd490325e21b54ae1d62095`

- Sample frozen fingerprints: #47 `3afeeb55beb39b3b` (NGA family cue),
  #49 `1900ea8b921ce560` (FRA), #190 `b8057d217b228ff6` (NGA).
- No DEV D1 writes, migration, WebP updates or remote snapshots were made.

## Implementation

- Player-generator approval commits one or multiple permanent players and
  **pending, immutable V4.2 snapshots** together. No image is created.
  Replays reject missing profiles.
- Public player detail **does not load old static WebPs by ID**: the API
  returns a portrait asset only for a V4.2-approved row with exactly the
  canonical asset path. All pending V4.2 rows produce a silhouette.
- Migration `backend/migrations/0034_portrait_v42_replacement.sql`
  enforces new snapshots with correct embedded ID, version and unique
  fingerprints. A non-empty world requires **complete 1:1 staging** before
  dropping old identities. Every replacement row starts
  `status='pending'`, `asset_key=NULL`. The historical backup/staging
  tables are removed after a successful cutover; old identities are not kept.
- `tools/prepare-player-portrait-v42.sql`: read-only original-generation
  source export; no legacy portrait read.
- `tools/prepare-player-portrait-v42.mjs`: offline new V4.2 snapshots,
  source/manifest verification, no overwrites.
- `tools/prepare-player-portrait-v42-cutover.mjs`: offline
  **identity-only** SQL staging; does not require images or owner image QA.
- Owner-approved release sequencing and PowerShell commands:
  `docs/player-portraits-v42-cutover.md`.

## Release gates

- [x] 150-player original-source audit and canonical hash.
- [x] V4.2-only generator and version pinning.
- [x] Fail-closed 1:1 migration staging with no image dependency.
- [x] Public silhouette until exact V4.2 approved profile and asset.
- [x] Offline export tools and test coverage.
- [ ] **Exact-head CI** for updated PR with separated image phase.
- [ ] Owner-authorised PR merge (code only).
- [ ] Owner-authorised DEV D1 pending-identity cutover (separate action;
      **not implied by merge**).
- [ ] Post-merge: create 150 individual new transparent images,
      human QA, publish and mark each as approved in separate workflow.

## Deployment safety

Until the separately authorised D1 migration, the existing DEV database
still has old V3/V4.1 portrait constraints. A V4.2-only generator commit
against that schema fails closed; avoid treating the code merge as D1
activation. Preview deployment is also separate. The player page shows
the silhouette for any unapproved/non-V4.2 portrait even if old WebP files
exist on the static origin.

The new identity snapshots are reproducible from original generation
records. No historical portrait identity backups or old-version fallback
will be created or retained.
