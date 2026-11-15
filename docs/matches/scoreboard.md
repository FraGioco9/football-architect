# #577 — Small left-logo match scoreboard

The Match Detail page has one narrow centered scorebar, no page heading or
visible match ID, and no invented club crests or scores.

## Layout

Desktop: maximum width **340px**, height **48px**. Narrow screen: maximum
width **310px**, height **48px**. The single horizontal row is:

`COMPETITION LOGO | HOME ABBR | HOME SCORE | – | AWAY SCORE | AWAY ABBR`

The first column is a **48×48px ivory (#F5F1E8) tile**, flush with the
scoreboard's left and top edges in both Desktop and Mobile. Its ivory
surface is fixed in Dark and Light so the **unmodified approved compact.svg**
remains legible in the competition's original primary + secondary colours.
The logo image is centered vertically and horizontally, rendered at
**36×36px on desktop / 34×34px on mobile**. There is no logo overhang,
recolouring, separate contour, outline, shadow or hover effect. The tile's
left corners follow the bar radius.

The scoreboard is 48px high on both breakpoints, including its 1px border.
The grid compensates for that border to let its first 48×48px tile meet the
actual outer left edge, without affecting the six-column score layout.

## Competition-specific Dark and Light palettes

The two appearances follow the existing site `html[data-theme="light"]`
setting and respond immediately when the site's appearance changes.

| Scoreboard element | Dark | Light |
|---|---|---|
| Bar surface | Official `primaryHex` | 16% `primaryHex` blended with 84% approved ivory |
| Abbreviations, goals, divider | Official ivory `#F5F1E8` | Official `secondaryHex` (graphite `#243039`) |
| Bar border and bottom 2px inset | Official `secondaryHex` | Official `primaryHex` |
| Logo on ivory 48×48px tile | Original primary + secondary fills | The exact same original primary + secondary fills |

This creates a visibly different scoreboard for **each division**, while
making Light genuinely pale and Dark saturated. The site owns the appearance,
not individual match data. All 16 contrast-checked divisions meet the
4.5:1 minimum in both variants.

**Logo integrity:** both appearances load the exact same original SVG.
Its primary and secondary colours stay untouched; the 48×48px ivory
tile provides sufficient separation from the competition-coloured bar.
No third logo colour, added outline, drop shadow or alternate logo is used.

The 16 published domestic division `compact.svg` files remain intact,
SHA-verified, publication-allowlisted and mapped to the right competitions.
The browser displays the original approved SVG by its validated asset path,
without reconstructing paths, changing their fill, or caching an alternate
colour version. SVGs with the canonical XML declaration are supported. The international `int-1` and `int-2` cups
still have no approved competition logo, so no fallback logo is invented.

Names use each club's canonical `abbr`. Full names remain accessible
through ARIA labels but no native `title` tooltips are set. The scoreboard
has no hover transitions, animations, underlines or opacity changes.
The official match status / ET / PK information remains below the bar.
The page sits high, with 6px top padding (4px on narrow screens).

## Theming and data

`assets/match-scoreboard-themes.mjs` supplies the competition-specific
background/foreground/accent HEX colours and verifies them against the
published competition manifest, with at least 4.5:1 text contrast.

`GET /api/matches/:positiveNumericId` is the sole authority for the
match. Scores are displayed only for verified completed results. The
numeric match ID remains in the URL only.

The shared template generates `matches/_shared/index.html`. Tests
cover the layout, logo mapping and palette treatment, public asset
allowlisting, routing and official result authority.

PR #614 remains Draft/HOLD pending exact-head CI review and explicit
merge authorization.
