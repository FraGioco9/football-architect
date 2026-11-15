# #577 — Compact match scoreboard

The Match Detail page is currently **one centered scoreboard**, without an
additional title, visible match ID, club crests or other content panels.

## Layout

Maximum width 560px, centered horizontally, with a responsive five-column row:

`COMPACT HOME NAME | HOME SCORE | COMPETITION LOGO | AWAY SCORE | COMPACT AWAY NAME`

The competition logo occupies the fixed central slot (48px desktop / 40px
mobile), links to the competition and uses the existing **approved**
`assets/divisions/{id}-{name-slug}/compact.svg` of that division.

The 16 domestic competitions already have `compact.svg` and `primary.svg`
assets; both are validated with `tools/validate-division-assets.mjs`,
covered by its integrity check and included by the public artifact allowlist.
The scoreboard uses `compact.svg` by default; the matching `primary.svg`
can be selected per competition in the theme config if its shape suits a
different layout. A small ivory plate (`#F5F1E8`, already approved) behind
the SVG prevents brand-coloured paths from disappearing into the league's
primary-colour background.

The international competitions `int-1` and `int-2` have no equivalent
approved competition SVGs in the current repository. Their central slot
remains neutral/empty until verified assets are available. An image loading
error also yields a neutral empty slot; **no unrelated Football Architect
logo or invented competition crest is displayed**.

The official match status and optional ET/PK annotation appear in a small
centered line below the scoreboard.

Names use approved `compactName` from the club manifest at all widths.
If unavailable, the official name or a guarded unresolved-participant
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
