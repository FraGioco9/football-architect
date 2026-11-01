# Shared Nonproduction Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opt-in code for Dev and Preview to use one nonproduction account/world backend with independent browser sessions.
**Architecture:** Strict Preview pool guard + environment handshake in Worker; loopback-only HTTPS API bridge in Dev translates only validated host-only session cookies. Existing D1 atomic mutation guards and active local config remain unchanged.
**Tech Stack:** Existing TypeScript Workers/D1, Node HTTP/HTTPS, Vitest and Node test.
**Spec:** docs/superpowers/specs/2026-10-31-shared-nonproduction-backend-design.md

## Global Constraints
- One Dev/Preview account/world DB; separate Production DB and separate per-frontend sign-in.
- No real mail, remote D1, deploy, DNS, resource activation or live grants.
- No publication guard/vercel.json changes; no new dependencies.
- Target configuration is server-only and opt-in; fail closed before credential dispatch.

## Review Focus
- Wrong/unbound pool or Production target must not receive authenticated API dispatch.
- Cross-origin local POST, duplicate/malformed cookies and unexpected headers must be rejected/stripped.
- Upstream redirects, bad handshake, unsafe Set-Cookie and oversized/error responses fail closed.
- Local/legacy fixtures and anonymous sporting reads remain compatible; Preview delivery stays disabled.
- Two sessions for the same shared account remain independent; common world mutations and current Admin revocation remain atomic.

### Task 1 — Worker Preview contract
Files: backend/src/environment-pool.ts; backend/src/index.ts; backend/src/http-player.ts; backend/src/http-admin.ts; backend/tests/shared-nonproduction-runtime.test.ts.
Interfaces: assertEnvironmentPool(env,expected?), resolveAccountConfiguration(request,env,code), GET /api/environment {schemaVersion:1,pool:'dev-preview',origin,sharedWorld:true,separateSignIn:true}.
- [x] Write and observe RED runtime tests for strict Preview mode/pool/transport, prod isolation, separate sessions, common world and no live adapter.
- [x] Implement helpers and wire existing auth handlers/public entry without modifying atomic command SQL; run affected tests GREEN.

### Task 2 — Local bridge
Files: tools/shared-nonproduction-proxy.mjs; tools/dev-admin-api-proxy.mjs; tests/shared-nonproduction-proxy.test.mjs; .github/workflows/admin-world-checks.yml.
Interfaces: proxySharedNonproduction(req,res,{target,path,body,publicRead,send?}); native bounded HTTPS sender and handshake/cookie validation.
- [x] Observe RED Node bridge tests; implement strict opt-in, local request validation, expected-pool handshake, per-request marker and narrow cookie translation.
- [x] Retain old loopback bridge and all original path/method/body guards; run new and legacy tests GREEN.

### Task 3 — Integration documentation and final verification
Files: backend/wrangler.shared-nonproduction.example.toml; backend/docs-shared-nonproduction.md; existing decision note; PR/issue metadata.
- [x] Document opt-in PowerShell setup, native same-origin Preview routing prerequisite, independent Production, sender still absent and no live activation.
- [ ] Typecheck, focused Worker + Node tests, full operator/migrations, independent review; then one consolidated final exact-head CI cycle on Draft #329.

Owner's latest choice approves the shared-world topology. Execute inline under prior autonomous-work authorization; live activation remains outside scope. Track results/rulings below, not in repeated plan handoffs.


## Execution evidence
- Baseline aa02bb8 remains Draft/HOLD, compatible with main eaf3b4b; all three previous CI runs SUCCESS. Issue checklist remains 13/15 (86.7%).
- Task 1 complete: initial Preview runtime tests failed (4 failures/1 pass) before implementation. Strict Preview transport/pool, no-secret handshake, expected-pool header and shared auth configuration implemented. Full local Worker suite **228/228 (35 files)**, typecheck PASS; pure contracts **75/75**, migrations **44/44**.
- Task 2 complete: initial bridge tests failed before implementation; new+legacy bridge and real frontend-server checks **21/21**. Native TLS verification/no redirects, bounds, cookie and Origin isolation preserved; existing loopback path unchanged.
- Final review (fresh independent reviewer): one Important integration finding: default Dev fictional overlays prevented authoritative sporting loaders. Reproduced with real createPreviewServer regression RED, disabled those overlays only in explicit shared-pool mode, then **21/21 GREEN**, including legacy fictional mode and app/site routing. No further Critical/Important finding; no minors deferred.
- Local unrestricted root test glob was diagnostic only: **719 pass / 40 fail**, caused by absent Chrome and installed backend/node_modules symlinks rejected by the existing publication guard. No guard or test was relaxed. Clean final GitHub Site/Browser/Admin CI remains the required gate; root artifacts/dependencies are excluded from the commit.
- Task 3 code/docs complete; final exact-head CI evidence will be recorded on PR/issue after the single consolidated push. No live activation, remote D1, mail or grants. Local-only owner command remains unchanged.
