# #577 — Match scoreboard: flat bar and overlapping 48px badge

The Match Detail scoreboard is a single compact, competition-branded strip,
**340×48px maximum on desktop** and **310×48px maximum on mobile**.
Its dimensions, page centring and first-paint reserved columns remain fixed.

## Layout

`48×48 COMPETITION LOGO | HOME ABBR | HOME SCORE | – | AWAY SCORE | AWAY ABBR`

The main strip begins **12px behind** the 48×48 badge, so the badge projects
12px to the left of the strip but **never extends the overall scoreboard width**.
The badge is 48×48px, centred vertically, flat ivory in Dark and a 5% primary /
95% ivory tint in Light. Its own **1px complete outline** uses the very same
border colour and 6px radius as the main strip. It sits on top of the strip;
the underlying outline is obscured by the badge where they overlap. No crest
paths are modified, recoloured, masked, or given an artificial outline.

The main strip is **flat** (no gradient, bottom accent or decorative
second border). Scores and team abbreviations share its surface with no
separate capsule or score box. Numbers are optically stronger than
abbreviations, with a subdued centre dash. All six columns reserve
space before data arrives; no layout jumping or invented score data.

## Theme

| Element | Dark | Light |
|---|---|---|
| Bar | Competition primary (solid) | 16% competition primary / 84% ivory (solid) |
| 48px badge | Ivory | 5% primary / 95% ivory |
| Logo | Original approved SVG colours | Same, unchanged |
| Text and score | Ivory | Approved secondary graphite |
| Main and badge outlines | Secondary graphite | Competition primary |
| Desktop / mobile width | 340px / 310px max | Same |
| Height | 48px | 48px |

Each of the 16 domestic competitions retains its own official primary HEX;
unapproved or international branding falls back to neutral, without
fabricating an emblem. Contrast and the entire approved palette remain
checked by the match-detail regression tests.

## Behaviour and source

The verified `GET /api/matches/:positiveNumericId` response remains the
sole source of scores, participants and status. Abbreviations are from the
canonical club catalogue; full team and competition names remain accessible
via ARIA. Do not add title tooltips or hover animation.

The markup source is `templates/match-detail-content.html`; the generated
`matches/_shared/index.html` uses exactly the same six columns. The new
visual system only changes `assets/match-detail.css`; JS data contracts,
published SVGs, routing and generated HTML are untouched.

PR #614 remains **Draft/HOLD** pending owner visual acceptance, exact-head
CI and separate merge authorisation. No remote DB or deployment operations.
