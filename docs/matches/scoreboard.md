# #577 — Compact match scoreboard

The Match Detail page is currently **one centered scoreboard**, without an
additional title, visible match ID, club crests or other content panels.

## Layout

Maximum width 560px, centered horizontally, with a responsive five-column row:

`COMPACT HOME NAME | HOME SCORE | COMPETITION LOGO | AWAY SCORE | COMPACT AWAY NAME`

The competition logo occupies the fixed central slot (48px desktop / 40px
mobile); it is an accessible link to the competition and retains its size
on initial paint. Until an approved competition logo SVG exists, the slot
displays the **existing approved Football Architect symbol**
(`assets/brand/symbol-mono-white.svg`) as an explicitly temporary,
non-competition-specific fallback. If a future approved logo fails to load,
the display falls back to this symbol rather than an empty circle.
This is not intended to represent an official competition crest.
The official match status and optional ET/PK annotation appear in a small
centered line below the scoreboard.

Names use approved `compactName` from the club manifest at **all widths**.
If unavailable, the official name or a guarded unresolved-participant
label is used. Full club names remain available as accessible labels
and title tooltips. Scores are displayed individually beside the center,
and remain `—` unless there is a verified completed result.

## Competition customization

`assets/match-scoreboard-themes.mjs` defines a separate editable theme
for each of 18 competitions. Only official `primaryHex`, `secondaryHex`
and `ivoryHex` values from the immutable manifest are permitted;
foreground/background must meet 4.5:1 contrast. International competitions
currently use existing neutral Graphite/Ivory values until approved
competition-specific colors are provided.

The central logo is configured as `logoAsset`. It remains null until
an approved SVG is added at
`assets/competitions/{competition-id-lowercase}/logo.svg`.
There are no official competition logos in the repository yet.

## Data and lifecycle

The page reads the official `GET /api/matches/:positiveNumericId`.
The numeric ID still identifies the route, **but is not rendered**.
Status reflects only attested states; both official XI are needed to
display confirmed lineups. No fictitious results or scores are produced.

The shared source template generates
`matches/_shared/index.html`. Tests cover alignment, the five-column
order, theme validation, routing, full/compact text identity, and
only-official completed scores. Run the exact-head CI, Site checks
and Browser QA before merging. PR #614 remains Draft/HOLD.
