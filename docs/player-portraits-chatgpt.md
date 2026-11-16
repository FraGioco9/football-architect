# PLAYER-PORTRAITS-05 — Generate player portraits **in ChatGPT** (manual handoff)

This document describes the **image-generation operator workflow**, not a new web API or a Cloudflare image service. **ChatGPT** renders the photos in the active conversation using its image-generation capability. Cloudflare DEV/Preview D1 supplies immutable identity inputs, and GitHub stores only the **version-pinned implementation**. The repository does **not** store an all-player prompt manifest or any generated photos awaiting approval.

## Read-only inputs and canonical authority

1. Use the connected Cloudflare account and select **only** D1 database `football-architect-dev` when that is the environment requested. Execute a read-only, ID-bound query:
   ```sql
   SELECT player_id, schema_version, prompt_version, snapshot_json, status, asset_key
   FROM player_portrait_profiles
   WHERE player_id IN (45, 47, 49, 124, 148)
   ORDER BY player_id;
   ```
   Check for exactly the requested IDs, each once. Never infer absent traits from current game stats, player names, or another player's photo. The approved #44/#98/#145 images are **not** generation references.
2. Validate each parsed `snapshot_json` with `renderPortraitPromptFromSnapshot(snapshot)` from `backend/src/player-portrait-core.mjs`. It rejects unsupported versions, invalid/mutated fingerprints and extra snapshot properties. You may instead use the already-authorized `GET /api/admin/players/portrait?playerId=N` endpoint where available. It returns canonical V3 text and must stay Admin-only.
3. To form the **ChatGPT execution prompt**, call `buildChatGptPortraitExecutionFromSnapshot(snapshot)` in `backend/src/player-portrait-chatgpt.mjs`. The returned `prompt` includes the entire canonical V3 prompt **verbatim**, plus ChatGPT-specific isolation/composition instructions. This module is pure: it never contacts an AI provider or a database. If you retrieved only the Admin endpoint text, prepend/append the same ChatGPT-specific safeguards without changing that text.
4. Get the player name separately from the authorized `generated_players` public display data **only for captions outside the image**. Names, IDs, positions, age and height are *not* image-model instructions.

## In-chat execution contract

- Call the **ChatGPT image-generation tool** directly, **separately once per player ID**. Do not call Cloudflare Workers AI, AI Gateway, Canva or a GitHub workflow for the image itself. Five IDs require five independent invocations/results, never a multi-person prompt, collage or sheet.
- Pass the **complete execution prompt** for exactly one player. The image-generation tool receives `transparent_background: true` as a **real tool setting** (not only a phrase in the prompt). An explicit count is unnecessary for a single image. The prompt requests a vertical **3:4** composition; do not assume the image tool exposes an exact aspect-ratio switch or that the resulting dimensions meet it.
- Every individual image: one adult male fictional footballer, exact frozen facial details, realistic subtle athletic physique, plain pure-white unbranded short-sleeved jersey, forward-facing and neutral, arms relaxed *beside* the body, **whole head to hips** with generous transparent margin. No text, ID, player name, labels, team crest, backdrop, checkerboard, collage or props **inside** image.
- Do not use a previous generated image, an approved unrelated player, an imagined ethnic stereotype or a fallback generic face as a visual reference. Never invent missing appearance traits or edit the immutable snapshot to force a good result.
- Present the candidate to the owner with **ID and name in ChatGPT's surrounding message only**, **not painted into the PNG**. Keep it `candidate / pending owner approval` until both technical and visual QA pass.

Suggested instruction to reuse in a new ChatGPT conversation:

