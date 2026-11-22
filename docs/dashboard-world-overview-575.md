# PAGE-DASH-01 (#575) — World Overview MVP

Implementation authorization: owner "Procedi" after the 2026-11-22 source audit (issue comment 7072224161).

## Ownership and scope
The existing \`/dashboard\` replaces its introductory panels with World status, recent verified results, upcoming published fixtures, competition entry points and planned World events. No \`/world\` route, sidebar item, API schema, database modification or gameplay change. \`templates/dashboard-overview.html\` is a Dashboard-only generator fragment; \`tools/generate-app-pages.mjs\` installs it into the original static shell, producing \`dashboard/index.html\`. Existing /calendar, /settings and other route renderings stay unchanged.

## Authoritative sources
- The shared shell's \`faWorldState\` provides one verified public \`/api/world\` read; Dashboard **never** performs another world GET.
- \`GET /api/matches?season=N&day=D\` is anonymous, no-store and public; World generation/revision/phase and selected season/day are checked before acceptance. Match IDs must be numeric and unique. Display completed scores only when \`status=completed\` and a result is present; future entries require published fixtures with known clubs.
- \`world-calendar-model.createSeason()\` supplies *planned* world event markers, not result or lifecycle authority. At most two preceding and two current/future official days are checked (at most four match GETs); summaries do not claim exhaustive world history.
- The static competition links are navigational catalogue links (16 domestic + two cups), **not** a claim that a competition is currently active.
- DEV/Debug projection is labeled Debug and cannot be mistaken for verified public match outcomes.

## States and QA
First HTML response includes all fixed-size panels, clock placeholders and three match/event rows; hydration changes text/rows without a blank initial page. The world read handles unstarted Season 0, preparing day 0, active/closed season and unavailable status. Match requests fail closed for stale/409/invalid shape and invalidate the shared world; partial/unpublished/error states never masquerade as empty actual results. Source changes, reset and BFCache cancel older requests. Links use \`/matches/<numeric id>\`, \`/calendar?season=N&calendarView=week&week=W\` and existing competitions/Guide routes. Language updates cover EN/DE/ES/FR/IT.

Targeted: \`node tools/generate-app-pages.mjs --check\` and \`node --test tests/app-home.test.mjs\`. Manual: desktop Chrome + iPhone Safari / WebKit at 375px, 768px and desktop, keyboard focus/SR, light/dark, locale switching, Season 0, day 0, days 13/56, published/partial/unavailable, stale response and Back/Forward/BFCache. Do not claim manual or FULL checks passed without executed evidence.

Draft/HOLD; no merge, deploy, remote DB or workflow dispatch authorized.
