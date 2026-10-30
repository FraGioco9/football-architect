# PLAYER-AUTH-01 — #15 local acceptance execution plan (30 October 2026)

Status: **OPEN / not accepted**. This document is an evidence-based audit and execution plan, **not a successful test-run report**.

## Blocks 1–3 development batch — 30 October 2026 (unverified, Draft/HOLD)
- Player verification now has an isolated synthetic full-path Worker+D1 regression: registration → pending denial → single-use verification → successful login → session restore. Recovery has an analogous synthetic path covering selected locale, one-time token and old-session revocation. These tests are **authored but not executed**; no PASS is claimed.
- Selected Account language (EN/DE/ES/FR/IT) is explicitly sent as `Accept-Language` for registration and password recovery, rather than relying on browser language; a static regression ensures the field is retained. Cloudflare delivery stays production-only, disabled by default.
- Cloudflare environment separation, no-email Local/Preview, opt-in Production binding, DNS/provider prerequisites, and STOP/rollback conditions are documented in `backend/docs-cloudflare-auth-environments.md`. **No active Wrangler binding, credential, DNS, remote D1, live operator link or deploy** was created.
- Player/Admin production cutover is still blocked pending separate approval and full QA. Existing local operator preflight and reversal tests remain in place.
- Per owner instruction, postpone manual/full CI runs until development finishes. GitHub may still schedule automatic workflows on branch pushes; do not call them verified success until exact-head evidence is inspected. Checklist remains **12/15 (80%)**.

## Operator cutover runbook
- See `backend/docs-player-admin-cutover-runbook.md` for approval gates, disposable-D1 rehearsal, STOP conditions, privilege revocation, preservation of historical audit and separately approved backup/restore. This is documentation only; it **does not** authorize live cutover or release.

## Local operator cutover readiness preflight (read-only)
- New `backend/tools/operator-cutover-audit.mts` implements a **read-only** check of a normalized email in disposable local D1. It returns only `ready` and finding codes (no identifiers, secrets or PII) and cannot create an operator link, permission or session.
- Requires an enabled legacy audit operator, active verified Player with matching email, exact explicit Player/legacy link, and all three D1 permission grants. Missing or revoked prerequisites fail closed.
- `backend/tests/operator-local.test.mts` covers missing identities, unverified pending accounts, explicit grants, permission removal and zero created sessions. The new test requires exact-head CI confirmation.
- `ready:true` means only that the local data satisfies these prerequisites; it **does not authorize** live cutover. Actual operator provisioning, backup/rollback, credentials and remote D1 remain separately owner-approved #10 work.

## Latest focused acceptance evidence — 30 October 2026
- Exact HEAD `0a0fc2b3b8233a89b3d584861253b7eb89b8bcc2`: Admin World foundation checks **SUCCESS**, including local auth, **213/213 full Worker D1 tests**, operator persistence/restart and Chromium login/register layout and safe return. This supersedes the historical 71-failure baseline described below.
- Site checks and full Browser QA **SKIPPED intentionally** under Draft diagnostic conditions, **not passed** on that HEAD. WebKit and full exact-head acceptance remain open.
- A new isolated unified Admin regression exercises verified Player-to-legacy-operator email correspondence and link removal; test outcome must be confirmed on its own exact HEAD before claiming PASS.
- No live operator cutover, credentials, remote D1, outgoing email, deployment or merge. Owner sign-off for actual #10 cutover and delivery provider #12 remains required. Checklist **12/15 (80%)**.

## Exact-head starting point
- Baseline inspected: `fcdd1bcc01a37acbaac58bde4df7c6ad06bd98cd` (PR #329).
- Baseline GitHub CI: Site checks, Browser QA and Admin World foundation all SUCCESS on this commit.
- Existing account/Season 0 matrix and targeted Worker+D1 checks are documented in the PR description.
- Historical full `backend/npm test` evidence: 127 passed, 71 failed, 15 skipped against implementation, with the same 71 failing signatures on pristine prior baseline (123 passed, 71 failed, 15 skipped). **These are not a PASS** and should be rechecked on exact HEAD.
- Historical failing groups include Admin calendar, lifecycle, preparation, public sporting, reset world, season transition and persistence runtime suites.

## Observed migration mismatch
`backend/tests/admin-calendar-command-runtime.test.ts` still constructs `AdminSession`, inserts into `admin_sessions` and calls lower-level world commands with the retired identity. Its HTTP test correctly creates a Player identity, explicit `player_admin_operator_links`, permissions and Player session. This mixed fixture model must be audited across all 15 historical failing suites. Do not restore legacy password login as a shortcut. Keep historical audit foreign-key ownership intact.

## Local operator procedure (disposable D1 only)
From a clean checkout on the PR head, with pinned dependencies already installed:

```powershell
git fetch origin feat/player-auth-01-foundation
git switch feat/player-auth-01-foundation
git pull --ff-only
git rev-parse HEAD
git status --short
cd backend
npm run typecheck
npm run test:contracts
npm run test:auth-local
npm run test:operator
npm test
```

Record exact SHA, each exit code, counts of PASS/FAIL/SKIP and first failed assertion by file. Do not mark `npm test` PASS until 0 failures. If a fixture fails after the retired Admin login cutover, update it to provision a verified Player identity, **explicit** operator link and server-owned permissions with disposable local D1; retain race, audit, CSRF, revoke and rollback assertions. Avoid weakening production guards or deleting negative tests. Run affected suite first, then entire suite, followed by typecheck/contracts and exact-head CI.

## Acceptance evidence required before #15 is checked
1. D1 migrations in order and repeatability/rollback behavior; no production/remote D1 writes.
2. Token expiry, revoked sessions, credential version, multi-session revocation, login restore after Worker restart, CSRF/origin, anti-enumeration, one-time recovery and verification; delivery is injected/test-only.
3. Admin denial by default, explicit operator link, rights granted/revoked on each request, atomic mutation/replay, concurrency, stale revision, audit preservation and group cutover rollback. **Actual operator cutover remains #10 and requires separate approval**.
4. Full Worker runtime suite green, or each known failure explicitly classified with reproduced evidence and a separate acceptance decision; no blanket “pre-existing” waiver.
5. Real-browser/mobile, five locales and two themes, anonymous public routing, trailing-slash/canonical links, login return, profile and Season 0 navigation.
6. Check exact-head CI on the final commit; never transfer an old HEAD's green badge to a new commit.

## Hard boundaries
PR #329 stays **Draft/HOLD**. No merge, deployment, remote D1, real email, credentials, or live operator cutover. #12 remains blocked on separately approved outbound email delivery; #10 remains blocked on authorized live migration. Checklist **12/15 = 80%** until independent acceptance evidence exists.

## Draft-only full gate activation
The PR body includes `<!-- admin-world-final-verification -->` to opt into the pre-existing Admin World CI gates (full Worker Vitest, operator persistence and lifecycle browser) without changing workflow logic or remote resources. A new exact-head CI run must be inspected before any success claim. Any failed full suite remains a blocker for criterion #15.
