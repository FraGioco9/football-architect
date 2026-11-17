# V4.1 portraits — 23/23 staged in Draft PR (2026-11-17)

Issue #646 | PR #648 (Draft/HOLD)

**Scope of owner request:** integrate the uploaded portrait assets into the existing Draft PR only. **No merge, deploy, Production, DEV D1 update, portrait-profile status or asset_key mutation.** All V3 assets on `main` remain unchanged.

## Staging history

- First batch: **20** user-uploaded PNGs with explicit ID filenames #44–#63, converted to 320×362 transparent lossless WebP and staged in commit [`3a54759`](https://github.com/FraGioco9/football-architect/commit/3a5475958ac9becb0d6e11a154e5d6d3a77327cf).
- Final batch: **3** original PNG uploads `98(1).png`, `145(1).png`, `148(1).png` supplied by owner and staged at `assets/players/portraits/{98,145,148}.webp` in this Draft PR.
- **All 23 intended IDs are now represented exactly once:** #44–#63, #98, #145, #148. No other player portrait asset was touched in this staging workflow.

## Real-file technical checks

For each newly received source: native **1086×1448 3:4 RGBA PNG**, true alpha with transparent corners; a source-preserving aspect-ratio resize on a transparent canvas produced **320×362 lossless transparent WebP**, inspected on light and dark composites. New files were independently decoded with **Pillow and FFmpeg**, yielding identical RGBA pixel arrays. Across all **23** staged WebPs, significant top-alpha clearance is **3–8 px**, side clearances **>=20 px**, and horizontal centring **within ±8 px**. Actual uploaded file hashes, generated WebP hashes, sizes and alpha geometry are in [the integration manifest](portrait-v41-integration-batch-2026-11-17.json).

**Explicit limitation:** The actual user-uploaded PNG bytes are **not SHA-256-identical to the original image candidates recorded as QA PASS** in issue #646 (including the final three). File-to-ID pairing is based on the supplied ID filenames and manual visual review; no cryptographic equivalence to the historical candidate PNG is claimed. The approved 2026-11-17 realistic QA threshold and historical per-candidate PASS records remain unchanged. The file provenance discrepancy must be acknowledged at release review.

## Release hold — still mandatory

This Draft branch stages new WebP bytes at existing V3 public asset paths, but it **does not** migrate/approve any V4.1 canonical snapshots or update `player_portrait_profiles`. Before a separately authorised merge/deploy, review the 23 staged assets and fingerprint-to-file associations, plan versioned V4.1 portrait-profile/snapshot migration and rollback, run the relevant QA/CI on the exact final head, and receive explicit owner release approval. **Do not merge while these gates are open.**

## Staged asset audit

