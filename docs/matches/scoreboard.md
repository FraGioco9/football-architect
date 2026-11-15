# #577 — Match scoreboard: flat bar and overlapping 48px badge

The Match Detail scoreboard is a single compact, competition-branded strip,
**284×48px maximum on desktop** and **268×48px maximum on mobile**.
Its dimensions, page centring and first-paint reserved columns remain fixed.

## Layout

`48×48 IVORY TILE (44×44 LOGO) | HOME ABBR | HOME SCORE | – | AWAY SCORE | AWAY ABBR`

The main strip begins **12px behind** the 48×48 badge, so the badge projects
12px to the left of the strip but **never extends the overall scoreboard width**.
The badge is 48×48px (including its 1px outline), with its original unmodified SVG displayed at **44×44px**, centred horizontally and vertically (2px inset per side). The inner slot uses 100% of the **46×46px available content box**, not a competing 48×48px grid item that can push the image off-centre. The tile is flat ivory in Dark and a 5% primary /
95% ivory tint in Light. Its own **1px complete outline** uses the very same
border colour and 6px radius as the main strip. It sits on top of the strip;
the underlying outline is obscured by the badge where they overlap. No crest
paths are modified, recoloured, masked, or given an artificial outline.

The main strip is **flat** (no gradient, bottom accent or decorative
second border). Scores and team abbreviations share its surface with no
separate capsule or score box. Numbers remain optically stronger than abbreviations, with a subdued centre dash. Team abbreviations use **26px desktop / 24px mobile**, bold and **centred horizontally and vertically** in the 48px row. Score columns reserve **35px desktop / 32px mobile** each for two-digit results, with each score aligned toward the centre but inset 3px away from the dash. The larger dash gets a **20px desktop / 18px mobile** track and is **21px desktop / 19px mobile**. It is **pure white in Dark** and **identical in colour to the team names in Light**. Grid column spacing remains **0px**. The shortened strip keeps fixed geometry from first paint through match hydration, with ellipsis only for exceptionally long names. All six columns reserve
space before data arrives; no layout jumping or invented score data.

## Theme

| Element | Dark | Light |
|---|---|---|
| Bar | Competition primary (solid) | 16% competition primary / 84% ivory (solid) |
| 48px badge | Ivory | 5% primary / 95% ivory |
| Logo | Original approved SVG colours, 44×44px | Same, unchanged |
| Text and score | Ivory | Approved secondary graphite |
| Main and badge outlines | Secondary graphite | Competition primary |
| Desktop / mobile width | 284px / 268px max | Same |
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

## Published competition first paint (hosted Cloudflare Preview)

The shared `/matches/:id` shell cannot infer competition from the numeric URL.
On the **Cloudflare Preview Worker**, the canonical, published D1 match read
is verified against the request ID before the HTML response is sent. Its
competition ID is resolved to the **same approved palette map** used in
`assets/match-scoreboard-themes.mjs`. A literal, scoped CSS custom-property
rule is injected into `<head>` before the scoreboard markup. Both Dark and
Light use the normal existing CSS rules, with no neutral-colour flash.

Only a valid published match gets first-paint branding. A missing match,
stale world, unsupported cup palette or unavailable DB leaves the neutral
static shell; never infer staged fixtures or results. No match result or
participant data is injected, and no public caching is permitted for the
per-match HTML. Browser JS still uses its existing official match API for
all mutable match data. No new public API or extra browser fetch is added.

**Hosting boundary:** the current Vercel configuration rewrites these URLs
to the same static HTML without a Worker lookup; it cannot guarantee the
correct branded first paint there. A production-approved equivalent edge
read or server-generated HTML is required before claiming parity. The
static build does not guess match IDs from a mutable D1 world. No deploy
or production routing change is authorised by this implementation.

## Local app.first paint

