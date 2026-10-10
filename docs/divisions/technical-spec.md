# DIV-ASSET-A04 — Approved asset-production specification

**Planned inventory:** 16 divisions × four variants = **64 SVGs**, plus one manifest and one README for the future independent pack. **Produced: 0/64 SVGs.**

## Format and geometry

- Self-contained vector SVG compatible with modern browsers; `viewBox="0 0 512 512"`, intrinsic dimensions 512 × 512.
- Genuine transparent background, with no hidden opaque rectangle. Approved explicit HEX colors, vector geometry, no embedded rasters, scripts, external assets, remote fonts, gradients or 3D effects.
- Centered artwork. Minimum clear margin: **40 units** for the primary mark and **56 units** for the compact mark. Distinct shield silhouettes should not be stretched to reach the canvas edge.
- Convert all visible lettering to vector outlines in distributed SVGs; no bundled font files. Editable working sources, if any, must remain separate from the final standalone pack.

## Four variants per division

| Suffix | Contents | Planned size checks |
|---|---|---|
| `primary` | Full emblem with official name, central symbol and controlled decoration | 64, 128, 256, 512 px |
| `compact` | Same identity, simplified details, no full-length lettering | 16, 24, 32, 48, 64 px |
| `mono-dark` | Compact geometry in a single dark ink for light backgrounds | 16, 24, 32, 64 px |
| `mono-light` | Compact geometry in a single light ink for dark backgrounds | 16, 24, 32, 64 px |

## Naming and packaging

Filename format: `<lowercase-division-id>-<primary|compact|mono-dark|mono-light>.svg`, for example `it-1-primary.svg`. No spaces or accents in generated SVG filenames; division IDs are stable even if display names later change.

The **future isolated asset pack** will contain `svg/`, `manifest.json`, and `README.md`. No import into `src/`, runtime asset directories, UI, game logic, saves or database is authorized.

[inventory.json](inventory.json) is a documentation-only register of **expected names**, not evidence of existing SVG files. PNG previews are optional and are not part of the 64-vector requirement.
