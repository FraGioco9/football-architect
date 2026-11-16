# Approved player portraits — UI integration (#623)

## Scope

Public single-player pages stage photo paths for **only** the currently enumerated portrait candidates and approvals (IDs 44, 98, 145, 45, 46, 47, 49, 50, 51, 52, 148, 53 and 54). Newly staged candidates remain PR-only until separate portrait approval and publication authorization. The simple, fully filled head-and-torso silhouette from the existing `/players` sidebar icon is the fallback on image absence/error and the permanent image for players without an approved photo and Admin previews. During initial loading the reserved portrait slot is blank; neither the SVG nor the image flashes before the source is resolved. Only the icon's two outer shapes are filled; no interior outlines or details. The portrait frame has **no visible box border**. For better correspondence with approved photographs, the **head remains round at both viewport sizes** (`preserveAspectRatio="xMidYMax meet"`), while the torso/shoulders receive only a **6% horizontal adjustment** centered on the SVG (x′=1.06x−15.36), while the head remains unscaled and the height-stable 190×181 desktop / 120×114 mobile frame. The portrait box is wider than before: **190×181 desktop / 120×114 mobile**, still borderless with the original 181 / 114 pixel heights. Mobile affiliation and back-link offsets are aligned to the new 120px-wide box. No extra player API calls, external image hosts or database changes.

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
| 51 | Giampiero Caione (QA-reviewed candidate; staged) | `assets/players/portraits/51.webp` | `2d3ef95e37c2d259f0a8fc4b39c9a665713b1435` (GitHub blob verified, binary committed) | `ce1b90f2e7b115395affe7949d56ba07943dfaab2ffb376d2fbe8a30ceb2a1e3` | 12578 B |
| 52 | Emilio Rigotto (candidate, not approved) | `assets/players/portraits/52.webp` | `32d0989f16a389179605f57fad585d39a39745bd` (local digest; upload pending) | `71fedc686de47aec66c77d4f1439acb58bc690a7f93b5fa8b208bedd63ae4118` | 13912 B |
| 148 | Craig Leaman (V5 candidate, not approved) | `assets/players/portraits/148.webp` | `f4efa024dc1c7b2b58c3e11351645ff8f18257a8` (verified GitHub blob) | `c340bcf5dc77a0462e4f252c383ec1d624cb47bfa0e6b455dd05dd8fe84ec749` | 12758 B |
| 53 | Paolo Lacasa (QA-reviewed candidate; not publication-approved) | `assets/players/portraits/53.webp` | `af4f6b07f973072851fb2d8f819405f7e6626fee` (verified upload) | `dc088027b0b6462120ee99604429979be22d870da30891250215e5f73e23a457` | 12554 B |
| 54 | Massimo Bottineri (QA-reviewed candidate; not publication-approved) | `assets/players/portraits/54.webp` | `17984461e36616dc7cad8d267eb0eb12622f5372` (verified GitHub blob) | `04bb0e00c838e54cc7394671d4ba71bc9de8c895a5edc97f7cdba0e86a34fca9` | 12962 B |
| 55 | Mario Bodi (QA-reviewed candidate; not publication-approved) | `assets/players/portraits/55.webp` | `61fcf2101e07465d3b8988efbee0af7617417508` (verified GitHub blob) | `fcdcab18571c7c524400c4a57887a51ebfa31714cefe0bba5c9e855ca0f34fda` | 12142 B |

The public allowlist and required publication file list are restricted to these 14 IDs while PR #640 remains Draft/HOLD. `tests/player-detail.test.mjs` verifies their SHA256 digests, RIFF/WEBP/VP8X headers, path allowlisting and inclusion in the published artifact, and checks the placeholder/error handling.

### Before merge

- [ ] Exact-head Site, Browser, Admin and FULL CI after committing the binary files
- [ ] Visual browser smoke at `/players/44`, `/players/98`, `/players/145`, `/players/46`, `/players/45`, `/players/49`, `/players/50`, `/players/47`, `/players/52`, `/players/148` and an unknown valid ID
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

Display-only derivative target: `assets/players/portraits/50.webp`, Lanczos resize to 320×427, top crop to 320×362, WebP quality 70/method 6/exact alpha, **13,844 bytes**, SHA256 `ef25d641280c9e1cfa5d97d0fded878ae33b7694ad845aca071048dc61813b54`, Git blob SHA1 `ea1598f93300370455e62d5694f849de16496a4c` (**verified uploaded Git blob**). Public photo mapping, allowlist, publication requirement and digest test are staged only on this PR. No CSS, frame, protected Admin preview or other portraits changed.

