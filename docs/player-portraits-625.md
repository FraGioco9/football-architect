# Approved player portraits — UI integration (#623)

## Scope

Public single-player pages stage photo paths for **only** IDs 44, 98, 145, 46, 45, 49 and 50, 47. IDs 45 and 50 remains PR-only until binary QA and separate publication authorization. The simple, fully filled head-and-torso silhouette from the existing `/players` sidebar icon is the fallback on image absence/error and the permanent image for players without an approved photo and Admin previews. During initial loading the reserved portrait slot is blank; neither the SVG nor the image flashes before the source is resolved. Only the icon's two outer shapes are filled; no interior outlines or details. The portrait frame has **no visible box border**. For better correspondence with approved photographs, the **head remains round at both viewport sizes** (`preserveAspectRatio="xMidYMax meet"`), while the torso/shoulders receive only a **6% horizontal adjustment** centered on the SVG (x′=1.06x−15.36), while the head remains unscaled and the height-stable 190×181 desktop / 120×114 mobile frame. The portrait box is wider than before: **190×181 desktop / 120×114 mobile**, still borderless with the original 181 / 114 pixel heights. Mobile affiliation and back-link offsets are aligned to the new 120px-wide box. No extra player API calls, external image hosts or database changes.

The existing **owner-approved PNGs** are preserved unchanged as full-resolution 1086×1448 RGBA conversation attachments. Display-only framing: portrait images use a **150% CSS zoom**, centered horizontally and anchored to the top of their fixed (desktop/mobile) frame, with overflow clipped primarily from the lower torso and sides. The image files remain unchanged; future per-player framing can use `--app-player-photo-scale`, `--app-player-photo-offset-x`, and `--app-player-photo-offset-y`. To reduce site traffic, the public images are alpha-preserving, cropped/top-aligned **320×362 WebP derivatives**, created from the approved originals with Lanczos scaling (quality 70, WebP exact alpha).

| ID | Player | File | Git object SHA | SHA256 | Size |
| --- | --- | --- | --- | --- | ---: |
| 44 | Giacinto Lello | `assets/players/portraits/44.webp` | `0603b6cdd9d121487a44fe38180dd6bc74d77af4` | `a4a05f06df54cff48612ce5cbebc56eee4ccea381ff8b93aa475a5738c015304` | 14102 B |
| 98 | Arthur Kiesel | `assets/players/portraits/98.webp` | `a7e5ebe5e10fe49d2d2bdadf86351e83fb463756` | `7eec047c80a0e9bf662f72caf07cdcccab71dfad7d762698da2adf34c14b546d` | 15350 B |
| 145 | Steven Sellen | `assets/players/portraits/145.webp` | `f0ec19217f1bad21ee26e9d0bbff7d0890696221` | `7e2c883d0e9776b103b76a64f3957b19cfcc974b9d47bdc5677904fa5e8ebd74` | 16906 B |
| 46 | Gennaro Cassola | `assets/players/portraits/46.webp` | `ad273644abaa804265c746054ae1cfe66f2f5dc0` | `e257210da736f83c444c1d7c7a9a88b59a7901a6c15fb6c10fab6c0eae58d617` | 14416 B |
| 49 | Gianfranco Patry (candidate; not yet approved) | `assets/players/portraits/49.webp` | `d5a314ddac817195d5f5434dadb3023627c34ce4` (local digest; upload pending) | `eb2ebb852ef2d99d6157dd0e4012236cde78ac04c5a658def3936e2847f82a28` | 12424 B |
| 47 | Matthew Tiamiyu (QA-reviewed candidate; staged) | `assets/players/portraits/47.webp` | `966b3e7faccd2d41770bb09da3010b34e022710a` (verified GitHub blob) | `1110c0aaf7bee8e459f4fee223e8d765314108fb94bfe345310761423aa45d6a` | 11574 B |
| 45 | Paolo Andrian | `assets/players/portraits/45.webp` | `310606cc8bf53b86febd8ca988bca73000947ba1` (local Git blob digest; GitHub upload pending) | `6830f96eed85a7ebea555fba09e988179f6548f5db955fbef107bc23802bb63f` | 12122 B |
| 50 | Severino Cerboni (candidate, unapproved) | `assets/players/portraits/50.webp` | `ea1598f93300370455e62d5694f849de16496a4c` (local derivative Git digest; upload pending) | `ef25d641280c9e1cfa5d97d0fded878ae33b7694ad845aca071048dc61813b54` | 13844 B |

