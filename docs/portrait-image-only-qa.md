# Football Architect — STEP 2, ONLY AFTER SUCCESSFUL IMAGE CREATION

**Do not include this text in the first image-generation request.** Copy/paste this as a **second message in the SAME individual player's chat only after an actual new portrait was rendered**. For a failed generation, there is no technical or visual candidate QA; report the tool error and stop without demanding a reference image.

## Owner-approved V4.1 visual-QA tolerance (2026-11-17)

This changes **acceptance judgment only**, not identity creation, the immutable V4.1
fingerprint, its original facial descriptors, physique rules, source image prompts,
or the requirements for real-pixel technical QA. The goal is a credible,
distinguishable footballer consistent with the written identity, **not perfect
visual reproduction of every adjective**. Photographic rendering, camera,
lighting and natural human variability create uncertainty. Do not reject an
otherwise credible image merely because a subtle detail is not fully observable.

- **PASS (including PASS CON NOTA / PASS_WITH_NOTE):** the overall identity is
  recognisably consistent with the frozen written description, anatomy,
  apparent age, plain white jersey and verified technical gates; small hair-top
  volume/density/styling differences, slightly stronger brows, marginal jaw or
  facial asymmetry variation, and lighting-driven skin/hair/eye colour shifts
  may be recorded as **non-blocking notes**. Do not require a precisely
  observable widow's peak, crown thinning, slight nose bridge curvature,
  tiny asymmetry or scar when the frontal view cannot prove it. Preserve
  notes for later owner review.
- **FAIL:** clearly contradictory *major* frozen identity traits (e.g.,
  substantially different skin-tone category, black hair rendered blond,
  clearly straight hair rendered tight ringlets, close-cropped hair rendered
  genuinely long, clean-shaven rendered a full beard, a fundamentally
  different face shape), wrong physique class, a different/duplicated player,
  missing or damaged anatomy, branded/wrong shirt or composition,
  fake/opaque alpha, invalid geometry, visible persistent matte halo, or
  missing required transparent-file properties. A discrepancy must be
  **clearly visible and material**, not merely a subjective interpretation
  of borderline volume or a hue under studio lighting.
- **INCOMPLETE / NOT VERIFIED:** no actual candidate or an essential visual/
  pixel artifact cannot be inspected. Do not convert unknown to PASS.
- Technical gates stay evidence-based: real source vertical 3:4 PNG RGBA alpha;
  real decoded transparent WebP 320×362 when available; significant top alpha
  margin 3–8 px (0–12 only after hair-intact review), side clearance >=20 px,
  centering, clean usable silhouette. Invisible low-alpha RGB residue alone
  is a note, not a visible halo FAIL. Do not fabricate missing WebP/PNG files,
  dimensions, SHA-256 or edge readings.

For an **existing FAIL candidate**, review the *same exact image* again under
the updated threshold. Record the player ID, original ImageGen ID and/or
source SHA-256, its earlier QA issue comment, and the new evidence-based
result in issue #646 as a **new re-QA comment** with a link to the old outcome.
Do not erase the earlier outcome or automatically classify a FAIL as PASS
without viewing its actual pixels. Multiple candidates for the same ID
are separate; only a concretely identified one can be accepted. No image
generation during re-QA. No D1 writes, Production, asset upload, status or
asset_key changes, merge or deployment.

## Follow-up QA message (copy only after a successful image)

Do not generate any additional portrait yet. We have exactly one original candidate image in this chat. For this player's immutable V4.1 portrait, inspect the actual candidate and run QA **using the owner-approved 2026-11-17 visual tolerance above**. Use the connected GitHub plugin to read PR #648 and record an outcome in issue #646 if permitted, and Cloudflare for read-only DEV D1 (football-architect-dev) verification of this player's original frozen Strength/Speed/Agility when necessary. Do not access Production or write D1. The player ID, frozen V4.1 fingerprint and body class are documented in the canonical prompt index.

Visually assess the approximate age appearance cue (young male 21–25), broadly faithful written facial identity and hair/complexion/physique, realistic natural proportions, plain regular-fit white jersey, frontal head-to-hips pose and anatomy. Treat minor visual variability as nonblocking; use FAIL only for a clearly material conflict described in the policy. Verify actual accessible PNG bytes, native vertical 3:4, genuine RGBA alpha and visible fringe quality, otherwise mark technical QA NOT VERIFIED. If possible, derive/inspect a nonpublished 320x362 transparent WebP and measure significant top alpha margin 3–8 px (0–12 only after intact hair review), side clearance >=20 px and centering; otherwise derivative QA is NOT VERIFIED. Output only PASS, FAIL or INCOMPLETE, count PASS WITH NOTE as PASS, preserve minor notes, give real SHA-256 only if verified. No fictional pixel assertions. Do not publish, overwrite existing approved portraits, merge, deploy or modify any status/asset_key; stop after QA.

The legacy approved WebP can be consulted only as metadata, never as a reference for the frozen V4.1 facial identity. Technical QA PASS alone does not make a candidate visually suitable or owner-approved for publication.
