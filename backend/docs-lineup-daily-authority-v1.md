# #613 — Single-result-engine clean break

**Owner decision (2026-11-16):** `temporary-lineup-v1` replaces the old score-only authority for every played fixture. No dual-mode support, season pin, conversion of old scores or legacy fallback. This is still a **Draft/HOLD PR**; nothing here authorizes remote D1 changes, merge or deployment.

## Implemented in PR #642

- One deterministic 4-3-3 auto-XI for 11+ distinct eligible real affiliates, using canonical positional suitability. A side with 0–10 players uses a neutral team fallback (strength 61), without invented players, appearances or scorers. Mixed and dual fallback matches use the **same** scorer.
- Frozen per-match receipts record XI identities and attributes, result, goals, 90/120-minute appearances and regulation/ET/PK separation. Verified past scores are never regenerated from current contracts. No modeled assists, cards, shots or possession.
- One immutable daily evidence chain in `season_lineup_day_outcomes` and per-match `match_lineup_result_receipts` (migrations 0028/0029). Real due fixtures, scores, knockout plans, day/world transitions and audit are committed together under protected Admin guards.
- HTTP switch in branch commit `4b40466`: `http-admin.ts` routes explicit milestone/calendar publication, sporting advance, archive and close to the V2 commands. `index.ts` routes public Match Detail, competition/standings, Calendar, club Fixtures/History and published match lists to verified frozen V2 readers. Direct old calendar/start HTTP commands return 410; there is **no legacy reader fallback**.
- Season 2 qualification/prepare authority reads the frozen V2 archived season. World reset is a guarded, atomic operation that can clear current-generation V2 receipts only with a single-batch permit (migration 0030); generated players and current club affiliations survive. The owner already performed Reset Season 0 in their environment; **do not repeat it**.
- Focused Worker D1 integration tests cover day 13 with real-XI, mixed and fallback fixtures; 56 sporting days, 4,082 match receipts and 54 knockout ties; archive/close, replay, rollback, no future leakage and isolated world reset. At prior head `8126b7e`, 64 Worker files / 344 tests and all relevant CI workflows passed. Later HTTP cutover commits used `[skip ci]` and **have not yet been CI validated at exact HEAD**.

## Remaining before closure

1. **Audit single-authority reachability:** confirm no live/Admin/public endpoint imports the score-only scorer or old history adapters; remove dead imports/branches and reconcile any stale UI/source text. Old modules/tables may be removed only when no supported workflows depend on them; do not create compatibility paths.
2. **Exact-head QA:** TypeScript, migration and import checks; Worker D1 HTTP dispatch regression (retired routes, published vs finalized Match Detail, player totals, empty/upcoming fixtures, knockout ET/PK), 56-day replay and reset preserving players/contracts; Site/Browser/FULL at the final SHA.
3. **Review product boundaries:** competition and player statistics must match the frozen receipts; distinguish absent V1 metrics from measured zeros. Any additional Player Detail Stats (#578) screen work must be tracked separately from this core authority.
4. **Owner-gated activation:** review PR diff + test evidence; obtain separate permission for merge, remote migrations and deployment. No second Reset Season 0 unless specifically authorized.

**Branch is wired; production/main remain unchanged.** This document records implementation state, not proof of exact-head CI success or authorization to operate on remote data.
