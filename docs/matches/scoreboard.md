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

### Team-to-score spacing

Each official abbreviation is placed closer to **its own** score (home
`justify-content:flex-end`, away `justify-content:flex-start`) with a 4px
inner inset. This removes excessive unused space between labels and their
score tracks while keeping the team names aligned vertically on the same
48px axis and preserving the 26/24px fonts, skeleton dimensions, score-to-dash
spacing, approved Light/Dark colours, and 284/268px strip widths. The
browser checks verify both hydrated name-to-score geometry and the matching
first-paint skeleton alignment.

### Section top padding and visual alignment decision

The Match Detail section now has **0px padding-top** at all breakpoints
(previously 6px desktop / 4px mobile). Scoreboard dimensions and logo
geometry are untouched.

**The separator axis is now centred on the page.** The 48px competition
badge made it 20px right of the bar centre. The 284/268px scoreboard keeps
its dimensions, but shifts 20px left to align the reserved separator track
with the centre of the main content box. Below 308px
viewport width the offset is clamped to prevent horizontal clipping.

### Pre-kickoff score visibility

The centre en dash is **always visible**, from first paint through hydration,
including scheduled, postponed, cancelled, in-progress and completed fixtures.
It is static in the shared template and generated HTML, never inferred from
match data. The **two numeric score cells** start truly empty and remain
empty unless a verified `completed` result provides valid nonnegative goals.
All six grid tracks remain reserved to prevent layout jumps, and ARIA hides
empty score nodes. The separator remains centred on the page. No 0–0 score
or placeholder digits are fabricated on cold navigation or refresh.

### Dynamic controller QA (no backend writes)

The FULL browser runner also loads the real match controller with local
intercepted responses for `awaiting_participants`, `scheduled`, `in_progress`,
`postponed`, `cancelled`, and `completed`. Non-completed fixtures deliberately
carry stale score-shaped values in the test harness; the live client must
keep both numeric score cells blank **while retaining the centre en dash**.
A verified completed fixture renders both numbers with the same separator.
This is repeated for Dark and Light in Chromium and WebKit and checks ARIA
visibility.

### Team abbreviations: permanent underlined club links

Known published club IDs now always produce canonical `/clubs/{country}/{id}/overview`
links, even if the optional club manifest is late. Pending/unresolved teams
stay plain text with no misleading link. Links show a **permanent 1px text
underline** with **3px underline offset**, including on hover; no extra
padding, border, margin, font or positioning changes are introduced. The
underline draws under the text rather than affecting its 48px flex row,
so the label-to-score distances and vertical centring stay identical.
The browser suite verifies actual two-club links, clicking into Club Overview,
computed text decoration and unchanged text bounds with and without it in
Dark/Light on Chromium/WebKit.

### Link hit area and hover-only underline

The 48px-high score grid cell is now a **non-interactive flex wrapper**,
responsible for vertical centring and the 4px team-to-score inset. Its
nested `<a>` is an inline-block intrinsically sized to the abbreviation,
so pointer hover and click apply **only to the visible text**, not the cell.
The underline is **absent by default**, appears only on link hover, and is
drawn 3px below the text at 1px thickness; it changes no dimensions.
This replaces the previously permanent underline while preserving team
links, skeleton positions, typography and centred score separator.

### Hover underline visibility regression

The link itself must **not** use `overflow:hidden`: at `line-height:1`, the
underline painted 3px below the glyphs was clipped even though computed
`text-decoration-line` correctly reported `underline` on hover. The text-sized
link now has `overflow:visible`, while the outer non-interactive 48px cell
still clips oversized text; unresolved, non-clickable labels retain their own
ellipsis. No font size, position, height or hit-area change is introduced.
Browser QA now verifies actual link overflow and sufficient space inside the
slot as well as hover-only decoration and unchanged geometry.

### Underline weight and main-content alignment

Linked team abbreviations have a **hover-only underline** with a thickness
of **0.1em** (approximately **2.6px** at the 26px desktop font and **2.4px**
at the 24px mobile font), retaining the 3px offset. The link hit area remains
the text only and no new padding, border, or baseline displacement is added.

