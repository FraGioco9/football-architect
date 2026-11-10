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
envelope with a **6 mm nominal outward clearance**, a minimal shaped
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

## KM-03B — fitted jersey geometry rebuild (2026-11-10)

The original KM-03A garment was too loose. This revision keeps the same
approved rigged 180 cm CC0 mannequin, topology, pose, dev-only page and
disabled color controls but **rebuilds the garment fit**:

- The 56-sector torso scan now uses 6 mm nominal clearance (instead of
  19 mm), narrower neighborhood sampling, and 2 mm shaped hem ease
  instead of 11 mm additional waist flare. The shoulders still transition
  to the open round neckline without collapsing at the armpits.
- Each sleeve is measured separately from actual posed **arm-weighted
  SkinnedMesh vertices**, ring by ring along the corresponding upper-arm
  skeleton axis. A robust radial cross-section follows the real biceps
  and tapers naturally to the cuff; the former fixed 127-to-70 mm sleeve
  radius is removed. Small seam ease is maintained for separation.
- The sleeve fitting has a deterministic synthetic geometry regression.
  No skin mesh, skeleton, body pose or bundled GLB asset was modified.
  A static pose-fit is not an animated fabric simulation.

Visual sign-off is still needed in Chrome from front, side and back,
including shoulder junction, underarm, collar and hem intersections.
PR #454 stays stacked on #455, **Draft/HOLD**, without merge or deploy.

## KM-03C — slim sleeves with real armhole seams (2026-11-10)

Owner visual QA found that the KM-03B sleeves were both too wide and
visibly detached from the shirt. This revision removes those standalone
sleeve tubes and joins both arms to the bodice in one indexed fabric
surface:

- Two symmetrical lateral armhole patches are cut from the body/shoulder
  lattice, removing the previously hidden solid bodice behind each arm.
- The seam ring of each sleeve REUSES the exact vertex indices bordering
  the opening, then transitions smoothly into its sampled posed-arm shape.
  The shoulders, upper torso and sleeves therefore belong to one
  topologically continuous mesh, not merely overlapping objects.
- Sleeve ease is narrowed from 6 mm to 3.5 mm and the extra shoulder
  radius is reduced. Radial profiles still sample real pose-deformed
  arm skin and taper toward the biceps-height cuff.
- The main shell contains only four intentional openings: neck, hem,
  left cuff and right cuff. A structural test verifies one connected
  component, manifold edges, and those four perimeter loops; geometry
  is compacted to exclude vertices from the excised shoulder panels.

Separate trim meshes remain only for collar rib, two narrow cuff rims and
hem. The approved 180 cm rigged GLB, its pose and skin, studio UI,
Club control, theme, private DEV routing and disabled color options
are unchanged. This is a static fit; front/side/back visual QA and
exact-head GitHub checks still apply. Draft/HOLD: no merge, publication
or database mutation.

## KM-03D — raise the neckline to the base of the neck (2026-11-10)

Owner visual QA: the connected jersey did not reach the neck; its front
edge sat at Y 1.502 m and the back at Y 1.522 m, leaving a wide opening
low on the upper chest. This revision **raises and narrows the crew neck**:

- Shirt edge now sits at **Y 1.562 m front / 1.579 m back** for the
  180 cm anatomical base, following the neck's natural front/back slope.
- Opening half-width is **74 mm** (down from 98 mm), with the neck ring
  centred slightly forward (Z 48 mm, depth 80 mm) to follow the neck
  silhouette more closely instead of using the chest-centred ellipse.
- Collar rib begins exactly at the shell edge with **no 3 mm floating
  gap**, then rises 10 mm and tapers gently around the neck.
- Upper torso/shoulder fabric joins the collar in the same connected
  indexed shell. Both attached sleeves, armholes, lower hem, mannequin
  asset, rig, DEV UI and read-only club selection are unchanged.
- Geometry regression verifies the raised front/back height, snug
  opening, collar rise, and all 56 collar outer vertices matching the
  main fabric border. The previous manifold/four-opening tests remain.

These measurements are based on the existing 180 cm mannequin profile;
real GLB appearance must still be checked in Chrome Front/Side/Back.
PR #454 stays Draft/HOLD, no merge/deploy/remote database changes.

## KM-03E — anatomical shoulder contour audit (2026-11-10)

The owner requested a focused recheck of the shirt's shoulders after
KM-03D. The previous shoulder panel merely interpolated between the
torso's 1.435 m top ring and the raised neckline, even though the torso
fitting explicitly excluded clavicle/shoulder/arm-influenced skin. This
could leave a narrow, flat or intersecting shoulder cap.

- Added an independent posed-skin scan of the real 180 cm GLB at shoulder
  and trapezius height (1.38–1.595 m), including deltoid/clavicle skin
  samples intentionally excluded from the torso envelope.
- Shoulder panels retain the four topological openings and the exact
  shared sleeve-armhole seam, but now locally expand to clear the
  anatomically scanned shoulder contour with 6 mm nominal surface ease.
  The correction tapers to zero at the torso and neckline connections,
  preserving watertight continuity and the existing raised collar.
- The shoulder height progression now lifts gradually from the upper
  torso instead of starting from a flat smoothstep ledge. Both sides
  use the same geometry and per-angle scan; there are no detached caps.
- Regression checks cover the additional contour scan, bilateral shoulder
  width, centre-chest overinflation, missing sample fallback, and existing
  single-shell/four-openings/collar contracts.

- Reduced each lateral upper armhole cut from eight to **six 56-sector
  segments**, leaving more connected shoulder fabric above the deltoid
  while preserving the actual shared-index sleeve seam. This prevents
  the shoulder top from disappearing into an overly wide cut-out.
- The new fixture uses synthetic bilateral shoulder skin with actual
  arm-bone weights to prove that the finished shell increases its
  upper-shoulder width without becoming oversized; prior manifold,
  connected-shell, collar and four-boundary checks remain.

This is a static fit refinement, not cloth animation. Mannequin GLB,
skeleton, approved relaxed pose, short-sleeve cut, hem, and DEV-only UI
are untouched. The rendered Front/Side/Back fit still needs owner QA.
PR #454 stays Draft/HOLD; no merge, deploy or DB mutations.

## KM-05 — Alberto Sena original kit received (2026-11-10)

Owner-provided original ZIP has now been inspected. It includes the
65.5 MB Blender source, the Draco-compressed 17-mesh glTF upper outfit,
multiple texture atlases and original shoe objects in the Blender scene.
The glTF alone lacks shoes/socks, and refers to textures with nonmatching
paths: **use the Blender source as authoritative**.

Added a Blender-local clothing-only exporter at
`tools/kit-designer-prototype/export-sena-outfit.py`. It keeps the
previously approved 180 cm Innerscene/MakeHuman mannequin and groups
clothes independently as jersey, shorts, socks and football boots.
A local-only, gitignored GLB is optionally loaded in the same Kit Maker
viewer; the procedural jersey is no longer drawn in its place.
Original garment materials and named mesh groups remain intact.

**Important:** no explicit redistribution license was present in the
uploaded ZIP. The creator's 3D models/textures are not in GitHub and
must never be published without permission. The exporter has not been
executed against the .blend in this environment because Blender is
not installed. Detailed intake and PowerShell commands:
`kit-maker/asset-intake/alberto-sena/README.md`.

Pending: Blender audit/export, full garment groups confirmation,
real WebGL front/side/back 180 cm fit QA, license, exact-head CI, and
separate merge authorization. PR #454 remains Draft/HOLD.

## KM-05B — completed owner-supplied outfit export

## KM-05B — owner-uploaded kit extracted without Blender (2026-11-10)

The original ZIP uploaded in this conversation was processed **directly from the Blender 4.0.4 binary format** using an offline geometry extractor. No Blender installation or PC-side export is needed.

- **Real, complete private outfit GLB created:** 19,674,012 bytes; SHA-256 `985a459664dbbbea061a5126ba1765acc208e4480091a2882f441379926110c8`. Uses all available genuine outfit geometry: **27 source mesh objects** (6 jersey, 11 shorts, 8 socks, 2 football boots), **313,206 vertices** and **599,124 triangles**. Source avatar and rig excluded.
- Preserves eight original source textures in the standalone GLB, named group meshes (`FA_jersey__`, `FA_shorts__`, `FA_socks__`, `FA_boots__`) and correct boot scale inherited from Blender's 0.1-scaled parent node. Converted Blender Z-up to glTF Y-up; output bounds X ±0.283 m, Y 0–1.617 m, Z −0.138–0.175 m.
- **Independent validation PASS:** GLB header/data, group inventory, load into `trimesh`, and texture-correct VTK 3D renderer from front/side/back. Geometry is static (not skinned). **Overlay on actual approved 180 cm rig in the Kit Maker browser is still NOT visually verified.**
- The user's download in this conversation includes a ready-to-extract `alberto-sena-kit-maker-local.zip` containing `kit-maker/local-assets/alberto-sena-outfit.glb` and report. The binary remains **outside GitHub** (gitignored by design). With the bundle extracted into the repo root, the existing private `/dev/kit-maker` route will read it automatically. Do not attempt the optional Blender exporter unless a new source export is needed.
- Also fixed the optional Blender fallback exporter to classify by **source Z height**, not Y, and detach the 0.1-scaled shoe hierarchy while preserving its world transform. No rig modifications or remote DB operations.
- **Rights gate:** author's source ZIP did not provide explicit permission to redistribute. Keep third-party geometry/textures in private local QA; do not push to GitHub, deploy or merge before the rights are verified.


## KM-06 — show the outfit alone, not the mannequin (2026-11-10)

