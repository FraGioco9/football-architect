# PLAYER-AUTH-01 — Player/Admin operator cutover runbook (DRAFT / HOLD)

This is a planning and local validation artifact, **not permission to cut over**. It does not enable a production account, send email, change remote D1, deploy, or grant a privilege. Owner approval is required for the separate #10 live cutover.

## Current authorization model
- Player authentication is the only accepted login for `/api/admin/*`. Legacy login/logout endpoints are retired.
- Administrative reads require an active, email-verified Player account, a currently enabled legacy audit identity with the same normalized email, a one-to-one explicit link, `admin.access`, and `admin.world.read`.
- Writes additionally require `admin.world.write`, valid Player CSRF and origin, and the existing atomic command/replay guard. `admin_operations` retain their historical legacy operator identity.
- Local readiness does **not** establish permission for production provisioning.

## New synthetic operator cutover rehearsal (Draft / unexecuted)
- `backend/tools/operator-cutover-rehearsal.mts` provides explicit `rehearseLocalOperatorGrant` and `rehearseLocalOperatorRevoke` helpers for **disposable local D1 only**. They are library functions, have no CLI entry point or HTTP route, and must not be imported into a deployed Worker.
- The grant rehearsal accepts a specific Player ID, legacy operator ID and normalized matching email; requires verified, active Player and enabled historic operator, refuses conflicting links, grants only the three known Admin permissions and checks postconditions through the read-only audit.
- A competing Player linked to the same historic operator is explicitly rejected **before** any grant or link mutation; a synthetic regression verifies no privileges are issued in this case. This remains a local rehearsal only; it does not establish production-ready atomic provisioning. It never creates Player accounts or replaces passwords.
- The revoke rehearsal removes Player administrative grants and the link and revokes Player sessions, leaving the historic operator and sporting world intact. It is designed to fail closed.
- `backend/tests/operator-local.test.mts` now exercises mismatch rejection, idempotent rehearsal, post-grant preflight, revocation and world-state immutability. **Tests authored, not executed** per owner deferred-CI instruction.
- This is a dry-run model only, not an audited, approved or safe production cutover tool. Real #10 is still OPEN and requires independent owner approval, target/environment confirmation, backup, and exact-head QA.

## Stage 0 — freeze and independent approvals (mandatory)
1. Keep PR #329 Draft/HOLD; require an explicit separate authorization naming the approved operator identity, environment and maintenance window before any live mutation.
2. Confirm the Player email-verification and recovery delivery adapter is separately approved and configured, or **STOP**; there is no acceptable bypass of verification.
3. Verify a complete, restorable authorized backup of the target D1 and a tested restoration process. Never copy user data into test fixtures or logs.
4. Capture exact Git commit, D1 migration versions, target binding identity and existing operator account count using an approved operator-only access path. An unexpected binding or schema change means **STOP**.
5. Define two independent approvers for linking/granting and for any production deployment. Do not embed credentials, IDs, tokens, passwords or PII in issue/CI output.

## Stage 1 — dry run using disposable local D1 only
1. Create synthetic legacy and Player identities with different passwords and matching normalized email, and a separate unprivileged Player.
2. Call `auditOperatorCutover(db,normalizedEmail)` from `backend/tools/operator-cutover-audit.mts`. It must initially report missing prerequisites.
3. Independently verify the exact explicit link and `admin.access`, `admin.world.read`, `admin.world.write` grants in the disposable fixture; audit must then be ready. Remove a grant, disable the legacy operator, remove the link or invalidate Player verification: each must fail closed.
4. Verify persistent logout/revocation, same-session read/write constraints, CSRF/origin, idempotent replay, historical audit ID, and a restart. World state and public sporting routes must remain stable except for authorized test commands.
5. Record pass/fail counts and exact-head results **without sensitive data**. Stop on any flaky, inconsistent or unauthorized access.

## Stage 2 — live provisioning (BLOCKED until separate owner authorization)
- A designated privileged operator must create/verify the intended Player account through the separately approved delivery process. **Never copy the legacy password verifier or reset the password without the user's approved flow.**
- Explicitly link the known Player and legacy audit identities. Verify unique correspondence and email equality; never infer privileges solely from email or automatically link all accounts.
- Grant the minimum authorized permissions in a bounded, auditable operator action. Default deny persists for everyone else.
- Recheck credentials, enabled state, permissions and live denial cases after each change. Any mismatch means **STOP** and revoke grants.
- Perform a controlled authenticated read, then an explicitly authorized harmless write/replay in the approved window. Preserve operator attribution and immutable historical receipts.

## Rollback / stop protocol
1. Immediately halt additional provisioning and disable access by revoking `admin.world.write`, `admin.world.read` and `admin.access` from the affected Player. Revoke Player sessions; ensure `/api/admin/*` returns denied.
2. Review audit entries and world revision for unexpected writes. Do not delete historical `admin_operations` or rewrite sporting outcomes.
3. Restore or reconcile D1 **only** under a separately approved recovery procedure validated against an actual backup; never run unreviewed destructive SQL. Record the reason and verification evidence without account secrets.
4. Repeat fail-closed checks and public-read checks. Leave deployment blocked if any authorization or world-integrity check fails. A UI or route rollback alone must not restore legacy Admin login.

## Final release decision (still open)
- Require exact-head full Worker and operator tests, full Site checks, Chromium and WebKit account/browser regression, D1 migration and security gates, and explicit #10/#12 approvals. A Draft focused green run or a local `ready:true` is insufficient.
- No automatic promotion from a successful run to a production cutover or merge.
