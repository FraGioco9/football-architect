# KM-02 — Kit Maker minimal DEV workspace

The integrated Kit Maker lives at **http://app.localhost:2000/dev/kit-maker**,
under **Development → Kit Maker** next to Match Engine. It shares the
canonical app sidebar, topbar, site typography and light/dark themes.

## Visible workspace

- **Kit Maker** page title
- Large, rotatable and zoomable 3D preview of the approved 180 cm,
  skinned Innerscene/MakeHuman CC0 mannequin, arms relaxed slightly apart
- Right-hand **Club** selector populated from the canonical
  `/clubs/_shared/manifest.json` (320 real Football Architect clubs,
  grouped by the eight nations)
- Right-hand **Colors** section with non-editable **Primary** and
  **Secondary** placeholders; their editing controls and garment designs
  are deliberately deferred

The club dropdown can be used now; its selection is reflected in the
`?club=COUNTRY-ID` URL parameter and restored on reload. It does not
modify the player's club, alter the mannequin's material, write world
data or change any saved kit. The only club data request is a single,
read-only GET of the same manifest the Clubs directory uses.

No mannequin measurements, local 3D import, bone pose controls, camera
preset buttons, laboratory descriptions, additional title or lab footer
appear in the integrated page. Orbit/pinch/scroll camera controls remain.
The older independent studio at **http://127.0.0.1:2100/** keeps its
full model-comparison and anatomy tools for focused 3D development.
Both views reuse the same exact CC0 GLB and Three.js viewer.

## Local startup

```powershell
git fetch origin
git switch --detach origin/feat/kit-designer-01-3d-mannequin-prototype
npm --prefix backend ci
npm --prefix match-engine ci
node tools/dev.mjs
```

Open http://app.localhost:2000/dev/kit-maker without `--lan`.
The DEV-only routes are allowlisted in `tools/dev-standings-preview.mjs`,
restricted to loopback and the app.localhost host; no upload, remote DB,
deployment or public publication occurs.

## Validation

```powershell
npm --prefix match-engine test
node --test tests/kit-designer-prototype.test.mjs
```

The targeted suite validates the streamlined page, real club catalogue,
private route/CSP and fallback viewer. Manual browser QA should include
the 320-club selection, URL refresh, desktop/mobile layout,
light/dark theme and 3D orbit/zoom.

PR #454 remains **Draft/HOLD**, stacked on Match Engine PR #455.
Do not merge until the parent branch has been separately approved and
merged and KM-02 visual QA is confirmed.

## KM-02 style alignment — canonical controls (2026-11-09)

The visible Kit Maker boxes use the site's existing `app-panel` markup,
`--fa-radius-panel` and theme-backed surfaces, rather than a one-off
card style. The Club selector uses the exact canonical
`language-control` / `language-trigger` / `language-menu` /
`language-option` pattern (including the standard chevron, hover,
open/selected states and keyboard navigation) instead of the browser's
native select styling. The existing 320-club manifest is still the sole
data source. Group headings appear within the scrollable, native-looking
menu; selection remains URL-backed and read-only.

The first-paint trigger already reserves its final dimensions and shows
only **Select club** until data is available. It is disabled while
unready. No loading text, skeleton or spinner is shown. A catalogue
error is reported only if loading actually fails. The preview and
colors card use the same app panel and control design tokens in both
light and dark themes. The unchanged standalone mannequin laboratory
retains its older expert controls.

## KM-03A — first neutral short-sleeve jersey (2026-11-09)

The owner approved KM-02 and authorized the first 3D shirt. The first
garment is **neutral matte white**, with **short sleeves, a small open
round collar, sewn-look cuff edges and a hem**. It is an independently
generated garment `THREE.Group`, not a recolor or slice of the
Innerscene/MakeHuman CC0 anatomy and not baked into the GLB. The entire
approved 180 cm, 163-bone mannequin, relaxed-arm pose, proportions and
original GLB SHA remain unchanged.

**Fitting:** `kit-maker/lab/jersey-geometry.mjs` reads actual posed
`SkinnedMesh.getVertexPosition()` samples with bone weights. Excluding
arm-dominant vertices, it constructs a 56-sector circumferential torso
envelope with a **19 mm minimum outward clearance**, additional relaxed
hem allowance, smooth shoulder transition, open neckline and ribbing.
Near the arm sockets, where the torso source has no complete samples,
the upper-chest contour is inherited to avoid unnatural mesh collapse.
The two tapered sleeve tubes follow the actual bilateral
`upperarm01.L/R → lowerarm01.L/R` bones of the mannequin and end before
the elbows. Geometry has UVs and normals, is double sided, casts and
receives shadows. This is a **static pose-matched first garment**, not
cloth physics, a complete size system or an animated skinned kit.

**Scope isolation:** Only the integrated private
`/dev/kit-maker` viewer dynamically imports the helper via the
`/__fa_kit_maker__/jersey-geometry.mjs` allowlist. The separate
mannequin anatomy studio (port 2100) continues to display just the
original model and keeps its imported-model comparison tools. No extra
Kit Maker controls, dropdowns, cards or colors appear. Primary and
Secondary are still disabled and there is no logo, number, pattern,
garment persistence, upload, world mutation, deploy or remote D1 write.

**Safeguard:** a garment build error does not replace, remove or modify
the approved mannequin; the error is recorded and the mannequin remains
available. The resulting garment can be independently disposed/changed
in later milestones without editing the GLB. A focused Node regression
checks sampled radial skin clearance, separate torso/neck/sleeve/cuff/hem
geometry, material roughness, safety boundary and source immutability.

**Visual QA to be confirmed:** Front/Side/Back (orbit), shoulder-to-sleeve
junctions, neckline opening, hem, no body/garment intersections, and
desktop/mobile dark/light. Draft/HOLD stacked on Match Engine PR #455,
no merge until separately authorized.