- #44: `assets/players/portraits/44.webp` — top 5px; left/right 51/54px; horizontal centre -1.5px; WebP SHA-256 `f1905de740ee673b11ec6274d7749a9d83de5c597ed8bbbb91e3e809ca252a2f`
- #45: `assets/players/portraits/45.webp` — top 5px; left/right 59/62px; horizontal centre -1.5px; WebP SHA-256 `c23bd8f586fc702ed71b84cb65fb757b5db8518f7ec1687875ed21cb399602d4`
- #46: `assets/players/portraits/46.webp` — top 5px; left/right 53/52px; horizontal centre 0.5px; WebP SHA-256 `7d4aa97c4319d94e8fe6429b693ddddfc8ba5df1ee3fa3d1f2cb48a0e8f12541`
- #47: `assets/players/portraits/47.webp` — top 5px; left/right 58/58px; horizontal centre 0px; WebP SHA-256 `3cfb3a398dea51ce573ca3db83b6bddf348b04d801795c496d7babbf02ac4c10`
- #48: `assets/players/portraits/48.webp` — top 5px; left/right 61/61px; horizontal centre 0px; WebP SHA-256 `12022e17616de539fd23b3dc3601a6472c26d79039957c2036ec952fc7bac547`
- #49: `assets/players/portraits/49.webp` — top 6px; left/right 62/63px; horizontal centre -0.5px; WebP SHA-256 `efd8f22e023f936b2ffa2b2d29916745707b84ff10b2a2ab46d858fb9c3af24b`
- #50: `assets/players/portraits/50.webp` — top 6px; left/right 44/44px; horizontal centre 0px; WebP SHA-256 `acc146d26398ed1cfaae9bd82fce9863aff85fafbc311f4c2a0de28d77b89fe9`
- #51: `assets/players/portraits/51.webp` — top 4px; left/right 50/53px; horizontal centre -1.5px; WebP SHA-256 `70fa5525b8ea46a5b7f9e93fc1826bbbcc186ec433f144167bc146507286378d`
- #52: `assets/players/portraits/52.webp` — top 5px; left/right 53/53px; horizontal centre 0px; WebP SHA-256 `1af6af76f3f191b851ed548a03005bbfa1df3ce0bb2d73c2a3ef33ff255dcbfe`
- #53: `assets/players/portraits/53.webp` — top 5px; left/right 51/57px; horizontal centre -3px; WebP SHA-256 `b60640264c7d0a02737d1ce39642834370d87a86cbbc4aa64e5231f74bb0e3e7`
- #54: `assets/players/portraits/54.webp` — top 3px; left/right 58/60px; horizontal centre -1px; WebP SHA-256 `26da9b6049a57ee4c3388d99ef336e834b2548e03e288aaaabf9fe9ac43f11aa`
- #55: `assets/players/portraits/55.webp` — top 5px; left/right 53/61px; horizontal centre -4px; WebP SHA-256 `a9a8e203865c20080db79b2ba11a32045dc3cc89954555bbd2b5113411e18d7f`
- #56: `assets/players/portraits/56.webp` — top 5px; left/right 54/53px; horizontal centre 0.5px; WebP SHA-256 `b0b594504a013173045cf4b5c32c66fe7534d844e6f02c47d8f04cd3223e246e`
- #57: `assets/players/portraits/57.webp` — top 4px; left/right 56/59px; horizontal centre -1.5px; WebP SHA-256 `0fa1a8cc7c9d2c92c33b0f7f3b92d7d6c1cafd8d2243773d70e3d1e84499e54d`
- #58: `assets/players/portraits/58.webp` — top 6px; left/right 55/54px; horizontal centre 0.5px; WebP SHA-256 `cccf3475d4160a3d5bd57c9c8d9489982df74637266733f74a2264736c436888`
- #59: `assets/players/portraits/59.webp` — top 5px; left/right 54/56px; horizontal centre -1px; WebP SHA-256 `bed9bd4c7f4c617160962667feba4ed629c36724b58bcc40196c137576a64d09`
- #60: `assets/players/portraits/60.webp` — top 6px; left/right 52/54px; horizontal centre -1px; WebP SHA-256 `9a58c9774d27f0a7b0505d0bcf2bee018b0a13411de998736880e02684bf8dcc`
- #61: `assets/players/portraits/61.webp` — top 6px; left/right 58/54px; horizontal centre 2px; WebP SHA-256 `fc249fef5a263783cd7e7005b48c126f857d17646a080b681f2e1f773be9330f`
- #62: `assets/players/portraits/62.webp` — top 5px; left/right 59/60px; horizontal centre -0.5px; WebP SHA-256 `9c88846a13b8e3db7d02449076d3cec329f4f7e1351c9fb5ee84e8069fe3733f`
- #63: `assets/players/portraits/63.webp` — top 4px; left/right 54/55px; horizontal centre -0.5px; WebP SHA-256 `4fc1fc030d129cab5907fd8002fc4236ac18dbb4881ea4556a2f31e2bb134a52`
- #98: `assets/players/portraits/98.webp` — top 5px; left/right 54/54px; horizontal centre 0px; WebP SHA-256 `a0ff38c0119ca1272390bed4bbdfb626be602541b012cc5a434071756ecdae2e`
- #145: `assets/players/portraits/145.webp` — top 5px; left/right 51/50px; horizontal centre 0.5px; WebP SHA-256 `6d51c64aff5633b243c98382e22998090f6b00523d05c9c8f0618d5d30a725e1`
- #148: `assets/players/portraits/148.webp` — top 8px; left/right 58/56px; horizontal centre 1px; WebP SHA-256 `ea86df214bddafe1946fd83d0a25e4083c07d30a343db24e34bf2239228cbfc8`

No image generation during staging. No database/Production writes, asset publication, merge, or deployment.
