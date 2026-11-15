# #577 — Small left-logo match scoreboard

The Match Detail page has one narrow centered scorebar, no page heading or
visible match ID, and no invented club crests or scores.

## Layout

Desktop: maximum width **340px**, height **34px**. Narrow screen: maximum
width **310px**, height **30px**. The single horizontal row is:

`COMPETITION LOGO | HOME ABBR | HOME SCORE | – | AWAY SCORE | AWAY ABBR`

The approved competition `compact.svg` is shown at **44px on desktop**,
**38px on mobile**, at the **far left of the scorebar**. Its link is
shifted 8px left and 5px upward. The SVG **overhangs the upper and left
edges of the bar**; the container uses visible overflow and stacking
to avoid clipping. No logo outline or backing is used.

## Competition-specific Dark and Light palettes

The two appearances follow the existing site `html[data-theme="light"]`
setting and respond immediately when the site's appearance changes.

| Scoreboard element | Dark | Light |
|---|---|---|
| Bar surface | Official `primaryHex` | 16% `primaryHex` blended with 84% approved ivory |
| Abbreviations, goals, divider | Official ivory `#F5F1E8` | Official `secondaryHex` (graphite `#243039`) |
| Bar border and bottom 2px inset | Official `secondaryHex` | Official `primaryHex` |
| Left logo | Primary-coloured paths displayed in ivory; secondary paths graphite | Original primary and secondary fills |

This creates a visibly different scoreboard for **each division**, while
making Light genuinely pale and Dark saturated. The site owns the appearance,
not individual match data. All 16 contrast-checked divisions meet the
4.5:1 minimum in both variants.

**Legibility treatment (no logo border or backing):** the small logo is
rendered directly on the bar. In Dark, approved primary-filled paths become
ivory so they remain distinguishable from the primary-coloured bar; secondary
(graphite) paths stay graphite. In Light, the original primary+secondary
fills are used unchanged. Neither variant introduces shadows, outline rings,
round badges or separate logo backgrounds. Canonical SVG files never change.

The 16 published domestic division `compact.svg` files remain intact,
SHA-verified, publication-allowlisted and mapped to the right competitions.
Runtime reconstruction checks the path-only geometry, original two-colour
palette and viewBox before displaying. The dark/light SVG render cache is
keyed by appearance to avoid stale logo colours on theme changes. SVGs with the canonical XML
declaration are supported. The international `int-1` and `int-2` cups
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
