# Approved player portraits — UI integration (#623)

## Scope

Public single-player pages display photos for **only** IDs 44, 98 and 145. The simple, fully filled head-and-torso silhouette from the existing `/players` sidebar icon is the first-paint placeholder, fallback on error, and permanent image for all other players and Admin previews. Only the icon's two outer shapes are filled; no interior outlines or details. The portrait frame has **no visible box border**. For better correspondence with approved photographs, the **torso/shoulders alone are enlarged 12% horizontally around the SVG center** (x′=1.12x−30.72), while the head remains unscaled and the fixed 160×181 / 100×114 frame is unchanged. The existing portrait box remains 160×181 desktop / 100×114 mobile. No extra player API calls, external image hosts or database changes.

The three **owner-approved PNGs** are preserved unchanged as full-resolution 1086×1448 RGBA conversation attachments. To reduce site traffic, the public images are alpha-preserving, cropped/top-aligned **320×362 WebP derivatives**, created from the approved originals with Lanczos scaling (quality 70, WebP exact alpha).

| ID | Player | File | Git object SHA | SHA256 | Size |
| --- | --- | --- | --- | --- | ---: |
| 44 | Giacinto Lello | `assets/players/portraits/44.webp` | `0603b6cdd9d121487a44fe38180dd6bc74d77af4` | `a4a05f06df54cff48612ce5cbebc56eee4ccea381ff8b93aa475a5738c015304` | 14102 B |
| 98 | Arthur Kiesel | `assets/players/portraits/98.webp` | `a7e5ebe5e10fe49d2d2bdadf86351e83fb463756` | `7eec047c80a0e9bf662f72caf07cdcccab71dfad7d762698da2adf34c14b546d` | 15350 B |
| 145 | Steven Sellen | `assets/players/portraits/145.webp` | `f0ec19217f1bad21ee26e9d0bbff7d0890696221` | `7e2c883d0e9776b103b76a64f3957b19cfcc974b9d47bdc5677904fa5e8ebd74` | 16906 B |

The public allowlist and required publication file list are restricted to these three IDs. `tests/player-detail.test.mjs` verifies their SHA256 digests, RIFF/WEBP/VP8X headers, path allowlisting and inclusion in the published artifact, and checks the placeholder/error handling.

### Before merge

- [ ] Exact-head Site, Browser, Admin and FULL CI after committing the binary files
- [ ] Visual browser smoke at `/players/44`, `/players/98`, `/players/145` and an unknown valid ID
- [ ] Mobile 390px and iPhone Safari; light/dark; broken image fallback; Admin draft isolation
- [ ] Separate owner authorization for merge and Preview deployment

The PR remains **Draft/HOLD**.