> Generate the following Football Architect player portraits **directly in ChatGPT**, not with Cloudflare image APIs. Retrieve immutable `snapshot_json` for the requested player IDs from Cloudflare D1 `football-architect-dev`; verify each with GitHub's `renderPortraitPromptFromSnapshot` from `backend/src/player-portrait-core.mjs`; then use `buildChatGptPortraitExecutionFromSnapshot` in `backend/src/player-portrait-chatgpt.mjs`. Call the image-generation tool once per ID, with `transparent_background: true`, using the full execution prompt without paraphrasing. Produce separate 3:4 photographic head-to-hips white-shirt cutouts, never a collage or generated checkerboard. Identify each **outside** the photo. Do not approve, upload, replace existing assets or change the DB/repo. Inspect each file for true RGBA transparency and facial-trait fidelity; mark failures as rejected, not completed.

## Offline technical preflight and visual acceptance

The image tool is **not** guaranteed to honor aspect ratio, exact hair/eye/complexion details or genuine transparency. A checkerboard in a screenshot or image is not proof of alpha. Always inspect the **actual output bytes**, not a screenshot or thumbnail.

On Windows 11 PowerShell, after saving each individual candidate `PNG` locally:

```powershell
node .\tools\portrait-png-preflight.mjs "C:\path\to\portrait-45.png"
```

This read-only Node 22 script reports **PASS only if** the file is a complete, decodeable, noninterlaced 8-bit **RGBA PNG**, has a **3:4** image ratio, clearly contains opaque subject pixels plus meaningful **fully transparent** pixels, and has fully transparent corners. It fails closed on unsupported PNG formats, opacity-only checkerboards and incorrect ratio. It does **not** upload or rewrite the file.

Then perform **manual review** for every ID: exactly one individual, matching the frozen complexion, eyes, hair color/texture/style, facial hair, face shape, body archetype, plain white jersey, consistent head-to-hips crop and clean hair/shoulder edge without chromatic fringes. The tool cannot certify visual identity, absence of a painted checkerboard *inside* the silhouette, number of people, or owner approval. A candidate that fails *any* check must be rejected and independently regenerated using the **same immutable snapshot**, not repaired by rewriting the profile.

