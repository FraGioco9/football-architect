# PLAYER-PORTRAITS-02 — deterministic appearance profile pilot

**Status:** Offline source-only prototype / Draft-HOLD. No generation API, public page, D1/R2 change, image generation or remote data read.

## Approved visual contract

- One fictional **male** footballer, lean athletic non-bodybuilder appearance.
- **Plain white** unbranded short-sleeved football jersey, regular match fit.
- Front-facing, relaxed arms, complete **head-to-hips** framing, consistent vertical 3:4 composition.
- Genuine PNG alpha transparency, clean hair edges, no background or checkerboard.
- No age, height or football position passed to the model.
- Body composition is a **subtle visual interpretation** of four public metrics: strength, speed, stamina and agility. It is not a measurement of actual anatomy and never overrides the lean-athletic/no-bodybuilder rule.

## Offline import

`buildAppearanceManifest(players)` takes an array of public player records: permanent positive numeric `id`, `nationality`, optional `secondary_nationality`, and public `attributes.strength`, `attributes.speed`, `attributes.stamina`, `attributes.agility` (integers 1–99). All other fields are ignored. It returns sorted deterministic player-ID face profiles, a separate body archetype/conditioning descriptor, a face fingerprint, and versioned schema and prompt version. `buildPortraitPrompt(entry)` produces the approved V3 studio-photo prompt for each entry; **never** raw stat numbers.

An individual **face** is derived from a versioned SHA-256 seed based only on the player ID. Nationality is included solely as context in the image prompt, not mapped to ethnicity, skin tone or face structure. Export and preserve the reviewed manifest: approved player identities and images must not be regenerated during transfers or season changes. A new future player should receive an additional immutable manifest entry. An approved manifest is a photographic snapshot: later attribute changes do not silently regenerate an approved image. Different textual profiles do not guarantee different generated faces: visual similarity and true-alpha QA remain manual gates.

Use a read-only, **authorized public players export**, not private Admin drafts or D1 tooling. The tool performs no remote calls. The input may be a JSON array or an object `{ "players": [...] }`. It refuses to overwrite an existing output file.

```powershell
node --test tests/players-portrait-profiles.test.mjs
node tools/players-portrait-profiles.mjs --input .\players-public.json --output .\players-appearance-manifest.json
```

## Athletic body classification (explicit V1 thresholds)

Use only public 1–99 integer values, reject missing/out-of-range metrics. `mobility = (speed + agility)/2`. The first matching rule wins:

1. **power-athletic** if `strength >= 72` and `strength - mobility >= 8`: slightly sturdier but still modestly athletic.
2. **lean** if `mobility >= 72` and `strength <= 47`: relatively slim.
3. **lean-athletic** if `mobility >= 67` and `strength < 72`: slim and toned.
4. Otherwise **balanced-athletic**: proportionate, moderately athletic.

`stamina` affects only subtle muscle-tone wording: `<=34` understated, `35–74` natural, `>=75` slightly clearer but without extra mass. No position-based or age-based adjustments, bodybuilder physiques, or unnatural extremes. The source attributes are **not** copied into the appearance manifest, only the two allowlisted visual descriptors. Changes to athletic metrics may change the body result, **never** the face fingerprint. Freeze accepted images and profiles after owner review.

## Evidence and limits

- Local Node 22 body-classification unit smoke: **4/4 PASS**. Expanded integrated portrait test suite adds deterministic body attribution, invalid-input, no-internal-field and boundary checks. The original 150-player and 1,000-player cohorts remain **synthetic**; do not claim full-project or exact-head CI PASS before it completes.
- The **actual 150 persisted players have not been read or checked**: live player records belong to environment-specific D1 and are not in this repository. Verify only after an approved public export is supplied.
- No actual photographs generated or installed; alpha quality, visual diversity, image licensing, costs, storage and player-detail fallback behavior still need separate approvals.

## Public API export and deterministic three-player pilot

This step operates only against the **anonymous, already-public** players API. It never accesses Admin APIs, private drafts or D1 directly, sends no cookies, refuses cross-origin redirects, and never modifies remote state. The official Preview Worker may run older source than the latest main; the exporter recognizes both current `/api/players?page=N` and legacy `/api/players/page/N` public page paths. It deliberately refuses to overwrite an existing output file.

Run from PowerShell with Node.js 22, using the exact Preview origin (public GET only):

```powershell
node tools/export-public-players-for-portraits.mjs --source https://preview.football-architect.workers.dev/ --output .\players-public.json
node tools/players-portrait-profiles.mjs --input .\players-public.json --output .\players-appearance-manifest.json
$export = Get-Content .\players-public.json -Raw | ConvertFrom-Json
$export.players | Where-Object { $export.pilot_ids -contains $_.id } | Format-Table id,display_name,nationality,secondary_nationality
```

The export keeps only player numeric ID, display name, primary/secondary nationality and the four **public** athletic attributes. It verifies complete, consistent pagination and duplicate IDs. `pilot_ids` proposes three players deterministically, favoring distinct body archetypes and primary nationalities; selection is provisional until reviewed by the owner. Public export may be unavailable if the hosted Worker is older, network-restricted, or lacks the current public schema. Do not substitute private D1 reads or invent player records.

**Local mock-API test:** 5/5 PASS using an in-memory public response; real hosted API connectivity and the 150 real players are **NOT VERIFIED** in this environment. No portrait images have been generated or stored by this feature.

## Local-only PNG technical preflight (no publishing)
Run `node --test tests/portrait-png-qa.test.mjs` and `node tools/portrait-png-qa.mjs 44.png 98.png 145.png` on **three separate** candidate images. The CLI uses Node 22 built-ins only; reports one JSON object per file and exits nonzero when any fail. Rejects non-3:4 format, non-RGBA/painted-checkerboard PNG, insufficient genuine alpha, significant disconnected silhouettes, clipped bounds and suspicious red/yellow/magenta edge fringing. Its thresholds are **heuristics**, not guarantees of visual quality or personal identity. Human review must still check face variation, hair/eyes vs stable `appearance_profile`, anatomy and media-day styling. Never commit rejected/generated portraits as game assets without owner approval.

### Historical local sample QA (not stored in Git)
- Single #44 candidate 1086×1448 RGBA: `fringe_fraction=0.0856`, **FAIL** colored halo.
- Three-person 1881×836 RGB collage: **FAIL** aspect and missing alpha.
- Three-person 1881×836 RGBA collage: **FAIL** aspect, fringe `0.0538` and 3 significant components.
No new approved photo has been generated in this GitHub-only step.
