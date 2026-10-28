# Approved Season 1 initialize/read implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Execute the owner's explicit approval of the immutable 8126da1 review package and deliver the local protected Season 0→Season 1 prepare/read flow.
**Architecture:** A separate server-only loader imports independent canonical catalogues and the canonical calendar model, validates an immutable approval record against an independent whole-record digest, recomputes full rules/participant/calendar hashes and then obtains a validated immutable snapshot. HTTP awaits the loader. Candidate/DEV files never become runtime dependencies. Existing atomic command/auth/revision protections remain.
**Tech Stack:** Existing Node22/TypeScript/Worker/D1/Chromium; no new dependency or infrastructure.
**Spec:** docs/admin-world-01-season-1-review.md at8126da13d0f36a1a2087f66f21626d06fe00c873, owner-approved in chat28October2026; existing foundation design.

## Global Constraints
- Same PR316, Draft/HOLD; no merge/deploy/remote D1/provisioning/real credentials/manual workflow.
- Keep canonical inputs pinned to c187d4e and approved participants/rules hashes unchanged.
- Preserve exactly20 original acceptance entries; mark initialize/read only after actual Worker/D1/browser/restart evidence.
- Preparation is season1/day0/preparing only, without fixtures, results or start/advance/later lifecycle.
- Candidate stays an immutable historical review artifact, approval is a separate record with explicit owner/reference/source provenance.

## Review Focus
- Recomputed corrupt record/rule/participant/calendar hashes must never bypass independent approval pins.
- No unawaited loader, import cycle or Node-only dependency may reach real Worker code.
- Duplicate authenticated requests commit once; forged client approvals and anonymous/CSRF-invalid writes stay rejected.
- Prepared snapshot/audit/world survive actual Wrangler restart and independent clients agree.
- Browser/public/static boundaries remain correct; candidate/tool/DEV data excluded from production.

### Task1: Server-owned approved loader and protected initialize/read
Files: backend/catalogues/season-1.approval.json; backend/src/approved-season-one.ts; backend/src/catalogue-snapshot.ts; backend/src/http-admin.ts; backend/src/canonical-calendar.d.ts; backend/tests/approved-season-one-runtime.test.ts; existing command/catalogue/auth/candidate/production-bundle/restart tests; tests/admin-settings-browser.mjs; operations/review docs.
Interface: loadApprovedSnapshot():Promise<ApprovedSnapshot>; validateProductionSeasonOneApproval(input:unknown,catalogue:CanonicalCatalogue,calendar:unknown):Promise<ApprovedSnapshot>. canonicalHash(value:unknown):Promise<string> shares existing canonical encoding.
- [x] Write failing approval-runtime, HTTP/restart/browser expectations and run focused failures before loader implementation.
- [x] Commit separate owner approval record (review commit8126da1, canonical sourcec187d4e, unchanged accepted hashes), independently hash record/calendar in Python. Implement server-only validation and await it at command boundary; retain no production runtime candidate import.
- [x] Prove positive canonical prepare/read, rejection of forged/drifted inputs, one actor/time/revision/audit, duplicate replay, two clients and real restart. Update browser cohort to initialize once and verify persistent prepared state across all five languages/themes/widths; keep unavailable/prerequisite client regressions.
- [ ] Run backend full/contracts/operator/typecheck, targeted public/generator checks, independent review and final exact-head automatic Admin/Site/Browser gates. Group one branch update; preserve the pre-existing CSV difference. Record evidence in original issue and PR; infrastructure release gates stay open.

## Local evidence / preflight

Shared interface: HTTP previously consumed a synchronous nullable loader from catalogue-snapshot; the new loader is server-only and async. All runtime call sites now await/import approved-season-one directly, avoiding an import cycle. Candidate structural validation stays separate and the historical candidate stays invalid as a production manifest. D1 requires no schema change: its existing immutable snapshot stores the versioned manifest/approval reference, which resolves to the reviewed record with calendar/source pins.

Test-first evidence: new approved-runtime suite failed on missing approval record; protected HTTP expected200 but received422 from the old null loader. After implementation47/47 actual runtime tests pass. Node29 contracts,typecheck,operator/restart/compilation/candidate10,real Settings browser31,focused public22,generator23/23 pass. Python independently computes record and calendar canonical hashes. No whole-world reset or real credentials were used: all actual writes belong to disposable local test D1.

Independent review: no Critical/Important findings; reviewer independently ran typecheck and14 focused actual Worker/D1 tests and reproduced Python approval/source hashes. One minor diagnostic still described production approval as absent globally; scoped both candidate-tool messages to the historical candidate, which grants no approval. No behavior change. Final automatic exact-head gates and checklist evidence will be recorded on the existing PR/issue.
