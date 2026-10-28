# Season 1 review candidate implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the existing Season 1 approval handoff concrete and reproducible without granting production approval.
**Architecture:** An offline backend tool reads the five canonical input files at immutable source c187d4ebfc0240515e79b4dbd9f3dceea3f293cc, rejects working-tree drift, and emits a pending-review candidate with all 18 full rules, bindings, raw source checksums and canonical participant/rule hashes. Candidate approvalReference stays null. The production loader and HTTP command boundary remain unchanged.
**Tech Stack:** Node 22, TypeScript, existing Worker validation, SHA-256 and independently pinned source checksums (no Git-history dependency); no new dependency.
**Spec:** docs/admin-world-01-operations.md (Season 1 approval handoff), approved foundation design and the owner's next-block continuation.

## Global Constraints
- Existing PR #316 only, Draft/HOLD; no merge, deploy, remote D1, provisioning, real credentials or manual workflow.
- Retain exactly the original 20 issue checklist entries; 5/20 until real accepted initialization.
- Participant approval is not full sporting-rule/manifest approval. No DEV or synthetic data in the candidate.
- Keep static publication, authentication, production null loader and security guards unchanged.

## Review Focus
- Recomputed hashes cannot turn a candidate into an approval.
- Missing, edited or stale pinned inputs fail before candidate output.
- Missing/extra rules, wrong Federation slots and mutated candidate bytes fail validation.
- Candidate/tool/report stay out of real Worker and static bundles.
- Check mode is read-only; no command accepts approval or remote database options.

### Task 1: Reproducible approval handoff
**Files:** backend/tools/season-one-candidate.mts; backend/catalogues/season-1.candidate.json; backend/tests/season-one-candidate.test.mts; backend/tests/catalogue-runtime.test.ts; backend/tests/production-bundle.test.mts; backend/package.json; docs/admin-world-01-season-1-review.md; docs/admin-world-01-operations.md.
**Interfaces:** buildSeasonOneCandidate(sources: Record<string,string>), verifySeasonOneCandidate(candidate: unknown,sources: Record<string,string>), readPinnedSeasonOneSources(root?: string). CLI accepts only --check (default) or --write, writes fixed backend candidate path only.
- [x] Write behavioral tests for exact approved selection/full hashes, malformed candidate/rule/input rejection, pinned-source drift, read-only CLI, forbidden flags, and runtime rejection of candidate approval.
- [x] Run tests and observe missing-tool/candidate failures.
- [x] Implement offline candidate/tool, retaining null approval reference and production loader. Include full canonical rules and a pinned 56-day calendar source/checksum; no fixtures, results or generated sporting data.
- [x] Run targeted candidate/runtime/typecheck, contracts, operator and publication tests; independently reconcile SHA-256 with Python; generate reviewer-readable source/participant/rule/hash table.
- [ ] Review with a fresh reviewer, fix Important findings RED→GREEN, run final local suites. Upload one grouped commit to existing branch; inspect automatic exact-head Admin/Site/Browser CI. Update original issue/PR evidence without new checklist nodes.

## Execution evidence

Node22.23.0: candidate4/4, actual workerd/D1 44/44, contracts29/29, operator/persistence/restart/compilation plus candidate10/10, SQLite6/6, targeted public/settings/bridge/selection22/22 and typecheck PASS. Generator23/23 parity PASS. Independent Python source and canonical SHA-256 checks agree. Test-first missing-tool failure was recorded; a no-Git checkout regression failed before replacing Git reads with fixed independent source hashes and passed afterward. This keeps shallow exact-head CI compatible without widening checkout permissions/history or changing workflows.

Independent scoped review: no remaining findings; candidate4/4, compilation1/1, actual publication staging8/8 and pinned source hashes independently verified. Two documentation phrases were clarified during review (parsed JSON contents, no Git-history dependency). Sporting approval, production infrastructure and old foundation behavior are outside that review. Windows LF configuration was inspected; no claim of Windows execution.

Final general suite / exact-head automatic CI evidence belongs in PR316 and issue315 after the grouped branch update. No implementation acceptance checkbox is completed by this candidate.
