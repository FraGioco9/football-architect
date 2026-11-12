# REPO-493 / Step 09 — CI orchestration inventory and first optimization

Date: 2026-11-12 · Branch: `audit/repo-493-first-paint-matrix` · PR #500 (Draft/HOLD)

## Current workflow owners (source-level)

| Workflow | Trigger | Ownership / safe behavior |
| --- | --- | --- |
| `landing-checks.yml` | PR and main; optional manual | Site Node tests; uses `ci-opt-01-impact.mjs` for FAST/TARGETED Draft, otherwise FULL; explicit exact-head checkout |
| `int24-browser-qa.yml` | PR and main; optional manual | Browser Chromium/WebKit, first paint, responsive, visual suites; conservative CSS/full policy |
| `admin-world-checks.yml` | PR | Admin contracts, local Worker/D1 and account/lifecycle browsers; Draft impact routing, FULL required at final |
| `ci-opt-03-full-gate.yml` | PR, optional manual | Observes Site/Browser/Admin completed FULL on the same exact head and base, without dispatch/deploy |
| `match-engine-01.yml` | Selected match-engine/preview changes | Focused physics, routing/security, viewport and benchmark tests |
| `cloudflare-preview-package.yml` | Scoped CI | Preview packaging only; deployment remains separately authorized |

Other domain-specific catalog/performance workflows continue to own their own gates. The existing `ci-discovery.mjs` manifests all Node/browser/Worker test ownership; `ci-selected.mjs` and `ci-opt-01-node-runner.mjs` handle narrowed and complete Node lanes.

## Confirmed inefficiency and fix

Before this step, `ci-opt-03-full-gate.yml` started its 45-minute evidence observer on *every* PR synchronize, including ordinary Draft commits classified by Site/Browser/Admin as FAST or TARGETED. Such runs intentionally cannot provide FULL markers, producing avoidable waiting or a misleading 'missing FULL evidence' result.

**Implemented policy:** classify impact once in a short, exact-head, read-only scope job using the existing fail-closed `tools/ci-opt-01-impact.mjs`. Run the FULL evidence observer only when that mode is `full`. Unknown paths, styles, shared code, CI workflow changes and cross-area diffs still classify FULL. Ready-for-review, non-Draft, explicit final verification marker and manual dispatch also force FULL. No test execution or required final evidence was removed. A narrowed Draft **never counts as FULL success**; its observer is explicitly skipped, and the future full gate still checks the exact SHA, base, actual executed coverage and all required jobs.

**Expected benefit:** eliminate long, unproductive FULL observer waits for FAST/TARGETED Draft iterations. No numeric time or cost reduction claimed without measured Actions history. The small scope job itself adds checkout/classification overhead; quantify after CI evidence.

## Safety and next checks

- [x] Inventory workflow owners and classify an observed duplicate/waiting pattern from source.
- [x] Keep single existing classifier (no second allowlist); require exact-head checkout and fail-closed unknown mode.
- [x] Add a fast Node contract that protects narrowing conditions and the untouched FULL check/production guard.
- [ ] Prove Site + Browser + Admin + FULL on the new commit; CI changes always classify FULL.
- [ ] Review Actions duration and duplicate job counts before/after on comparable head/branch samples.
- [ ] Audit duplicate browser installs and repeated long Node/runtime lanes, then propose further changes only with evidence.
- [ ] Perform complete final browser/physical QA separately; source tests do not certify hardware Safari.

No merge, deployment, remote D1 reads/writes or PR publication authorization was given.
