# #777 Phase B — contract-only cutover (Draft/HOLD)

Owner accepts discarding the 43 existing DEV V1 assignments. No fabricated backfill, no dual persistent relationship. Main at 3f260c3 already has 0040 (DEV verified, zero signed terms).

## First isolated slice
`effective-player-contracts.mjs` provides a shared read-only SQL relation for current signed contracts and next playable match day. It reads only valid effective intervals, current world generation and active career status. It intentionally ignores legacy links, historical match receipts, and private wages. No table/view, mutation, new clock or migration required. Season 0 and preparing day 0 show opening day-1 terms for inspection; actual wage accrual remains #778. Closed season retains last day for public inspection; next match projection is empty. The next-match coordinate differs from the current day because match planning is for day+1. Test on local disposable D1 uses real 0040, contradictory legacy links, free agent, retirement, transfer boundary and next-season expiry. CI evidence required.

## Public reader cutover — second slice
Public Players list/detail, market-value-ranked listing and complete club roster now join the same current-contract relation. Public payload shape and privacy are preserved, and reads reject world revision changes. Old mock expectations adjusted; real D1 test covers signed roster and disagreement with legacy data, while the valuation test confirms legacy rows no longer assign a club. This branch is intentionally incomplete until official match and Admin V1 are also converted, and the legacy table is dropped. Do not merge this intermediate state.

## Official match cutover — third slice
Match snapshots and batch guards now use the same next-match relation, including exact contract identity (same-club replacement invalidates a stale snapshot). Existing immutable receipts are never rewritten. Updated local tests to use real synthetic signed terms, including transfer/return, same-club term replacement, new signing/count race, post-result closure and day13 fixture. Old reset of a world containing signed terms now explicitly fails under 0040 instead of removing history; #788 owns a compatible replacement. Full evidence still pending.

## Known consumers and remaining cutover (same Draft PR)
- Public directory/detail including indexed market-value ranking: backend/src/public-players-read.ts.
- Unpaginated roster and roster stats: backend/src/public-club-roster-read.ts.
- Official match roster snapshot and atomic count/membership guards: backend/src/match-lineup-snapshot-v1.mjs. Use next-day relation consistently in snapshot and commit guards, preserve historical receipt hashes; include signed-contract identity in fresh guard if needed. Do not use current-day relation for next-day matches.
- Admin V1 read/write module backend/src/player-club-contracts.ts and protected /api/admin/contracts route. Replace editor with genuine read-only contract list until trusted signing/closure is ready. Retire assignment mutations; do not merely rename them as signing. Coordinate shared http-admin.ts and proxy with #799.
- Generated UI source tools/render-admin-contracts.mjs, assets/admin-contracts.js and admin/contracts/index.html, five locales, CSS/layout and tests. Keep canonical route, remove selection/assignment UI.
- Test fixtures and local tooling: backend/tests/fixtures/test-world.ts, player-club-contracts-runtime, public-player-detail-runtime, public-players-directory-runtime, public-club-roster-runtime, match lineup tests, tools/bench-public-players-532.py, Admin browser/QA. Preserve actual coverage, adapt fixture isolation to immutable signed rows instead of disabling production triggers.
- #799 Admin reset inspection must treat legacy table as temporary only; #797 opening planner integrates real signing; #796 Rewards independent. Audit all remaining source/test/maintenance references (repository code search returned no results despite known consumers; targeted fetches identified above; exhaustive audit still incomplete).

## Destructive migration gate
Do not edit 0022/0040. After consumer cutover, verify all live references, schema dependencies, reset behavior and historical receipts. New forward migration drops the three player_signed_affiliation_* guards and legacy player_club_affiliations table. No backfill and no contract deletion. Reserve migration number only after coordinating #799/#797/#796. Do not execute on DEV until merge and explicit migration authorization; backup Time Travel, confirm legacy counts, verify players/results/ledger unchanged. All unsigned active players then free agents. This first commit does not activate cutover, remove UI or delete storage. No deploy or generation.
