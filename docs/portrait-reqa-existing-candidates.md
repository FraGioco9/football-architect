# Football Architect — re-QA a previously generated V4.1 FAIL (no generation)

**Send this message only in the individual player's original image chat when
the actual candidate image is available for inspection.** The QA issue history
may include multiple distinct candidates for the same player; do not silently
switch between their PNGs. If the original file is inaccessible, ask for the
exact candidate PNG; do not claim to have re-examined its pixels. This task
must **not generate or edit any images**.

## Copyable re-QA prompt

```text
FOOTBALL ARCHITECT — V4.1 EXISTING-CANDIDATE RE-QA

Do NOT generate, edit or retry any portrait. Reassess the ACTUAL previously
generated original candidate image available in THIS chat for the same player.
Read the canonical face/physique and immutable fingerprint at the current
verified HEAD of GitHub PR #648, docs/portrait-image-prompts-all.md, plus
the OWNER-APPROVED 2026-11-17 realistic tolerance policy in
docs/portrait-image-only-qa.md. Read the original QA issue #646 outcome(s)
to identify this exact candidate by ImageGen generation ID and/or original
source PNG SHA-256. Do not conflate candidates.

New judgment policy:
- PASS (including PASS WITH NOTE) when the overall fictional footballer's
  appearance is plausibly faithful to the frozen identity, with correct
  physique/pose/jersey/age and real technical transparency/framing.
  Minor differences in hair volume/density/arrangement, eyebrow intensity,
  subtle jaw/face/asymmetry, facial marks or studio-lighting-dependent
  complexion and iris nuance are NOT standalone FAIL reasons. Record notes.
- FAIL only for CLEAR, MATERIAL contradictions to major frozen facial
  traits (e.g. dramatically wrong skin-tone category; different hair colour,
  hair texture or hair-length class; radically different face, beard or
  physique), wrong person, anatomy/composition faults or failed real
  technical PNG/WebP requirements. Borderline visual impressions are
  nonblocking, not grounds for endless regeneration.
- INCOMPLETE if the original actual image or required evidence cannot be
  inspected. Do not reclassify using GitHub report text alone.

Inspect the ACTUAL original PNG and the actual non-published 320x362
transparent WebP when accessible. Confirm decoded 3:4 PNG RGBA transparency,
significant top alpha margin 3-8 px (0-12 after intact-hair review), side
clearance >=20 px, centering, and no materially visible persistent chromatic
halos. If files/bytes are inaccessible mark those checks NOT VERIFIED and
do not invent SHA-256, alpha margins or derivative paths.

Output the player ID/name, frozen fingerprint and body class, exactly which
original candidate was re-reviewed (generation ID or SHA-256), old QA
comment URL, the specific new visual findings, technical evidence available,
and FINAL PASS / FAIL / INCOMPLETE. Count PASS CON NOTA as PASS.
If permitted, append a new transparent re-QA comment to GitHub issue #646
linking the prior comment, with policy-version date, without rewriting old
history or automatically approving a different candidate.

NO image generation, no file publication, no approved-V3 asset replacement,
no DEV D1 writes, no Production access, no status/asset_key updates, no
merges or deployments. A re-QA PASS is local candidate acceptance only;
owner publication authorisation remains separate.
```

The new 2026-11-17 threshold changes **QA evaluation**, not the frozen
canonical prompt, V4.1 fingerprint or original image generator. Do not
retroactively call prior FAIL images PASS without inspecting the actual image.