The public allowlist and required publication file list are restricted to these eight IDs while PR #640 remains Draft/HOLD. `tests/player-detail.test.mjs` verifies their SHA256 digests, RIFF/WEBP/VP8X headers, path allowlisting and inclusion in the published artifact, and checks the placeholder/error handling.

### Before merge

- [ ] Exact-head Site, Browser, Admin and FULL CI after committing the binary files
- [ ] Visual browser smoke at `/players/44`, `/players/98`, `/players/145`, `/players/46`, `/players/45`, `/players/49`, `/players/50`, `/players/47` and an unknown valid ID
- [ ] Mobile 390px and iPhone Safari; light/dark; broken image fallback; Admin draft isolation
- [ ] Separate owner authorization for merge and Preview deployment

The PR remains **Draft/HOLD**.


## #639 — Gennaro Cassola (#46) staged integration

Approved source conversation artifact: `football_architect_player_46_gennaro_cassola_candidate_v3.png`; SHA256 `c34dad4f7e4232b4b7b54be0b42cbb5f700d523eb863e51a27955e08ef73e081`; 1086×1448 8-bit RGBA PNG with transparent background. D1 frozen fingerprint `1eb822ae0ccbfa19`, V3 template. The PNG remains outside the public repository and is not overwritten.

The **display-only** WebP `assets/players/portraits/46.webp` is derived from the approved source by resizing to 320 pixels wide using Lanczos, cropping from the top to 320×362, then encoding in WebP quality 70, method 6, exact alpha. It weighs 14,416 bytes; SHA256 `e257210da736f83c444c1d7c7a9a88b59a7901a6c15fb6c10fab6c0eae58d617`. The binary was committed to this branch as the exact Git blob above, with matching SHA-256. The PR remains Draft/HOLD pending exact-head CI, visual QA and separate merge/deployment authorization. Existing image hashes must not change.

Once published via a separately authorized Preview deployment, the guarded SQL in `backend/manual/portrait-46-approved-dev.sql` may be reviewed for an explicitly authorized, isolated DEV D1 operation. It verifies `pending`, identity and immutable snapshot fingerprint before setting status to `approved` and `asset_key`. Do not run against Production. Reverting the public portrait entails reverting the allowlist/photo mapping/public asset, and independently coordinating any DB status update; do not mutate `snapshot_json`.

Review: browser desktop/mobile, light/dark, broken-image fallback, Admin draft isolation, correct crop, actual alpha and no chromatic fringing. Exact-head full CI and separate owner permissions remain mandatory.


## #640 — Paolo Andrian (#45) staged integration — HOLD

User requested integration of V4 following visual/technical QA PASS; this does **not** independently authorize deployment or database publication. Source conversation attachment: `football_architect_player_45_candidate_v4.png`; original RGBA PNG **1086×1448**, SHA256 `f47e90f210d8a904b734fbb319f18341886363f510b591bb7450ea9f4912ae7b`; frozen D1 snapshot `player-portrait-v3` (schema `player-portraits-v2`) fingerprint `b7a293c6d7061ec2`; `player_portrait_profiles.status=pending`, `asset_key=NULL` at staging. Name in `generated_players`: **Paolo Andrian**. Snapshot unchanged.

**Display-only derivative:** `assets/players/portraits/45.webp` from this PNG, resize to **320×427** with Lanczos, top-crop to **320×362**, encode WebP quality **70**, method **6**, exact alpha; 12,122 bytes; SHA256 `6830f96eed85a7ebea555fba09e988179f6548f5db955fbef107bc23802bb63f`; Git blob SHA1 `310606cc8bf53b86febd8ca988bca73000947ba1`. Original PNG remains outside GitHub. The binary must be uploaded and hash-verified in the PR before CI can pass.

No CSS, zoom, frame or protected Admin preview changes. No modifications to previous #44/#98/#145 files or the #46 portrait. Guarded SQL `backend/manual/portrait-45-approved-dev.sql` is staged for **separately authorized** DEV-only use after deployment; DO NOT EXECUTE. Keep PR Draft/HOLD pending binary verification, exact-head CI, browser QA, owner approval, merge/deploy and DEV D1 authorization.


## #640 — Gianfranco Patry (#49) staging, NOT owner-approved

