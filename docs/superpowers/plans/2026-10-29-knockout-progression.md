# Knockout progression implementation plan

> Execute inline under superpowers:executing-plans as the owner's authorized continuation.

**Goal:** Complete authoritative Season1 match processing through day56,including all domestic/international knockouts.
**Architecture:** Pure validated standings and rule-driven knockout resolver; immutable tie plans in D1; chronological receipt reconstruction and atomic extension of existing day executor.
**Tech Stack:** TypeScript,Workers,D1,Vitest,Node22; no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-29-knockout-progression.md

## Constraints / review focus
Preserve initial1–35 receipts,original rank/neutral venue,no away goals,all56-day event identities,rank-reference eligibility and frozen full-rule hashes. Reject incomplete league/first-leg evidence and corrupt/extra/replaced stored ties. Verify duplicate/competing phase-day commands and rollback of tie generation/scores/day. No public data/engine/player-stat or release-scope expansion.

### Task1 — standalone complete league standings
- [x] Write RED tests for domestic subgroup H2H reapplication over stronger global stats,seeded exact ties,INT opponent statistics/composite-ID ties,missing/duplicate/foreign evidence.
- [x] Implement backend/src/league-standings.ts; consume initial fixtures and saved score map; return ranked immutable metrics with deterministic tie keys.

### Task2 — pure knockout day resolver and persistence
- [x] Write RED tests for canonical brackets,original-rank return venues,semifinal upsets,domestic promotion final,neutral cup final,all4082 expected matches and incomplete dependencies.
- [x] Implement backend/src/knockout-progression.ts consuming pinned canonical rules and validated result history; output today's fixture/context pairs and newly ready immutable tie records.
- [x] Add migration0004_knockout_ties and real D1 migration invariants; extend simulator's neutral single-final context without changing existing output contexts.

### Task3 — atomic complete day flow
- [x] Update chronological receipt reconstruction and tie validation/commit guards in lifecycle-command.ts.
- [x] Adapt day36 stop test to a full1–56 run and add knockout-concurrency,late-failure/replaced-tie/missing-first-leg cases. Extend actual restart proof across first knockout.
- [x] Run full Node22 runtime/contracts/typecheck,migrations/operator/publication/generator checks; independent review and one RED→GREEN fix pass.
- [ ] One grouped existing-branch upload,exact-source automatic CI and #315/#326 acceptance reconciliation. No premature full lifecycle/closure credit.

Execution ledger: Tasks1–3 implemented and locally verified. Node22:85/85 Worker/D1 tests,34/34 contracts,typecheck,13/13 SQLite tests and10/10 operator/compilation/restart tests. Independent review found no Critical/Important defects;7 focused standings/progression checks and typecheck independently PASS under Node24. Minor deferred: an additional nonuniform INT24 opponent-statistic precedence scenario; equal-score metric calculations and full-season behavior already covered. No sporting rule change or extra owner decision.
