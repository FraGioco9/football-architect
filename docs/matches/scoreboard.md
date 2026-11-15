# #577 — Unified match scoreboard, without a score panel

The Match Detail page has one branded scoreboard with an outer size of
**340×48px max on desktop** / **310×48px max on mobile**. The scorebar
remains centred on the page without a visible match ID or heading.

## Appearance

`48×48 COMPETITION LOGO | HOME ABBR | HOME SCORE | – | AWAY SCORE | AWAY ABBR`

The score is set **directly on the competition-coloured bar**. There is
no separate score box, capsule, background, score border, or island.
The home/away numbers use the same accessible, theme-aware text colours
as the team abbreviations; the dash is slightly less prominent. Grid
slots reserve width at first paint, and the official match data later
fills the existing structure without moving it.

The original canonical compact division SVG remains untouched, is
**48×48px on desktop and mobile**, and is displayed directly in the
**48×48px** left logo tile. The tile has an official ivory background in
Dark, and an 8% primary / 92% ivory background in Light.

**A continuous visual perimeter** is now applied to both the scoreboard
and the tile: a 1px outline of the same competition border colour
on all four tile edges, including the upper-left and lower-left corners
and the inside separator at the right. The tile is flush against the bar
with a shared 6px corner radius. The border is on the *tile*, never on
individual elements of the SVG, and does not change the crest's colours.
The discreet 2px lower accent to the right of the tile is retained.

## Colours and dimensions

| Element | Dark | Light |
|---|---|---|
| Main bar | Subtle blend of primary/secondary | Pale primary/ivory wash |
| Logo tile | Official ivory | 8% primary + 92% ivory |
| Logo | Original primary/secondary | Same unchanged SVG |
| Abbreviations and score | Ivory | Official secondary graphite |
| Outer border, tile outline, lower accent | Secondary graphite | Primary |
| Height | 48px | 48px |
| Width (desktop / mobile) | 340px max / 310px max | Same |

All 16 domestic competitions retain their distinct approved primary
HEX values. The two international cups have no approved distinct logos;
the neutral placeholder has no fabricated crest.

## Behaviour

The official `GET /api/matches/:positiveNumericId` response remains the
sole authority for results and team participants. Home/away abbreviations
come from the approved club catalog; full club names remain in accessible
ARIA labels. No native tooltips, hover animations, underline effects,
logo recolouring or alternative assets are introduced.

`templates/match-detail-content.html` is the source for the generated
`matches/_shared/index.html`. Focused tests cover exact 48px branding,
direct score cells, continuous border, Light/Dark roles, public asset
allowlisting, routing and verified-result-only behaviour. PR #614 stays
Draft/HOLD; merge and deploy require separate approval.
