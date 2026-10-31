# Hosted Preview Preparation Implementation Plan

> Execute inline using superpowers:executing-plans under prior owner autonomy; one final independent review, one combined push/final CI.

Goal: produce a reviewable nonproduction Worker/static package without deployment.
Spec: docs/superpowers/specs/2026-10-31-hosted-preview-design.md
Constraints: Draft/HOLD; no live writes, deploy, mail, grants or publication-guard changes; reuse API and route authorities; no new dependencies.

## Review focus
- Account origin helpers must not invent app.* hosts for workers.dev.
- Private APIs and navigation requests never fall through to static HTML; asset requests strip credentials and tokens.
- Canonical competition/club/query behavior and account privacy headers survive Cloudflare hosting.
- Build inputs are an exact Git snapshot; dependency/state/symlink injections cannot enter public assets.
- Config is Preview-only; package paths/hashes and generated bindings match the compiled entry, including Wasm.

## Task 1: Preview entry and host routing
Files: backend/src/preview.ts; backend/src/preview-routes.d.ts; backend/tests/hosted-preview-runtime.test.ts; assets/account-ui.js; assets/app.js; assets/landing.js; tests/hosted-preview-origins.test.mjs.
- [x] RED tests: canonical pages and aliases/query retention, account headers, credential stripping, API non-fallthrough, bad origin/config/method/path, same workers.dev frontend origin.
- [x] Implement wrapper with route-registry reuse, ASSETS streaming, private headers; extend existing frontend preview host classification; GREEN affected tests and typecheck.

## Task 2: Offline package
Files: backend/tools/prepare-preview.mts; backend/tests/preview-package.test.mts; backend/package.json; .github/workflows/admin-world-checks.yml; backend/docs-hosted-preview.md.
Interfaces: preparePreview({repository,sourceSha,output,accountId,databaseId,origin}) and verifyPreviewPackage(output); CLI npm --prefix backend run preview:prepare -- --source-sha SHA --output ABS --account-id ID --database-id UUID --origin HTTPS.
- [x] RED package tests for target validation, overwrite rejection, exact snapshot staging/config/provenance and tamper detection.
- [x] Implement Git archive, unchanged guard, pinned local dry-run compilation, standalone config and complete hashes. No deployment entry point.
- [ ] Run focused tests and actual packaged local Miniflare/assets check; review whole change, fix reproduced findings, final consolidated source CI and generate exact-head review artifact.

## Execution ledger
Prior autonomy covers inline preparation. workers.dev is the builder's technical choice; no domain purchase or DNS operation. Operational publication still requires specific owner authorization after review.


- Task 1: missing Preview entry and incorrect workers.dev redirects observed RED; then hosted runtime 4/4, existing/new origin/control Node checks PASS, typecheck PASS. Request-normalized encoded dot segments are denied as protected paths (404), while remaining unsafe encodings receive 403.
- Task 2: missing preparer observed RED; a rehashed Production-config package was also accepted before policy checks (RED), then rejected after strict config/target cross-checks (GREEN). Package suite 3/3 includes exact snapshot, unchanged guard, pinned compilation, standalone no_bundle dry-run, actual local Miniflare Assets+D1 pages/API, protected-path denial and tamper detection.
- Native harness uses explicit module manifests and has_user_worker routing metadata required by pinned Miniflare v5; this is test configuration, not a hosted runtime bypass. Dependency junction exists only in temporary compiler source AFTER public staging; never inside assets.
- Final independent fresh-context review: no Critical/Important/Minor findings. Typecheck, 4 runtime cases, 2 origin cases and 3 package cases independently passed. Combined targeted Node checks 29/29 PASS.
- Final source CI and generation of the exact final-source package are pending the single consolidated push. No Cloudflare mutation, Worker upload, D1 write, DNS/mail/grant/Production action or merge in this block.
