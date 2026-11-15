# #577 — Small left-logo match scoreboard

The Match Detail page has one narrow centered scorebar, no page heading or
visible match ID, and no invented club crests or scores.

## Layout

Desktop: maximum width **340px**, height **34px**. Narrow screen: maximum
width **310px**, height **30px**. The single horizontal row is:

`COMPETITION LOGO | HOME ABBR | HOME SCORE | – | AWAY SCORE | AWAY ABBR`

The actual approved competition `compact.svg` is shown at **28px** on
desktop, **25px** on mobile, on the **far left within the bar**. It no
longer occupies the centre or protrudes above/below the bar.

**Legibility treatment (no ivory border or backing):** competition logos use
two approved colours: their `primaryHex` and graphite `#243039`. Because
the scorebar itself uses `primaryHex`, the scoreboard-specific display
replaces only paths filled with that primary colour with the approved ivory
`#F5F1E8`; the existing graphite details remain graphite. The result is
a small high-contrast two-tone mark against the original competition-coloured
bar, without changing the canonical SVG assets. No outline, shadow, border
around the logo, circular badge, separate plaque or ivory background is used.

The 16 published domestic division `compact.svg` files remain intact,
SHA-verified, publication-allowlisted and mapped to the right competitions.
Runtime reconstruction checks the path-only geometry, original two-colour
palette and viewBox before displaying. SVGs with the canonical XML
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