Owner QA found the approved mannequin still visible through the imported
Alberto Sena outfit. The integrated `/dev/kit-maker` preview is now
**clothing-only**. The anatomical mannequin remains internally loaded
for scale/rig references, but its original meshes are hidden and do not
cast shadows. **The mannequin's root/skeleton stay visible/active in
the scene graph**, so the separately imported outfit is still visible.

The body is hidden before the first scene render to avoid a mannequin
flash during the optional private GLB fetch. A missing or malformed
outfit leaves an intentionally **empty stage with status feedback**,
not the original body. The legacy 2100 anatomical reference studio
retains its mannequin-only behaviour. The viewer's page and canvas
accessibility labels now describe the football outfit, not the model.

Tests verify hide-before-first-frame, shadow suppression, keeping
parent/bones intact, adding the outfit afterward, the private module
route, and the absent-asset fallback. No asset, materials, physics,
club selectors or production endpoints were changed. PR #454 remains
Draft/HOLD; license verification and browser QA are still pending.

## KM-07 — lower sock/boot alignment corrected (2026-11-10)

Owner requested a focused alignment check for **socks and football boots**,
with the mannequin already hidden in the KM-06 integrated viewer.

- Direct numeric inspection of the genuine owner-supplied GLB confirms
  both boots are mirror-aligned around X=0 (±0.00002 m), point forward,
  and rest at the same sole height (**Y=0.000238 m**). The ankle/heel
  positions were already correctly aligned; **do not shift either shoe**.
- Zoomed textured VTK renders exposed a defect in four **lower sock
  panels**: orange sock fabric extended inside the boot vamp and
  appeared as irregular spikes near the laces and ankle opening.
- Generated a corrected **private owner-only GLB** by clipping only
  `Pattern2D_3586`, `3588`, `3592` and `3600` to a smooth
  **Y=0.105 m** plane with vertex/UV edge interpolation. Shoes
  still reach Y=0.118171 m, giving **13.171 mm vertical bounding overlap**.
  An alternate Y=0.115 m trim was **rejected** because it left an
  unacceptable visible air gap above the shoe.
- Result: **27 original named garment meshes**, unchanged jersey,
  shorts, all source textures and both football boots. Independently
  confirmed that **only the four specified sock mesh geometries
  changed**, with the other 47 glTF primitives unmodified.
  Updated file: **19,508,596 bytes**, SHA-256
  `8f929ab45ef51c7ce200b0f51514dff40854a2cd81ef68e82121533ca5942dca`; 310,203 vertices; 593,347 triangles.
- The new corrected package was delivered in the conversation as
  `alberto-sena-kit-maker-ankle-fit.zip`, with internal path
  `kit-maker/local-assets/alberto-sena-outfit.glb`. Extract into the
  repo root **with overwrite**; this is a private, gitignored
  clothing asset. See `ankle-fit-evidence.json` for numeric QA.
- The front/side renders show a cleaner, straighter ankle junction.
  Remaining small rear-collar openings can only be assessed
  definitively in the owner's Chrome viewer. **No browser PASS claimed**.
  Distribution and commercial-use rights remain **unverified**.
  PR #454 remains Draft/HOLD; no merge/deploy/DB.


## KM-08 — raise clothing, align ankle socks to stationary boots (2026-11-10)

Following owner visual QA, the KM-07 sock-to-boot fitting was still
unsatisfactory. The owner explicitly requested **raising everything
except the cleats**, and aligning both socks accurately to both boots.

- **Maglia and shorts:** all vertices moved **+0.046 m in Y** without
  deformation or changing any UVs or topology.
- **Socks:** upper sock sections moved +0.046 m, with a smooth vertical
  transition toward the original shoe openings. Lower cuff is anchored
  at **Y=0.098 m** (not raised 4.6 cm and left floating above shoes).
  Both ankle cuffs move **11 mm outward** and **25 mm heelward**,
  symmetrically for the left/right feet. The correction fades to zero
  by original sock height Y=0.28 m. Sock normals adjusted to the
  deformation; triangles and UVs preserved.
- **Football boots:** **no translation or geometry edits**. Their
  position and vertex/normal/index accessor bytes were verified
  identical to KM-07, and both soles remain at Y≈0.000238 m.
  All eight original embedded texture blobs are byte-identical.
- **Candidate selection:** compared +3.8 cm and +4.6 cm shifts in
  textured three-quarter, lateral, rear views. Selected +4.6 cm,
  with a lower ankle cuff and adjusted XZ position, because the
  opening is visually more continuous from the side and rear.
- **Corrected private GLB:** 19,508,584 bytes, SHA-256
  `6c5968336bf359bca9157dfdaae20ea5b346679c3223be8ddf427ad6e4e2849d`. 27 original garment meshes
  (6 jersey / 11 shorts / 8 socks / 2 boots); all four groups load in
  trimesh, topology unchanged. No mannequin in GLB.
- **Owner-only delivery:** `alberto-sena-kit-maker-km08.zip` in
  the conversation with internal path
  `kit-maker/local-assets/alberto-sena-outfit.glb`. Unzip over the
  previous private local file (PowerShell `Expand-Archive ... -Force`).
  See `km08-alignment-evidence.json`.
- **Remaining QA:** precise fit in the owner's Chrome viewer is not
  confirmed. Creator redistribution/commercial license is still
  unverified: do not commit the original assets or deploy. PR #454
  remains Draft/HOLD, no merge or DB changes.


## KM-08 code-managed fit (2026-11-10)

The repository **is public**. Alberto Sena makes the original kit downloadable and
customizable but the user-provided ZIP and public project do not specify a license
permitting republication of the model/textures. Do not push the 19.5 MB third-party
binary to this public repository without such permission.

To prevent repeated manual ZIP downloads, the **fit correction itself** is now
versioned in `kit-maker/lab/sena-fit.mjs` (KM-08). The local Kit Maker computes
SHA-256 of the original local GLB: for the verified KM-07 hash, it automatically
applies GitHub-defined +46 mm jersey/shorts lift, smooth ankle/sock fit,
11 mm outward and 25 mm heelward correction while leaving both boots untouched.
Already KM-08 assets are recognized and remain unchanged. Unrecognized hashes
fail closed rather than applying arbitrary or double transforms. Thus later fit
adjustments are made in the repository code via the Draft PR and fetched through
Git; the original author-supplied asset is only a local, untracked base.

Owner needs **one existing KM-07 or KM-08 file** at
`kit-maker/local-assets/alberto-sena-outfit.glb`; no fresh ZIP is needed when
that file is already present. Nothing is publicly served outside the loopback
DEV Kit Maker, and there is no deploy or merge permission.

The first 19.67 MB user-exported GLB (SHA-256 `985a459664dbbbea061a5126ba1765acc208e4480091a2882f441379926110c8`) is also accepted: the same fit parameters are applied, with GPU clipping of the four lower sock panels at Y=98 mm. This is an in-browser private preview approximation of the more exact KM-07 polygon trim and still requires owner fit QA; the original third-party file is not committed.

## KM-10 — lift kit to 6 cm with the boots locked (2026-11-10)

The owner authorized a further upward lift of **shirt, shorts and socks**
without changing the shoes. This revision is a GitHub-managed runtime
adjustment in `kit-maker/lab/sena-fit.mjs`; no GLB redistribution or ZIP
download is needed. The owner already has a local copy of the genuine
Alberto Sena outfit. Changes relative to KM-08:

- Shirt and shorts: **+60 mm** above source (formerly +46 mm), an additional
  +14 mm from the KM-08 appearance.
- Upper socks: **+60 mm** above source (formerly +46 mm), also +14 mm higher.
- Lower sock edge: **Y=102 mm** above the shoe sole (formerly Y=98 mm),
  only +4 mm at the ankle. The movement transitions smoothly to +14 mm
  higher at the upper calf, avoiding an abrupt sock/shoe gap.
- Socks preserve the previously approved 11 mm mirrored outward and
  25 mm heelward correction. These offsets are **not applied twice** to
  an already KM-08 GLB.
- Both football boots retain their original geometry, placement, UVs and
  render materials. Shoe soles stay fixed.

The model SHA-256 is checked on load: the initial owner export and KM-07
receive the full KM-10 transform, while a pre-adjusted KM-08 file receives
only the **incremental** (+14/+4 mm) lift. On an already-adjusted scene
a repeated fit call is a no-op. For the original GLB only, browser clipping
of the four lower sock panels is updated to the 102 mm seam.

Two focused synthetic JS regression tests passed for original/KM-07/KM-08
inputs, bilateral ankle positions, unchanged shoes/UVs and idempotency;
JS module syntax passed. **Full Node suite, actual GLB browser rendering,
and owner visual approval remain pending.** PR #454 remains Draft/HOLD;
no binary asset committed, no merge, deploy or DB write.

## KM-11 — increase vertical distance above fixed boots (2026-11-10)

Owner requested **greater visible vertical separation** between the
calzettoni and the fixed football boots. This revision changes only the
GitHub-managed fitting transform in `kit-maker/lab/sena-fit.mjs`, not
any artist-owned GLB binary.

- **Jersey, shorts, upper socks:** +80 mm relative to source (KM-10: +60 mm),
  an additional 20 mm upward move.
- **Lower sock cuffs:** world Y=130 mm (KM-10: Y=102 mm), an additional
  28 mm upward move. Vertical gap is now intentional. The previous QA
  reported the boots' overall upper bound at Y=118.171 mm, implying
  roughly **11.8 mm of vertical bound clearance**, not a formal contact
  validation at each ankle.
- **Football boots:** untouched (geometry, placement and materials).
  Existing mirrored +11 mm outward and 25 mm heelward sock adjustments
  are preserved, without applying twice to an already adjusted KM-08 GLB.
- Full original / KM-07 and incremental KM-08 sources converge to the
  same KM-11 displayed appearance via SHA-gated transforms. An unknown
  GLB is rejected, and repeated fitting on the same scene is a no-op.
  For the original asset, four lower sock panels have their private
  viewer clipping plane at Y=130 mm (formerly 102 mm).