The Match Detail section explicitly occupies the full **padded content width
of `#main-content`**. The scoreboard keeps its existing -20px optical offset
from the badge, making the centre dash line up with the **main content axis**,
not the viewport or the sidebar. Chromium/WebKit browser tests measure the
actual main content-box centre, including its horizontal padding.

The match backend can still return six sporting statuses: awaiting
participants, scheduled, in progress, completed, postponed and cancelled.
The scoreboard no longer prints these labels. `data-match-load` still
tracks loading/ready/missing for rendering; missing/error notices are kept
in the separate feedback area.

### Open links in a separate tab; remove scoreboard captions

The competition logo and both resolved club-abbreviation links open their
canonical competition/club pages in a **new browser tab**, using native
`target="_blank" rel="noopener noreferrer"` on both source and generated
markup, retained by the controller when the URL becomes available. Missing
participants are not linked.

The entire `app-match-scoreboard-meta` row is removed, including Scheduled,
In progress, Full time, lineups-confirmed and any extra-time/penalties caption
that previously occupied that location. The related CSS, status-generation
and unused translation copy are removed too. All authoritative match states
and recorded results remain intact in the model, but no messages are
rendered under the scoreboard. Missing/error feedback remains separately
visible and is not suppressed. No extra vertical gap is reserved.

### Verification additions for new-tab links and absence of captions

The Chromium/WebKit browser check verifies that the competition badge and
both authorised club abbreviations carry `target="_blank"` and a `rel`
containing `noopener` and `noreferrer`. Clicking each link must open a
separate browser tab at the canonical destination while the original match
page retains its URL. The test also checks that a club without an
assigned participant has neither `href` nor new-tab attributes, and that
the former caption DOM never appears on first paint or after any of the six
backend states. The standalone feedback area for errors remains.

### Narrow viewport correction (320px)

The match shell has a narrower padded main content box on 320px devices.
Keeping the scoreboard constrained to 100% of that box reduced its width
to 226px and clipped the 50px abbreviation skeletons. On mobile the bar
now uses width = min(268px, viewport width - 40px), preserving 268×48 at
the supported 320px viewport while occupying safe surrounding gutters.
It remains offset 20px left so the centre en dash stays aligned with the
actual main content axis; no browser horizontal clipping is expected.
The old below-308px offset guard is no longer required and was removed.

### 320px scoreboard centering QA fix

The 268px mobile bar overhangs the padded `main` content box at 320px.
Auto margins collapsed to zero, leaving the centre dash 21px right of the
content axis. Mobile now uses `left:calc(50% - 20px)`,
`transform:translateX(-50%)`, and zero margins; this centres the
bar against the actual padded main axis while retaining the 20px logo
compensation. The 268×48px geometry, abbreviation font and crest size
stay unchanged; browser QA still measures ≤0.5px dash misalignment and
requires no horizontal viewport clipping.

### Simplified match page — scoreboard and pitch only

Removed the Context cards (Overview, Lineups, Events, Stats), all opacity
controls and the related first-paint markup, controller code, CSS, localization
keys and browser assertions. There is no view selector, placeholder box,
status caption or secondary heading.

The approved 48px scoreboard is followed directly by a static empty
105:68 football pitch reserved for future verified match visualization.
It contains no fabricated players, ball movements, events or statistics.
The pitch remains visible for all published match states; the separate
missing/error feedback stays hidden in normal operation. The official
score gating, competition branding, new-tab links and responsive scoreboard
centring remain intact. Chromium/WebKit QA checks no extra UI and pitch
geometry on desktop and mobile.

### Team context panels: Home and Away

The match stage contains only two subtle translucent, symmetric side panels,
Home and Away, around a narrower central **105:68** empty pitch. Each side
panel contains three elements and nothing more:

- **Position** in the current competition, if an authoritative pre-match
  league table exists.
- **Form**, using five fixed W/D/L indicator slots populated from verified
  results from this competition *strictly before the match day*.
