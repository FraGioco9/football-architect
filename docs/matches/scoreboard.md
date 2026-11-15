# #577 — Compact match scoreboard

The Match Detail page is currently **one centered scoreboard**, without an
additional title, visible match ID, club crests or other content panels.

## Layout

A centered **42px-high** narrow bar (38px on small screens), maximum width **440px**, with a responsive five-column row:

`HOME ABBR | HOME SCORE | COMPETITION LOGO | AWAY SCORE | AWAY ABBR`

The center uses the existing approved
`assets/divisions/{id}-{name-slug}/compact.svg` of that division.
It is rendered at **96px desktop / 82px mobile**, deliberately **protruding
above and below** the 42px / 38px bar. The bar and the logo's containing
elements use visible overflow and the image has **no background,
plate, padding, or round backing**. The logo remains linked to the competition.
The page reserves enough top spacing for the protruding SVG without clipping.

The 16 domestic competitions already have `compact.svg` and `primary.svg`
assets; both are validated with `tools/validate-division-assets.mjs`,
covered by its integrity check and included by the public artifact allowlist.
The scoreboard uses `compact.svg` by default; the matching `primary.svg`
can be selected per competition in the theme config if its shape suits a
different layout. The SVG itself displays directly on the scoreboard's
approved competition colour; there is no ivory plate or other artificial
background behind it.

The international competitions `int-1` and `int-2` have no equivalent
approved competition SVGs in the current repository. Their central slot
remains neutral/empty until verified assets are available. An image loading
error also yields a neutral empty slot; **no unrelated Football Architect
logo or invented competition crest is displayed**.

The official match status and optional ET/PK annotation appear in a separate
small centered line **outside** and below the narrow rectangle, without
increasing the height of the bar.

Names use the approved **`abbr`** field (the canonical 2–5 character
abbreviation) from the club manifest at all widths. If unavailable,
the official compact/primary name or a guarded unresolved-participant
label is used. Full club names remain in accessible labels/title tooltips.
Scores are displayed individually beside the center and remain `—`
unless there is a verified completed result.

## Competition customization

`assets/match-scoreboard-themes.mjs` defines a separate theme for each
of 18 competitions, including a configurable `logoAsset` path for each
domestic division. All configured paths are validated against pinned
canonical division slugs and the two approved SVG variants.

Only official `primaryHex`, `secondaryHex` and `ivoryHex` values
from the immutable competition manifest are permitted; text contrast
must reach 4.5:1. International competitions currently use existing
neutral Graphite/Ivory until their specific branding is approved.

## Data and lifecycle

The page reads the official `GET /api/matches/:positiveNumericId`.
The numeric ID still identifies the route but is not rendered.
No fictitious results or scores are produced.

The shared source template generates `matches/_shared/index.html`.
Tests check logo existence and public allowlisting for all 16 competitions,
the compact layout, theme validation, routing and official result authority.
Run exact-head CI, Site checks and Browser QA before merging.
PR #614 remains Draft/HOLD.
