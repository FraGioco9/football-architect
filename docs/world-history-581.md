# #581 — World History MVP (Draft/HOLD)

## Approved scope
The canonical page `/history` appears as a **primary History item in the World sidebar**, with an 18 px archive icon and the same active/hover/focus styles as Competitions. It is an archive index, not a new competition or standalone game mode. Filters use the shared Clubs/Competitions accessible combobox (`language-control`, `language-menu`, `faBindCompetitionMenu`), including keyboard handling, focus restoration, viewport placement, five languages and responsive grid. Filters: completed Season, champion's Country, and Competition; country matches the champion's nationality for international cup winners. Filter choices live in URL `?season=N&country=IT&competition=IT-1`, are normalized, and support reload and Back/Forward. The page links to existing canonical club and competition History pages. Five locale strings (EN default, DE/ES/FR/IT), dark/light CSS tokens, keyboard-native selects, and a static skeleton preserve usability.

## Anonymous public API
`GET /api/world/history` (no query parameters, no cookies needed, no writes) returns a small, allowlisted archive projection. It uses the same public Worker/pool gate as `/api/world`. Payload:
- `schemaVersion: 1`, `providerId: "authoritative-world-history"`, `status: "empty"|"available"`.
- `world: {seasonNumber,phase}` only for truthful unstarted/current status; selected UI filters do not advance world time.
- `provenance: {kind:"authoritative",source:"closed-season-archive"}`.
- `seasons: [{seasonNumber,champions:[{competitionId,championClubId}]}]`, newest first; exactly 16 domestic champion slots and 2 INT24 winner slots per closed season.

The backend only reads immutable archive summaries through `readClosedSeasonHistory`, which validates stored summary hash, immutable archive generation/hash, independent close receipt and world revision. It additionally validates competition coverage, distinct club identities, valid country/competition and schema before projecting. Never leak archive `summary_json` (including qualification candidates/holder proposals/player internals), inspect remote D1 while auditing, or infer a champion from active standings. A sealed archive at active day 56 is **not** completed. Errors (or missing/invalid evidence) fail closed with `history_unavailable` (503); a world race returns `stale_world` (409). Season 0 returns an honest empty archive, not fictional DEV preview seasons.

No schema change or remote D1 operation is required. Local identity display is loaded from the existing public `/clubs/_shared/identity.json`; missing identities degrade to valid club IDs, not invented names.

## QA checklist (not yet asserted as PASS)
- Backend: valid archived/closed seasons, missing close receipt, altered archive/summary hash, wrong generation/revision, duplicate or missing competition rows, tampered champion, active day-56 not closed, unstarted world.
- Frontend: first-paint geometry, empty/loading/error/retry, all three filters and query normalization, Ctrl+R and Back/Forward, canonical cross-links, locale switch, dark/light, keyboard/screen reader, 320/390/768/1440 desktop/mobile and manual iPhone Safari.
- Scoped commands: `node --test tests/world-history-page.test.mjs tests/routes-compatibility.test.mjs tests/app-canonical-routes.test.mjs`, `node tools/generate-app-pages.mjs --check`, `npm --prefix backend run typecheck`, `npm --prefix backend run test:contracts` plus runtime tests and exact-head PR checks.
- PR remains Draft/HOLD, no merge, deploy, workflow dispatch, DB writes or publication.

## Design boundaries
The History page does not display final tables, ranking stats, player records, player MVPs, podiums, relegation/promotion or all-time aggregates. Those remain on existing verified competition/club History pages or require separate evidence and owner review. A single public GET avoids querying each competition; no extra D1 schema is added. For shared generated markup the new page is derived by `tools/generate-app-pages.mjs` from the just-generated Competitions shell and a dedicated source renderer; checked-in `history/index.html` is an output artifact, not a hand-edited source.