Manual guarded DEV-only SQL is staged at `backend/manual/portrait-50-approved-dev.sql` but **MUST NOT BE EXECUTED** without separate publication authorization. WebP binary committed to PR with exact SHA1; local VP8X/alpha/dimensions/SHA256 checked. Remaining: exact-head CI, desktop/mobile/Safari crop and fallback, portrait approval, merge, deploy, and explicit DEV D1 permission. Keep Draft/HOLD.


## #640 — Matthew Tiamiyu (#47) staged integration — HOLD

Source artifact `football_architect_player_47_matthew_tiamiyu_qa_fixed.png`: original **1140×1520 RGBA PNG**, SHA256 `d4a559a00a287ace8e4ec4be4abb5dd4b60055b1602976add171fa0d929adf5a`. D1 immutable snapshot `player-portraits-v2` / `player-portrait-v3`, fingerprint `b1acddd2bf187186`; verified player name `Matthew Tiamiyu`. At integration D1 `status=pending`, `asset_key=NULL`. PNG unchanged, retained outside repository.

Display-only WebP `assets/players/portraits/47.webp`: Lanczos resize to **320×427**, top-crop to **320×362**, encode WebP quality **70**, method **6**, exact alpha. Size **11,574 bytes**; SHA256 `1110c0aaf7bee8e459f4fee223e8d765314108fb94bfe345310761423aa45d6a`, Git blob `966b3e7faccd2d41770bb09da3010b34e022710a` verified. Existing images unchanged, player CSS unchanged, protected Admin preview still uses silhouette.

**Draft/HOLD:** staging was requested; merge, deployment, publication and DEV D1 update need distinct authorization. A guarded manual DEV-only script `backend/manual/portrait-47-approved-dev.sql` is included but MUST NOT BE EXECUTED without explicit approval. Verify exact-head CI, desktop/mobile/Safari appearance, transparency and image-load fallback. Other staged portraits may still have separate blockers.


## #640 — Emilio Rigotto (#52) candidate integration — Draft/HOLD

User authorized starting PR staging, **not** final portrait approval, merge, deployment or a D1 write. ID 52 is **Emilio Rigotto** in `generated_players`. Frozen D1 snapshot: `player-portraits-v2` / `player-portrait-v3`, fingerprint `fff5faeef7005b1a`; `status=pending`, `asset_key=NULL` at staging. Do not alter `snapshot_json`.

Source portrait (outside repository) `player_52_emilio_rigotto_reframed.png`, 1086×1448 RGBA, SHA256 `989f9fcdc1d870d1c1decda186f07ab29b9078e1300850c8bcd6cd9f08ea66d6`. Display-only derivative locally prepared for `assets/players/portraits/52.webp`: Lanczos resize to 320×427 then top crop to 320×362, WebP quality 70/method 6/exact alpha; 13,912 bytes, SHA256 `71fedc686de47aec66c77d4f1439acb58bc690a7f93b5fa8b208bedd63ae4118`, Git blob SHA1 `32d0989f16a389179605f57fad585d39a39745bd`. PNG stays unmodified outside GitHub. WebP publication file must be uploaded and independently verified before considering integration complete.

Mapping, fail-closed publication allowlist, asset-required guard, exact-byte test and manual DEV-only guarded SQL are staged in this PR. **DO NOT execute SQL.** No CSS, preview fallback, other portraits, merge or deployment changes. Draft/HOLD pending binary upload, exact-head CI, desktop/mobile/Safari QA, owner acceptance and separately authorized publication, merge/deploy and DEV D1 status change.


## #640 — Craig Leaman (#148) V5 candidate integration — Draft/HOLD

Owner requested **begin integration** of the technically reviewed ChatGPT-generated V5 candidate; this is NOT owner portrait approval, merge, deployment, public publication or a D1 write. D1 read-only verified identity in generated_players **Craig Leaman**; immutable portrait schema `player-portraits-v2`, prompt `player-portrait-v3`, fingerprint `2c013bc6054a8073`; status=`pending` and asset_key=NULL. Do not modify the frozen snapshot or derive appearance from current gameplay data.

Original source remains outside GitHub and unmodified: `football-architect-148-craig-leaman-candidate-v5.png` (1086×1448 RGBA, SHA256 `570eb909390e54481a15b85aa73e0fbe6cabb0b483ad707022e9cccefdddc55e`). Local display-only derivative prepared with Lanczos resize to 320×427, top crop 320×362, WebP quality 70/method 6/exact alpha; 12,758 bytes; SHA256 `c340bcf5dc77a0462e4f252c383ec1d624cb47bfa0e6b455dd05dd8fe84ec749`; expected Git blob SHA1 `f4efa024dc1c7b2b58c3e11351645ff8f18257a8`.

