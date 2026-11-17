# Football Architect — Image-only V4.1 first messages (#646)

**Image-only execution version:** `image-only-chat-v2`. The portrait should look like a **young male, approximately 21–25 years old**, regardless of the game's player age. The permanent ID-based V4.1 face description and physique class remain unchanged. This is a prompt-level visual age cue, not a rewrite of a frozen V4.1 identity fingerprint.

This is a **diagnostic isolation workflow** for the repeated ImageGen missing-edit-target error: the first message of each isolated player chat contains ONLY an original image-creation request and the immutable canonical V4.1 visual features. No GitHub/Cloudflare connector links, old published portraits, reference image discussion, QA instructions or player metadata are included in the first message.

## How to use

1. Open a fresh chat for ONE player.
2. Copy ONLY the corresponding image prompt, using `docs/portrait-image-prompts-all.md` or a single file in this package. Send it as the **first message** (no old failed conversation, no image attachment).
3. If the generation actually produces an image, send `docs/portrait-image-only-qa.md` as the **SECOND** message in that same chat, adding the player ID and fingerprint from the index header. Do not start with this QA message.
4. If the generation still fails with a missing image target, record **GENERATION_UNAVAILABLE / NO CANDIDATE**. Do not upload any reference photograph, use third-party rendering, claim QA PASSED, or generate another image without separate authorization.

This separation is a diagnostic workaround, **not a guarantee** that an original text-to-image tool is available. The original immutable face descriptors and body classes have not changed. The prompt index header carries the fingerprint for QA metadata only; do not paste that header into the first image request.

The original 23 approved portraits remain unchanged; no database operations, publishing, merges or deployments occur in this workflow. PR #648 stays Draft/HOLD.