- **Lineup**, with exactly 11 permanently reserved empty rows. Neither
  player identity nor formation is invented: the authoritative public match
  endpoint does not yet supply starting XI information.

No Matchday, clock/time, events, points or extra information boxes are
rendered. The cards retain roughly 82% surface opacity but all text is
fully opaque. Desktop uses proportions approximately 20% / 60% / 20%.
At 1000px and below, the field spans the full available content width and
the two team panels are displayed side by side beneath it.

The only new read-only request is
`GET /api/competitions/:competitionId/seasons/:season`, following a
validated authoritative match response. Match ID, competition ID, season,
schema version and provenance must match. League position appears only if
the verified competition projection's sporting day is **earlier** than
this fixture's sporting day and the team has at least one completed game.
No present-day league ranking is falsely presented as the historic pre-match
rank. Last-five form uses only verified fixture scores from this exact
competition, excluding same-day and future fixtures; empty slots are
neutral rather than invented results. League and knockout teams may show
form where official results exist; a knockout phase never masquerades as a
league rank. W/D/L colours match standings and localize in EN, IT, DE,
ES, FR.

First paint reserves every cell and all 22 lineup rows with no animation
or content shifts. Browser QA checks 1440px, 390px, 320px in both themes,
Chromium/WebKit, layout order, safe data gating and language updates.

The responsive breakpoint is 1000px rather than 800px because the fixed
career sidebar consumes 180–210px before mobile collapse. At intermediate
viewport widths an inline three-column layout would otherwise shrink the
central match field to an unusable width. Browser QA includes 900px.

### Full-width club identity panels and inline facts

The match stage uses the full available main content width (no 1120px
max-width), preserving only existing page gutters. Both translucent side
panels expand vertically to the field's height and distribute eleven
reserved lineup rows across their space. Typography, crests and form
indicators are larger; the central pitch retains its 105:68 ratio.

The header of each panel shows the **official club name and actual crest**
for its verified home/away club ID. Name comes from
`clubs/_shared/manifest.json`; images come exclusively from the
existing allowlisted `clubCrestAssets().catalog` generated into the
match shell, then rendered by the shared `assets/club-crests.js`.
Unpublished crests retain the site's established fallback, not an invented
image. Logo and text slots are reserved at first paint. Unresolved teams
retain localized Home/Away headings until published.

**Position and Form are on the same horizontal row** within each panel,
including small screens, with their own labels above rank / five outcomes.
The lineup continues below. No matchday, clock or other boxes were added.
Browser and static QA check names, crest sources, responsive grid geometry,
full-content-width alignment, and absence of shifted elements.

## Home/Away form availability

The form row contains only the latest five verified prior-day results in this competition, in chronological order. Without any available prior result, the label and row stay hidden (also on first paint and when the published snapshot is unavailable), with Position centred across the panel. If one to four official outcomes exist, only those one to four cells are rendered; five outcomes render five cells. Home and Away are treated independently, with no placeholder results or fabricated fixtures. This remains responsive at every breakpoint.

## Side-panel club title navigation

The full club name in each Home/Away side panel is a text-sized link to the verified club's canonical `/clubs/<country>/<id>/overview` route (new tab, `noopener noreferrer`), consistent with the scoreboard abbreviation. Underlining appears only on hover or keyboard focus. Unknown or unresolved teams show plain, non-interactive text with no fabricated link or tooltip. The h2 heading, crest, stats, lineup and field geometry are unchanged.

## One centered Overview box with three rows (2026-11-16)

The 105:68 pitch and flanking Home/Away panels retain their dimensions. Exactly **one Overview box** is centered horizontally and vertically over the green field, narrower than the pitch (86% with max-width 560px on wide screens; 96% within the inner field on small screens). Its single semi-transparent themed 80%-opaque surface leaves the field visible underneath. No View selector, separate inner cards or Stats/Events view.

Three visually separated rows contain:
- **Competition** (clickable canonical Fixtures link), **Season**, **Round**.
- **Date**, **Stadium**.
- **Status** (localized verified match state).