**Integration boundary:** the three existing approved player assets (#44, #98, #145), all D1 statuses/asset keys and repository files remain untouched until the owner explicitly approves each new portrait and separately authorizes integration. No automatic DB write, image-service cost, deploy, schema migration, new Admin UI or public prompt endpoint is needed for generating here in ChatGPT.

## Focused QA

```powershell
node --test .\tests\player-portrait-chatgpt.test.mjs .\tests\player-portrait-png-preflight.test.mjs
```

The new source/QA scripts run only on demand. Site/Backend/FULL CI must refer to the **exact PR head** before merging. A green technical test is **not** approval of any photo.

## V4 — independently versioned ChatGPT handoff (#646, Step C)

V3 remains untouched: continue to use `buildChatGptPortraitExecutionFromSnapshot()`
with `player-portraits-v2` / `player-portrait-v3` snapshots.

Only new `player-portraits-v3` / `player-portrait-v4` snapshots may use
`buildChatGptV4PortraitExecutionFromSnapshot()` from
`backend/src/player-portrait-chatgpt.mjs`. Both adapters reject the other
version and validate frozen identity before returning any image prompt.

V4 uses the entire canonical prompt **verbatim exactly once**, with V4-specific
guards surrounding (never rewriting) it. The execution contract is
`chatgpt-portrait-execution-v2`, `onePlayerPerInvocation:true`,
`renderer:'chatgpt-image-generation'`, `desiredAspectRatio:'3:4'`, and the
native `toolOptions:{transparent_background:true}` with no `n` image count.

**Owner rule:** every image request is for a fictional **adult male**.
Never add ages, age bands, or infer appearance from gameplay age. Keep
ordinary natural faces, conservative V4 body, regular-fit white shirt and
complete transparent head-to-hips crop. On the final 320×362 WebP derivative,
aim for a top alpha margin of 3–8 px; assess separately during pixel QA.

These modules do not call the image tool, modify D1, upload or publish assets.
Invoke ChatGPT image generation separately for each snapshot, then conduct
technical and visual QA plus owner approval before replacing any portrait.

Focused tests:
`node --test tests/player-portrait-core.test.mjs tests/player-portrait-v4.test.mjs tests/player-portrait-chatgpt.test.mjs`

## V4 Step D — technical QA of PNG + actual WebP pixels

After generating a candidate and converting it to a final WebP, run the
new read-only QA command (requires Node 22 and FFmpeg on PATH):

    node tools/portrait-v4-qa.mjs --png candidate.png --webp portrait.webp

The decoder checks the genuine WebP pixel alpha, not just RIFF metadata.
The combined report returns PASS, PASS_WITH_NOTE, FAIL, or INCOMPLETE,
measured geometry, findings, and original file SHA-256 digests.
Passing technical QA never means the facial identity or image is owner-approved.
The old V3 PNG preflight and the frozen V3 portraits remain unchanged.

See [V4 technical QA rules](player-portraits-v4-qa.md) for exact 3–8 px
top-margin targets, 0–12 px outer allowance, alpha threshold, centered
silhouette, side clearance, chromatic-fringe notes and manual acceptance.


## V4.1 diversity extension — opt-in, immutable and versioned (#646)

**Existing V4 and V3 identities are immutable.** The original `v4:0` facial seed,
existing frozen `player-portraits-v3` / `player-portrait-v4` snapshots and the
six owner-accepted pilot portraits remain bit-for-bit reproducible. They must
never be silently re-rendered as a different identity.

For new V4.1 candidates, use the separate functions exported by
`backend/src/player-portrait-diversity-v41.mjs`:

- `buildDiverseV4PortraitSnapshotForPlayer(player)`
- `renderDiverseV4PortraitPromptFromSnapshot(snapshot)`
- `buildChatGptDiverseV4PortraitExecutionFromSnapshot(snapshot)` in the
  ChatGPT adapter module.

The snapshot explicitly declares `schema_version='player-portraits-v4'`
and `prompt_version='player-portrait-v4.1'`, with a fresh ID-only deterministic
face seed and canonical fingerprint. Old V3/V4 snapshots fail closed if passed
to this renderer or adapter. **Never convert an approved portrait's immutable
snapshot in place.**

V4.1 has **24 facial/hair descriptors** (23 weighted trait pools plus the
texture/length-compatible hairstyle), independently covering face contours,
cheek fullness, forehead, eye shape/spacing/colour, eyebrows, nasal bridge/tip,
jaw, chin, mouth width and lip fullness, ear shape, complexion, hair
length/texture/colour/density/hairline/style, facial hair, skin texture and a
natural mark. The **body still uses the five V4 classes**, plus a restrained
class-compatible natural body-build variant. All physical input must be
frozen initial Strength/Speed/Agility; Stamina has no effect on body mass.
No facial characteristic or age band is inferred from citizenship, position,
player name, age or game development.

**Compatibility:** haircut comes from the chosen hair length and texture,
so e.g. coily hair never gets a straight-hair side part. Bald players have
no visible hair colour, texture or hairline. All traits are deterministic
for a given permanent player ID and seed version. Hair length/eye colours
and facial marks use explicit weighted frequencies rather than equal
probabilities. These frequencies are design weights, not demographic claims.

**Single-image policy:** one player, one image invocation **then QA before
another generation**. Auto-accept technical+visual PASS or PASS_WITH_NOTE,
keeping notes; regenerate FAIL only after recording that failure, with
a bounded retry safeguard. The prompt cannot control a provider that returns
the wrong identity; validate the actual effective image output, true PNG alpha
and 320x362 derivative before accepting. Never accept a collage or
a reused face from an earlier player.

**No automatic migration:** The six already accepted V4 pilot portraits remain
V4 even after this extension; unapproved future candidate requests may opt in
to V4.1 with their own versioned snapshots and independent QA. Nothing here
writes DEV D1, publishes assets, merges code or deploys.
See [V4.1 diversity details](player-portraits-v41-diversity.md).
