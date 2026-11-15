# #577 — Match scoreboard: flat bar and overlapping 48px badge

The Match Detail scoreboard is a single compact, competition-branded strip,
**340×48px maximum on desktop** and **310×48px maximum on mobile**.
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
separate capsule or score box. Numbers are optically stronger than
abbreviations, with a subdued centre dash. All six columns reserve
space before data arrives; no layout jumping or invented score data.

## Theme

| Element | Dark | Light |
|---|---|---|
| Bar | Competition primary (solid) | 16% competition primary / 84% ivory (solid) |
| 48px badge | Ivory | 5% primary / 95% ivory |
| Logo | Original approved SVG colours, 44×44px | Same, unchanged |
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
