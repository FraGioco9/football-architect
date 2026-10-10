# Football Architect brand assets

BRAND-01: vector reconstruction of the approved compass-and-pitch mark.

## Layouts
- `horizontal-*.svg`: full wordmark for wider headers.
- `vertical-*.svg`: stacked composition for large presentations.
- `symbol-*.svg`: pictogram for narrow navigation, loading and future app sidebar.
- `/favicon.svg`, `/favicon.ico` and `/assets/brand/favicon-32.png`: compact favicon assets.

Color variants use suffixes `light` (Graphite #17262B / Petrol #087C70, designed for light surfaces), `dark` (White #F2F7F4 / Petrol #20B7A6, designed for dark surfaces), `mono-graphite`, and `mono-white`. Assets have transparent backgrounds, except favicons.

All primary SVGs contain **native vector paths**, including the outlined Inter-based wordmark, without embedded raster images, webfont downloads, or JavaScript. The logo is a manually reconstructed vector treatment of the selected image, not an exported vector source from the original image.

## Usage and safety
- Landing and Guide: use `horizontal-dark.svg` on wide screens and `symbol-dark.svg` at compact breakpoints.
- Future Home/sidebar: reuse the same `symbol-*.svg` and `horizontal-*.svg` files once those surfaces exist.
- Future loading screen: use `symbol-dark.svg`; respect reduced-motion preferences.
- Keep brand name in English across all five site languages.
- The logo must not replace meaningful heading text or the language menu.
- No deploy configuration, club identities, division data, or flag assets are modified.
