# Football Architect — One-ID V4.1 automatic image generation (#646)

**Utilizzo:** in una normale chat del progetto Football Architect, con i plugin GitHub e Cloudflare collegati e ImageGen disponibile. Cambia **solo** il numero in `PLAYER_ID`. L'assistente deve recuperare l'identità canonica, chiamare direttamente ImageGen e valutare l'immagine restituita nella **stessa chat**, senza richiedere un secondo messaggio.

**Important:** previous combined orchestration prompts failed because the generator requested an image target instead of creating a new image. This revision isolates the **visual payload** from metadata, connector instructions and QA within the workflow. It is a diagnostic improvement, **not a guarantee of image-tool routing**. If ImageGen cannot create an image, return `GENERATION_UNAVAILABLE / NO CANDIDATE`; do not ask the user to upload a photo, fabricate QA or silently switch workflows.

**Sources:** `FraGioco9/football-architect`, Draft/HOLD PR #648. Reuse frozen entries from `docs/portrait-image-prompts-all.md` exactly; for other IDs, use only read-only DEV D1 data with auditable FROZEN INITIAL stat provenance and the actual V4.1 exporter, or fail closed. The image-only visual description preserves the immutable facial fingerprint and uses the presentation cue **young male approximately 21–25 years old**.

## Reusable prompt — edit ONLY the one ID

```text
# FOOTBALL ARCHITECT — ONE-ID V4.1 ORIGINAL PORTRAIT
PLAYER_ID = 44

[$github](app://connector_76869538009648d5b282a4bb21c3d157)
[$cloudflare](app://asdk_app_6abc2a9552748191b465859a06e90da3)

Change ONLY the number in PLAYER_ID. Execute the following automatically in THIS NORMAL CHAT: verify the player identity, create exactly ONE new portrait using the built-in ChatGPT image generator, then run all possible QA. Do not stop after a text-only prompt, ask for a second message, or direct me to Images → Create image.

PHASE 1 — REPOSITORY LOOKUP (tools: GitHub; Cloudflare if necessary)
1. GitHub: FraGioco9/football-architect, PR #648, branch feat/646-player-portrait-v4-core. Pin its exact HEAD and use that same revision throughout.
2. Read docs/portrait-image-prompts-all.md. Find the heading matching the EXACT numeric PLAYER_ID. When present, obtain the name, V4.1 fingerprint, frozen physique and the COMPLETE fenced image-only description from that entry. Use the visual text VERBATIM. Do not recompute the frozen identity.
3. For IDs absent from that index, fetch backend/src/player-portrait-diversity-v41.mjs and tools/export-player-image-prompts.mjs from the same HEAD. Retrieve player information using the Cloudflare plugin ONLY from football-architect-dev (DEV D1, read-only). Prove that strength, speed, agility and stamina are ORIGINAL/FROZEN initial values using a committed draft or other auditable initial record; current/evolved stats alone are not proof. Run the exact repository createImageOnlyPortraitPrompt() implementation with the verified row, if execution is possible. Do not approximate its deterministic facial features or fabricate a fingerprint. If provenance or execution is missing, return CANONICAL_PROFILE_NOT_VERIFIED and stop.
4. The image description must retain the exact frozen V4.1 facial features, hair, complexion and body class, plus the image-only-chat-v2 apparent age: young male, approximately 21–25 years old, irrespective of gameplay age.
5. Keep all metadata and connector results INTERNAL. They are NOT part of the description passed to image generation.

PHASE 2 — CREATE THE IMAGE NOW (native ChatGPT ImageGen)
Immediately after a successful lookup, call the available original image-generation tool in this same chat, for exactly ONE new image. Pass ONLY the resolved, COMPLETE image-only visual description as the generation request. It specifies a realistic studio media-day portrait, full head/hair/arms down to hips, regular-fit pure-white jersey, vertical 3:4 and transparent background.

Do not transmit this orchestration prompt, connector calls, repository files, metadata, QA instructions or other conversation context as the visual request. Do not substitute another face, shorten the canonical description, or create a collage. No user-supplied material is needed.

If the tool cannot create a new image and returns no result, stop with GENERATION_UNAVAILABLE / NO CANDIDATE and the actual tool error. Do not improvise a candidate or claim the image exists; no retries without a new request.

PHASE 3 — QA (only once a real new image is returned)
Evaluate the actual candidate against the frozen face/hair/skin/body, approximate 21–25 appearance, natural anatomy, white jersey and full frontal head-to-hips pose. If you can access the actual PNG bytes, verify genuine transparency, vertical 3:4 and clean edges; otherwise technical QA is NOT VERIFIED. If possible, derive a QA-only transparent WebP 320×362, preserving the face and hair; check top significant alpha margin 3–8 px (0–12 only with full hair), left/right room >=20 px, centering and color fringing. Mark unavailable checks NOT VERIFIED; never invent files, SHA-256 or measurements. Report PASS / PASS CON NOTA / FAIL based on actual evidence; use INCOMPLETE when necessary. Add a traceable comment to GitHub issue #646 only if the plugin permits it.

FINAL OUTPUT
Show the GENERATED IMAGE and a concise report: player ID/name, immutable fingerprint, physique, PR HEAD, DEV verification if used, generation status, visual QA, PNG/WebP QA and any limitations. If generation failed, show the failure rather than a fictional QA report.

BOUNDARIES
One player and one image attempt per run. Keep approved portraits unchanged. No writes to D1, no Production access, no publication, asset replacement, PR merge or deployment without separate explicit authorization.
```

## Boundaries and fallback

One native original image attempt per invocation. QA is attempted **only after** real generated pixels exist. The 23 individual image-only files are retained as optional fallback if the product repeatedly fails to route the combined request, but the normal expected path is a single message and a single chat. No Production or D1 writes, approved asset replacement, automatic publishing, merge or deploy. PR remains Draft/HOLD.
