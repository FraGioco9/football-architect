# DIV-ASSET — Production and approval register

The A01–A05 design phase is **fully approved (5/5, 100%)**. This record distinguishes the progress of visual sample approval from the eventual delivery of 64 finalized SVGs.

| Phase | Division | Approval | Approved image | Final SVGs |
|---|---|---|---|---|
| P01 | IT-1 Lega Federale | Approved in conversation | 1 PNG sample | 0/4 |
| P01 | IT-2 Lega delle Città | Approved in conversation | 1 PNG sample | 0/4 |
| P02 | ENG-1 Crown League | Approved in conversation | 1 PNG sample | 0/4 |
| P02 | ENG-2 Shield League | **Corrected version only** approved | 1 PNG sample | 0/4 |
| P03+ | Remaining 12 divisions | Pending | 0 | 0/48 |

**Current total: 4/16 sample identities approved (25%). Final SVGs: 0/64.**

## Integrity: approved originals preserved in the Library, not in GitHub binaries

- **IT-1** — original filename `stemma_della_lega_federale_i.png`; RGBA 1254 × 1254; SHA-256 `bfd87c44cd029b0fac73cf077cb30ea64175cb2da68f7666ad61297acc976ede`.
- **IT-2** — original filename `emblema_lega_delle_città_ii.png`; RGBA 1254 × 1254; SHA-256 `0d8569f841fd1e822a0ad7c5e7a2319d8664e33a334378f4bd075526778db1e7`.
- **ENG-1** — original filename `emblema_della_crown_league_i.png`; RGBA 1254 × 1254; SHA-256 `8ff35e75fa7cfa4485f814e89abb6aefbef7eb293cf9d6c08cceb9508fa753fd`.
- **ENG-2**, **approved symmetry-corrected version** — original filename `emblema_araldico_shield_league_ii.png`; RGBA 1254 × 1254; SHA-256 `b72d6a5ced753f65083d60c0f218d48a9d4b1299d5e14212f4dc398dcf806534`.

All four original PNGs are stored in the persistent ChatGPT Library folder `/Football Architect/DIV-ASSET/`. **These binary PNG files are not in the current GitHub branch.** Original filenames are deliberately retained so checksums continue to identify the approved snapshots. GitHub contains the design documents, SHA-256 metadata and visual briefs; the Library contains the actual PNGs.

These visual samples establish approved composition only. Final SVGs must use the precise A03 HEX palette, outlined approved typography and all four A04 variants. Do not present a PNG as a completed master SVG.

## P02 correction history

The earlier unapproved Shield League draft `emblema_shield_league_ii.png` displayed imperfect inner-shield symmetry. The user requested a correction. **Only** `emblema_araldico_shield_league_ii.png` was subsequently approved. The final A04 SVG must have an exactly mirrored inner shield outline, centered tip and cross, and correctly balanced quadrants. Never treat the superseded draft as approved.

## Future update protocol

On each new explicit approval, update the **dedicated documentation branch and draft PR #69** in English; add sample preservation details to this register and the [inventory](inventory.json). Do not automatically merge, deploy, change databases or implement game assets. Do not change unrelated club documentation or division catalog data.