The authoritative competition ID must match the same allowlist as the scoreboard emblem link. The Overview text link opens `/competitions/<id>/fixtures` in a new tab with `noopener noreferrer`; the text is underlined only on hover/keyboard focus. Before hydration no link is attached.

**Date** comes only from a valid ISO `kickoff` calendar date/time published by the match API. It is verified and formatted for the current locale; sporting day numbers are not converted to guessed dates. **Stadium** comes only from the authoritative `venue` name (string or `venue.name`). The backend currently returns `kickoff:null` and `venue:null`, so those values remain blank until the source publishes them. Invalid or unavailable values remain blank. All other fields retain existing validation.

The box reserves cell heights on first paint, retains three compact rows on small screens and does not change the pitch or club panel geometry. Supported languages: EN, IT, DE, ES, FR. Source and browser QA cover centering, hyperlink safety, available/missing match metadata, localization and first paint.

### Registered home stadium, scoreboard spacing and Overview typography (2026-11-16)

All 320 published club records include `stadiumName`. When a match's explicit `venue` is absent or invalid, use the verified home club's published stadium name for non-neutral matches. A valid explicit match venue takes precedence; neutral fixtures, unresolved home clubs and unavailable catalog data never inherit a guessed venue. The page already loads the club manifest, so no extra request is needed. `kickoff` remains blank unless the API publishes a valid date.

Reserve **8px** between the 48px ivory competition tile and the Home abbreviation via the Home grid cell's left padding, keeping the existing 4px right inset next to the score. Preserve scoreboard alignment, badge size, skeletons and responsiveness. The centered Overview heading increases from 13px to 18px (mobile 11px to 15px); fact labels 11px to 12px (mobile 9px to 10px); fact values up to 15px to up to 17px (mobile 10px to 12px). Browser QA covers typography, the badge-to-home gap, explicit venue precedence, scheduled home stadium, neutral stadium and unresolved home participants in Chromium/WebKit.

## Calendar-assigned stadium in public match APIs (proposed migration 0027; 2026-11-16)

When the initial/domestic/international league fixture draw is published, the server uses the official catalogue to assign each fixture's `stadium_name` from its known home club. The name is stored in the new nullable column of the **immutable** `season_match_slots` row, in the **same protected D1 batch** as the fixture slot/public numeric ID publication. No source fixture IDs, season draw payloads, scheduling algorithm, canonical calendar hashes, scores, or dates are changed by this additive materialized metadata. Future venue changes must not silently rewrite a published slot. New rows always have a valid stadium name; old records (created before migration) retain NULL and the match read falls back to the published canonical stadium catalogue without modifying their hashes or stored rows.

Both `GET /api/matches/<id>` and the indexed published competition match collection expose `venue:{name:string}` for known league fixtures. Calendar dates remain `kickoff:null` without an authoritative timestamp. Knockout fixtures cannot assign a home ground at initial calendar generation while participants are unknown: unresolved and neutral matches return `venue:null`; resolved non-neutral fixtures can report the verified home stadium. Neutral finals require a separately authoritative venue assignment and are never mislabeled as the nominal host's stadium. The frontend continues to prefer the API's venue, retaining the registry-only fallback for legacy API environments.

Migration `backend/migrations/0027_match_slot_stadium.sql` and server code are **not deployed or applied to remote D1** as part of this PR. Merge, deploy and remote database migration require separate owner authorization. Runtime and migration tests verify the atomic write, published API field, backwards compatibility, and immutability.

### Proposed symmetric scoreboard follow-up (not implemented)

To center both teams and the result as an indivisible unit, separate the competition's 48px ivory badge from the scoreboard's **five-column symmetric core**: `home name | home goals | separator | away goals | away name`. Use matching left/right name tracks, matching numeric tracks and equal central gaps, then center this five-column unit on the main content's exact axis. The badge becomes an absolutely positioned overlay to the left of the core instead of consuming a grid column and shifting the center. Keep the 8px badge-to-home-name clearance and text-only hover underline. This is a design proposal for owner review; no scoreboard geometry change was made here.
