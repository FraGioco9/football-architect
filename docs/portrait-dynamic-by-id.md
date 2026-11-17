# Football Architect — One-ID dynamic portrait prompt (#646)

**Change only `PLAYER_ID = 44`.** This preparation prompt retrieves an existing frozen V4.1 identity from GitHub PR #648 and, for non-exported player IDs, consults Cloudflare **DEV D1 read-only** plus the canonical repository generator. The result is one **image-only** text description to paste into a separate image-generation chat.

**Why two chats:** The prior full-handoff v2/v3 workflow repeatedly triggered a missing-image-target failure. This isolated lookup approach keeps GitHub, Cloudflare, and QA requests out of the actual image-generation chat. It improves separation but **does not guarantee** ImageGen will be available.

**Coverage:** All 23 players in `docs/portrait-image-prompts-all.md` can use the existing frozen text directly. Other player IDs are supported **only when** original physical attributes can be verified and the exact V4.1 generator can be executed; otherwise fail closed with `CANONICAL_PROFILE_NOT_VERIFIED`, never invent an identity. Fingerprints and faces remain immutable. The presentation cue is young male, approximately 21–25 in apparent age, independently of gameplay age.

## Reusable prompt (copy this whole block; edit only the ID)

```text
# FOOTBALL ARCHITECT — Dynamic V4.1 portrait preparation (one player ID)

PLAYER_ID = 44

[$github](app://connector_76869538009648d5b282a4bb21c3d157)
[$cloudflare](app://asdk_app_6abc2a9552748191b465859a06e90da3)

Change ONLY the numeric value of PLAYER_ID above. Do not ask me to paste player details, an old portrait, a reference photograph, or any file. Your task is to FETCH the frozen player identity and PREPARE the clean image-only prompt for a NEW ChatGPT image-generation chat. Do not generate an image in this retrieval chat.

AUTHORIZED SOURCES AND PERMISSIONS
- GitHub repository: FraGioco9/football-architect, Draft/HOLD PR #648, branch feat/646-player-portrait-v4-core. Use the connected GitHub plugin to read files at one consistent, verified PR HEAD. Do not substitute outdated files from main when the PR is unmerged.
- Cloudflare plugin: only DEV D1 database football-architect-dev, read-only queries for player identification and provenance of FROZEN INITIAL Strength, Speed, Agility and Stamina. Never access Production. Never write D1, modify portrait status, or update asset_key.
- No external image services (including Canva). The repository's previously approved WebP is metadata only, NEVER an image-generation input or a visual identity reference.

LOOKUP AND IDENTITY — FOLLOW THIS ORDER
1. In GitHub, open docs/portrait-image-prompts-all.md on PR #648 and search for an exact heading beginning with "## <PLAYER_ID> — ". Match the integer ID exactly, not a name or substring.
2. If that heading exists, read the displayed name, frozen V4.1 fingerprint and body class from the heading. Copy ONLY its complete fenced "text" image-generation prompt, verbatim. This entry is the preferred immutable appearance source. Do not recompute its face, change hair/skin traits, or choose a new fingerprint. Cloudflare checks are optional at this point and must never change the frozen portrait identity.
3. If that ID is NOT in the prepared index: retrieve backend/src/player-portrait-diversity-v41.mjs and tools/export-player-image-prompts.mjs from the SAME PR HEAD. Use the connected Cloudflare plugin to locate the player's ID, name, primary and secondary nationality, and verify their INITIAL (not current/evolved) Strength, Speed, Agility and Stamina from an original committed-generation source or auditable frozen snapshot. Compare with DEV records where possible. Do not assume current generated_players.attributes are initial without independent evidence.
4. Only if initial provenance is VERIFIED and a JavaScript execution environment is available, execute the actual version-pinned createImageOnlyPortraitPrompt({id,name,nationality,secondary_nationality,initial_verified:true,attributes:{strength,speed,agility,stamina}}) implementation from that PR. Use its returned content, appearance_fingerprint and bodyProfile. Do NOT hand-invent deterministic facial characteristics, fabricate a fingerprint, or approximate the repository algorithm.
5. If the ID does not exist, sources are unavailable, frozen-initial provenance cannot be established, or the canonical generator cannot be executed, STOP with CANONICAL_PROFILE_NOT_VERIFIED and state exactly which missing source prevented faithful reconstruction. Never silently replace the identity with a generic footballer.

IMAGE PROMPT REQUIREMENTS
- The selected output must be original text-to-image creation, one fictional young male footballer approximately 21–25 years old in apparent age, without inferring gameplay age. Retain all frozen canonical V4.1 face, hair, complexion and body descriptors.
- Maintain a realistic ordinary-looking person, neutral direct gaze, shoulders level, arms at sides, head-to-hip framing, and a plain regular-fit white jersey without logos or lettering.
- Vertical source 3:4, genuine transparent RGBA PNG cutout (not a painted checkerboard), complete hair and arms, clean edges.
- Use the EXACT prepared image-only visual description when available. Never add GitHub, Cloudflare, player name, ID, fingerprint, WebP targets, QA checklist, references to previously published photos, tool restrictions or diagnostic instructions INSIDE the image-generation text.
- If constructing the image-only text from the canonical generator, the only permitted presentation change relative to frozen V4.1 is the versioned young-male 21–25 appearance cue already defined by image-only-chat-v2. Do not change identity traits or its fingerprint.

RESPONSE FORMAT
First show one short metadata line OUTSIDE the copyable prompt: PLAYER_ID | verified player name | immutable V4.1 fingerprint | frozen body class | GitHub source/PR HEAD | initial-stat verification status (VERIFIED or NOT VERIFIED).
Then show ONE complete fenced text block containing ONLY the image-generation description. Do not shorten or paraphrase it. Do not insert any introductions, notes, IDs or source links inside that fenced block.
After the block, say: "Copy ONLY the text block into a NEW chat in Football Architect to create exactly one original image. Do not attach a reference image. If an image is returned, use docs/portrait-image-only-qa.md as a separate follow-up in the image chat."
Do not call ImageGen or perform technical/visual candidate QA during this retrieval step. No GitHub issue comment, asset publication, D1 writes, deployment, commit or PR merge without separate authorization.
```

## After preparing the image-only text

Open a fresh ChatGPT conversation in the Football Architect project and paste only the resulting visual text block. On actual success, use `docs/portrait-image-only-qa.md` in the same image chat as a separate QA follow-up. Keep legacy approved portraits intact; do not upload user reference photos, publish assets, write any D1 database or merge without separate approval.
