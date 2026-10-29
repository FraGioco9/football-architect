# Initial sporting calendars implementation plan

> Execute inline under superpowers:executing-plans; continuation explicitly authorized for #315/#326.

**Goal:** Generate and persist reproducible Season 1 initial league fixtures for all 18 competitions.
**Architecture:** Server-owned approved snapshot, pinned 56-day markers, deterministic versioned constructive generators, independently checked invariants, one protected atomic D1 command with existing authorization/revision/idempotency semantics.
**Tech Stack:** TypeScript, Workers, D1, Vitest, Node22 contracts.
**Spec:** `docs/admin-world-01-pr1-design.md`, issues #315 and #234 (current 56-day override).

## Constraints and review focus
No remote DB, deploy, merge, new PR, workflow dispatch, DEV imports or simulated results. Preserve original 20 checklist entries. Markers N01–N33 are canonical; N31–N33 require later sporting outcomes. Season 1 only; later qualification not invented. Validate membership, per-round exclusivity, pot/home/away balance, snapshot/seed binding, corrupt persistence, revocation at commit, duplicate and competing requests, rollback, and missing CSRF.

### Task 1 — source repair and sporting generators
- [x] Reproduce calendar_invalid; fix 32→33 national markers without changing canonical hash.
- [x] Add runtime tests for 3840 domestic +144 international fixtures, 30/6 rounds, correct days, each domestic pair twice with reverse venue, six unique non-domestic cup opponents and 1H/1A per pot, replay across many seeds, corrupt inputs and outputs.
- [x] Implement `buildInitialSchedule(snapshot, seed)` and `validateInitialSchedule(input, snapshot)` in `backend/src/initial-schedule.ts`; circle method for domestic, seeded country-cycle constructive INT-24 fallback.

### Task 2 — protected atomic persistence
- [x] Extract existing session/replay guards without changing prepare semantics; add `generateSeasonCalendar(db,session,command,key,now)` in `backend/src/calendar-command.ts`, loading and comparing the immutable D1 snapshot to server approval.
- [x] Authenticate `/api/admin/seasons/calendar`; accept concurrency metadata only, generate server seed, persist calendar and two seed/version/hash draw outcomes with world revision and sanitized audit in one guarded batch.
- [x] Test actual D1 concurrency/replay/rollback, stale generation/revision, corrupt snapshot, forged inputs and commit-time revocation; HTTP auth/CSRF cases.

### Task 3 — verification and checkpoint
- [ ] Run complete backend runtime/contracts/typecheck/migrations/operator checks, focused public isolation and generator parity; review diff, push one grouped update with lease through GitHub tools.
- [ ] Verify exact-head automatic CI; update existing #315 and #326 without credit for unsupported lifecycle/public integration. Leave Draft/HOLD.

Execution ledger: Tasks1–2 complete. Runtime63/63,contracts34/34,migrations9/9,typecheck PASS; operator10/10 PASS including real Wrangler restart with generated fixtures/draws. Node22 runtime/contracts/typecheck PASS.
Ruling: constructive seeded cycle fallback chosen under #234; a constrained valid draw family, not uniform sampling of every valid draw. No sporting rule changed.
Review: independent reviewer found no Critical/Important issue. Minor deferred: same-hashes/modified snapshot-json negative test; current guard independently reviewed.
