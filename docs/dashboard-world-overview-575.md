# PAGE-DASH-01 (#575) — World-first Dashboard V1

**Owner-approved scope:** exactly three neutral sections at `/dashboard`, including for people without clubs. Separate Club/Agent role dashboards are future work.

## Layout
- **World Status:** season, sporting day / 56 and phase in one compact strip. Season 0, preparing, debug and unavailable remain source-honest.
- **Match Centre (primary):** Recent Results stacked *above* Upcoming Fixtures; up to four source-verified rows each, from a bounded official day window. Rows have two published club crests with neutral fallbacks, compact club names, competition context, day/verified score, and canonical numeric match links. All Matches link.
- **World Calendar (secondary):** next three planned world markers, with day and season/week deep link. Never confuse a planned calendar event with a completed match.
- Desktop is 1.8:1 Match Centre/Calendar, responsive one-column below 1100px. Mobile status wraps. Match list skeletons reserve two crest slots, name/competition and score/day; calendar skeletons reserve date and copy.

Explicitly excluded: Competition Spotlight, Top Players, league/club-specific tables, role actions, Following, economic widgets, world news or fabricated gameplay. The world view is general and uncluttered. World News can be a future module based on authoritative events.

## Existing contracts
Shared faWorldState only; no independent `/api/world` read. At most two previous and two current/future official days via public `GET /api/matches?season=N&day=D`; verify published receipts, IDs, scores, world generation/revision/phase. The bounded match preview is *not* a complete global results query. Preserve honest empty/partial/unpublished/stale/error, retry, BFCache, keyboard, EN/DE/ES/FR/IT, light/dark and iPhone Safari compatibility. Clear stale world counters on unavailable state.

Source `templates/dashboard-overview.html` → generated `dashboard/index.html`; controller `assets/dashboard-overview.mjs`; styles `assets/dashboard-overview.css`; tests `tests/app-home.test.mjs`. Final targeted/generated CI and manual device checks remain required.

PR #752 remains **Draft/HOLD**. No merge, deploy, manual workflow dispatch or remote DB writes approved.