The local `app.localhost:2000` server reuses the same pure style renderer
as Cloudflare Preview. When `FA_ADMIN_API_TARGET` is configured, it performs
one **bounded server-only anonymous GET** against the already approved
local or shared Preview Worker match API, validates the canonical match
identity and inserts the official palette before returning HTML. Shared DEV
requires the same `/api/environment` pool handshake as other anonymous
reads. Unconfigured / invalid / missing / remote-untrusted targets leave
the neutral shell. This is not an additional browser request, does not
connect to Production and does not open privileged endpoints on LAN.

## Browser first-paint regression QA

The explicit FULL Browser QA lane runs
`tests/match-first-paint-browser.mjs` against the real static page shell,
approved palette and browser CSS (Chromium and WebKit, Dark/Light, 1440/
390/320px). It creates one synthetic **verified match identity** exclusively
in the test harness and supplies an injected HTML response, while keeping
match hydration disabled until the parser-time styles are inspected. It
checks direct navigation and refresh, 48px reserved badge and fixed scoreboard
height/width. It is not a deployment or a live D1 validation.

### Neutral-state first paint regression fix

A parser-time palette must also replace the initial `data-scoreboard-theme="neutral"`
with the verified `competition` state in the same HTML response. Otherwise
Light CSS's neutral border override remains graphite until JavaScript loads.
The FULL browser test checks the real Light border colour, stable refresh and
the 44px official emblem centred within the 48px bordered tile.

### QA release boundary

Until exact-head Site Checks, FULL evidence, Admin checks and the dedicated
Chromium/WebKit first-paint test succeed, this PR remains Draft/HOLD. The
synthetic test harness validates browser geometry and parser-time styling, but
live Cloudflare Preview behaviour on the new source cannot be certified before
an explicitly authorised Preview deployment. No deployment is part of QA.

## Compact typography revision

The enlarged, centred abbreviations and fixed two-digit score columns are
checked in `tests/match-detail.test.mjs` and the first-paint browser suite.
The 48×48 badge, 44×44 SVG, height, palettes and match data contract are
unchanged. All widths remain reserved at initial paint to avoid layout shift.

### Vertically centred names

Each team abbreviation fills the full scoreboard row and uses flex alignment
on both axes, centred against the score numerals rather than baseline-aligned.
The 296/280px widths, two-digit score columns, competition badge and themes
are unchanged. Match-first-paint browser QA asserts the name rows have a
48px height and a vertical-centre delta no greater than 0.5px.

### Enlarged type and aligned loading placeholders

Names now render at **26px desktop / 24px mobile**, with zero extra letter
spacing, keeping the official three-character abbreviations in their fixed
columns. The loading skeleton has a **54×20px desktop / 50×18px mobile**
block, following the same flex centring as the hydrated names (instead of the
old 30×10px bar). Both placeholders and loaded text remain centred in the
unchanged 48px row; no scoreboard width, score digits, logo or brand changes.
Browser QA checks skeleton centre offsets and dimensions before hydration as
well as loaded name alignment in Dark and Light on desktop/mobile.

### Zero-gap scoreboard spacing

The six grid tracks now have **0px column gap** (including on mobile). The
home score is right-aligned and the away score left-aligned so both two-digit
scores sit against an **8px central dash track**. Removing the former 4px
inter-column gaps and shrinking the dash track also reduces the scoreboard
to **272px desktop / 258px mobile**, without shrinking either team-name track.
First-paint widths remain reserved; font sizes, skeleton, badge and row height
are unchanged. Contract and browser tests assert this geometry.

### Central dash spacing and theme

The centre en dash is now 21px desktop / 19px mobile. Scores retain their two-digit
reserved width but gain a 3px inward-edge inset. A 20px / 18px separator track
gives the dash adequate breathing room, without reintroducing column gaps.
It is **white only in Dark**; in Light, it takes the exact same computed colour
as team abbreviations through `var(--app-match-text)`, without text strokes or
background boxes. First-paint browser QA compares the computed colours in
both themes and checks the spacing of the score and dash glyphs.
