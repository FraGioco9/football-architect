# PAGE-DASH-01 (#575) — Compact World HQ

Owner-approved content simplification in Draft PR #752; retain the existing /dashboard route. **No merge or deploy authorized.**

## Layout
- Compact season/day/phase authoritative world-status bar with truthful Season 0, Debug, preparing and unavailable notes.
- Primary Match Centre: up to four verified upcoming fixtures and four recent results, including club names, their competition and day or completed score. These are bounded previews rather than exhaustive global results. Canonical numeric match links.
- Secondary calendar: next three planned markers with canonical season/week deep links. Planned never means played.
- Removed duplicate featured fixture, oversized pitch hero and progress, repeated next event, all-18-competitions catalogue, redundant toolbar, decorative kicker/subtitle, Guide/site footer.

## Data and QA
Keep shared faWorldState without a second world GET; up to two past and two current/future calendar-day requests, with published receipt/result and world generation/revision/phase checks. Preserve empty/partial/errors, retry, accessibility, localization EN/DE/ES/FR/IT, light/dark, first-paint geometry, responsive Safari and BFCache.
Source: templates/dashboard-overview.html, generated dashboard/index.html, assets/dashboard-overview.mjs and .css; tests/app-home.test.mjs. Verify generated synchronization and exact-head CI; manual QA outstanding.

PR #752 remains Draft/HOLD. No API/schema, remote D1, manual CI dispatch, deploy or merge.
