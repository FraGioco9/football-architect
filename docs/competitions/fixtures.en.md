# Competition Fixtures — first implementation

Issue: #147. Scope: the existing Fixtures tab in all 16 competition detail pages.

## Display decisions for review

- One round at a time, with a top-centered Matchday button and previous/next
  buttons. The Matchday button opens a vertical, scrollable list of 30 options using
  the same language-control, language-trigger, language-menu and language-option
  styling as Settings. Season uses the same custom combobox, without a native
  select. Both share keyboard/pointer behavior: Up/Down, Home/End, Enter/Space,
  Escape, Tab and outside-click dismissal, with active-descendant focus. No repeated Fixtures heading.
  The round/match-count announcement is available only to assistive technology.
  On the first Fixtures visit without an explicit round, use the supplied current
  matchday; fall back to round 1 when unavailable. Later data updates preserve the
  consulted round. Explicit Fixtures URLs restore their selected round.
- Eight matches per round; home club, score when played and away club. Show
  Full time above completed scores, otherwise supplied date/time or Date TBD.
  Show the canonical home stadium below. Goals and separator occupy three fixed
  columns, preserving alignment across single- and double-digit scores. On narrow screens home/away clubs stack beside the
  score, preserving readable space for long names without truncation.
- Dropdown menus match their trigger width. Season uses a compact 88px control;
  previous/next use site-style SVG chevrons and have no disabled hover effect.
- A shared season selector applies to all six competition views. No match-detail
  action is included.
- Dates and times remain unknown unless supplied. Supplied ISO timestamps must
  carry a time-zone offset; they are displayed in the browser's local time.
  This does not choose world-clock, kickoff or seasonal scheduling rules.
- Public pages contain an empty state with hidden navigation until a complete
  schedule is supplied. There are no fabricated official matches or results.

## URL and season context

Competition catalogue links open Standings in the latest available season.
Public data currently supplies provisional season 1; the isolated DEV preview
also supplies season 2. Canonical detail URLs have no trailing slash:
`/app/competitions/it-1?season=1&view=fixtures&matchday=12`.
The six supported views are `standings`, `fixtures`, `stats`, `history`, `rules`
and `awards`. Only Fixtures carries `matchday` (1–30). Switching tabs preserves
that selection in the current document. Direct links, refresh, Back and Forward
restore the selected view/round. Default or malformed values normalize with
`replaceState`; user navigation adds a history entry only when the URL changes.

Season `1` is a provisional display context for the existing data, not a newly
approved sporting season, calendar year or historical dataset. Other valid numeric
season IDs without supplied data retain their URL but show "Season unavailable" and hide every data
panel. Selecting season 1 restores the requested view. No unavailable season
silently falls back to season 1 results. Real season metadata and history remain
unconnected.

The generated detail pages have a fixed same-origin base URL so assets/links work
with or without the directory slash. A small head bootstrap hides another
view/season before the shared runtime binds URL state. The same head URL state
also controls the active tab colors immediately; a synchronous post-tab bootstrap
sets the selected ARIA state and tab stop before the external runtime loads.
Direct load and refresh are checked frame by frame under delayed runtime loading
for every non-Standings view in both themes. The DEV server accepts
canonical URLs without broadening its host, network or file allowlists.
`vercel.json` contains only competition-specific redirects and rewrites. The
publication guard validates its exact structure; the manual Preview workflow
checks that same structure before credentials are available. No workflow is run
and no deployment is performed by this implementation.

## Data and existing debug settings

The renderer validates a complete schedule: 240 games, 30 rounds, eight matches
per round, each active club once per round, and every directed home/away pairing
once. Scores are nonnegative safe integers in pairs or both null. Kickoff values
are valid explicit-zone ISO timestamps or null. Invalid input is rejected before
any current view is replaced. This feature displays supplied data and does not
implement a public fixture generator or match engine.

The existing DEV **Fictional standings** switch, **0–30 matchdays** slider,
**Reset current page**, **Reset all** and sessionStorage preferences apply to
Fixtures too. There is no additional debug panel, switch or persistence key.
The existing deterministic DEV model supplies both views; future scores are
removed. DEV seasons share pairings while completed scores vary with the seed. No fictional-preview notice is displayed in Fixtures.
On navigation/refresh with DEV already ON, a DEV-only head bootstrap keeps the
standings and Fixtures regions pending until the session model commits, so the
first visible values are the saved DEV values. Header/logo rendering is unaffected.
Public HTML is unchanged. Errors and a bounded fallback release pending content.
Turning the switch OFF or resetting restores both views. Preview data and its
generator remain excluded from publication.

## Implementation and verification

- [x] Generate accessible, localized Fixtures controls in the shared page generator.
- [x] Add a display-only runtime with validation, round navigation and rollback snapshots.
- [x] Connect the existing DEV controls to the same result model as standings.
- [x] Verify all 16 routes, 30 rounds, unknown/zero scores, invalid data, themes,
  five languages, 1440/390/320 widths, session restoration and both resets.
- [x] Owner manual PC/iPhone Safari QA, including the final score alignment and
  mobile readability refinements.

The existing competition tabs, standings, inline Compact division logos, club
identities, flags and branding remain in scope only for regression checks.
No deploy, database change or manual workflow is part of this implementation.


## Returning to the current matchday

The **Current matchday** button appears at the right of the round picker on the same row only when
a current round is explicitly supplied and differs from the selected round. It
updates the URL and returns keyboard focus to the picker. Desktop keeps the picker centered; narrow screens use an accessible icon shortcut and fit both controls on one row. Unknown public current
rounds do not produce a button. DEV supplies the next unplayed round (completed
matchdays + 1), capped at round 30 when the preview season is complete. Changing
the DEV slider updates this target without moving the round being consulted;
OFF/reset removes the target, and rollback restores it with the schedule.

The `matchday` parameter appears only in Fixtures URLs. Switching tabs within the
loaded page retains the selected round in memory. Refreshing another tab uses the supplied current round on the first Fixtures visit; direct Fixtures links and Back/Forward
restore their URL round. No additional persistence key is introduced.
