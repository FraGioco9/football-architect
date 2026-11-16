# #613 — Single V2 lineup-aware match authority

`temporary-lineup-v1` replaces score-only simulation for **all officially finalized fixtures**. This is a clean break: no dual-mode reader, historical score migration, scoring-version selection, or legacy scoring fallback. The implementation is tracked in [Draft/HOLD PR #642](https://github.com/FraGioco9/football-architect/pull/642).

## Match input and frozen results

- Use a deterministic 4-3-3 XI of **11 real eligible affiliated players** when available. Select players by canonical position suitability; use a neutral team-level strength of 61 when one side has fewer than 11. A mixed XI/fallback match uses one engine; fallback sides never invent player IDs, appearances or scorers.
- Record goals, real XI player appearances/starts/minutes, goal scorers, regulation and extra-time events and penalties in immutable match receipts. Penalty shootouts do not count toward goals. Do not manufacture assists, shots, cards, possession or other unavailable metrics.
- A verified completed result is read from its frozen receipt, **never recomputed** from the current roster, attributes or match-day seed. Future and unplayed fixtures have no simulated results or player events.
- Store match receipts in `match_lineup_result_receipts` and immutable daily outcomes in `season_lineup_day_outcomes` (migrations **0028–0029**). Keep sporting, knockout and world-day advancement atomic and protected by Admin authorization and source guards.

## Official HTTP and season flow

- `backend/src/http-admin.ts` routes sporting progression, Admin event/calendar operations, archive and close to V2 commands; direct retired calendar/start endpoints respond with HTTP 410.
- `backend/src/index.ts` serves public Match Detail, competition and standings, World Calendar, Club Fixtures and Club History through verified V2 evidence.
- Season 2 approvals, archived qualifications and historical views depend on frozen V2 outcome/knockout proofs. Do not reconstruct old results or bypass official source checks.

## Reset semantics

- **Reset Season 0 is a separate authenticated and explicitly confirmed destructive operation**, not part of normal match progression or deployment. It uses a short-lived current-generation permit within an atomic batch (migration **0030**) to delete that generation's immutable V2 match receipts and day outcomes. Ordinary updates and deletes remain forbidden.
- **Stable public numeric match IDs survive reset; finalized match/day receipts do not.** Generated players, committed generator batches and current player-club affiliations/contracts survive. This distinction is intentional.
- The owner has already performed Reset Season 0; **do not repeat it** without new explicit authorization.

## Review and release boundary

- Core Worker D1 tests cover real-XI, fallback and mixed teams, 56 sporting days, knockout ET/PK, archive/close, Season 2, replay, future-result protection, and guarded reset. The official current-head CI evidence is maintained in PR #642, **not pinned in this source document**.
- Verify Site, Admin, Browser and FULL CI on the **exact final branch HEAD**. Check public/Admin HTTP contracts, production-disabled behaviors, and manual mobile/desktop behavior before release. Automated WebKit emulation does not imply a physical iPhone Safari test was completed.
- Competition player-statistics UI is deferred to [#643](https://github.com/FraGioco9/football-architect/issues/643); Player Detail Stats remains tracked by [#578](https://github.com/FraGioco9/football-architect/issues/578). Neither changes frozen recorded match results.
- Keep PR **Draft/HOLD** until separate owner review/approval. **No automatic merge, remote D1 migration, remote data mutation, reset, or deployment.** Sequence any authorized rollout deliberately: reviewed migrations, compatible application deployment, then authorized functional QA.
