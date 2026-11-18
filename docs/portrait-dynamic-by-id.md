# Football Architect — one-player portrait workflow (V4.1)

This is a **generic template**; change only `PLAYER_ID`. It does not embed any existing player's face, name, file, prompt or fingerprint.

Use the current `main` revision of the repository and the verified immutable V4.1 generator. The AI image-creation tool and connected GitHub/Cloudflare plugins may be used when available. If a tool or original data is inaccessible, report that limitation rather than inventing it.

```text
FOOTBALL ARCHITECT — ORIGINAL PORTRAIT

PLAYER_ID = <positive integer>

1. Verify this player's identity, nationality and FROZEN INITIAL Strength,
   Speed, Agility and Stamina from an auditable committed generation batch
   in the expressly selected environment. Never substitute current stats.
2. Use the canonical V4.1 builder and renderer from current main, or a
   previously approved immutable V4.1 snapshot. Verify the deterministic
   appearance fingerprint and physical class. Do not approximate the traits.
3. Generate EXACTLY ONE new original portrait from the resulting visual-only
   text (not image editing). No existing player photo is an input or reference.
   If original image generation is not available, report NO CANDIDATE.
4. Review the returned candidate against the frozen identity using the
   current owner-approved realistic QA policy and real pixel evidence.
   PASS WITH NOTE counts as PASS. Report INCOMPLETE where evidence is missing.
5. Do NOT publish, merge, deploy or change D1 status/asset_key based solely on
   generating or checking the image. Log the candidate and exact verified
   hashes in a GitHub issue and request separate approval for publication.
```

Reference: [canonical workflow](player-portraits-chatgpt.md), [realistic QA](portrait-image-only-qa.md), [technical QA](player-portraits-v4-qa.md). Prompt exports are generated **locally per request** with `tools/export-player-image-prompts.mjs`, never checked in as per-player files.
