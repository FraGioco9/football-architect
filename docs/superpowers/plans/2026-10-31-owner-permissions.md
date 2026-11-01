# Trusted Admin Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a local owner grant/revoke command with explicit account-pool boundaries.
**Architecture:** Tool-only core uses existing D1 batch/abort guards. A local CLI handles confirmation; immutable pool metadata and permission-change audit are additive migration 0017. No HTTP or remote adapter.
**Tech Stack:** TypeScript, Node 22, existing Miniflare/D1 and SQLite migrations.
**Spec:** docs/superpowers/specs/2026-10-31-owner-permissions-design.md

## Global Constraints
- Dev/Preview map to dev-preview; Production independent.
- No remote D1, real mail, DNS, deployment, merge or real account promotion.
- Existing sporting audit, account authorization and atomic world guards remain intact.
- Runtime sharing remains deferred; metadata is a guard, not a shared service.

## Review Focus
- Wrong pool, unknown environment and renamed/disabled accounts fail closed.
- Existing legacy identities need explicit selection, never email-only linking.
- Mutation races and late audit failure roll back grants, principals and session deletion.
- Revocation works after identity drift without deleting historic audit.
- Inspect/dry-run cannot migrate persistence, grant permissions or create accounts.

### Task 1: Atomic tool and pool metadata
Files: backend/migrations/0017_owner_permissions.sql; backend/tools/owner-permissions.mts; backend/tests/owner-permissions-local.test.mts.
Interfaces: accountPool(environment), initializeAccountPool(db,environment,now), inspectAdminPermissions(db,environment,email), changeAdminPermissions(db,{action,environment,email,expectedAccountId,legacyId?},now).
- [x] Add real disposable-D1 tests for bootstrap, explicit legacy mapping, wrong pool, unverified targets, revocation, concurrent identity changes and late audit failure; observe RED.
- [x] Implement guarded atomic changes and append-only receipts; observe GREEN.

### Task 2: Local CLI and verification
Files: backend/tools/admin-permissions.mts; backend/tools/operator-local.mts; backend/package.json; backend/docs-owner-permissions.md; local test above.
Interfaces: parsePermissionArguments(argv) and runPermissionCommand(argv,io), with default local path, dry-run and explicit confirmation.
- [x] Test argument rejection, no initialization on status/dry-run, apply confirmation and separate target databases; observe RED then GREEN.
- [x] Wire command and operator tests, document Windows use and local-only limitation.
- [x] Run targeted tests, migrations/typecheck, fresh review, then one final exact-head CI push on PR #329. Keep 13/15 until actual acceptance criteria are met.

## Execution decision
Inline execution is authorized by the owner's request to proceed autonomously in substantial blocks. One consolidated commit/push after local verification. Routine choices are settled here without another approval round.


## Verification and review ledger
- Core RED: importing the absent manager failed; new behavior was then implemented and exercised on real disposable D1.
- CLI wiring RED: missing npm command/operator-suite registration was detected before wiring.
- Argument RED: unexpected `--legacy-id` on revoke/status reproduced a missing rejection, then passed after validation.
- Local checks before final push: operator suite 22/22 (including 10 owner-command tests), migration checks 41/41, typecheck PASS. Includes independent target-pool accounts and revocation after verification/legacy drift.
- Fresh independent review: no Important/Critical findings. Existing-world audit and private tooling exclusion verified by the operator suite.
- Deferred minor: `requireExisting` can accept an unrelated SQLite file; opening then fails schema validation but may create an empty selected local DB/cache. No schema/account/grant mutation occurs.
- Deferred minor: direct privileged SQL `INSERT OR REPLACE` can bypass UPDATE/DELETE immutability triggers for metadata/receipts. The CLI never issues REPLACE; this is outside its grant/revoke surface.
- Ruling: this block supplies local owner management and target-pool guards only. Shared runtime Dev/Preview identity and a remote owner adapter need a later integration; claiming a shared service from matching metadata would be incorrect.
- Final exact-head CI evidence is recorded on PR #329 / issue #170 after the consolidated branch update. No live operation is performed.
- Final CI uncovered an obsolete account-back fixture: `view=week` was normalized by Calendar into `calendarView=week`, racing an exact-URL wait. Reproduced deterministically after actual Calendar hydration; corrected the fixture to the canonical parameter and asserted the visible Week mode before URL verification. Local Chromium layout/menu/back matrix: 70/70 PASS. No authentication or Calendar production code changed for this correction.

## Hardening follow-up (31 October 2026)
- Both previously deferred minors are resolved in this follow-up: exact selected backing-file validation happens before opening user state, and additive migration 0018 rejects duplicate-ID INSERT/REPLACE for pool metadata and permission receipts.
- RED observed: unrelated SQLite produced new selected DB/cache paths; both Python REPLACE regressions failed because no IntegrityError was raised. GREEN: corrected target detection and insert guards pass; Dev/Preview init remains idempotent.
- Independent patch review found no Important/Critical issue; scratch cleanup also now runs through a nested finally if runtime disposal fails.
- Verification: full operator suite 23/23 (11 owner-tool cases); complete migration suite 44/44, including upgrade/reapplication preserving existing records; TypeScript PASS. Final exact-head CI evidence is recorded on PR #329/issue #170.
- Account-sharing analysis is in backend/docs-account-pools-integration-decision.md. It records a product decision still needed: nonproduction world sharing versus account-only sharing. No runtime rebinding or cross-database authorization change has been implemented.
