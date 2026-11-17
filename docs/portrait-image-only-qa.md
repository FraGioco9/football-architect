# Portrait V4.1 — owner-approved QA policy and follow-up message

Use this **only after an actual candidate image was generated**. Never infer a PASS from text, a previous report or an inaccessible file. Keep canonical identity/fingerprint frozen.

## Realistic visual acceptance (approved 2026-11-17)

- **PASS** (including **PASS WITH NOTE / PASS CON NOTA**): a credible real footballer broadly matches the frozen facial identity, complexion, hair characteristics and physique, with realistic anatomy, frontal pose and plain white short-sleeved regular-fit jersey. Minor variation in hair volume/arrangement, eyebrow density, subtle facial proportions and lighting-dependent colour is nonblocking; record any observations.
- **FAIL**: substantial contradiction of frozen facial identity, complexion or physique; clearly wrong anatomy; materially inappropriate composition or essential technical requirements.
- **INCOMPLETE**: required actual image/evidence cannot be inspected. Do not replace missing evidence with assumptions or old issue text.
- The original should be a genuine alpha-transparent RGBA PNG, approximately vertical 3:4 and head-to-hips; avoid cropping hair or adding labels, props, reference-image decorations or multiple subjects. Target appearance: young adult man around 21–25, independently of gameplay age.
- Independently decode/inspect the 320×362 alpha-preserving WebP derivative. Preferred significant top margin 3–8 px (0–12 px only with intact hair), side clearance at least 20 px and horizontal centering. Check colour halos on light/dark backgrounds. Do not claim real-pixel checks were performed unless they were.
- Technical QA cannot replace visual owner acceptance; each candidate has its own SHA-256 and possibly image-generation ID. Previous FAIL records are immutable history; re-QA may add a separate outcome, never overwrite earlier evidence.

## Copyable follow-up for any player

```text
Do NOT generate or edit another image.
Evaluate the ACTUAL candidate generated in this chat against this player's
already verified immutable V4.1 face/fingerprint/physique using the current
realistic owner-approved QA tolerance. Do not infer the identity from player
name or citizenship. Perform only checks whose actual source pixels are
accessible. Report PASS, FAIL or INCOMPLETE; count PASS WITH NOTE as PASS.
Include the player ID, candidate identifier, real file hashes and evidence
where available; flag missing evidence as NOT VERIFIED. Record results in
the relevant issue if permitted. Do not upload, replace approved assets,
alter the database, merge or deploy.
```

Related: [technical QA](player-portraits-v4-qa.md) and [generic generation workflow](player-portraits-chatgpt.md).
