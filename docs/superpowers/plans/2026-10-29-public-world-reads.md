# Authoritative public sporting reads

Goal: provide the server-side source needed by the open #315 public-page integration requirement. Preserve the existing protected admin and DEV boundaries.

Architecture: anonymous read-only `GET /api/competitions/<id>/seasons/<n>`; exact viewed season, explicit empty/unavailable states, generation/revision-bound snapshot, persisted fixture/result whitelist, league-only tables under approved rules, score-derived team statistics and closed-season archive. No player data, fallback into DEV or verified-history relabeling.

- [x] Author D1 cases for anonymous preparing/active/closed/reset reads, method/identity validation, score totals, final table parity, tampered/missing receipts and concurrent world change. Author partial table cases before changing ranking.
- [x] Extend the existing league table calculator with explicit through-day coverage while retaining its strict full-season default and complete fixture-membership checks. Never replace missing past results with zero scores.
- [x] Read and independently validate snapshot/calendar/draw/day/tie/archive evidence; expose only persisted scores after validation. Recheck generation/revision before return. Add the anonymous endpoint without changing admin authorization or deployment topology.
- [x] Document incomplete UI wiring and verification limits; inspect syntax/types/diff. Test execution and CI updates stay at the owner's final gate.

Review focus: viewed season must not follow current season implicitly; unpublished stages stay private; no player statistics invented; future/invalid seasons never map to Season1; knockout scores stay out of league tables; partial tables require every elapsed fixture result; reset/concurrent advances must not mix revisions; archive availability must require a validated closure receipt.

Progress remains 17/22 (77.3%) until all public consumers are connected. No merge/deploy/remote D1 or manually run tests/CI.

Independent source/migration review: no important defects found. TypeScript inspection: only the9pre-existing diagnostics in unchanged source/tests; no test execution. Backend/UI boundary remains explicit in operations documentation.
