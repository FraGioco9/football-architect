# Football Architect — One-ID direct portrait generation and QA (#646)

**Edit only the numeric `PLAYER_ID` inside the prompt below.** The selected workflow is **one chat, one user message**: read the versioned V4.1 identity using GitHub (Cloudflare DEV D1 only when needed), call the native original text-to-image engine once, and automatically attempt QA after a real candidate exists. No second prompt or separate chat is required.

**Important limitation:** this orchestrates generation but **does not guarantee** that an original text-to-image operation is available. Earlier combined prompts encountered missing-edit-target errors. If the generator still fails or demands an image input, return `GENERATION_UNAVAILABLE / NO CANDIDATE` without requesting an upload or fabricating image QA.

The 23 frozen image-only identities in `docs/portrait-image-prompts-all.md` are reused exactly. Other IDs require verified frozen initial physical attributes and the real version-pinned V4.1 exporter; otherwise fail closed. Appearance is young male, approximately **21–25** years old. No source photos, Production, D1 writes, image publication, merges or deployments.

## Prompt universale — copia tutto, cambia soltanto PLAYER_ID

```text
# FOOTBALL ARCHITECT — V4.1 ONE-ID PORTRAIT: LOOK UP → GENERATE → QA

PLAYER_ID = 44

[$github](app://connector_76869538009648d5b282a4bb21c3d157)
[$cloudflare](app://asdk_app_6abc2a9552748191b465859a06e90da3)

Change ONLY the numeric PLAYER_ID above. In THIS SAME CHAT, automatically (1) retrieve the frozen identity from repository/DEV, (2) immediately generate ONE ORIGINAL portrait with ChatGPT ImageGen, then (3) perform the possible candidate QA and report the outcome. Do not ask me to paste another prompt, open a second chat, upload a reference photograph, or authorize an intermediate step. Do not stop after preparing the prompt.

A. CANONICAL DATA — BEFORE GENERATION
- Use the connected GitHub plugin on repository FraGioco9/football-architect, PR #648, branch feat/646-player-portrait-v4-core. Pin a consistent PR HEAD; the unmerged V4.1 files may not yet be in main.
- First inspect docs/portrait-image-prompts-all.md for a heading with the EXACT integer PLAYER_ID. If found, read the player name, immutable V4.1 fingerprint and physique class from its heading; use that ID's COMPLETE image-only fenced prompt verbatim. NEVER alter facial traits or re-derive its fingerprint. Cloudflare verification of original initial attributes is optional for this already-frozen image prompt; mark unavailable checks NOT VERIFIED.
- If the ID is not in the prepared 23-player index, use the connected Cloudflare plugin ONLY for read-only DEV D1 database football-architect-dev to locate the player and verify ORIGINAL FROZEN INITIAL strength, speed, agility and stamina against a committed original generation record or auditable frozen snapshot. Do not assume current/evolving player attributes are the initial values. Read backend/src/player-portrait-diversity-v41.mjs and tools/export-player-image-prompts.mjs from the SAME PR HEAD. Execute its exact versioned createImageOnlyPortraitPrompt() with verified player ID, name, nationalities and initial stats. Use only the returned visual content/fingerprint/body class. Do not simulate deterministic identity generation in prose.
- If no canonical image prompt can be recovered or generated faithfully, report CANONICAL_PROFILE_NOT_VERIFIED with the missing source and STOP without using ImageGen.
- Never use a legacy approved WebP as an ImageGen input or face/pose reference. GitHub and Cloudflare are DATA connectors, not rendering engines. Never access Production or write D1.

B. GENERATE IMMEDIATELY — IN THIS CHAT
- As soon as the complete canonical image-only text is available, invoke ChatGPT's ORIGINAL TEXT-TO-IMAGE generator EXACTLY ONCE to create a NEW image from that visual description. Do not merely output the prompt for me to copy.
- Give the image engine ONLY the recovered image-only visual prompt, not this orchestration text, player ID/name, GitHub/Cloudflare links, QA instructions, previously approved files, image IDs, masks or input photographs. This is NOT an edit, remix, restoration or image-to-image request.
- Keep the versioned presentation cue: one fictional YOUNG MALE footballer, approximately 21–25 years old in apparent age (not gameplay age), without changing the immutable V4.1 face or body class.
- Request a single original vertical 3:4 portrait with real transparent RGBA background, frontal media-day pose, all hair/head/arms through hips visible, plain white regular-fit jersey, no logos or captions.
- If no original text-to-image mode is available or the generator requests an existing image target, report GENERATION_UNAVAILABLE / NO CANDIDATE. Do not request a reference photo, switch to image editing, claim an image was created, or automatically retry.

C. AUTOMATIC QA — ONLY AFTER A REAL IMAGE IS RETURNED
- Inspect the actual newly rendered portrait visually: one person, precise canonical face/hair/complexion, plausible frozen physique, apparent age 21–25, natural unretouched features, pose, anatomy, plain white shirt, clean silhouette. Do not invent image observations.
- If the original PNG bytes are actually accessible, verify vertical 3:4 dimensions, genuine RGBA transparency and no painted checkerboard; otherwise record PNG technical QA as NOT VERIFIED.
- If you can create/inspect a 320×362 transparent WebP derivative, check decoded alpha, significant top margin 3–8 px (0–12 only after hair integrity review), side room ≥20 px, center and fringes. Otherwise mark derivative QA NOT VERIFIED; NEVER invent a WebP, SHA-256 or pixel measurements.
- Report PASS / PASS CON NOTA / FAIL only for checks actually evaluated; when QA evidence is incomplete, report INCOMPLETE. If permitted, record a traceable QA outcome in issue #646 with ID, immutable fingerprint and verified observations. Do not publish or automatically replace an existing asset.
- Do not generate a second candidate after a failed or incomplete QA without an explicit new request.

FINAL RESPONSE
Show the single generated image (if successful), then briefly report player ID/name, V4.1 fingerprint, frozen body class, GitHub source PR HEAD, DEV verification status, visual QA, PNG/WebP technical QA, any limitations and overall candidate status. If generation fails, state there is NO CANDIDATE and that image QA cannot be performed. Never claim publication approval, perform D1 writes, merge PRs, deploy or overwrite approved WebPs.
```

## QA and fallback

If the engine returns a candidate, the same chat performs all possible visual and decoded-pixel QA, and notes **NOT VERIFIED** for evidence it cannot access. When needed, use the original optional manual [follow-up QA specification](portrait-image-only-qa.md) for a deeper operator audit, but it is **not a required second message**. The earlier two-chat isolation workflow and 23 individual files remain available as a fallback if the combined prompt is misrouted to image-editing mode. Never substitute an image reference for text-only generation.