Two focused synthetic geometry tests cover right/left cuffs, source
versions, fixed boots, increased height and repeated calls. Actual
browser appearance and complete Node CI remain to be confirmed.

PR #454 is Draft/HOLD. No merge, deployment, DB change, or public
third-party asset publication is authorized.

## KM-12 — remove black-lettered tape inside jersey collar (2026-11-10)

Owner approved KM-11 positioning and requested removal of the curved
strip with black repeating text visible **inside the neck opening**.
The original Alberto Sena GLB was inspected: the target is a unique,
separate mesh named `FA_jersey__Pattern_2702362`, spanning approximately
X=-98.2…+98.0 mm, Y=1594.2…1609.3 mm in the original model. Its UV
island samples the thin grey band with dark repeated lettering on the
jersey's embedded texture atlas (U≈0.3665–0.6023, V≈0.8875–0.8961).
All owner-local original/KM-07/KM-08 GLBs contain exactly that mesh.

The viewer calls `removeSenaInnerNeckPrint(outfit)` in the version-controlled
`kit-maker/lab/sena-fit.mjs`, **after the SHA-gated fit transform and before
the 3D scene attachment**. Exactly the printed inner tape is detached from
the scene graph. It is not recoloured, texture-erased or redistributed.
The actual knitted collar `FA_jersey__Pattern2D_3805002`, exterior shirt,
sleeves, shorts, socks, and shoes remain unchanged.

The original private GLB remains on the owner's PC and gitignored.
No additional ZIP or GLB download is needed. Targeted synthetic test
covers removal, collar preservation, exact mesh count, and a strict
single-target guard. Full browser visual QA still pending; PR #454
remains Draft/HOLD without merge or deployment.

## KM-13 — neutral, pure-white jersey base (2026-11-10)

Owner requested the Alberto Sena jersey as an entirely **solid-white
design foundation**. After removing the separate black-lettered inner
collar strip (KM-12), the private viewer applies
`makeSenaJerseySolidWhite(outfit,THREE)` to every remaining mesh named
`FA_jersey__*` (shirt body, sleeves, external collar and trim).
Each jersey material slot becomes a fresh opaque PBR white material
(`#FFFFFF`, roughness 0.85, metalness 0) **without albedo, normal or
other texture maps**. Lighting may still produce natural grey shadows:
the actual base material is solid white, not flat emissive white.

The original materials and texture atlas are **not disposed or modified**,
because other garments may share them. Shorts, socks, boots, geometry,
UVs, mesh groups, 180 cm anatomical reference, KM-11 heights and
fixed boot position are unchanged. The white override is safe to call
repeatedly on the same model; no external asset is exported/uploaded,
and no new GLB/ZIP download is necessary.

Focused regression checks verify coverage of the collar/body/sleeves,
multiple material slots, white colour and absence of texture bindings,
preservation of source materials shared with shorts/socks/boots,
unchanged geometries, repeat safety and strict integration order.
Visual QA in the owner's Chrome viewer and the complete Node suite
remain pending. PR #454 remains Draft/HOLD, no merge/deploy/DB.

## KM-14 — white shorts, socks and separately-meshed shoe laces (2026-11-10)

Owner requested extending the KM-13 solid-white base to **shorts,
socks and shoe laces**, while keeping the actual football boots their
original colours and geometry. The genuine creator GLB was inspected:
**no mesh is named “laces”**. Instead both `FA_boots__shoes_l.001`
and `FA_boots__shoes_r.001` contain five material-indexed primitives.
On each shoe, **`FA_boots__material_1` (material slot 1)** consists of
11 disconnected shoelace components (6960 triangles, 3700 vertices)
restricted to the lace region on the shoe upper. Boot material slots
0, 2, 3, and 4 are *not* laces and must remain unchanged. This was
verified across all three supported original / KM-07 / KM-08 GLBs.

The private viewer now applies `makeSenaShortsSocksSolidWhite`
to all `FA_shorts__*` and `FA_socks__*` meshes, including every
material group, with the same opaque `#FFFFFF` PBR settings as
the shirt (roughness .85 / metalness 0, no texture maps).
The separate `makeSenaBootLacesSolidWhite` changes **only material
slot 1** on the two identified boot meshes, preserving all other
material object references, textures, positions, shadows, soles and
studs. It validates both boots before replacing any material and
fails closed if the expected independent lace group is absent.
All artist-owned original materials are retained undisposed.

The KM-11 height adjustment, fixed boot geometry, KM-12 collar tape
removal and KM-13 white jersey remain unchanged. The local GLB is
still read from the owner's gitignored folder; no additional ZIP,
source binary commit, public deployment, DB write or merge is needed.

Targeted tests assert shorts/socks pure white (including multiple
materials), boot material isolation, saved original shared texture,
unchanged geometries, two-shoe guard and idempotence. Browser QA and
full Node suite still require verification. PR #454 stays Draft/HOLD.

## KM-14B — fix empty Kit Maker after white-lace update (2026-11-10)

The KM-14 boot-lace implementation made the outfit fail to load. The root
cause was a false assumption about the parsed glTF: each original boot has
five glTF primitives with separate materials, but **THREE.GLTFLoader
creates five individual child Mesh objects for each boot**, not a single
Mesh containing an array of five material slots. The old validation
threw and the clothing-only preview remained empty.

The fixed code traverses the five single-material meshes per side,
including the numbered primitive-name suffixes generated by GLTFLoader,
and identifies **only the one with material `FA_boots__material_1`**
(the shoelaces). Both shoes are validated before recolouring anything;
all four other primitive materials, their colours, shoe geometry, laces
source maps, and fixed boot positions remain unmodified. The shorts,
socks and jersey still use their approved opaque white materials.

An optional cosmetic lace-mapping problem is now nonfatal: the viewer
shows the outfit with original laces and a specific status warning
instead of blanking the entire stage. On other outfit-load exceptions,
the DEV-only viewer status includes the error details for debugging.
A regression test simulates the real GLTFLoader primitive layout and
verifies both white laces, untouched shoe parts and atomic validation;
viewer error behaviour is statically asserted. No original artist binary
needs to be downloaded or committed. Complete Windows Node/browser QA
is pending; PR #454 remains Draft/HOLD, no merge or deployment.

Technical naming detail: Three.js `PropertyBinding.sanitizeNodeName()` removes the
period in the source boot name `FA_boots__shoes_l.001`, so the rendered
primitive child names are `FA_boots__shoes_l001`, `...l001_1` etc.; the
same applies to `r001`. The corrected selector accepts sanitized names
and the original unsanitized form, guarded by the exact lace material.

## KM-15 — monochrome football boots, remove green studs (2026-11-10)

Owner reported that the boot stud tips were still green after KM-14B.
Inspected the actual original and KM-08 private GLBs: each boot has
five material-indexed glTF primitives. Material 0 (shoe upper) uses
texture image 6, which is **exactly grayscale** (RGB channel differences
are zero throughout the 768×768 texture). Materials 1–4 share
image 7, a **fluorescent green atlas**. The underside studs and outsole
are primitive 4 (source geometry Y≈0.00024–0.0163 m).

The approved neutral black/white boot style now is:

- **Primitive 0:** keep the existing detailed grayscale/black upper;
  no source atlas changes
- **Primitive 1:** original laces, recoloured opaque white by KM-14B
- **Primitive 2:** opaque white accent/detail, no green atlas
- **Primitive 3:** dark black trim `#181818`, no green atlas
- **Primitive 4:** outsole and studs black `#101010`, no green atlas

`makeSenaBootsBlackAndWhite` validates exactly five named
single-material boot primitives per foot using the same Three.js
sanitized/source-name recognition as the lace code. Both feet are
validated *before* replacement. It replaces only materials 2–4
with independent untextured neutral PBR materials, preserving boot
geometry, height, normals, UVs and source material objects.
The original source grayscale upper texture is preserved. The viewer
applies this before the KM-14B white-lace conversion, and treats
cosmetic colour failures as nonfatal rather than emptying Kit Maker.

No author binary is added to public GitHub, and no new GLB download
is required. Focused synthetic tests cover two boots, neutral colours,
unchanged uppers/laces/geometry, source textures, idempotence and atomic
validation. Full Node/Chrome QA is still pending. PR #454 Draft/HOLD.

## KM-16 — functional solid-colour kit designer (2026-11-10)

The owner requested the first real kit customizer. The right-hand options
panel now contains **Garment (Jersey / Shorts / Socks)**, **Style** and
**Color**. Only **Solid** is currently permitted; no fictional pattern,
gradients, number, logo, sponsor or export function is implied.

A separate solid-colour selection is kept for each garment. With no club
selected, the entire kit defaults to the already-approved neutral white,
and the club-specific Primary and Secondary options are disabled.
Select a club from the existing **320-club** canonical dropdown to enable
its published `primaryColor` / `secondaryColor` from
`/clubs/_shared/manifest.json`. This is the same **single, existing**
read-only manifest request, no separate colour API or local hardcoded club
colors. Proposed, unmerged CLUB-COLORS issue #466 selections are **not**
silently used.

