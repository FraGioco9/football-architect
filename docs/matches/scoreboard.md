# #577 — Small left-logo match scoreboard

The Match Detail page has one narrow centered scorebar, no page heading or
visible match ID, and no invented club crests or scores.

## Layout

Desktop: maximum width **340px**, height **48px**. Narrow screen: maximum
width **310px**, height **48px**. The single horizontal row is:

`COMPETITION LOGO | HOME ABBR | HOME SCORE | – | AWAY SCORE | AWAY ABBR`

The first column is a **48×48px tile**, flush with the scoreboard's left
and top edges on both Desktop and Mobile. The **unmodified compact.svg
image is exactly 48×48px** on both breakpoints and fills the tile, with
`object-fit:contain` preserving original proportions and approved colours.
The tile and scoreboard share the same left corner radius. There is no logo
overhang, separate contour, outline, shadow or hover effect.

In **Dark**, the tile uses the official ivory `#F5F1E8`. In **Light**, it
uses the competition's light palette: **8% primary + 92% ivory**, deliberately
a little lighter than the surrounding light scorebar (16% primary + 84%
ivory). This visually integrates the tile without losing the logo's contrast.
The original SVG itself does not change between appearances.

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
| 48×48px logo tile | Official ivory surface, original logo fills | 8% primary + 92% ivory surface, original logo fills |

This creates a visibly different scoreboard for **each division**, while
making Light genuinely pale and Dark saturated. The site owns the appearance,
not individual match data. All 16 contrast-checked divisions meet the
4.5:1 minimum in both variants.

**Logo integrity:** both appearances load the exact same original SVG.
Its primary and secondary colours stay untouched; the 48×48px tile uses
the appropriate light/dark palette to separate the logo from the bar.
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
