# PLAYER-AUTH-01 — Trusted Admin cutover and rollback runbook

Status: **Draft/HOLD**. Procedure only. This document is not authorization to access production D1, deploy or merge.

## Preconditions and authority

- Obtain the owner's separate authorization for the exact target D1 environment, full immutable ID mappings, approved operator, and scheduled cutover. Never infer links from matching email alone.
- Do not expose any migration or rollback helper via public HTTP. Execute only from a separately reviewed trusted maintenance context.
- Establish an independently restorable D1 backup/snapshot and record the pre-cutover database migration version; record backup identifiers privately, not in issues or logs.
- Confirm all enabled historic operators are represented exactly once in the approved roster, each corresponding Player identity is active, verified, and matches normalized operator email.
- Existing Admin credentials must not be reused as Player credentials. Independently verify each operator's ownership.
- Block if any disabled operator retains a Player link or an unrelated Player has an orphan Admin grant. Preserve historical audit principals and existing sports/world results.
- Capture the exact PR HEAD and D1 migration version before any changes. All code, Worker, and browser tests remain deferred until the separately authorized final validation gate.

## Trusted cutover sequence (not executable by itself)

1. Review the read-only `adminOperatorMigrationInventory(db)` output in a protected context. Reconcile it against the approved roster.
2. Call `preflightAdminOperatorsBatch(db, mappings)` without changes. Do not proceed if `ready` is false or any `blockers` are present.
3. Reconfirm the approved IDs, approver ID, D1 environment, backup, and maintenance window. Reject any roster changes since approval.
4. Invoke `migrateAdminOperatorsBatch(db, mappings, approvedBy, now)` once in the trusted context. The DB batch includes per-operator guards and an all-enabled-operators coverage guard. Any failure is a **stop**, never an invitation to retry a partially rewritten roster.
5. Read `adminOperatorMigrationReadiness(db)`: require `ready=true`, all enabled operators `linked`, zero `blocked` and zero `orphanGrants`.
6. Confirm old legacy Admin and pre-cutover Player sessions and outstanding one-time credentials cannot authenticate. Operators must sign in afresh via the unified Player login.
7. Record the mapping approval and operator-linked audit results in access-controlled maintenance records. Never log password verifiers, tokens, session digests or backup secrets.

## Abort and rollback

- Before a successful commit, an atomic D1 batch failure should leave the attempted group unmodified. Inspect readiness before any retry.
- After commit, revoke only the explicitly approved affected Player IDs using `revokeMigratedAdminOperatorsBatch(db, playerAccountIds, now)` in the trusted context.
- The rollback atomically deletes Admin grants, Player/legacy sessions, one-time credentials and Player–legacy links. Historical `admin_accounts` and sports/audit rows remain intact.
- Reconcile every affected Player ID, ensure no surviving privileges or sessions, and expect `ready=false` until a fresh explicitly approved migration is performed.
- Rollback does **not** automatically re-enable old login routes; separate Admin credentials remain retired. Do not restore an insecure legacy login as a workaround.
- Escalate unknown DB state, partial audit evidence, backup failures, identity mismatch, or unexpected idempotency outcomes. Do not improvise direct SQL repair on remote D1.

## Final gate (intentionally not yet run)

- Review migration fixtures and SQL schema compatibility; execute disposable local D1 tests for atomicity, duplicate/concurrent mappings, disabled operators, missing grants, pre-cutover sessions, reset credentials, rollback and replay.
- Execute browser/mobile/i18n, cross-account isolation, CSRF, throttling, safe redirect, account deletion and public-route regression checks.
- Require CI PASS at exact PR HEAD with deploy/production guard unchanged. No merge until the owner authorizes that gate.
- Email verification and password recovery require separately approved outbound delivery; do not mark the corresponding original issue requirement complete while the provider is unapproved.

## Original issue #170 acceptance

Do not close the original Admin cutover checkbox based on helper implementation or this runbook alone. Evidence must include approved actual operator cutover, verified zero privilege loss and privilege isolation, successful revocation/rollback tests, and final exact-HEAD gate. 
