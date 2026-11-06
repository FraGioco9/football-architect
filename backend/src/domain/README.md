# Backend source ownership — BE-01

> **Historical/specialist record — REPO-04 #358, 2026-11-06.** BE-01's restructuring plan is historical; after #357 zero modules were deleted and after #370 only private identifiers changed, not file paths. Use the [living architecture](../../../docs/architecture/overview.md) for current ownership and approved behavior. Frozen source names, immutable identities and migration receipts below remain intentionally preserved.


This is the canonical **directory-level ownership map** for the scoped restructuring in PR #364. It describes actual code boundaries, not authorization to alter sporting outcomes, production security or the D1 database.

| Location | Responsibility | Boundary |
| --- | --- | --- |
| `src/index.ts` | Configured Cloudflare Worker fetch entrypoint and public API dispatch | **KEEP path**: Worker configuration and tests reference this entrypoint |
| `src/http-admin.ts`, `src/http-player.ts` | Admin and Player route adapters | **KEEP**: HTTP contracts and auth belong to #349 and #352 |
| `src/domain/calendar/admin-calendar-policy.ts` | Pure milestone schedule/validation and day-56 order | No persistence, HTTP, dispatch or side effects |
| `src/domain/calendar/admin-calendar-execution-policy.ts` | Pure fail-closed due-event planning | No actual artifact execution or writes |
| `src/domain/lifecycle/lifecycle-policy.ts` | Pure season phase/revision proposal | **Not** a substitute for D1 CAS and audit guards |
| `src/domain/qualification/*.ts` | Pure next-season membership, trophy holders and qualification proposals, INT24 pots | Read-only evidence and deterministic proposals; **never approval** |
| `src/admin-calendar-advance-plan.ts` and `src/*-command.ts` | Command orchestration, revision checks, idempotency, D1 batches | **KEEP** outside pure domain folders, including all audit/source guards |
| `src/database.ts`, `src/world-repository.ts`, `src/season-*-read.ts` | D1 access, stored data, read models | **KEEP** for separate database issue #350 |
| `src/player-*.ts`, `src/auth.ts`, `src/session-*.ts`, `src/environment-pool.ts` | Identity, authorization and environment authority | **KEEP** for #352; do not reorganize away security boundaries |
| `src/initial-*.ts`, `src/knockout-progression.ts`, `src/catalogue-snapshot.ts` | Sporting generation, progression and canonical snapshots | **KEEP** for shared rules/lifecycle issues #351/#353 |

## Dependency direction

Consumers import the new domain modules; domain modules import only stable data types, canonical validation/hashing or pure progression utilities. No domain module imports Worker request handlers, D1 command executors or active sessions. Persistent receipts and authority checks remain in the existing commands.

## Explicit migration inventory

**Batch 1 (commit `435d14bc`):** four qualification files were moved and their source/test consumers repointed.

**Batch 2:** two calendar policy modules, one lifecycle policy module and `next-season-membership.ts` were moved; all known direct source/test imports were repointed. No export name, API route, SQL, data file, test filename or algorithms were changed. Existing legacy import locations were removed; deliberate compatibility re-export wrappers are *not* introduced for private TypeScript paths.

## Validation gate

Run from a full repository checkout against the exact branch HEAD:

```powershell
npm --prefix backend ci
npm --prefix backend run typecheck
npm --prefix backend run test:contracts
npm --prefix backend run test -- tests/admin-calendar-command-runtime.test.ts tests/admin-end-season-transition-runtime.test.ts tests/season-two-activation-runtime.test.ts tests/season-two-authority-runtime.test.ts tests/season-two-persistence-runtime.test.ts tests/season-aware-engine-runtime.test.ts
```

The broad `test:contracts` command discovers `node:test` files by their original filenames, unchanged by this migration. The focused runtime cases verify real Worker/D1 interaction where available. **No PASS may be claimed before execution.** A migration-only diff and static import-target audit are useful but do not replace typecheck and runtime tests.

## Pending BE-01 inventory

A final full dependency graph should include dynamic script imports, test-only entrypoints and root tooling references. The directory map deliberately leaves side-effectful modules in `src/`; moving them without full consumer evidence risks obscuring trust and transaction boundaries and is not a condition of making every source directory nested. Once the scoped policy boundaries are validated, remaining directories can be left intentionally flat and documented rather than relocated merely for aesthetics.
