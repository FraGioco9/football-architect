# PAGE-DASH-01 (#575) — Dashboard World HQ, Football Manager-inspired rebuild

**Status:** Owner explicitly requested a from-scratch redesign inspired by Football Manager, following the initial approved MVP in Draft PR #752. This is a visual and layout transformation on the same /dashboard route, not a grant of additional sporting capabilities, merge or deploy.

## Information architecture
A management-game command centre, not generic equal-sized cards: editorial title with fast Calendar/Matches access, dense authoritative world-status strip, a dominant tonal-green sporting day hero with calendar position, a World agenda rail, a Match Centre with featured verified next fixture and compact scoreboards, and a 16-division + 2-cup navigator.
The subtle pitch geometry is original CSS, not a copied Football Manager screenshot or game asset. The current Football Architect navigation shell, first-paint geometry, light/dark themes and five languages remain. No fictitious manager, press news, standings, scorers, player stats or playable Continue action.

## Data authority
- Reuse canonical shared faWorldState; do not duplicate /api/world GET or mutate simulation.
- Read at most two preceding and two current/future official calendar days from public no-store GET /api/matches?season=N&day=D: narrow preview samples, not exhaustive history.
- Require exact world generation/revision/phase and selected season/day; reject invalid and duplicate IDs and unverified scores. Scores only for completed matches with a result, featured fixture only for published scheduled matches with resolved clubs.
- World calendar model provides planned future markers only, not evidence of played games. Progress measures position in the 56-day planned calendar, not matches played.
- Season 0, preparing day 0, closed, unavailable, Debug and partial/unpublished/failed API states stay explicit. Competition list is a catalogue; not a claim that all 18 are active.
- Canonical deep links: /matches/<numeric ID>, /calendar?season=N&calendarView=week&week=W, /competitions/<slug>/standings, /guide.

## Ownership & QA
templates/dashboard-overview.html is the authored Dashboard; tools/generate-app-pages.mjs produces dashboard/index.html. Dedicated assets/dashboard-overview.mjs and .css are explicitly allowlisted by the fail-closed tools/publication-guard.mjs. No new endpoint or DB schema.
Targeted: node tools/generate-app-pages.mjs --check; node --test tests/app-home.test.mjs; node --test tests/a04-provider-baseline-evidence.test.mjs. Then exact-head Site, Browser, Admin and FULL.
Manual: Chrome desktop and iPhone Safari narrow/tablet; EN/IT/DE/ES/FR, light/dark, keyboard focus and screenreader, Season 0/day0/day1/day56, incomplete/unavailable/stale API, retry, Back/Forward/BFCache and source change. Do not claim unexecuted QA.

Keep PR Draft/HOLD. No merge, deploy, remote DB or manual workflow dispatch.
