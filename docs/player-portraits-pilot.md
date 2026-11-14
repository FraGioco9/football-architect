# PLAYER-PORTRAITS-02 — deterministic appearance profile pilot

**Status:** Offline source-only prototype / Draft-HOLD. No generation API, public page, D1/R2 change, image generation or remote data read.

## Approved visual contract

- One fictional **male** footballer, lean athletic non-bodybuilder appearance.
- **Plain white** unbranded short-sleeved football jersey, regular match fit.
- Front-facing, relaxed arms, complete **head-to-hips** framing, consistent vertical 3:4 composition.
- Genuine PNG alpha transparency, clean hair edges, no background or checkerboard.
- No age, height or football position passed to the model.

## Offline import

`buildAppearanceManifest(players)` takes an array of public player records: permanent positive numeric `id`, `nationality` and optional `secondary_nationality`. Other fields are ignored. It returns sorted deterministic player-ID profiles, plus a profile fingerprint, versioned schema and prompt version. `buildPortraitPrompt(entry)` produces the approved V2 studio-photo prompt for each entry.

An individual appearance is derived from a versioned SHA-256 seed based only on the player ID. Nationality is included solely as context in the image prompt, not mapped to ethnicity, skin tone or face structure. Export and preserve the reviewed manifest: approved player identities and images must not be regenerated during transfers or season changes. A new future player should receive an additional immutable manifest entry. Different textual profiles do not guarantee different generated faces: visual similarity and true-alpha QA remain manual gates.

Use a read-only, **authorized public players export**, not private Admin drafts or D1 tooling. The tool performs no remote calls. The input may be a JSON array or an object `{ "players": [...] }`. It refuses to overwrite an existing output file.

```powershell
node --test tests/players-portrait-profiles.test.mjs
node tools/players-portrait-profiles.mjs --input .\players-public.json --output .\players-appearance-manifest.json
```

## Evidence and limits

- Local Node 22 targeted tests: **5/5 PASS**, 150 *synthetic* identities with primary/secondary nationality and 1,000 synthetic stress IDs; deterministic order and no nonvisual-field influence.
- The **actual 150 persisted players have not been read or checked**: live player records belong to environment-specific D1 and are not in this repository. Verify only after an approved public export is supplied.
- No actual photographs generated or installed; alpha quality, visual diversity, image licensing, costs, storage and player-detail fallback behavior still need separate approvals.
