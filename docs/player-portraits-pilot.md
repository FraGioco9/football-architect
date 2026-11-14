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
