# #577 — Compact match scoreboard

The Match Detail page is currently **one centered scoreboard**, without an
additional title, visible match ID, club crests or other content panels.

## Layout

A more compact centered bar, **34px high / max 340px wide** on desktop, **30px high / max 310px wide** on narrow screens, with a responsive five-column row:

`HOME ABBR | HOME SCORE | COMPETITION LOGO | AWAY SCORE | AWAY ABBR`

The center uses the existing approved
`assets/divisions/{id}-{name-slug}/compact.svg` of that division.
It is rendered at **80px desktop / 68px mobile**, deliberately **protruding
above and below** the 34px / 30px bar. The bar and the logo's containing
elements use visible overflow and the image has **no background,
plate, padding, or round backing**. The logo remains linked to the competition.
The ivory (#F5F1E8) border is painted on **each original SVG path/object**,
not on the combined alpha silhouette of the entire emblem. The browser loads
the already-approved compact SVG (without modifying the published assets),
rebuilds its path-only geometry and original approved fill colours as a
sanitized inline SVG, and applies `stroke="#F5F1E8"`,
`stroke-width="5"`, `vector-effect="non-scaling-stroke"` and
`paint-order="stroke fill"` to every path. The visible exterior stroke
is about **2.5px** at any responsive size. Inner logo objects, including
overlapping pieces, receive their **own** ivory edge. There is no
SVG-wide filter, backing plate, extra logo or box outline.
The logo's visual center is shifted **8px upward** (7px on mobile)
relative to the bar, not vertically centered.
The bar keeps its subtle neutral outline. The SVG remains transparent,
without a background plate, circular border, or colored rectangle.
The entire scoreboard and status have been raised: the page's top padding
is now 16px on desktop / 11px on narrow screens (formerly 36px / 30px);
status spacing below the bar is 16px / 14px. The wrapper preserves
visible overflow for the overhanging logo.

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
label is used. Full club names remain in accessible ARIA labels only;
native browser `title` tooltips are deliberately removed from team
and competition links. All scoreboard hover animations/transitions
are disabled, and hover does not change the link underline or logo opacity.
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