Frozen V3 snapshot fingerprint: `49aae634f4ff8519`. Source PNG remains outside the repo: `football_architect_player_49_gianfranco_patry_alpha_fixed.png` (1086×1448 RGBA; SHA256 `e78a471c534209abfe271dc847ac1057c0fe9d3beb21cf572e0c694e5dd9d18f`). No change to immutable snapshot or original source.

Display-only target `assets/players/portraits/49.webp` created with Lanczos resize 320×427, top crop 320×362, WebP quality 70, method 6, exact alpha: 12,424 bytes; SHA256 `eb2ebb852ef2d99d6157dd0e4012236cde78ac04c5a658def3936e2847f82a28`; local Git blob SHA1 `d5a314ddac817195d5f5434dadb3023627c34ce4` (verify after upload).

**HOLD:** this candidate awaits approval, binary upload, exact-head CI, browser/mobile/Safari QA and separate publication and manual DEV D1 authorization. The mapping and allowlist are staged on this PR only; do not merge or deploy. No database writes.


## #640 — Severino Cerboni (#50) candidate staging — HOLD

The owner requested integration of the corrected ChatGPT-generated portrait on Draft PR #640. Staging only: **not final portrait approval, merge, deployment or a D1 status mutation**.

Immutable D1 `player_portrait_profiles` snapshot `player-portraits-v2` / `player-portrait-v3` has fingerprint `ca16d977229022e4`; status `pending`, `asset_key=NULL` when checked. Player name in `generated_players`: **Severino Cerboni**. Never recompute appearance from gameplay attributes or change `snapshot_json`.

Candidate source PNG (conversation attachment, outside GitHub): `player_50_severino_cerboni_draft_corrected.png`, **1086×1448 RGBA**, SHA256 `a6bf21b359f78e40f087fef03d1e252e8a4615ff3b9867445ca53d261c7db9b5`. Source remains unchanged and outside the repository.

Display-only derivative target: `assets/players/portraits/50.webp`, Lanczos resize to 320×427, top crop to 320×362, WebP quality 70/method 6/exact alpha, **13,844 bytes**, SHA256 `ef25d641280c9e1cfa5d97d0fded878ae33b7694ad845aca071048dc61813b54`, Git blob SHA1 `ea1598f93300370455e62d5694f849de16496a4c` (verify after upload). Public photo mapping, allowlist, publication requirement and digest test are staged only on this PR. No CSS, frame, protected Admin preview or other portraits changed.

Manual guarded DEV-only SQL is staged at `backend/manual/portrait-50-approved-dev.sql` but **MUST NOT BE EXECUTED** without separate publication authorization. Remaining: uploaded binary integrity/alpha, exact-head CI, desktop/mobile/Safari crop and fallback, portrait approval, merge, deploy, and explicit DEV D1 permission. Keep Draft/HOLD.


## #640 — Matthew Tiamiyu (#47) staged integration — HOLD

Source artifact `football_architect_player_47_matthew_tiamiyu_qa_fixed.png`: original **1140×1520 RGBA PNG**, SHA256 `d4a559a00a287ace8e4ec4be4abb5dd4b60055b1602976add171fa0d929adf5a`. D1 immutable snapshot `player-portraits-v2` / `player-portrait-v3`, fingerprint `b1acddd2bf187186`; verified player name `Matthew Tiamiyu`. At integration D1 `status=pending`, `asset_key=NULL`. PNG unchanged, retained outside repository.

Display-only WebP `assets/players/portraits/47.webp`: Lanczos resize to **320×427**, top-crop to **320×362**, encode WebP quality **70**, method **6**, exact alpha. Size **11,574 bytes**; SHA256 `1110c0aaf7bee8e459f4fee223e8d765314108fb94bfe345310761423aa45d6a`, Git blob `966b3e7faccd2d41770bb09da3010b34e022710a` verified. Existing images unchanged, player CSS unchanged, protected Admin preview still uses silhouette.

**Draft/HOLD:** staging was requested; merge, deployment, publication and DEV D1 update need distinct authorization. A guarded manual DEV-only script `backend/manual/portrait-47-approved-dev.sql` is included but MUST NOT BE EXECUTED without explicit approval. Verify exact-head CI, desktop/mobile/Safari appearance, transparency and image-load fallback. Other staged portraits may still have separate blockers.
