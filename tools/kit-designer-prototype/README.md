# MANNEQUIN-180 — Football Architect neutral male anatomy (prototype)

Tracked by [issue #453](https://github.com/FraGioco9/football-architect/issues/453) and [Draft/HOLD PR #454](https://github.com/FraGioco9/football-architect/pull/454).

This is an **entirely rebuilt standalone anatomical viewer**, not an incremental edit to the previous procedural kit mannequin. The asset is an adult **male**, **exactly 1.800 metres tall**, standing with both arms lowered alongside the hips and slightly away from the legs. It is entirely **without clothing**, including jersey, shorts, socks and footwear. The surface is uniform neutral matte resin. Head and neck share the same continuous base anatomy.

## Run (Windows PowerShell, Node 22)

From the repository root:

```powershell
node --test tests/kit-designer-prototype.test.mjs
node tools/kit-designer-prototype/server.mjs
```

Then open http://127.0.0.1:2100/ in Chrome. Use Front / Back / Side / Reset, mouse drag, wheel or touch/pinch to inspect proportions. CDN connectivity is required for the pinned Three.js JavaScript runtime; the anatomical mesh itself is **bundled locally**.

The server binds only to 127.0.0.1:2100. No public routing, sidebar, world API, player data, credentials, database, club kit or deployment changes.

## New architecture

- `mannequin-180.obj` — **new source-derived, garment-free single anatomical surface**, in exact real-world **metres** (Y from 0.000000 to 1.800000), with 13,380 retained source vertices and 13,378 original body quads. The original neck and head remain part of the same source body; no separate head shell, rings or shoulder cylinders.
- `viewer.mjs` — isolated renderer, camera presets, neutral PBR resin, studio lighting, source mesh smoothing and explicit bounding-box validation.
- `index.html` — anatomy-only screen, no kit editor, export, colors, cloth or shorts.
- `server.mjs` — loopback-only static Node HTTP server with exact file whitelist, restricted methods, CSP and disabled caching.
- `tests/kit-designer-prototype.test.mjs` — source geometry, scale, arm posture, head/neck anatomy, UI/DOM, JS syntax, HTTP and Host validation.

The old `base-body.obj`, `mannequin.mjs`, `mannequin-fit.mjs` and `mannequin-pose.mjs` are intentionally **removed**, not kept as a second overlapping viewer.

## Anatomical mesh and reproducibility

**Official upstream:** [MakeHuman Community hm08 base.obj](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj). The original base is explicitly marked **CC0**. We use only its genuine `body` group and do not import proxy groups (eyes, teeth, hair, genital helper, clothes, etc.). Original MakeHuman asset licensing is documented in [LICENSE.ASSETS.md](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md).

**Adult male morphology:** the official CC0 MakeHuman `african-male-young.target`, `asian-male-young.target` and `caucasian-male-young.target` macrodetails are averaged at equal weights. This is a **neutral composite anatomical source**, not a representation of any individual. Color and facial identity are not inferred.

**Rebuild operations, deterministic in the authored asset:** apply target displacements to the official hm08 base; preserve the original body topology; rotate the mesh shoulder/arm vertices toward a relaxed lowered-arm stance (symmetric axes with a soft shoulder transition); pull the hands slightly toward the hips; smooth the front facial contours without removing the anatomically joined neck or creating a segmented separate cranium; normalize the final model's minimum and maximum Y to precisely **0.000 and 1.800 metres**; reindex all body faces; write a single OBJ in SI units.

For morphology and re-posing auditing, record inputs: original base 19,158 vertices; 13,378 body quads; original `body` group only; average of three male-young macrodetails with 19,150 displacement entries each; geometry normalized after the morph. Header metadata and this README preserve the provenance. No runtime downloads of the upstream body or any morph file.

## Acceptance checklist

1. Camera front: adult male silhouette at 180 cm, relaxed symmetrical arms down alongside thighs, neither extended forward nor wide A/T-pose.
2. Camera side: hands remain near the thighs, head balances naturally over the spine.
3. Camera back: no disconnected shoulder or neck seams and no arm intersections.
4. Head: matte neutral, smoothed front, physically connected to anatomical shoulders/neck; no extra head capsule.
5. Body is completely ungarmented, including shorts. No hidden kit editor control or clipping garment.
6. Camera controls, zoom, window resizing and mobile tap/drag work; no JavaScript console exceptions.
7. Loopback server/test suite succeeds on Windows Node 22; no deployment or remote data access.

**Visual limitation:** numerical/source tests establish the topology and measures but do not prove photorealistic appearance. The final sculpt/skin realism, mouth/eye smoothness and shoulder shading still need human visual review in Chrome and Safari. This prototype is not a fully rigged or photogrammetric model and should stay **Draft/HOLD** until owner acceptance.

## Focused anatomy QA — arms, neck, neutral face (2026-11-09)

The 180 cm male mesh was measured in front and side cross-sections. Both arms remain lowered and mirrored, with the hands beside the upper thighs. The arms were brought about 8 mm closer in the lower/forearm region; the measured hand-to-thigh clearance at 80–87 cm height is approximately 7 cm. The shoulders and chest retain their anatomical mesh, with no detached arm cylinders or visible garment.

The original front profile from chin through the mid-face had an unnaturally sudden jump in depth (roughly 9 cm at 150 cm height to 15 cm at 154 cm), followed by an almost flat vertical face plane. The CC0 head topology is retained, but the face-facing positions are resculpted to a gradual lower-neck/jaw transition, soft blank facial curvature and a rounded forehead. The face is still neutral and devoid of deliberately authored expression; this is not an individual likeness. The head/neck and body remain one closed quad mesh. New numerical tests protect head-side depth, front contour, shoulder/arm proximity and topological seam integrity.

**Still pending:** visually inspect frontal, profile and rear views in a real browser. The absence of strong geometric facial bumps in sampled sections does not prove that all residual eye/mouth topology or subtle shading artifacts have disappeared. A Blender sculpt/retopology pass may be necessary for photorealistic production quality.

## Arm reconstruction and featureless head — QA revision (2026-11-09)

**Rebuilt arms:** the right and left shoulder-to-fingertip geometry is now remapped with a bilateral, smooth joint/limb axis (shoulder, elbow, forearm, wrist and hand). The surface remains the original continuous CC0 anatomical mesh, not separate tubes or primitive meshes. Hands shift about 1.6–1.8 cm inward and up to 5.2 cm rearward relative to the earlier posed source to rest beside the thighs rather than in front of them. The shoulder blend is gradual and preserves human arm topology.

**Neutral head:** the entire face, including the projected eye/eyebrow/nose/mouth relief and the lateral ear contour, is geometrically relaxed toward a continuous cranial elliptical envelope while retaining the natural neck-to-jaw transition, one single closed head-and-body surface, source vertices/faces and exact 1.800 metre height. No facial detail meshes, drawings, expressions or textures are added. This is an intentionally smooth, anonymous **featureless** display head, not a portrait.

**Geometry audits:** deterministic point displacement was checked for orientation flips and collapsed triangles (0 inverted and 0 near-flat facets in the full mesh in the preflight candidate), left/right joint-centre symmetry, measured hand-to-thigh lateral gap of about 5.4 cm, smooth positive-Z head contour and a closed quad manifold. Node tests now cover the arm's six cross-sections and the featureless cranial envelope. Numerical geometry QA does not replace final visual QA in a real browser.

## ARM-04 — Full anatomical arm rebuild after real side-view QA (2026-11-09)

The supplied side-view screenshot showed an unnatural bulge and twisted profile
between the shoulder, elbow, forearm and wrist. Previous arm operations
applied cumulative world-height vertex shifts, distorting original volumes.

This revision discards all previous arm shifts and restores both arms from the
authentic unposed MakeHuman hm08 CC0 adult male body (three equally weighted
young-male macrodetail targets). All preserved original quads, fingers and
arm muscle profiles are repositioned by two genuine articulated pivots:

- Shoulder centre: (±0.255, 1.435, 0.028) m.
- Source elbow: (±0.355, 1.225, 0.020) m;
  relaxed elbow: (±0.293, 1.200, 0.035) m.
- Source distal-arm reference: (±0.560, 1.000, 0.320) m;
  relaxed reference: (±0.295, 0.820, 0.075) m.

Upper-arm and forearm quaternions preserve original anatomical volumes;
only small smooth skin-weight transitions occur at the shoulder and elbow.
The result is a more natural arm alongside the torso rather than a highly
warped elbow with a rigid straightened forearm. The adult head and neck
stay exactly as previously modeled; the body remains ungarmented at 180 cm.

Regressions now cover six anatomical cross sections per side, elbow and
forearm thickness, smooth side-view centreline, left/right symmetry,
faceless head, closed quad topology and absolute metre-based height.
Geometric validation found no inverted arm triangles and no heavily
compressed/expanded triangles against the clean CC0 source.

Still Draft/HOLD: final front/side/back browser QA is required to judge
rendered anatomy. No merge or deployment without owner approval.

## FOREARM-01 — Rebuild of both forearm silhouettes (2026-11-09)

User side-view QA isolated the **forearms** as the next area to repair after
the upper arms were accepted. The original continuous CC0 anatomical mesh
and two-bone elbow positioning are retained. Only forearm-region coordinates
are resculpted **bilaterally**, using smooth longitudinal cross-sectional
envelopes rather than a uniform tube or new disconnected geometry.

- Slightly enlarge the muscle belly around Y=1.05–1.12 m to give a believable
  brachioradialis/flexor taper.
- Narrow the cubital region around Y=1.15–1.18 m, soften both lateral and
  front-to-back elbow outlines, and blend back into the unchanged upper arm.
- Fade edits out near the wrist without moving the hand, fingers, shoulders,
  head, trunk or legs.
- Preserve original quad indices and mesh connectivity, exact 180 cm height,
  symmetry and neutral ungarmented surface.

**Geometry preflight (side-specific outline, metres):** wrist at Y=.95 has
~4.6 cm width; muscular forearm at Y=1.09 has ~9.4 cm width;
elbow at Y=1.17 is ~9.1 cm wide/~9.6 cm deep. In the previous geometry,
the elbow was ~9.7 cm wide/~10.7 cm deep and the muscle belly was ~8.6 cm
wide. This change therefore moves maximum volume away from the elbow.
A total of 542 source vertices are adjusted, by at most ~7.1 mm.
No original face connectivity changes; relative triangle-area range
0.846–1.101, no reversed triangles in the audited candidate.

The new FOREARM-01 regression checks closed anatomical cross-sections,
bilateral symmetry, wrist-to-muscle taper and absence of sharp profile jumps.
**Visual approval remains open:** inspect front/back/side in the local Three.js
viewer for any unexpected wrist twist, mesh shading or elbow silhouette.
PR #454 stays **Draft/HOLD**; no merge, deploy or database operations.

## ARM-05 — full elbow and forearm silhouette rebuild after second visual QA (2026-11-09)

**Supersedes FOREARM-01**, which enlarged the forearm but did not resolve the
owner-reported continuous sleeve-like appearance in side view. This revision
starts from the prior clean-source articulated ARM-04 mesh, **not** the
incrementally altered FOREARM-01 coordinates.

- The elbow is now its own recognizably narrower transition, rather than a
  shoulder-to-wrist tube. At Y=1.17 m the lateral diameter is approximately
  7.3 cm (previously 9.7 cm) and the front/back depth approximately 7.5 cm
  (previously 10.7 cm).
- The muscular forearm section 6 cm below the elbow is about 8.1 cm wide,
  deliberately wider than the elbow; upper arm above it widens naturally again.
- The elbow centreline moves rearward around 1.5 cm, removing the bulging
  anterior elbow silhouette in side view. The changes blend away through the
  distal forearm at Y=0.94 m and upper arm above Y=1.27 m.
- Hands and fingers, shoulders, head/neck, torso and legs retain their original
  ARM-04 vertex coordinates. The mesh stays a single source-derived continuous
  quad surface; no detached geometric primitives or clothes.
- A cross-sectional Hermite curve guides local radius and gentle centreline
  adjustments without flattening the authentic original radial surface detail.

Preflight before commit: 584 changed vertices, maximum shift ~3.33 cm;
no flipped or degenerate triangles, original-to-new triangle area ratio
0.468–1.027, bilateral silhouette symmetry within 1 mm, uniform fade at the
wrist and upper arm. The ARM-05 regression replaces FOREARM-01 and checks
elbow-vs-forearm proportions, wrist taper, bilateral mirroring and profile
continuity in sampled edge-intersection rings.

**Still unverified visually:** run the local viewer and inspect from Side,
Front and Back on a real browser; any remaining unnatural shoulder/hand pose
will require separate anatomical review. No merge, deploy or DB operations.


## ARM-06 — anatomically aligned bilateral forearms (2026-11-09)

Supersedes ARM-05 and FOREARM-01 after persistent side-profile QA concerns.
The true ARM-04 clean-source pose, rather than any of the later sculpted
meshes, is the base for the replacement. The arm surface remains a single
continuous MakeHuman CC0 quad mesh. Geometry is edited using **local
forearm cross-sectional frames** anchored to the original centreline, with
Hermite-smoothed changes to centreline, orthogonal radii and a modest
longitudinal axial twist (peak ~11 degrees near the muscular belly).
This is deliberately **not a uniform cylindrical scale by world height**.

Anatomical profile (approximate right-side X widths measured by intersecting
mesh edges, with the left side exactly mirrored): wrist Y=.96 m ~4.5 cm;
muscular belly Y=1.10–1.125 m ~8.6–8.7 cm; elbow Y=1.18 m ~7.8 cm;
upper arm Y=1.23 m ~9.0 cm. Side depth at the elbow is ~8.3 cm.
The elbow centreline sits posterior to the forearm, with a smooth turn toward
the forward-set hand. The taper fades fully by Y=.935 m at the wrist/hand and
by Y=1.255 m at the upper arm. The shoulders, hands, fingers, torso, neck,
head and legs are unchanged from ARM-04.

Geometry preflight: 572 displaced vertices (maximum 2.37 cm);
zero inverted or degenerate triangles; face area ratios 0.694–1.077
versus pristine ARM-04; no abrupt 1 cm-section profile jumps and no left/right
ring asymmetry. New focused ARM-06 regression replaces ARM-05 in the 11-test
Node suite; exact-height, continuous topology and ungarmented-mesh checks
remain in place.

**Not yet visually accepted:** evaluate rendered Side, Front and Back and
real Chrome/Safari shading; this numerical preflight cannot certify anatomy.
PR #454 stays Draft/HOLD; no merge, deployment or remote database changes.

## ARM-07 — local smoothing of angular forearm surfaces (2026-11-09)

Owner feedback isolates **surface angularity**, not the ARM-06 proportions.
The Three.js OBJ renderer already welds identical positions and recomputes
per-vertex smooth normals. ARM-07 therefore modifies the **source geometry**,
not the lighting, body material or upper-arm proportions.

Starting directly from ARM-06, the source quad topology is retained and
Taubin-style alternating Laplacian smoothing is applied in X/Z only for
forearm vertices in the shoulder-free region Y=.948–1.180 m and |X|>.258 m.
Five alternating (+0.52, -0.54) passes use a smooth falloff at the wrist
and elbow, avoiding a new crease where the smoothing region ends. The local
longitudinal muscle belly, forearm centerline, axial twist, arm symmetry and
neutral display material stay intact. No body subdivision or new geometry
groups are introduced; fingers, hands, upper arms, shoulders, head, torso
and legs stay unchanged, and all vertex Y values are identical.

**Numerical comparison with ARM-06:** 292 changed vertices;
maximum point displacement 5.42 mm;
one-ring mean X/Z Laplacian roughness 1.941 to
1.564 mm (reduction
19.4%).
Maximum sampled forearm width/depth deviation 3.74 mm,
no reversed or collapsed triangles and relative triangle-area range
0.832–1.177. Bilateral sampled sections
match within 0.0000 mm. Source mesh still has
13,380 vertices/13,378 quads at exactly 180 cm.

The new 12th Node regression checks target-zone roughness, retained wrist
and elbow proportions and bilateral silhouette symmetry; all existing
geometric, static viewer and HTTP regressions remain in place. These
measurements do **not** establish visual acceptance: verify Side (priority),
Front and Back in real Chrome/Safari before approving the model.

PR #454 remains Draft/HOLD. No merge, deployment, publishing or DB change.

## ARM-08 — correct forward-shifted forearms in side view (2026-11-09)

After ARM-07's smoothing, the owner observed that the forearm was too far
forward of the upper arm in the side view. The mesh confirmed a
2.95 cm anterior centreline gap between proximal
forearm at Y=1.10 m and lower upper arm at Y=1.23 m.

ARM-08 **preserves the rounded ARM-07 anatomy**. Left and right limb surfaces
are selected through connected quad topology below the shoulder. Each
forearm, wrist and hand is shifted rearward along Z by up to 2.5 cm, with
a smooth taper to zero by Y=1.28 m; the hands travel with their wrists
so there is no wrist break, and upper arms, shoulders, body/head/legs
and the original hand/finger shapes remain unchanged.

The centreline gap is now 1.15 cm.
Elbow-to-wrist sagittal centres differ
0.31 cm. Geometry audit:
3844 vertices repositioned, maximum displacement 2.5 cm;
cross-section width/depth change ≤0.184 mm,
mirrored sides, no inverted/collapsed triangles, triangle area ratios
0.947–1.034. ARM-07 surface roughness retained
(1.585 mm sampled proxy); topology 13,380 vertices /
13,378 quads, height 180 cm. A focused ARM-08 regression makes 13 Node tests.

Real Chrome/Safari visual QA Front/Side/Back is still pending and numbers
alone cannot certify natural appearance. PR #454 remains Draft/HOLD;
no merge, deploy or database changes.

## SetPose reference comparison — local-only workflow (2026-11-09)

Requested reference: https://setpose.com/s/0961e1ef . This URL is a **shared
SetPose scene**, not a downloadable 3D mesh. It could not be inspected as
binary mesh from this environment. The prototype therefore **does not claim
to contain or exactly replicate** that third-party model.

SetPose Pro+ documents export of a model as **GLB, glTF, or OBJ**; its terms
reserve rights in website-provided assets. Do not commit or redistribute
SetPose meshes without checking the applicable license/permission. The
existing locally authored MakeHuman CC0 asset remains the default.

For side-by-side evaluation, use the studio's new **Local GLB / OBJ**
selector. Export **Model**, not Scene, from SetPose, ideally as a single
self-contained .glb file (OBJ is also supported). The selected file is read
directly using browser File APIs, not posted to the local Node server.
The importer rejects invalid size, non-GLB/OBJ extensions and GLB references
to remote or external buffers/images. It enforces an upper bound of 40 MB,
meshes/vertices safeguards, applies the studio's neutral matte material,
normalizes the bounding-box height to 1.800 m, grounds and centers the
model, and supports Front/Back/Side plus restoring the bundled mannequin.
The server remains loopback-only and GET/HEAD-only; no file-storage route
was added. Embedded GLB images can use only local data/blob URLs through CSP.

**Caveats:** A preview is not an approved replacement: the exported file
may contain separate meshes, clothes, facial details, exaggerated features
or a pose differing from the agreed neutral standing silhouette. Height
normalization is geometric, not an anatomical age/gender assessment.
Inspect the reference visually and verify distribution rights before
deciding whether to adopt the geometry. A self-contained export must be
provided for permanent integration; nothing is copied to GitHub here.

Targeted Node tests cover format, size, embedded-resource safety, local-only
HTTP behavior, viewer wiring, syntax and geometry scaling code. No new
production route, backend, account, publishing, deploy or DB changes.
PR #454 remains Draft/HOLD, and no merge is permitted without approval.

## MANNEQUIN-02 — rigged CC0 male base, arms lowered (2026-11-09)

Preferred candidate: https://www.innerscene.com/tools/library/3d-parts/male-base-mesh-3d-person-rigged-a-pose-380e6d89 .
The publisher describes a CC0 179 cm male A-pose GLB with 163 skinned
bones (upper arms, lower arms, hands, fingers), approximately 109k triangles
and a 4.3 MB self-contained binary. The official download exists, but the
external binary was not retrievable in the GitHub editing environment.
**Therefore no copy of the Innerscene mesh has been committed, and it is
not yet the default built-in mannequin.**

Implementation: download that GLB from its official page and select it in
the existing local-only GLB/OBJ preview. The new rigged-arms.mjs identifies
MakeHuman default .L/.R and common Mixamo-style upperarm/lowerarm/wrist
chains, requiring both sides, ancestry consistency and skin weights.
It uses skeleton quaternions: first aim shoulder-to-elbow downward with a
slight lateral clearance, then elbow-to-wrist nearly vertically. The
correction is converted from world space into the parent bone's local
coordinates. Skinning naturally carries the anatomical mesh and fingers.
The original rig quaternions are preserved and can be restored using
Original A-pose; Lower arms reapplies the relaxed stance. Compatible GLBs
are auto-posed and normalized to exactly 180 cm with precise skinned bounds.
Incompatible files remain unposed, with an explicit message.

The existing neutral CC0 anatomical OBJ, old ARM-08 mesh, original camera
presets and Restore built-in control remain in place. The preview stays
browser-local with GET/HEAD-only loopback routing, no file uploads,
external resource requests, remote DB or publication. New focused
regressions check bone-chain discovery (including absent wrist/unsupported
skin), MakeHuman/Mixamo naming, target directions, UI controls, syntax
and server wiring. There are now 15 mannequin Node tests.

**Not yet completed:** retrieval of actual Innerscene GLB, real visual
inspection of arms/elbows/wrists/hands in Side/Front/Back, confirmation
of a featureless head and garment-free geometry, validation of facial
feature treatment, and a permanent checked-in, approved base replacement.
These are required before declaring MANNEQUIN-02 complete. PR #454 remains
Draft/HOLD, with no merge or deployment.

## MANNEQUIN-03 — approved 180 cm rigged GLB as default (2026-11-09)

User provided male-base-mesh-base_male.glb from Innerscene/MakeHuman CC0
(SHA256 86c7cdfa989924b45e2e5110c131a4a4e6251ceb4e71246be68e468f3a32ca86).
Its 163-bone rig and weighted anatomy are preserved. The four bilateral
upper/lower-arm rotations were calculated to place the wrists beside the
thighs, without vertex-slice deforming. A scale factor of
1.0082009620848544 gives exact 1.8 m height from original 1.7853583439 m.
The binary default mannequin-180.glb has SHA256
0ff043359e06da50ceb459b1fcffde62fdae8bb6197b0fc5fd70e0967486d502
and size 4,498,780 bytes.

The viewer loads GLB by default through GLTFLoader using the local HTTP
application/model route model/gltf-binary. The previous ARM-08 sculpted
mannequin-180.obj remains as a fallback and for historical regression checks.
Already-posed GLBs imported manually are not reposed a second time.
A focused regression verifies the exact binary, bones, and HTTP asset route.
A deterministic Python 3 generator verifies source/final hashes and
reconstructs the asset without third-party packages. Visual QA of
Front, Side, Back remains required. PR stays Draft/HOLD, no merge or deploy.
## MANNEQUIN-04 — relaxed arms with natural torso clearance (2026-11-09)

Owner QA requested that the skin-weighted default model's arms remain down,
but **rest slightly away from the torso**, rather than hanging tightly
against the hips. Starting from the exact, checksum-approved 163-bone
Innerscene/MakeHuman CC0 source, shoulder/upperarm direction is now
(±0.18, -1, 0.01), elbow/forearm direction (±0.10, -1, 0.03).
Bilateral wrists move from approximately |X|=0.246 m to |X|=0.279 m
in the final 180 cm model, increasing outward spacing by ~3.1 cm per wrist.
Front/back depth stays similar, with a subtle relaxed offset.

No mesh vertices, skin weights, fingerprints, face, leg topology, or
skeleton hierarchy were manually warped; only the four arm joint
quaternions and the pose provenance metadata differ. Height remains
exactly **1.8 m**. The pre-posed default GLB does not get auto-posed
again on loading. The local import tool uses the corresponding relaxed
vectors for unposed external GLBs.

New checksum-locked default GLB: 4,498,816 bytes, SHA-256
d242a684bb636bad4b183d5ab19996acdd2e9c049e0f94c8e133a3db8dbefaf3.
`build-default-mannequin.py` reproduces it deterministically from
the source GLB, verifying both source and output SHA-256. Updated the
existing exact-asset regression with the new bilateral pose and metadata;
16 mannequin Node tests total. Owner visual QA (Front/Side/Back) and
exact-head CI verification remain required; Draft/HOLD, no merge/deploy.

## KM-01 — integrated DEV Kit Maker page (stacked on Match Engine PR #455)

The standalone mannequin studio remains available at http://127.0.0.1:2100/,
but the canonical app now provides **Kit Maker** alongside **Match Engine**
under **Development** in the local app-host sidebar. Open
http://app.localhost:2000/dev/kit-maker after starting the shared DEV app:

```powershell
npm --prefix backend ci
npm --prefix match-engine ci
node tools/dev.mjs
```

The new page uses the exact canonical Football Architect sidebar, topbar,
theme choices, app typography and panels, mirroring the Match Engine DEV
laboratory. The same Three.js mannequin viewer and rigged 180 cm CC0 GLB
are reused, not copied into a second model. Local Front/Back/Side/Reset,
temporary GLB/OBJ import, rigged Lower arms / Original A-pose and restore
default remain available. No garment design or persistence is implied by
the initial Kit Maker foundation.

Kit Maker assets are served only through the `/__fa_kit_maker__/`
allowlist on the existing loopback DEV server and *only* the
`app.localhost:2000` host, never public, LAN or shared Preview.
The private page has noindex/no-store, restricted CSP and no write routes.
The exact new GLB remains as the default; ARM-08 OBJ stays as legacy
fallback for the separate prototype. CDN-hosted pinned Three.js
0.181.0 is used as in the existing mannequin preview; only the
Kit Maker route permits that HTTPS script origin in CSP.

PR #454 deliberately **targets Match Engine PR #455's branch** because
the Development shell, app DEV server and first-paint sidebar logic
originate there. A single Kit Maker commit builds on #455; no changes
are made to #455 itself. After #455 merges, PR #454 can be updated to
track main. Both PRs stay Draft/HOLD; no merge, deploy or DB writes.
Node lab security, canonical sidebar, publication guard, GLB HTTP
and mannequin regression tests should all pass at exact PR HEAD.