**Binary uploaded and verified:** `assets/players/portraits/148.webp` was committed as `5059654c4672c5f106d6929a0c7f26a4d7c5e7b7`; GitHub confirms size 12,758 bytes and exact blob `f4efa024dc1c7b2b58c3e11351645ff8f18257a8`, matching the locally verified SHA256, VP8X 320×362 and alpha flag. The public mapping, allowlist, digest assertion and publication guard are staged on this Draft PR only. No other portrait bytes or shared CSS changed. Exact-head CI and browser/Safari QA remain pending; staging does not grant publication approval.

Manual guarded DEV-only D1 SQL at `backend/manual/portrait-148-approved-dev.sql` is staged but **MUST NOT be executed** until a separate explicit owner decision, successful publication and DEV-only approval. PR stays **Draft/HOLD** pending binary presence, exact-head CI, desktop/mobile/iPhone Safari light/dark crop and fallback QA, portrait acceptance and separate merge/deploy/D1 authorization.


## #640 — Paolo Lacasa (#53) QA-reviewed candidate staged — Draft/HOLD

This is PR-only staging following visual/technical QA, **not** final portrait publication approval, merge, deploy, or permission to mutate D1. Immutable D1 snapshot `player-portraits-v2` / `player-portrait-v3`, fingerprint `7981292a11708feb`; player name `Paolo Lacasa`; status `pending`, `asset_key=NULL` verified read-only. Never edit `snapshot_json` or derive identity from current gameplay attributes.

Corrected source PNG outside GitHub: `Paolo_Lacasa_53_ritratto_corretto_v2.png`, **1086×1448 RGBA**, SHA256 `325030052d8a6e1f15d4671d80fa218b7cf059a1b792e768d5c15291563df62b` (not changed). Visual QA compares to text traits, not a biometrically verifiable original.

The public display derivative `assets/players/portraits/53.webp` is Lanczos resized to 320×427, top cropped to **320×362**, WebP **quality 70 / method 6 / exact alpha**, 12,554 bytes, SHA256 `dc088027b0b6462120ee99604429979be22d870da30891250215e5f73e23a457` and Git blob `af4f6b07f973072851fb2d8f819405f7e6626fee` (matched). Prior images, CSS/zoom/frame, and protected Admin preview fallback remain unchanged.

Stage only: public mapping, required asset and fail-closed allowlist, VP8X/dimension/alpha/SHA256/publication tests, and guarded **manual DEV-only SQL** at `backend/manual/portrait-53-approved-dev.sql`. **DO NOT EXECUTE** SQL before separately approved publication. Retain Draft/HOLD pending exact-head CI (Site, Browser, Admin, FULL), browser/mobile/Safari/crop/fallback QA, owner portrait sign-off, merge/deploy and DEV D1 authorization.


## #640 — Giampiero Caione (#51) candidate integration — Draft/HOLD

User authorized beginning integration of the QA-reviewed corrected ChatGPT portrait; **staging only**, not final publication, merge, deploy, or D1 state change. Name from generated_players: **Giampiero Caione**. Read-only D1 snapshot: `player-portraits-v2` / `player-portrait-v3`, immutable appearance fingerprint `3ac282c49a28f65c`, `status=pending`, `asset_key=NULL`. Do not mutate snapshot_json or derive appearance from gameplay data.

Corrected full-resolution source remains outside GitHub and unmodified: `football-architect-player-51-alpha-corrected.png`, **1086×1448 RGBA**, SHA256 `c19c188d6ccb9df25070e53c7e714aacc1982f283107382431bd8ba719faf6b1`. QA checked 865150 opaque, 16635 partially transparent, and 690743 transparent pixels. QA is visual/technical, not proof of biometric identity. Source owner approval for publication is still separate.

Display-only derivative `assets/players/portraits/51.webp`: Lanczos resize **320×427**, top crop to **320×362**, WebP quality **70**, method **6**, exact alpha; **12578 bytes**, SHA256 `ce1b90f2e7b115395affe7949d56ba07943dfaab2ffb376d2fbe8a30ceb2a1e3`, Git blob SHA1 `2d3ef95e37c2d259f0a8fc4b39c9a665713b1435` (verified GitHub blob; commit `73020a42f5a5bbefb90e3e9855daeae3e7e609d2`). Do not change CSS/zoom/layout, other portrait bytes, or Admin preview isolation.

