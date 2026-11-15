# #577 — Scoreboard-first Match Detail

This is the first independent piece of the rebuilt Match Detail UI. The page currently
shows **only** the scoreboard, without placeholder Overview / Lineups / Statistics tabs.

## Layout

A stable first-paint scoreboard reserves space for competition identity, future approved
competition logo, home/away crests and names, official result/status and optional verified
extra-time/penalty result. Desktop uses three columns; smaller displays show approved
compact club names, with no page-width overflow. Club/competition identity links are
created only from known manifest/official match identities.

## Per-competition themes

Edit the explicit entry for one of the 18 competitions in
`assets/match-scoreboard-themes.mjs`:

- `surface` chooses the approved `primaryHex` or `secondaryHex` background.
- `ink` chooses an approved contrast-safe foreground (default `ivoryHex`).
- `accent` chooses an approved secondary/ivory accent.
- `logoAsset` is `null` until an **approved**, public SVG exists at
  `assets/competitions/{competition-id-lowercase}/logo.svg`. The runtime
  never invents a logo, downloads third-party branding or displays a fake icon.

At runtime, all chosen values resolve to the **same competition's existing
approved manifest HEX values**; a minimum 4.5:1 text contrast is required.
Unknown competition IDs, corrupted colour fields and the two international
cups (which currently have no approved palette/logo values) fall back to
the site's already-used Graphite/Ivory neutrals `#243039` and `#F5F1E8`.
No hard-coded new competition colours are introduced. The logo placeholder
is intentionally empty until real assets are supplied and approved.

## Data boundaries

The match is loaded from `GET /api/matches/:positiveNumericId`; no fake
kickoff, score, live event or lineup can be created. A score appears only
for a validated completed result. The `lineups_confirmed` label is derived
only when **both** official confirmed XI exist, not from a clock or guess.
Theming is presentation-only and never affects the official backend.

## QA / release

Use `node --test tests/match-detail.test.mjs`, site generator checks,
publication guard, browser QA and full exact-head CI. PR #614 stays Draft/HOLD:
no merge, preview deploy or remote DB work is included in this step.
