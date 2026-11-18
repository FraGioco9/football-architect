# Player portraits V4 — read-only technical QA (#646 / Step D)

This module verifies local candidate files. It does not generate, edit, export, upload, publish, approve or modify player portraits, snapshots, GitHub assets or D1.

## Requirements and commands

Requires Node.js 22+ and FFmpeg installed on PATH. Check in PowerShell: ffmpeg -version. The QA tool fails closed if the decoder is unavailable: WebP headers alone never produce a valid QA pass. No npm packages, network calls or API keys are required.

Run the complete two-file QA:

    node tools/portrait-v4-qa.mjs --png C:\path\to\candidate.png --webp C:\path\to\candidate.webp

One file can be tested separately, but the combined report will be INCOMPLETE rather than approved.

The older V3-compatible structural preflight is still available:

    node tools/portrait-png-preflight.mjs C:\path\to\candidate.png

All outputs are JSON on stdout with original source/derivative SHA-256 digests. No files are created or changed. Exit code: 0 on complete technical PASS or PASS_WITH_NOTE, 1 on FAIL/INCOMPLETE/unreadable input, 2 on invalid CLI arguments.

## Fixed measurements (final 320 × 362 WebP)

The alpha silhouette begins on the first row containing at least 3 pixels whose alpha is at least 64/255. This ignores one-off antialias fragments. Geometry is measured on the final WebP pixel data decoded by FFmpeg, never by guessing from the file header or applying WebP-pixel thresholds to the 3:4 source PNG.

- Top margin: 3–8 px PASS; 0–2 or 9–12 px PASS_WITH_NOTE, requiring visual confirmation of complete hair; >12 px FAIL. Cut hair is always a visual FAIL, regardless of the automated margin.
- Subject bounding-box horizontal offset: within ±8 px PASS; >8 to 10 px NOTE; >10 px FAIL. The horizontal frame center is x=159.5.
- Transparent left/right clearance: at least 20 px PASS; 16–19 px NOTE; less than 16 px FAIL; contact with the left or right image border is an especially important FAIL/re-generation candidate.
- Final derivative: exactly 320 × 362 px; anything else FAIL.
- Source PNG: complete, valid 8-bit noninterlaced RGBA, 3:4, genuine transparent corners and sufficient visible alpha subject. Not an RGB checkerboard.
- Both files: at least 4% pixels with alpha exactly 0; all four corners entirely transparent; significant alpha foreground at least 8% of the canvas. Opaque/pseudo-transparent images FAIL.
- Chromatic fringe: a conservative strongly saturated semi-transparent edge heuristic emits a NOTE when suspicious. It cannot reliably distinguish unusual natural skin/hair hues from a colored fringe and is not a standalone proof of contamination. Inspect edges on contrasting backgrounds.

Previously approved composition references retain their individually recorded QA measurements outside this general contract. Head/face scale still requires visual verification; hairstyle-dependent silhouette dimensions are not sufficient to measure anatomical face scale.

## QA verdicts and recommended actions

PASS: no blocking technical finding; manual visual QA and explicit owner approval still required.

PASS_WITH_NOTE: deviation or suspicious edge signal requires recorded human review. It is not automatic acceptance or permission to publish.

FAIL: correction or regeneration required. Recommended finding action is PIXEL_REPAIR for identity-preserving placement, crop and alpha fixes, REGENERATE for undecodable/opaque/missing-anatomy candidates, and VISUAL_REVIEW for ambiguous issues. After repairing pixels, rerun technical QA. After changing the individual, rerun visual identity QA.

INCOMPLETE: one of the two required image files is absent; complete technical verification has not occurred.

Every finding includes code, level, action and detail. The report always has ownerApprovalRequired=true and approved=false. A file's PNG/WebP format, real alpha or numerical geometry does NOT establish that the represented player matches the immutable identity.

## Mandatory manual QA

A reviewer must separately check: only one individual; correct immutable facial identity; plausible natural human imperfections and an ordinary adult male (never age bands); body shape faithful to V4 stats; non-model appearance; pure-white regular-fit shirt; natural fabric drape; complete hair/head, shoulders, arms and waist down to hips; face scale and centering; clean antialiased hair/jersey edges; and differences from other players to avoid reused/generic faces.

Record PASS, PASS with note or FAIL against the immutable V4 snapshot. The owner approves each portrait separately. Never edit the snapshot to force a pass.

## Developer tests (focused)

    node --test tests/player-portrait-png-preflight.test.mjs tests/player-portrait-v4-qa.test.mjs tests/player-portrait-core.test.mjs tests/player-portrait-v4.test.mjs tests/player-portrait-chatgpt.test.mjs

Unit tests cover: exact top-margin and alignment boundaries, alpha and empty/opaque backgrounds, chromatic warning vs blocking QA, lossless PNG unfilter, WebP container alpha/dimensions/animation, WebP decoder failures, SHA-256 evidence and V3/V4 compatibility. An injected pixel decoder in specific tests deliberately simulates WebP pixels without external services; actual CLI execution always uses FFmpeg to decode real WebP bytes and fails closed if decoding fails.

## Preservation and release boundary

This technical QA tool is read-only. Its output alone never authorises image approval, database writes, merge or deployment; obtain explicit owner approval and follow the generic portrait workflow.