Stage public mapping, exact allowlist/required asset, SHA256 + dimensions + alpha check, and guarded **manual DEV-only SQL** `backend/manual/portrait-51-approved-dev.sql`. **DO NOT EXECUTE SQL** without separate owner approval after publication. PR remains **Draft/HOLD** binary committed and verified, pending exact-head CI, desktop/mobile/iPhone Safari crop and fallback QA, separate publication acceptance, merge, deploy and DEV D1 authorization.

## #640 — Massimo Bottineri (#54) QA-reviewed candidate staging — Draft/HOLD

Owner requested **begin PR integration** after technical QA of the corrected ChatGPT portrait. This authorizes branch staging only, not final portrait/publication approval, merge, deployment or a D1 write. D1 read-only verification: `generated_players` display_name **Massimo Bottineri**, immutable `player_portrait_profiles` schema `player-portraits-v2`, prompt `player-portrait-v3`, fingerprint `9a51467599ad501c`, status `pending`, asset_key `NULL`. Do not modify the immutable snapshot or infer appearance from gameplay attributes.

Original source stays outside GitHub and unchanged: `football-architect-player-54-alpha-fixed.png`, **1086×1448 RGBA PNG**, SHA256 `5d57d31f0742df54854028d29931f557ef1a0f5c4589b5b344a26c05197dab49`. Visual/technical QA passed principal requirements, but exact biometric realization of textual facial traits cannot be certified. Candidate awaits owner approval.

Prepared public display derivative `assets/players/portraits/54.webp`: Lanczos resize to **320×427**, top crop **320×362**, WebP quality **70** / method **6** / exact alpha. Local derivative **12,962 B**, SHA256 `04bb0e00c838e54cc7394671d4ba71bc9de8c895a5edc97f7cdba0e86a34fca9`, verified Git blob SHA1 `17984461e36616dc7cad8d267eb0eb12622f5372`. Source PNG is not committed. RIFF/VP8X 320×362, alpha and decoded transparency checked locally. No existing assets, CSS, framing or protected Admin preview changed.

**HOLD:** mapping, required publication file, fail-closed allowlist, exact SHA256 test and guarded DEV-only manual SQL are staged. Binary `54.webp` uploaded in commit `c2b3f528c733c8a18afb4aca72ae757d916c6a6d`; GitHub reports exact expected Git blob SHA1. Local SHA256/RIFF/VP8X/alpha/dimensions were verified. Remaining: exact-head Site/Browser/Admin/FULL CI, desktop/mobile/Safari crop and fallback, owner portrait sign-off, and separate merge/deploy/DEV D1 approval. **Never execute** SQL during staging or in Production.


## #640 — Mario Bodi (#55) QA-reviewed candidate — Draft/HOLD

User requested **begin integration**, which permits PR-only staging, **not** final portrait approval, merge, deployment, publication or a DEV D1 update. Immutable D1 record: player 55 **Mario Bodi**, schema `player-portraits-v2`, canonical template `player-portrait-v3`, frozen fingerprint `99e2095ec8a56db4`; `status=pending`, `asset_key=NULL` at staging. The snapshot stays untouched. Exact facial fidelity remains a visual assessment, not biometric proof.

Final corrected ChatGPT source PNG is retained **outside GitHub**, unmodified: `mario_bodi_55_bozza_alpha_finale.png` — 1086×1448 RGBA, SHA256 `18dc6984933728e09c77619d2b8b532e93d6a5917d8f369f0798ca6bad6dd256`. Its documented QA reports a continuous alpha silhouette and no obvious halos; publication acceptance remains separate.