The first **Kit Maker-only neutral allowlist** (not an official change to
any club's colours) is: White `#FFFFFF`, Black `#111111`, Grey
`#808080`, Ivory `#F5F1E9`. There is no arbitrary colour picker or
hex entry. The six colour buttons and all static labels are on first
paint; Primary and Secondary swatches only receive their actual hex
values after the club manifest arrives. Changing club updates any
garments that have Primary/Secondary *roles* selected; the selection of
a particular garment remains independent. No page reload is needed,
and the club URL parameter remains the only persisted Kit Maker state.

**Render path:** The club picker and private viewer share the same
`kit-maker/lab/kit-design.mjs` ES module. Its pure store calculates
validated, role-based colours and immediately broadcasts changes. After
the KM-11 fit, KM-12 printed neckband removal, KM-13/14 solid-white
materials and KM-15 monochrome boots are set up, the viewer applies
the current colours exclusively to private jersey/shorts/socks
`MeshStandardMaterial.color` slots. Geometry/UVs/rig/boots and original
artist textures are never edited. The viewer receives updates even if
the user selects a palette before the private GLB finishes loading.
The original standalone mannequin laboratory (port 2100) never imports
this DEV-only design module.

**Private hosting/security:** `/__fa_kit_maker__/kit-design.mjs` is
explicitly served by the existing loopback/DEV allowlist, denied to
non-DEV/public hosts and production publication. No write route, backend
or remote database change is added. The private model remains gitignored,
and no vendor GLB is committed to the public repository.

**QA:** targeted `node --test match-engine/tests/kit-maker-design.test.mjs`
validates the six authorised colours, canonical club role updates,
independent garment colours, rejection of unsupported styles/custom
hexes, subscriber lifecycle, atomically validated private-material
recolouring and untouched shoes/geometry. The existing Kit Maker
page/server test now checks six colour options, three garment choices,
one style, the private module route, event integration and continued
publication guards. The old Chrome smoke expectation for two
disabled colours and the removed procedural-jacket message was updated.

**Owner visual QA remaining:** desktop 1440/768 and iPhone 390/320,
light/dark, first paint with no club, select any two clubs and check
that Primary/Secondary follow the selected one, colour all three
garments independently, switch garments without losing selection,
confirm shoes stay monochrome, rotate/zoom before and during colour
changes, refresh with `?club=...`, and verify standalone 2100 viewer
still loads. Full browser/CI checks not yet confirmed.

PR #454 stays **Draft/HOLD**, one grouped commit, no merge/deploy/remote
DB modification. Match Engine parent PR #455 remains untouched.

## KM-17 — Vertical Stripes: first geometric kit style (2026-11-10)

The owner authorised proceeding with the previously recommended next
style. **Vertical stripes** is added alongside **Solid** for jersey,
shorts and socks, while retaining the existing 320-club selector and
the six-role legal colour palette. Further styles (horizontal hoops,
half-and-half, central stripe, sash, chevrons, etc.) are **not included**
in this increment.

Each garment has its own independent Solid/Vertical stripes choice.
When Vertical stripes is selected, its first-paint sidebar exposes
**Base / Stripe** colour layers and three stripe-width presets:
Narrow **45 mm**, Regular **75 mm** (default), Wide **110 mm**.
Base and Stripe colours are chosen *only* from the already-approved
Kit Maker colour options (canonical club Primary / Secondary, or
White/Black/Grey/Ivory neutral options). Defaults are solid white;
upon first selecting stripes, base White and stripe Black. Returning
to Solid retains the stripe colour and width for later use. Changing
the selected club updates both role-selected layers automatically
without replacing the other garment designs. Style options and
static labels render immediately, before manifest or GLB loading;
secondary controls are hidden while Solid is selected.

**Geometry fidelity:** A Three.js MeshStandardMaterial
`onBeforeCompile` variant uses the *source model-space X coordinate*
instead of the GLB's printed texture-atlas UVs. Vertical bands are
continuous across independently generated mesh panels; their width
is defined in real metres instead of texture pixels. A
`cos(pi*x/width)` mask with `fwidth`-based anti-aliasing sets the
base/accent PBR diffuse colour in the fragment shader. Uniforms are
updated in place when garment, style, width or club changes, so
switching styles does not generate or upload new textures, move
vertices, replace the boot meshes or re-request the private GLB.
The Solid path disables stripes through a shader uniform and
retains the existing untextured PBR material and lighting. The
patterns extend to shorts and socks consistently with the selected
garment's individual style.

**Security / ownership:** the stripe renderer touches only KM-13/14
private neutral garment materials and the DEV-only kit state. Third
party geometry, UVs, local texture atlas, shoe materials, boots
and sole height, and the KM-11 alignment remain untouched.
The design module is still served only from `/dev/kit-maker`,
no API writes, new persistence, deployments, merges, or third-party
asset uploads. PR #454 is still Draft/HOLD, the base Match Engine
PR #455 is not altered.

**QA:** isolated unit regressions cover independent style/colour/width
state by garment, club-role changes, rejection of unsupported styles
and arbitrary colours, shader injection/antialiasing, uniform changes
without recompilation, preservation of geometry and boot materials,
plus the original KM-16 solid-only tests. The page/server assertions
were updated for two styles and stripe options at first paint, with
Chrome interaction smoke assertions for switching garments,
adjusting stripe layers/width and reverting to solid. Actual owner
private-GLB rendering on Chrome and iPhone Safari remains pending.

## KM-18 — garment-contour stripes and continuous width slider (2026-11-10)

Owner feedback: **the vertical stripes must follow the curves of the jersey**,
and **Stripe width must be a slider** instead of three buttons.

The KM-17 straight global `position.x` pattern is replaced with
**surface-aware coordinates derived from the actual local garment
geometry**. For the jersey torso, the shader interpolates an elliptical
cross-section profile reflecting the creator's measured cloth shape:
the half-width narrows to about 15.3 cm near the waist and expands to
about 20.8 cm across the upper chest/shoulders. The stripe mask follows
the angular/curvilinear path around that changing cross-section, rather
than intersecting the fabric with global vertical planes. The wrap
coordinate stays continuous across the visible centre-back; the
mathematical angular seam is placed at the left underarm/side. The
left/right upper-sleeve meshes each get a separate axis-aligned tube
coordinate, so their stripes run along the tilted sleeve fabric instead
of planar X slices. Shorts/socks retain a contour-based coordinate
without special shirt-sleeve treatment.

The existing Three.js `MeshStandardMaterial.onBeforeCompile` mask
retains PBR shading, fragment derivative antialiasing and in-place
uniform updates, so slider interactions do **not** recreate textures,
recompile the shader, move vertices, re-export GLB, reload the viewer
or touch the original imported UV/texture data. Only approved private
garment material slots are modified. The monochrome shoes, white laces,
KM-11 fitted height and KM-12 interior collar cleanup are unchanged.

**UI:** `Stripe width` is now a native accessible HTML range slider,
from **3 to 15 cm in 0.5 cm steps**, default **7.5 cm**. Its numeric
readout is present at first paint; `input` events (drag/touch/keyboard)
live-update the same design store used by the 3D viewer. Each garment
remembers its individual width when switching between Jersey, Shorts,
Socks and Solid/Vertical stripes. Club colour roles, two colour layers
and four allowed neutrals work as before. The slider only appears when
the active garment style is Vertical stripes.

**QA:** 13 focused synthetic JS regressions PASS (including the original
palette restrictions and geometric preservation, 25 slider steps,
independent per-garment settings, curved torso and both sleeves,
mathematical back-seam continuity, shader uniform reuse, and reverting
to Solid). Kit Maker page and Chrome smoke expectations were updated
to validate the actual range input, first-paint readout, and live
`input` event with an 11.5 cm result. Actual Chrome WebGL / iPhone
Safari visual inspection on the owner's private GLB and complete
Node/CI execution remain pending.

Scope: DEV-only Draft/HOLD PR #454. No merge, publication,
persistent kit record, remote DB changes or artist GLB redistribution.

## KM-19 — fix vertical stripes converging toward a common focal point (2026-11-10)

The owner reported that the KM-18 curved stripe effect was **radial and
converged in one point** rather than producing parallel, vertical shirt
stripes. That regression came from the KM-18 shader's `atan(...)`
angle-based unwrap and its polar sleeve mapping, which can yield
visible fan/pole artifacts.

KM-19 replaces that angular shader mask with a **non-singular,
parallel horizontal garment phase**. It starts from the local
left/right garment coordinate `p.x` and applies only a *bounded*
`0.010*sin(p.x*7.0)` drape offset, modulated smoothly by fabric
depth `abs(p.z)` and vertical height. This makes the projected
vertical bands gently follow the actual shirt contour without
fanning to the collar, shoulders, body centre or a discontinuous
UV/angle seam. The horizontal derivative of the new phase is
guaranteed to remain at least **0.9405**, which means adjacent
stripes cannot collide, reverse, or meet at a singularity.
The front and back use a symmetric depth response and the same
phase through the side seam, with no angular branch cut.

The sleeve meshes `FA_jersey__38/39` and `62/63` use the same
non-singular base field plus a bounded, side-specific lateral offset
along the **sloping garment sleeve axis**. This offset fades to zero
near the shoulder seam, so each arm retains parallel stripes rather
than projecting a radial/tubular swirl. The black/white boots and
all shorts/socks retain their existing styles and colours.

**Private source GLB geometry audit:** evaluated the new scalar field
across all **50,792 front**, **46,628 back**, **8,484 right
sleeve**, and **8,472 left sleeve** vertices. All values are finite;
the shirt torso contour adjustment stays around ±7mm.
The shader does not touch vertex positions, UVs, textures, clipping,
or the KM-11 3D fit. A new shader cache key
`km19-parallel-curved-stripes-v1` forces the renderer to replace
its old polar shader after local refresh.

**QA:** 14 focused JS tests PASS, including original palette/slider
tests and new numeric monotonic-spacing tests for multiple garment
heights, front/back/side continuity, and each sleeve's sloped-axis
coordinate. JavaScript module/test parse checks PASS and the source
GLB phase audit PASS. Full browser WebGL rendering with the owner's
private GLB, iPhone Safari and complete Node/CI still require owner
verification. The KM-18 slider remains 3–15 cm (0.5 cm steps);
club Primary/Secondary, allowed neutrals, independent per-garment
styles and colours remain unchanged.

PR #454 remains Draft/HOLD. No merge, production deployment, DB
operation, or third-party 3D asset upload.

## KM-20 — equal stripe width on the ACTUAL flattened cloth pattern (2026-11-10)

**Owner visual feedback:** On the KM-19 version, vertical stripes
still visibly changed apparent width at the curved shirt flanks.
The remaining problem was projecting the pattern using garment
**3D X** (`p.x + small drape`). Even a small 3D-space deformation
cannot make stripe width constant in actual fabric distance when
the surface curves away from camera and the X projection compresses.

**Solution:** Use the original Alberto Sena glTF's **2D
sewing-pattern `TEXCOORD_0`** as the vertical-stripe lateral
coordinate. The author has already unwrapped the cloth panels into
their actual flat pattern; `uv.x` is horizontal *on the fabric*,
even around shoulders and hips. The shader now calculates
`distanceOnFabric = (uv.x - centreU) * metresPerUv`
and alternates colours every exact slider-requested number of
metres along the flat pattern. This eliminates 3D-side compression
from the stripe-width computation, without requiring angular
projections, focus points, vertex movement, or extra textures.
Ordinary camera foreshortening remains physically correct.

**Measured genuine creator GLB** SHA-256
`985a459664dbbbea061a5126ba1765acc208e4480091a2882f441379926110c8`:

- Jersey front `FA_jersey__9`: ~**1.51472 metres/UV**,
  developed pattern width **48.68 cm**, central U≈0.70213.
- Jersey back `FA_jersey__42`: ~**1.51532 metres/UV**,
  developed pattern width **48.70 cm**, central U≈0.31534.
- Right sleeve `FA_jersey__38`: ~**1.52317 metres/UV**,
  developed pattern width **38.70 cm**, central U≈0.66847.
- Left sleeve `FA_jersey__62`: ~**1.52361 metres/UV**,
  developed pattern width **38.71 cm**, central U≈0.33224.

This is not a guessed scaling factor: `measureKitStripeFabricMetric`
samples up to approximately 512 source **triangles per garment
geometry**, obtains physical metres/UV from the 3D tangent to
the authored flat-pattern U axis, takes the robust median and
centres each pattern island on its own U range. A WeakMap cache
makes subsequent slider/club/colour inputs uniform-only.
It validates the original `position` and `uv` attributes
on *every* intended garment mesh before repainting anything.
If the private GLB lacks those attributes, the style update
fails atomically with a diagnostic, not a half-striped outfit.

The Three.js r181 vertex program unconditionally declares
`attribute vec2 uv`, so the KM-20 PBR shader uses
`vKmPatternU=uv.x`, independent of the original source texture
maps. The same lighting, `fwidth` antialiasing, existing
`MeshStandardMaterial` objects, live uniforms, and **3–15 cm**
slider remain. The new cache key is
`km20-fabric-width-uv-stripes-v1`.

**QA:** All **15 targeted JS model-design tests PASS** in the
isolated test harness. New regressions assert physical stripe
width on a curved 3D panel with regular flat UV intervals,
show that old model-X projection would squash flank widths,
validate front/back matching, and reject absent UV atomically.
The DEV page/server test no longer asserts removed KM-19
world-X shader functions. A separate read-only audit of the
original private GLB confirms compatible UV layouts and the
measurements above. Full Node/CI and owner's Chrome/iPhone
WebGL visual QA are still pending; no visual pass is claimed.

Scope: **Draft/HOLD PR #454**, no merge, deployment, remote DB
write, saved kit state, or original artist asset upload. Boot
black/white materials and shoe positioning remain unchanged.

## KM-21 — independent collar and sleeve cuff colours (2026-11-10)

At the owner's request, the Kit Maker now lets users set two new,
independent **Jersey** colour targets: **Collar** and **Sleeve cuffs**.
Both use *exactly* the existing canonical club **Primary/Secondary**
and the current allowed neutral roles (White, Black, Grey, Ivory);
there is no custom hex entry, new proposal palette, or API call.
The in-memory state remembers these roles independently of the body
and vertical-stripe colours, including when switching between
Solid/Vertical stripes, garment tabs and clubs. Default remains
white collar and white cuffs. Changing club updates any selected
Primary/Secondary detail roles automatically.

The sidebar shows a dedicated first-paint **Color area** control.
For Jersey it offers Body, optional Stripes (only when vertical
stripes are selected), Collar and Sleeve cuffs. For Shorts and
Socks only the applicable Body/Stripes controls are shown. Selecting
any target reuses the same six permitted colour swatches and
updates the preview immediately. The slider and the KM-20
equal-width patterned cloth UV mapping are unaffected.

**Author-source GLB topology was inspected before implementation:**
`FA_jersey__Pattern2D_3805002` is a separate **outer collar**
mesh (and its two material primitives become two loader meshes).
The former printed *inner* neck strip
`FA_jersey__Pattern_2702362` remains excluded by KM-12.
The actual sleeve shells are `FA_jersey__38` and
`FA_jersey__62`; **their hems are not independent meshes**.
The sleeve pattern has a distal flat-pattern V edge near 0.8891459.
A **12 mm wide fabric band**, calculated using the source's
vertical UV tangent scale (approximately **1.577 m per V** on
both sleeves), marks the last ~0.0076 UV units at that distal
edge. This band follows the natural sleeve circumference, without
creating geometry, deforming the cuff or recolouring the full sleeve.

The existing private `MeshStandardMaterial.onBeforeCompile`
shader gains two independent trim uniforms: an outer-collar
region that overrides the body/stripe colour for the collar
mesh, and an antialiased cloth-V band for both sleeve cuffs.
Only garment materials are affected. The already approved
black/white boots and white laces, GLB geometry, UVs, source
textures, fit and object transforms remain unchanged.
The new checks validate the club/neutral role selection
before mutating any shader uniforms. No artist binary is
committed to public GitHub.

**QA:** the focused design suite covers independent choices,
club-role changes, supported detail mesh IDs, the 12mm fabric
cuff threshold, 3D shader uniforms in solid and stripe modes,
unchanged boots and geometry, and atomic rejection of illegal
detail colours. The page/server assertions now expect four
colour targets; Chrome's interaction smoke exercises the
two detail colours and persistence across garment/style
switches. Full Node/CI, owner-local WebGL and Safari
visual QA still require verification.

PR #454 remains Draft/HOLD, with no merge/deploy/DB changes.

## KM-22 — no mannequin shadow, camera panning and complete outer sleeve hem (2026-11-10)

Owner QA requested three changes: **remove the mannequin shadow**,
**be able to move rather than merely rotate the view**, and
**recolour the outer sleeve edge instead of an interior stripe**.

**Shadow-free viewer:** Disabled the Three.js shadow map globally,
disabled imported body and outfit mesh shadow casting/receiving and
the directional light's shadow casting, and deleted the transparent
ground `ShadowMaterial` receiver entirely. Hemispheric and directional
*lighting* remains so cloth detail and PBR shading are still visible.
The same scene viewer powers the DEV Kit Maker and local mannequin
studio; neither displays a projected/contact shadow after KM-22.

**Navigation:** Enabled OrbitControls `enablePan` and
`screenSpacePanning`. Desktop: left mouse drag **orbit**, right mouse
drag or Shift+left drag **pan/translate**, wheel **zoom**. Touch:
one finger **rotate**, two fingers **pan/pinch zoom**. Preset camera
views still reset the orbit target to the original centre.
The stage now includes visible, responsive controls guidance and a
descriptive canvas accessible label.

**Actual sleeve folded-hem diagnosis:** Read-only audited the
original owner-private Alberto Sena GLB, SHA-256
`985a459664dbbbea061a5126ba1765acc208e4480091a2882f441379926110c8`.
The sleeve ends are *folded* in the artist's flat pattern, so the
KM-21 cutoff `highV - 12mm/metresPerUvV` included mostly an interior
folded-return line, rather than the outside opening lip.
The genuine right sleeve (`FA_jersey__38`) and left sleeve
(`FA_jersey__62`) each have an exterior hem boundary loop of
**155 vertices**, with pattern V ranging **0.874266–0.889082**.
Original high V≈0.889146 and measured vertical metric ≈1.577m/UV.
The KM-21 threshold **0.881538** reached only **51.6%** of the
physical exterior boundary vertices. The new threshold **0.87393**
covers **100% of those outer boundary vertices** on both arms.

KM-22 therefore colours the existing 12mm visible cuff **and the
matching 12mm turned-under return** as one contiguous strip. The
shader uses the existing original `vKmPatternV`, `kmTrimCuffV`
and antialiasing; only the cutoff is adjusted via
`kitCuffOuterTrimThreshold(metric)`. It validates source geometry
measurements before applying the trim and does not recolour the
whole sleeve. Collar, base/stripe geometry, club/neutral palette,
3–15cm width slider, black/white boots and white laces remain as
previously approved. No private artist GLB or ZIP is redistributed.

**QA:** 21 isolated Kit Maker design-state/shader tests PASS,
including new regression cases for actual original left/right
source hem boundaries, exterior coverage and Solid/Vertical stripes
mode. Syntax preflight PASS for viewer/kit-design and associated
test files. Page/server checks now require no shadow caster/catcher
and active mouse/touch panning; browser smoke asserts visible
controls guidance. Actual user Chrome/iPhone visual verification
and full Node suite remain pending; **not** reported as completed.

Changes committed as one grouped update to the existing **Draft/HOLD
PR #454**. No merge, deploy, remote database writes, or changes to
the underlying Match Engine PR #455.

## KM-23 — one jersey-trims colour, real exterior sleeve ends and lower torso hem (2026-11-10)

**Owner QA:** Sleeve cuffs were STILL appearing on the **inside** of the
sleeve, and one setting should apply exactly the same allowed colour
to **outer collar, exterior sleeve cuffs on both arms and the bottom
edge of the shirt body**.

**Confirmed actual GLB root cause:** A direct read-only audit of
`alberto-sena-outfit.glb` (SHA-256
`985a459664dbbbea061a5126ba1765acc208e4480091a2882f441379926110c8`)
shows that the earlier high-V KM-21/22 mask was reversed. In the real
author mesh `FA_jersey__38/39`, the **outer sleeve opening** is at
UV `V≈0.110854`, with vertical 3D height near **1.358 m**;
the **shoulder** is near `V≈0.231468`, Y≈**1.526 m**.
The other sleeve `FA_jersey__62/63` is the mirror image.
Thus sampling `V > highV-24mm/metresPerUvV` had consistently
colored a stripe near the *wrong end* of the arm.

The original GLB also splits **each sleeve across TWO material
primitives** (`38/39` and `62/63`), with the same original
underlying coordinates but different faces/materials. KM-21/22
selected `38/62` only. KM-23 correctly processes **both
primitive materials** of **both sleeves**. Their trim now selects
`V <= lowV + (12mm visible + 12mm folded return)/metresPerUvV`
with antialiasing. It reaches the actual distal opening, not the
upper/inner line. The old private material atlas, original
geometry, UVs and artist binary are untouched.

**One setting:** Jersey's Color area now offers **Body**,
**Stripes** (only when vertical style selected), and
**Jersey trims**. The trim selector is accompanied by the text
“Collar, sleeve edges and bottom hem use the same color.”
It controls a **single in-memory colour role**, selected from the
existing allowed club Primary/Secondary and White/Black/Grey/Ivory
neutrals. The former independent Collar and Sleeve cuffs selectors
are **removed**; all three trim regions use exactly the same live
uniform `detailColors.trim`. Club-role changes, garment tab
changes and Solid ↔ Vertical stripes preserve the selection;
Shorts/Socks hide the trim option.

**Included meshes:** Both separate outer-collar material primitives
`FA_jersey__Pattern2D_3805002/3805003` are recoloured fully.
Both sleeve material primitives per side (`38/39/62/63`) receive
the exterior hem band. The two front and two back shirt-body
material primitives (`FA_jersey__9/10/42/43`) receive a continuous
**24mm cloth-pattern lower hem** using their independently measured
**low-V** edge (front V≈0.275647, back V≈0.278342).
The previously removed black-lettered inner collar tape
`FA_jersey__Pattern_2702362` remains excluded. Boots and
shoelaces, shorts and socks are unmodified.

**Implementation:** No new material, texture or geometric segment.
The same private Standard PBR shader retains KM-20's equal-width
sewn vertical stripes. `kmTrimRegion` distinguishes collar (1),
sleeve edges (2), body hem (3). `kmTrimEdgeV` is each flat-pattern
piece's **minimum V plus a measured physical fabric width**;
the fragment mask fades from colour at the real exterior side to
body colour using `1-smoothstep(...,vKmPatternV)`. New shader cache
key `km23-unified-exterior-shirt-trims-v1` guarantees the old
direction is not reused across refreshed sessions.

**QA:** targeted design-state/render regressions verify the one
trim role, allowed colour guard and club changes, ALL creator mesh
primitives, source-model sleeve low-V geometry, lower-body hem,
shared colour in Solid and Vertical stripes, untouched shoe mesh
and shader orientation. Page/server and Chrome interaction checks
were updated to expect exactly three active colour areas and the
new first-paint explanatory text. Isolated state/shader tests and
syntax preflight pass; full Node, actual Chrome WebGL rendering with
the owner's original local outfit and Safari visual QA remain to
be confirmed. No CI success is claimed.

PR #454 stays **Draft/HOLD**. No merge, deploy, remote DB change
or redistribution of the privately licensed artist model.

## KM-24 — fitted physical sleeve and waist edges (2026-11-10)

Owner QA found that the collar trim was correct but the two sleeve cuffs
and bottom body hem were positioned incorrectly. UV V coordinates track
the flattened texture atlas, not necessarily the real exterior opening.

KM-24 measures both source sleeve primitives per arm together, fits a
sloping outward XY direction and colours the last 24 mm of sleeve in
3D garment space. Torso front/back meshes share a bottom 24 mm band
along real vertical Y. A 99.5th-percentile distal cut limits outlier
effects. The fitted projections are cached per outfit; colour/style
changes reuse the same uniforms with no geometry or UV alteration.
The outer collar, existing one-colour Jersey trims setting, even-width
UV stripes, boots and original artist binary are unchanged.

Targeted synthetic geometry and shader tests cover both cuff directions,
whole sleeve opening and curved lower hem. Owner-local original GLB
WebGL/Safari visual QA is still pending. PR #454 Draft/HOLD, no merge,
deployment or remote database work.

## KM-25 — contour-following outer Jersey trims (2026-11-10)

The owner found both sleeve cuffs still incorrect and the waist border
imprecise after KM-24. A single 3D projection plane cannot represent
the actual nonplanar distal openings. KM-25 measures one circumferential
physical rim profile from the **combined material primitives** on each
arm (38/39 and 62/63), plus a 360-sector wavy lower contour across
all four front/back torso primitives (9/10/42/43). Every source vertex
receives its **local metric distance to that external rim** through a
new shader attribute; the shared allowed Jersey trims colour fills the
outermost 24mm with antialiasing.

The artist's original vertex positions, UVs, normal/index data, textures
and local GLB remain unchanged; only new renderer attribute data is
added after fit, cached once per loaded outfit. The collar, KM-20
equal-width stripes, boots, shorts, socks and one-colour trim control
are preserved. Synthetic QA verifies asymmetric sleeves and curved
waist, but this is **not visual certification** of the private model.
Real desktop and iPhone Safari QA is still pending. Draft/HOLD, no
merge/deploy/DB/private binary redistribution.

## KM-26 — identify existing shirt borders from the original local GLB (2026-11-10)

Owner reports that both KM-25 sleeve trims are inaccurate and the
waist trim is likely too thick. An existing sewn border may already
be modelled. Stop guessing UV bands, 3D masks and artificial 24mm widths.

Read-only local diagnostic `inspect-sena-trim-topology.mjs` reads the
private GLB, recognizes actual open perimeter loops, original material
boundaries and modeled sharp folds, combining both sleeve primitives
and the four torso primitives with a 20-micron weld tolerance.
No geometry is changed, uploaded or shared. Only aggregate counts,
perimeters, centres, bounds and original material names are reported.

From PowerShell project root:
```powershell
node tools/kit-designer-prototype/inspect-sena-trim-topology.mjs > "$env:TEMP/fa-kit-trim-topology.json"
```
Examine `sections.rightSleeve`, `sections.leftSleeve` and
`sections.waist`. Colour only the existing physical hem mesh or
folded fabric faces once source topology identifies them. The current
shader is not yet approved by real-model visual QA. PR Draft/HOLD;
no merge, deployment, remote DB change or artist GLB redistribution.

## KM-27 — colour ORIGINAL modelled cuff and hem surfaces, not a generated band

Owner-provided KM-26 private-local topology report identifies, on
**both sleeves**, a closed original 73-edge material boundary around
Y~1.368 and a second ~70-edge fold around Y~1.350. The outer sewn
segment is about 18mm deep; earlier flat UV/global 3D masks did not
select these exact face rings. The waist has a real 198-edge, ~0.965m
fold ring centred near Y~0.937 and a segmented original lower
material border near Y~0.959. Absolute Y values are **evidence only**
because the on-load fit may shift original coordinates.

KM-27 reads the PRIVATE, already-loaded and fitted artist geometry
in browser, welds matching original vertices across both source
primitives, and identifies the original topological seam/fold loops.
Only existing source triangles between those rings are coloured.
An additional small overlay MeshStandardMaterial draws the selected
triangles coplanar with the original materials. The original source
GLB, vertex/normal/UV/index buffers, boots and jersey shell are
not changed. Collar remains fully coloured as before. No fixed width,
UV-V cut, shader-created 24mm edge, new vertices beyond the selected
overlay faces, or arbitrary trim shape is used.

The code reports selected source face counts via
`outfit.userData.km27SourceTrimReport` and Chrome DevTools.
If the original source topological contour cannot be identified,
it displays **no invented edge** rather than an inaccurate stripe.
Both material/crease seam and outside fold must be present for a
region. Paired sleeve topology is detected separately by side;
the waist joins front/back segment arcs.

The added testing uses synthetic multi-primitives with actual sewn
fold rings. The source report was parsed from user-local output, NOT
from an uploaded original GLB. Real user-local WebGL visual QA remains
pending before APPROVAL. PR Draft/HOLD, no merge/deploy/remote DB or
private-asset redistribution.

## KM-28 — only the waist's lateral seam joins (2026-11-10)

Owner visual QA approved the overall original sewn trims but asked to
recheck the waist **where front/back meet at both side seams**.
The upper hem profile in KM-27 treated ALL original primitive
interfaces near the lower waist as part of the horizontal waistband.
That inadvertently admitted near-vertical side-seam segments: their
upper vertices could pull the local trim line upwards at the flank.

KM-28 retains only genuine circumferential/tangential original seam
edges when constructing the *upper* waist hem profile. Source seam
segments with negligible horizontal angular progress or predominantly
vertical displacement are excluded, while both complete front/back
horizontal arcs and the original closed bottom fold remain. No
synthesized width, new colour mask, extra mesh topology or changes to
cuffs/collar. Report now includes `upperCircumferentialEdges` and
`excludedVerticalSideEdges` for local QA.
Added a targeted 4-panel regression with two 3D front/back vertical
side joins; body triangles must stay uncoloured while both original
hem halves remain coloured across the lateral joins.

Real original Alberto Sena GLB WebGL QA remains pending; PR #454
Draft/HOLD. No merge, deploy, remote DB or third-party asset export.

## KM-29 — align vertical stripe PHASE at existing shoulder seams (2026-11-10)

A separate audit found that KM-20 accurately measures stripe WIDTH
in physical flat-pattern UV metres, but individually centres each
glTF primitive's UV island. This independently chosen origin means
the fabric stripes can jump out of phase where the original bust and
sleeve panels meet at the shoulders. KM-29 does **not** replace the
flat-fabric stripe shader with a projected 3D coordinate.

The DEV-only `kit-stripe-seams.mjs` collects boundary vertices from
the owner's already loaded original fabric positions/UVs. Near the
upper armhole/shoulder (excluding collar, waist and cuffs) it pairs
geometrically coincident original author vertices within 2.7mm,
finds both original fabric-U alignment and mirrored UV sign, and
robustly fits a stripe-PHASE shift against the connected bust panel.
All connected torso and sleeve primitives share that phase. It
retains the exact absolute metres-per-UV scale, the chosen stripe
width (30–150mm), all approved palette choices and fabric pattern
UVs. The correction is cached per outfit and does not rerun when
the slider or club colour changes. If fewer than 8 genuine seam
correspondences or high-residual matches exist, it leaves the UV
island untouched rather than inventing a connection.

The public-facing renderer and original author mesh/material/texture
data are unchanged. Existing original sewn cuff/waist overlays, one
Jersey trims selector, collar, shorts/socks, shoes and laces remain
untouched. A diagnostic `outfit.userData.km29ShoulderStripeReport`
reports only matched seam counts and residuals; no 3D positions
or third-party GLB are exported. Focused tests include the
mirrored front/back UV atlas and sleeve with unmatched cases.
Real owner-local Chrome GLB shoulder visual QA remains pending.
PR #454 Draft/HOLD, no merge/deploy/DB/asset redistribution.

## KM-30 — a single continuous vertical stripe over shoulder stitches (2026-11-10)

The desired stripe is one continuous sewn band from shirt body over the
shoulder onto the sleeve. Per-panel UV centering / one uniform phase
offset cannot achieve this over a curved, nonaffine author seam.

KM-30 derives one additional per-vertex fabric metre coordinate
`kmStripeSewnMetres` on every physically matched original torso/arm
panel. The sleeve inherits *exactly* the corresponding torso stripe
coordinate at **each actual stitched vertex**. The remaining seam
correction is smoothly carried across the source sleeve's UV pattern.
It can follow mirrored or 90-degree-rotated source pattern islands.
The existing PBR stripe colours and selectable 30–150mm widths remain
unchanged, with no world-space planarity, source UV edits or generated
trim surfaces. In a real 3D environment the stitched shader attribute
is bound at first paint even if Solid is the initial style. On models
with no verifiable stitch, original UV mapping is retained.

The only changed areas are stripe-coordinate calibration, shader
read path for confirmed joined panels, and focused regression tests.
Original author GLB, position, UV, normals, index, sewn collar/cuff/
waist trims, shorts, socks, boots, palette and permissions are intact.
The original private GLB still requires owner-local visual WebGL QA.
PR Draft/HOLD; no merge/deployment/remote DB or asset distribution.

## KM-31 — shoulder seam precision and 1 cm stripe minimum (2026-11-10)

Owner visual QA found that KM-30 still produced inexact colour bands
at the original sewn shoulder joints. Its correspondence required
similar VERTEX locations, which is not valid for differently tessellated
body/sleeve patterns or glTF files with duplicate UV/normal vertices.

**KM-31 source-topology correction:** Weld coincident triangle positions
within each original garment mesh using 20-micron source-local
tolerance; classify real open seam EDGES, not arbitrary UV-island or
nonindexed triangle corners. Index full 3D boundary segments in a
spatial grid, then project each actual adjoining sleeve seam vertex
onto a source torso segment within 2.7mm. The torso's intrinsic stripe
coordinate is interpolated at that physical point. All duplicate
vertices at one original sleeve stitch inherit the exact same
physical stripe coordinate. Residual non-affine atlas corrections
fade away from the shoulder (45mm falloff) so the remaining source
fabric width is preserved. Mirrored/rotated pattern charts and
separate left/right sleeve connections are supported, with original
source geometry, UVs, indices, materials and GLB left untouched.

A DEV-only `km31ShoulderStripeReport` lists matched seam segments,
median physical gap, connected/unmatched source panels and right/left
sleeve coverage. The console displays the report once on a real
Three.js garment. Source calibration still fails closed where
genuine geometry does not correspond; it never projects fabricated
colour strips across unverified gaps.

**Slider:** Vertical stripes now range from **1 cm to 15 cm** (10–150mm)
in steps of 0.5 cm (5mm), retaining the 7.5cm default.
This updates the canonical validation, first-paint HTML, available
selector range, responsive labels and regression tests. All garments
support the new minimum with independent widths. Synthetic tests
include fine sleeve/coarse torso, nonindexed duplicate stitches,
left-side rotated atlas and stripe-wave continuity at 1cm.

**QA gate:** The owner-local private Alberto Sena GLB is not stored
in GitHub, so the original model must still be reviewed in Chrome
at 1cm/3cm/7.5cm from front, back and side before visual acceptance.
Collar/cuff/waist trims, source artist binary, palettes, boots,
shorts/socks and production assets remain untouched.
PR #454 Draft/HOLD; no merge, production deploy or DB operation.

## KM-32 — one front/back stripe origin on the physical shoulder seam (2026-11-10)

Owner proposed starting the torso stripes at the sewn shoulder instead
of independently centring front and back UV islands. KM-31 was using
the largest body panel as an arbitrary root, allowing front/back
stripes to begin from different positions even when sleeve joins were
otherwise corrected.

KM-32 searches for the ORIGINAL shared topological seam between
front torso primitives 9/10 and back primitives 42/43 using the
KM-31 3D source segment projection. Candidate seam segments must
extend laterally at least 45mm from the neckline and be predominantly
horizontal; pure or sloping vertical SIDE seams are rejected.
The most medial, physically shared shoulder stitch becomes a single
**zero-metre stripe start** on the front. The back inherits the exact
same intrinsic physical stripe coordinate at each original sewn
shoulder vertex BEFORE connecting either sleeve. Both sides are
analysed where present; the chosen origin is consistent independent
of glTF primitive traversal order or source UV centering.
The subsequent original sleeve projection inherits the already
shared torso stripe field. Mirrored atlas charts and differently
tessellated front/back shoulder seams remain supported, including
the 1cm stripe minimum added in KM-31.

This is not a new mesh, a projected global-X stripe, an invented seam
or a colour-contrast mask. The original source GLB, triangle positions,
UVs, normals, body materials and collar/cuff/waist trims remain
unchanged. The source-local report `km32ShoulderOriginReport` shows
`front-back-anchored` and the matched front/back primitives when a
genuine common shoulder was found; `not-detected` or
`front-back-seam-found-but-unaligned` means the original private
GLB must be inspected instead of claiming false alignment.

Targeted regressions cover each shoulder, different front/back
tessellation, inverted source UVs, arms joined only AFTER the torso,
Solid-to-Vertical stripe shader reuse, and rejection of vertical or
inclined side seams. Real original GLB visual inspection in
owner-local Chrome is pending. PR #454 Draft/HOLD, no merge, deploy,
remote DB access or artist-model publication.

## KM-33 — prevent KM-32 shoulder analysis from blocking garment load (2026-11-10)

**Regression reported by owner:** Kit Maker / original garment does not load
following KM-32. Actual browser stack trace is unavailable, but the
runtime inspection found a concrete load-blocking design: the full,
synchronous front/back shoulder topology solver was invoked by
`applyKitDesign` **on initial Solid first paint**, before the source
GLB was attached to the scene. It can be expensive on the original
detailed garment, even though no stripes are visible yet.

**Repair:** The private source GLB can now load and be recoloured in
Solid without running the KM-29/31/32 seam solver. Only selecting
Vertical stripes triggers shoulder calibration. The existing
MeshStandardMaterial hook uses a dynamically selected plain vs
`kmStripeSewnMetres` shader variant; changing the variant marks
`material.needsUpdate` and does NOT reload or modify the GLB.
After the first calibration, source geometry measurements remain cached.
The KM-32 front/back shared shoulder origin is retained for the
striped style (not rolled back).

**Bounded reference discovery:** KM-32's initial search for which front
and back are sewn together now examines at most 192 sampled source
boundary points per candidate pair. Once one plausible original
shoulder has been identified, the complete seam is fitted precisely
once, preserving the one-centimetre minimum width and the actual
original stitched coordinate.

**Verification:** 36/36 focused exact-source JS design/shoulder tests
passed in V8, including new Solid-first-load/no-calibration,
Solid-to-Vertical material shader upgrade, the unchanged shared
front/back origin, and dense-mesh bounded discovery. The original
proprietary GLB is owner-local, and original Chrome/Safari WebGL
loading and visual QA still need owner confirmation; do not claim
the full Node suite or live model was run here.

No changes to original glTF geometry, sewn collar/cuff/waist trims,
colours, slider minimum 1cm, frontend navigation, public assets,
database, deployment or merge. PR #454 remains Draft/HOLD.

## KM-34 — automatic asset loading from an authorized private GitHub Release

The **public** Football Architect GitHub repository intentionally does
**not** contain Alberto Sena's authored GLB: the source ZIP provided no
redistribution license. Approval to implement automatic retrieval is
**not** permission to publish the binary. No source model or texture is
included by this PR.

The DEV-only server still prefers an existing, gitignored
`kit-maker/local-assets/alberto-sena-outfit.glb`. If that file is
missing, it can retrieve an explicitly authorized binary from a
**separate private GitHub Release**, purely on the server side. GitHub
repo/token/asset identifiers are not sent to the browser. The original
GLB is SHA-256 verified and checked for glTF v2 signature, declared
file length and the 100MB limit. The signed GitHub download redirect
is restricted to trusted asset delivery hosts, with no credential
forwarding. A successful remote asset is cached only **in memory**
for the current DEV process; there is no need to copy it locally.

**Only after you obtain written redistribution/storage permission for
the third-party model and create a private Release containing the
authorized, SHA-256 verified GLB**, provide these environment variables
in the *local DEV shell* before starting `node tools/dev.mjs`:

```powershell
$env:FA_KIT_MAKER_ASSET_RIGHTS_CONFIRMED = '1'
$env:FA_KIT_MAKER_GITHUB_REPO = 'OWNER/PRIVATE_ASSETS_REPO'
$env:FA_KIT_MAKER_GITHUB_ASSET_ID = 'RELEASE_ASSET_NUMERIC_ID'
$env:FA_KIT_MAKER_GITHUB_SHA256 = 'EXPECTED_64_CHARACTER_SHA256'
$env:FA_KIT_MAKER_GITHUB_TOKEN = 'YOUR_REPO_READ_ONLY_TOKEN'
node tools/dev.mjs
```

Use a fine-grained token limited to **Contents: read** for that private
repository; never commit the token, place it in browser JavaScript, or
use an unauthenticated public download of the proprietary model.
Release asset metadata endpoints accept `application/octet-stream`
and can redirect (302) or return the binary (200). Only the DEV
loopback `app.localhost:2000` host can invoke the route. The repository
README and GitHub PR do not carry the token or asset binary.

**Without a confirmed license or GitHub source, the endpoint returns
424** with a minimal machine-readable reason, and Kit Maker explains
what is missing instead of presenting a misleading unexplained 404.
The CC0 rig stays loaded but hidden, and the original costume
cannot appear until an authorized source exists.

Validation should include owner-local real GLB loading and isolated
private token checks. No merge, deployment, production publish, remote
database change or third-party asset redistribution.

## KM-35 — restore the original owner-owned GLB without the GitHub Release (2026-11-10)

**Repeated owner QA:** Kit Maker displays no garment after the previous
KM-33/KM-34 changes. The original 404 now becomes 424 when no separate
GitHub Release, rights confirmation and private token are configured.
Neither GitHub code changes nor KM-34 can supply a GLB that is absent
from both the public repo and the private release. Blank preview was
not a crash of the 3D shaders; it was a missing source binary.

**KM-35 recovery path:** The DEV-only 3D stage now shows a distinct
"3D kit source unavailable" panel with a keyboard-accessible button
"Select local GLB". The owner chooses their ALREADY EXTRACTED, verified
Alberto Sena `alberto-sena-outfit.glb` **once from their own device**.
The browser validates the standalone glTF v2 header and one of the
**three GitHub-versioned, recognized SHA-256 source revisions** before
writing it to origin-scoped IndexedDB. The save is transaction-committed
before refreshing. Subsequent page loads first request the existing
localhost asset route and, on 424/404, read the private browser cache
instead of showing a blank viewport. It uses the **unchanged** GLTFLoader,
fit, monochrome, sewn trim and stripes pipeline: no procedural fake
garment, no lossy conversion or copying of the artist's GLB into Git.

Browser storage stays on the user's machine and may be lost when they
clear site data or use private browsing. If disabled, the import shows
a clear error; a currently configured, authorized GitHub Release
still works automatically and takes precedence. Wrong/unsupported
source hashes are rejected before browser caching; a corrupt older
cache is cleared and re-import is offered. No binary, texture,
SHA token, browser file name, or authentication secret is sent to
GitHub or any remote service through this recovery path.

**Owner instructions:** Sync PR #454, open
`http://app.localhost:2000/dev/kit-maker`, click
"Select local GLB" in the 3D preview and select their original
extracted `.glb`. Do not select the source Blender `.blend` or
the `.zip` container: first extract the original standalone
`kit-maker/local-assets/alberto-sena-outfit.glb` from their earlier
local package. After import, simply revisit Kit Maker; no repeated
manual copy or selection is required on that browser profile.

This does **not** remove the upstream license restriction, create
a GitHub asset, imply the private license has been verified, or make
the original third-party model universally available to other users.
Full owner Chrome/WebGL visual QA remains open; PR remains Draft/HOLD.

## KM-36 — same front/back stripe start on original upper-shoulder geometry (2026-11-11)

**Owner QA:** After recovering the original Alberto Sena GLB, the
front and rear vertical stripes still start at different locations.

**Cause identified in source:** KM-32 only shared one origin after a
successful front↔back **open-edge vertex/segment match**. The actual
author garment can split the upper torso into materially separate
mesh primitives that do not export coincident open-edge endpoints.
In this case the previous algorithm could silently use separately
centred UV charts. Its `aligned` status could also refer only to a
torso↔sleeve match, not front↔back shoulder start verification.

**Repair:** KM-36 independently measures each original *upper-torso*
front/back source mesh's uppermost boundary samples. It rejects
vertical/inclined SIDE seams, and derives one shared
**collar-side radial (absolute-X) start** from the real source
geometry on both chest/back panels. Within the upper 10cm shoulder
region it enforces the same physical-metre stripe coordinate on both
meshes; lower down it smoothly blends into the author's genuine
flat-pattern UV metre field. Existing **verified** original shoulder
stitches still have priority for connecting sleeves AFTER the torso;
no sleeve correspondence is invented if a sleeve is detached.
This can slightly alter projected stripe width very close to the
shoulder; the rest of the original cloth UV pattern is preserved.
Neither original geometry nor source UVs are edited. Original
1–15cm widths, collars, cuff/waist trims, palette and shoe/material
logic are unchanged.

If a front/back mesh pairing is not topologically verified but
upper-shoulder geometry exists, diagnostics show
`torsoShoulderStart.status="shared-physical-upper-start"`, with
`report.status="torso-anchored"` if no other seams match. Both statuses
now render the dedicated sewn stripe attribute; "aligned" alone is
not mistaken for a verified front/back physical stitch. If suitable
upper geometry is absent the old source UVs remain, and a
`no-common-shoulder-start` report is emitted.

Targeted regression tests include physically separated front/back
primitives, a mirrored UV pattern, front/back start at **1cm width**,
fail-closed detached sleeves, original previous valid seam models,
and a direct `applyKitDesign` first-Solid-to-Stripe shader-attribute
integration test. **User's private GLB was not attached** to the
conversation, so its actual pixel-alignment is pending manual Chrome
QA. Further adjustments must use real model evidence rather than
calling synthetic checks a visual approval. PR #454 Draft/HOLD;
no merge/deploy/database operations or third-party redistribution.

## KM-37 — straight torso stripes; sleeves independent from torso (2026-11-11)

Owner accepted KM-36's shared front/back shoulder start but reported
that stripes **deviate/bend along the torso**. The owner explicitly
requested that the left/right sleeves have stripe patterns **independent
of the torso**.

**Cause:** KM-36's per-vertex stripe field interpolated between the
artist's two differently oriented UV sewing islands and the
shoulder-side physical X coordinate across a 10cm height band. A
vertical stripe therefore changed horizontal position as it went
down the chest, even with identical front/back shoulder phase.
Previous KM-31/32 logic also attempted to extend body stripe phase
to sleeve UVs.

**Fix:** The front and back torso mesh primitives (9/10/42/43)
now use **one single, Y-independent, source-geometry X coordinate**
for the **whole torso**, with the same collar-side start radius
detected from genuine upper source geometry. Every vertex at the
same physical |X| has the same stripe phase regardless of Y, UV atlas
rotation, front/back mesh, or sculpted 3D chest/back surface.
**No interpolated shoulder warp** and no change of direction between
upper chest and waist. The original artist positions/UVs are read
but not mutated; one additional shader scalar attribute is attached
to torso meshes only. The width continues to be selected from 1 to
15cm, in 0.5cm increments. Note: a full X-projection preserves visual
verticality and front/back phase but can make physical fabric width
appear compressed around strongly curved flanks; this is an accepted
tradeoff for straight vertical torso stripes, not an assertion of
constant cloth-space width on all curvature.

**Sleeve independence:** Both sleeve source primitives 38/39 (right)
and 62/63 (left) retain their own original sewing-pattern UV U as
the stripe axis, plus their own existing UV-metre scale/origin. They
do **not** inherit the torso's X start, phase, sewn scalar attribute,
or source-edge correspondence; sleeve colours and width are still
controlled by the shared Jersey controls. The sleeve stripe pattern
is therefore intentionally allowed to differ at the torso-to-arm
seam. Shorts, socks, sleeve cuffs, waist hem, collar, trims, palette,
private GLB ownership and the existing Solid-first-load behavior
are unchanged.

**Diagnostics:** `outfit.userData.km37StripeReport` reports
`torso-straight`, `constant-source-world-x`,
`noVerticalBlend: true`, and
`sleeves.mode: independent-source-uv`. The separate source geometry
origin is a shared *physical phase reference*, not a claim that
original front/back material primitives are a welded physical seam.
No per-sleeve "connected" status is reported.

**Focused tests:** Torso stripes straight across all rows and front/
back pattern islands (both left/right), 1cm/1.5cm/3cm/7.5cm/15cm,
all four actual torso primitives, UV warping, nonindexed triangles,
world transforms and missing shoulder fail-closed. Both sleeves
retain their own shader variant and independent original UVs even
when their geometry coincides with the torso. The design's shader
is directly tested after Solid→Vertical stripes and slider updates.
Full Node/browser visual QA with the owner's local third-party GLB
is still required before approval. PR #454 remains Draft/HOLD;
no merge, deployment, remote DB or upload of proprietary assets.
