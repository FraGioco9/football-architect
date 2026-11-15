# #577 — Broadcast-style match scoreboard

The Match Detail page presents one intentionally small, competition-branded
scoreboard. The outer dimensions stay **340×48px maximum on desktop**,
**310×48px maximum on mobile**, centred on the page. No page title, match
ID, extra panel or fabricated club crest appears.

## Visual structure

The redesigned scoreboard has four deliberate visual zones:

`48×48 COMPETITION LOGO | HOME ABBR | SCORE PANEL | AWAY ABBR`

The score panel contains the actual home score, dash and away score, in
that order. Its backing is a contrasting, compact centre island: **92×34px
on desktop** / **86×32px on mobile**. Abbreviations flank it on the same
baseline. A restrained 2px competition-colour trim spans the bottom of
the bar **to the right of the logo tile**. The first paint preserves the
correct geometry while official API data is loading.

The logo's **48×48px tile** sits flush at the left/top edge. The published
`compact.svg` is displayed **at 48×48px**, with original approved primary
and secondary fills, no recolouring, alternative symbol, halo, outline,
shadow, tooltip or hover animation. The left tile and bar share the same
**6px outer corner radius**.

## Competition-specific palettes

The bar uses the authoritative colours for the specific domestic division
(no universal green/blue skin). The score island is deliberately darker in
Dark and more prominent in Light. No colour is read from a club kit or
untrusted match response.

| Surface | Dark | Light |
|---|---|---|
| Main bar | Subtle blend of primary and secondary (88/12 at left → primary at right) | Pale primary/ivory wash (12/88 at left → 20/80 at right) |
| Logo tile | Ivory `#F5F1E8` | 8% primary + 92% ivory |
| Original logo | Original primary and secondary | Exactly the same unmodified SVG |
| Home/away abbreviations | Ivory | Secondary graphite |
| Score island | Secondary graphite | Primary |
| Score digits and dash | Ivory | Ivory |
| Outer border + bottom 2px | Secondary | Primary |

All domestic primary/ivory pairs are checked for at least 4.5:1 contrast
of score digits, and light-wash/secondary text pairs also pass. The official
`int-1` and `int-2` tournaments currently have no approved individual
crest/palette: the neutral fallback retains readable dark and light score
islands without fabricating a logo.

The site's existing `html[data-theme="light"]` selector determines the
appearance; the logo remains identical in both themes.

## Behaviour and layout invariants

The page uses the official `GET /api/matches/:positiveNumericId` response;
only verified completed matches show numbers. Club labels use their canonical
2–5 character abbreviations, and accessible names remain available via ARIA.
No native tooltips, hover transitions, animations or decorative opacity
changes. Scheduled/unavailable matches retain score placeholders.

The shared template `templates/match-detail-content.html` produces the
canonical `matches/_shared/index.html` through
`tools/generate-app-pages.mjs`. All 16 domestic SVG assets remain approved
and byte-identical. The 48px logo, 48px scoreboard, dedicated central
score group, Dark/Light branding, routing and official data are covered by
focused checks.

PR #614 remains Draft/HOLD; merging and deployment require separate approval.
