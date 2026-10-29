# Temporary automatic simulation implementation plan

> Execute inline with superpowers:executing-plans under the owner's continuation request.

**Goal:** Finalize temporary match results automatically when the protected authoritative world advances.
**Architecture:** Versioned deterministic pure score policy, immutable daily D1 receipts, validated server-owned sporting evidence and atomic start/advance commands.
**Tech Stack:** TypeScript,Workers,D1,Vitest,Node22; no new runtime dependency.
**Spec:** docs/superpowers/specs/2026-10-29-temporary-simulation.md

## Constraints / review focus
Preserve current scores on read/replay; no DEV input or player-stat fabrication; exact approved56-day/INT24 rules; no source-auth weakening,remote D1/deploy/merge/new PR/manual workflow. Fail closed on an unimplemented sporting activity,corrupt evidence,partial receipts,revoked session or stale world. Runtime tests must verify rollbacks,competing advances,extra-time/aggregate handling and finality.

### Task1 — pure simulator and immutable receipt migration
- [x] Write/run failing pure runtime tests: deterministic regulation scores,single-knockout and second-leg resolution,no away-goal rule,seed/identity/context drift,invalid context and input; verify stable fields/version.
- [x] Implement backend/src/temporary-simulation.ts with integer SHA-derived scoring and separate extra-time/penalty fields; record provisional distribution in code/docs.
- [x] Create backend/migrations/0003_day_outcomes.sql and real D1 constraint/immutability/rollback tests.

### Task2 — protected initial lifecycle slice
- [x] Add backend/src/season-sporting-evidence.ts to reconstruct/validate approved D1 snapshot,calendar and two draw payloads. Extract pure draw payload builder only if needed.
- [x] Add failing runtime tests for start/advance to day16 (152 simultaneous games),pause receipts,idempotency,concurrency,failed audit rollback,corrupt snapshot/calendar/draw/receipt,auth/CSRF,commit-time revocation and fail-closed day36.
- [x] Implement backend/src/lifecycle-command.ts and protected start/advance routes; use actual D1-derived evidence,atomic receipt/world/audit writes and existing replay guards.
- [x] Extend actual Wrangler restart proof to include finalized scores and replayed advance.

### Task3 — review and acceptance
- [x] Run Node22 backend runtime/contracts/typecheck,migration/operator/restart,focused publication and generator checks; independent reviewer; one fixes pass with RED→GREEN as needed.
- [ ] Upload one grouped existing-branch update with expected-SHA lease; verify automatic exact-head CI and reconcile #315/#326 without premature whole-lifecycle credit.

Execution ledger: Tasks1–2 implemented. Independent review raised a missing receipt source-binding guard and infeasible shootout6–4. Both regressions reproduced RED; code fixes now checked by whole suite. Ruling: treat impossible penalty outcomes as requiring correction even though integration currently supports league fixtures only; otherwise later knockout integration would inherit invalid outcomes. No deferred review findings remain.

Final local evidence:76/76 actual Worker/D1 tests,34/34 contracts,typecheck,11/11 SQLite migration tests and10/10 operator/actual Wrangler restart tests PASS. Review-fix tests specifically prove source-binding replacement rollback and feasible shootout terminal scores. No implementation credit for the whole lifecycle/day processing requirement while result-dependent knockout integration remains open.
