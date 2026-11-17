# V4.1 portrait asset integration — partial batch (2026-11-17)

Issue #646 | PR #648 (Draft/HOLD)

**Owner instruction:** integrate the portraits uploaded in ChatGPT, but **no merge, deployment, DEV/Production D1 writes, status/asset_key mutation or release**.

## Staged in this Draft PR only

- **20 source PNG uploads actually available:** player IDs **44–63** inclusive. Each source file is native RGBA PNG, 1086×1448 vertical 3:4, with genuine alpha and zero-alpha corners.
- For each ID, staged a **320×362 lossless transparent WebP** at the pre-existing path `assets/players/portraits/<id>.webp`. All 20 derivatives were decoded by Pillow and FFmpeg with **identical RGBA pixel arrays**, and measured significant alpha top **3–8px**, left/right subject clearance **>=20px** and horizontal centering **within ±8px**.
- Original source PNGs are **not committed**, but are retained as user-provided local inputs. Exact source uploaded SHA-256 and staged WebP SHA-256 are in [the integration manifest](portrait-v41-integration-batch-2026-11-17.json).
- **Explicit provenance limitation:** uploaded PNG SHA-256 hashes are not byte-identical to the original per-candidate hashes recorded in issue #646. These are identifiable user-supplied files by their ID basenames; the original issue-file byte identity is **not cryptographically re-proven**. This commit does not claim those old SHA checks apply to new byte streams. Visual preview and real-file technical QA were performed on the uploaded set.
- **Not included yet:** #98 Arthur Kiesel, #145 Steven Sellen and #148 Craig Leaman. Three images were supplied inline after the 20 named PNG files, but **raw mountable PNG files were unavailable**, so those existing V3 WebPs remain untouched in the Draft branch. No image-to-ID inference from inline display.
- The 23 V4.1 candidates have historical per-image QA reports in #646. This batch is **asset staging only**, not versioned V4.1 profile/snapshot migration.
- **Release gate:** because this branch overwrites V3 asset paths for IDs 44–63, **do not merge before all intended assets, fingerprint-to-file mapping, owner visual confirmation, versioned V4.1 snapshots/rollback and release QA are approved separately**. The approved V3 files on `main` stay untouched until a separately authorised merge.

## Exact current batch

- #44: `assets/players/portraits/44.webp` — top 5px, left/right 51/54px, centre -1.5px; WebP SHA-256 `f1905de740ee673b11ec6274d7749a9d83de5c597ed8bbbb91e3e809ca252a2f`
- #45: `assets/players/portraits/45.webp` — top 5px, left/right 59/62px, centre -1.5px; WebP SHA-256 `c23bd8f586fc702ed71b84cb65fb757b5db8518f7ec1687875ed21cb399602d4`
- #46: `assets/players/portraits/46.webp` — top 5px, left/right 53/52px, centre 0.5px; WebP SHA-256 `7d4aa97c4319d94e8fe6429b693ddddfc8ba5df1ee3fa3d1f2cb48a0e8f12541`
- #47: `assets/players/portraits/47.webp` — top 5px, left/right 58/58px, centre 0px; WebP SHA-256 `3cfb3a398dea51ce573ca3db83b6bddf348b04d801795c496d7babbf02ac4c10`
- #48: `assets/players/portraits/48.webp` — top 5px, left/right 61/61px, centre 0px; WebP SHA-256 `12022e17616de539fd23b3dc3601a6472c26d79039957c2036ec952fc7bac547`
- #49: `assets/players/portraits/49.webp` — top 6px, left/right 62/63px, centre -0.5px; WebP SHA-256 `efd8f22e023f936b2ffa2b2d29916745707b84ff10b2a2ab46d858fb9c3af24b`
- #50: `assets/players/portraits/50.webp` — top 6px, left/right 44/44px, centre 0px; WebP SHA-256 `acc146d26398ed1cfaae9bd82fce9863aff85fafbc311f4c2a0de28d77b89fe9`
- #51: `assets/players/portraits/51.webp` — top 4px, left/right 50/53px, centre -1.5px; WebP SHA-256 `70fa5525b8ea46a5b7f9e93fc1826bbbcc186ec433f144167bc146507286378d`
- #52: `assets/players/portraits/52.webp` — top 5px, left/right 53/53px, centre 0px; WebP SHA-256 `1af6af76f3f191b851ed548a03005bbfa1df3ce0bb2d73c2a3ef33ff255dcbfe`
- #53: `assets/players/portraits/53.webp` — top 5px, left/right 51/57px, centre -3px; WebP SHA-256 `b60640264c7d0a02737d1ce39642834370d87a86cbbc4aa64e5231f74bb0e3e7`
- #54: `assets/players/portraits/54.webp` — top 3px, left/right 58/60px, centre -1px; WebP SHA-256 `26da9b6049a57ee4c3388d99ef336e834b2548e03e288aaaabf9fe9ac43f11aa`
- #55: `assets/players/portraits/55.webp` — top 5px, left/right 53/61px, centre -4px; WebP SHA-256 `a9a8e203865c20080db79b2ba11a32045dc3cc89954555bbd2b5113411e18d7f`
- #56: `assets/players/portraits/56.webp` — top 5px, left/right 54/53px, centre 0.5px; WebP SHA-256 `b0b594504a013173045cf4b5c32c66fe7534d844e6f02c47d8f04cd3223e246e`
- #57: `assets/players/portraits/57.webp` — top 4px, left/right 56/59px, centre -1.5px; WebP SHA-256 `0fa1a8cc7c9d2c92c33b0f7f3b92d7d6c1cafd8d2243773d70e3d1e84499e54d`
- #58: `assets/players/portraits/58.webp` — top 6px, left/right 55/54px, centre 0.5px; WebP SHA-256 `cccf3475d4160a3d5bd57c9c8d9489982df74637266733f74a2264736c436888`
- #59: `assets/players/portraits/59.webp` — top 5px, left/right 54/56px, centre -1px; WebP SHA-256 `bed9bd4c7f4c617160962667feba4ed629c36724b58bcc40196c137576a64d09`
- #60: `assets/players/portraits/60.webp` — top 6px, left/right 52/54px, centre -1px; WebP SHA-256 `9a58c9774d27f0a7b0505d0bcf2bee018b0a13411de998736880e02684bf8dcc`
- #61: `assets/players/portraits/61.webp` — top 6px, left/right 58/54px, centre 2px; WebP SHA-256 `fc249fef5a263783cd7e7005b48c126f857d17646a080b681f2e1f773be9330f`
- #62: `assets/players/portraits/62.webp` — top 5px, left/right 59/60px, centre -0.5px; WebP SHA-256 `9c88846a13b8e3db7d02449076d3cec329f4f7e1351c9fb5ee84e8069fe3733f`
- #63: `assets/players/portraits/63.webp` — top 4px, left/right 54/55px, centre -0.5px; WebP SHA-256 `4fc1fc030d129cab5907fd8002fc4236ac18dbb4881ea4556a2f31e2bb134a52`

No images were generated by this GitHub commit. No D1/Production operations, deployment, merge or published-site asset replacement.