Staged display-only derivative target: `assets/players/portraits/55.webp`. Converted via Lanczos resize to 320×427, top-crop to 320×362, WebP quality 70/method 6/**exact alpha**. Verified locally: **12,142 bytes**, SHA256 `fcdcab18571c7c524400c4a57887a51ebfa31714cefe0bba5c9e855ca0f34fda`, expected Git blob SHA1 `61fcf2101e07465d3b8988efbee0af7617417508`; RIFF/WEBP/VP8X alpha flag and 320×362 dimensions confirmed. **Binary uploaded and verified**: `assets/players/portraits/55.webp` has exact Git blob `61fcf2101e07465d3b8988efbee0af7617417508` and matches the locally verified SHA256, WebP VP8X dimensions and alpha. The PR is still Draft/HOLD; this is NOT publication approval.

PR-only changes add public mapping, fail-closed asset allowlist, required publication path, SHA256 + 320×362 + alpha test, and a guarded **manual DEV-only** script at `backend/manual/portrait-55-approved-dev.sql` (**NOT EXECUTED**). No CSS changes, no changes to other portrait bytes, no protected Admin preview changes. Pending: binary upload/verification, exact-head CI, desktop/mobile/Safari QA and fallback, explicit portrait acceptance, separately authorized merge/deploy and DEV D1 update. **Keep PR Draft/HOLD.**

## #640 — Andrea Cusenza (#59) QA-reviewed portrait staged — Draft/HOLD

Staging requested by the owner after technical and visual QA. This is PR-only integration and **not** authorization to merge, deploy, publish publicly or mutate DEV D1. `generated_players` identifies the player as **Andrea Cusenza**. The immutable D1 profile is `player-portraits-v2` / `player-portrait-v3`, fingerprint `ddb5407331e92ab9`; at staging `status=pending`, `asset_key=NULL`. No current gameplay attributes override the immutable snapshot.

The approved-for-staging source stays outside GitHub, unchanged: `football_architect_player_59_padding_corrected.png` — **1086×1448 RGBA**, SHA256 `fe66b0d0842382f98027639ef61535e18add6ed6d01b03a981e116185834a663`. The generated face is compatible with the textual V3 traits; exact facial fidelity cannot be certified biometrically.

The display-only derivative `assets/players/portraits/59.webp` was made by Lanczos resize to **320×427**, top crop **320×362**, WebP quality **70**, method **6**, exact alpha. Size **11,684 bytes**; SHA256 `3ce53bcf1a6b002bf3ee6fa517747cb440bf9f126f12cce65ed0caf01dfaf6fd`; Git blob SHA1 `66f36fa90a279705160589c675a09b024c75f484`. Local RIFF/VP8X dimensions, alpha flag and transparency were checked. The Git blob was independently created and matched this SHA1.

Staged changes: public portrait mapping, fail-closed path allowlist and required publication path, exact format/alpha/digest test, this provenance and rollback note, and an unexecuted guarded **manual DEV-only SQL** at `backend/manual/portrait-59-approved-dev.sql`. Existing portrait bytes, CSS, zoom/crop rules and protected Admin preview fallback are unchanged. Rollback is to revert the staged binary, mapping, allowlist, test and manual SQL; any future DEV D1 approval is separately controlled and must preserve `snapshot_json`.

**Draft/HOLD:** Verify exact-head CI and desktop/mobile/iPhone Safari crop, fallback and Admin isolation before any publication decision. No merge, deploy or DEV/Production D1 writes without separate explicit authorization.

## #640 — Angelo Mazzuca (#62) QA-reviewed portrait staging — Draft/HOLD

Owner requested integration into Draft PR #640 following visual/technical V3 QA PASS. This is **PR-only staging**, not final publication acceptance, merge, deployment or any DEV D1 mutation. Identity from `generated_players`: **Angelo Mazzuca**. Immutable D1 `player_portrait_profiles`: `player-portraits-v2` / `player-portrait-v3`, fingerprint `5eb91f7c1b6bced9`, `status=pending`, `asset_key=NULL` verified read-only. Do not edit `snapshot_json` or infer appearance from gameplay attributes.

QA-reviewed PNG source remains unchanged outside GitHub: `football_architect_player_62_angelo_mazzuca_draft_v3.png` — **1086×1448 RGBA**, SHA256 `6ce936a89a009828106337d88bf16406e9978e8d8fd49d3beb1c3052bd89fedc`. The V3 face is visually compatible with canonical textual traits; exact biometric fidelity is not certifiable from text.

Display-only public derivative: `assets/players/portraits/62.webp`, Lanczos resize 320×427, top crop to **320×362**, WebP quality 70, method 6, exact alpha. **12,974 bytes**, SHA256 `11d1752bd9b491df1ed4598ce4468171910c0ef3b07a3b8da962cf50e9427f1c`, expected Git blob SHA1 `5b65387ba1cd7e01ef0979dd4e857d8842cf60c1`. Confirm on GitHub after binary commit; until then integration and exact-hash CI must be considered **blocked**.

Staged mapping, fail-closed publication allowlist + required file path, exact WebP SHA256 / VP8X 320×362 / alpha test, provenance and rollback note, plus manual guarded DEV-only SQL `backend/manual/portrait-62-approved-dev.sql` that must **NOT be executed** without separate authorization. Original PNG, all existing portraits, CSS/zoom/crop and protected Admin preview remain unchanged. Rollback: revert the new 62.webp binary, mapping, guard, test, provenance and SQL. **HOLD** for exact-head CI, desktop/mobile/Safari and fallback QA, owner portrait publication acceptance, merge/deployment and separately authorized DEV D1 status change. Never write production D1.
