# Division SVG Specification

Status: Approved — DIV-SVG-01–20
Project: Football Architect
Scope: Division identity artwork for 16 divisions

## Approved decisions

| ID | Decision | Status |
|---|---|---|
| DIV-SVG-01 | Two SVG variants per division, `primary.svg` and `compact.svg`, each usable in both light and dark themes. | Approved |
| DIV-SVG-02 | Faithful conversion of approved logos into vector SVG, using user-provided original PSD files as the source. Preserve approved composition, symbols and identity. | Approved |
| DIV-SVG-03 | Render SVG markup inline in HTML, not through `<img>` or `<picture>`. | Approved |
| DIV-SVG-04 | Use the three fixed canonical HEX colors per division; do not recolor by theme. | Approved |
| DIV-SVG-05 | Display logos without additional backgrounds, frames, shadows or support elements. | Approved |
| DIV-SVG-06 | Preserve original aspect ratios; no distortion or cropping. | Approved |
| DIV-SVG-07 | Each UI component explicitly chooses Primary or Compact; no automatic variant switch based on viewport size. | Approved |
| DIV-SVG-08 | If SVG is missing, invalid, or unavailable, show division ID (e.g. `IT-1`) in the same reserved space. | Approved |
| DIV-SVG-09 | Show SVG immediately at initial render without temporary code placeholders or intermediate visual states; fallback only for genuinely missing/invalid assets. | Approved |
| DIV-SVG-10 | Keep SVG source files separate in repository and inline their markup in HTML for display. | Approved |
| DIV-SVG-11 | Self-contained, validated SVG only; no scripts, external resources, embedded raster images or interactive behavior. | Approved |
| DIV-SVG-12 | Convert all logo lettering to vector outlines; no SVG `<text>` or external font dependencies. | Approved |
| DIV-SVG-13 | Transparent SVG background; no extra background rectangles, while preserving fills integral to the crest. | Approved |
| DIV-SVG-14 | Tight `viewBox` around artwork, without unnecessary transparent margins; spacing handled by layout. | Approved |
| DIV-SVG-15 | SVG markup contains no internal `id` attributes or ID-based references. | Approved |
| DIV-SVG-16 | Inline SVG markup during page generation, before the HTML is delivered/rendered; do not fetch or inject SVG asynchronously at runtime. | Approved |
| DIV-SVG-17 | Each UI component defines its own logo dimensions and responsive available space; scale SVG proportionally without distortion or cropping. Primary/Compact selection remains explicit per component. | Approved |
| DIV-SVG-18 | Contextual accessibility: when a logo accompanies the visible division name, treat the SVG as decorative and hide it from assistive technology; when shown alone, provide an accessible name identifying the division (e.g. “Lega Federale”). | Approved |
| DIV-SVG-19 | Require comprehensive automated SVG validation before integration: valid SVG structure; no scripts, external resources, raster content, font dependencies, internal IDs or ID-based references; verify canonical HEX colors, aspect ratios and file integrity. Also perform visual legibility checks in both light and dark site themes. | Approved |
| DIV-SVG-20 | Organize source files in one directory per division, with deterministic paths derived from the division ID. Do not introduce an additional asset manifest or a separately maintained path registry. | Approved |

## Implementation boundaries and notes

- 16 divisions × 2 variants = 32 SVG source files.
- Approved organization: one directory per division with deterministic ID-derived paths; `assets/divisions/it-1/primary.svg` and `assets/divisions/it-1/compact.svg` are illustrative paths, not a final directory-root naming decision. No additional asset manifest.
- Existing PNG/WebP and theme-specific logo variants are superseded by the approved SVG model; removal/migration details are not yet approved.
- Inline SVG must be treated as trusted, validated build-time content; page-generation inlining is approved; the exact implementation mechanism remains to be specified.
- SVG contrast and legibility must be checked in both site themes without changing canonical colors or adding a backing surface.
- This document is a specification only. It does not authorize implementation, merge or deployment.

## Change log

- 2026-10-15: DIV-SVG-20 approved (option B): per-division directories and deterministic ID-derived paths, without an additional manifest. All 20 decisions approved.
- 2026-10-15: DIV-SVG-19 approved (option A): comprehensive automated SVG validation and visual verification in both site themes.
- 2026-10-15: DIV-SVG-18 approved (option A): contextual accessibility for inline division logos.
- 2026-10-15: DIV-SVG-17 approved (option A): component-specific responsive dimensions with proportional scaling.
- 2026-10-15: DIV-SVG-16 approved (option A): inline SVG markup during page generation, without runtime fetch/injection.
- 2026-10-15: DIV-SVG-15 approved (option B): no internal identifiers or ID-based references.
- 2026-10-15: DIV-SVG-02 approved (option A): faithful conversion of approved logos from original PSD sources.
- 2026-10-15: Initial consolidated specification based on DIV-SVG-01 and DIV-SVG-03–14.
