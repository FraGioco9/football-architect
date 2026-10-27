# Conservative Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Reconcile current documentation and make the shared stylesheet easier to navigate without changing rendered behavior.

**Architecture:** Keep the existing static HTML generators and plain JavaScript/CSS architecture. Work in the existing cleanup PR; preserve the original cascade, inline declaration serialization and shared language/theme dependencies.

**Tech Stack:** Node.js site contracts, existing Chromium suites, CSSOM and screenshot comparisons; no repository dependencies added.

**Spec:** `docs/superpowers/specs/2026-10-27-conservative-cleanup-design.md` (owner approved 2026-10-27).

## Global Constraints

- Preserve current visual design, URLs and observable behavior, including malformed legacy CSS interpretation.
- Preserve canonical 320 club identities, 18 competitions, 256 provisional participants, 64 asset-only clubs and approved artwork bytes.
- Preserve 56-day calendar timing, Season 0 semantics, rules, historical provenance, world/view separation and fail-closed public/DEV isolation.
- Keep `landing.js`, `landing.css`, hosting policy and all accepted ARCH-CLEAN-02 exceptions.
- No merge, deployment, database or gameplay changes; no unproved branch deletions.
- Exclude checkout-only CSV normalization from every commit.

## Review Focus

- Fresh-session Season 1 differs from Competition/Club reset to Season 0 and Calendar low-level reset: document each accurately (Task 1 source inspection).
- Canonical History/Rules omit season queries; domestic, cup and club view sets differ (Task 1 route registry check).
- Whitespace changes around literal escapes or token boundaries can activate ignored CSS (Task 2 exact browser CSSOM comparison).
- Source-contract tests rely on compact rule/media bodies: keep those bodies unchanged, rather than rewrite tests to fit formatting (Task 2 full existing suite).
- Unchanged defaults do not alone prove hover, focus, hidden and reduced-motion behavior (Task 2 CSSOM identity and Task 3 browser regression).

### Task 1: Reconcile current README

**Files:** Modify `README.md`; retain design and inventory files. No runtime interface changes.

- [x] Inspect source controls, routes, asset catalogues and generator output count; map current claims to their owning modules.
- [x] Rewrite stale current-state sections and remove superseded implementation prose, keeping useful operational/security instructions and links to historical records.
- [x] Validate local links, route examples and the documentation diff; run generator `--check` (expected: 23/23 plus manifests/template match).
- [x] Commit README and plan only; do not stage CSV line endings.

### Task 2: Improve shared CSS navigation

**Files:** Modify `assets/app.css` only. The stylesheet URL and exported selectors/custom properties stay identical.

- [x] Establish green existing contract/browser baseline and save original CSS bytes outside the worktree.
- [x] Save original CSSOM and representative rendering evidence before edits.
- [x] Add an accurate section guide and current-purpose headings; separate adjacent top-level rules using only whitespace between complete blocks. Keep media/keyframe bodies and the literal-escape legacy line byte-identical. Do not sort, rename or delete unproved overrides.
- [x] Assert ordered browser CSSOM identity before/after and identical browser screenshots/computed-style fingerprints at 1440/390/320 across dark/light and five locales.
- [x] Run the unchanged existing test suite and generator check. A failure is investigated against baseline before any corrective edit.
- [x] Commit the CSS change after all equivalence checks pass.

### Task 3: Review and publish the implementation to the existing PR

**Files:** Update the design status and record concise validation/limitations in the PR description.

- [ ] Run relevant Chromium suites, inspect source/publication scope and verify only planned files changed.
- [x] Obtain one fresh whole-branch review and address substantive findings; no per-task implementation agents.
- [ ] Publish through the GitHub connector using expected-head ref protection and verify the remote tree equals the tested local tree.
- [ ] Inspect exact-head CI to completion; distinguish local Node version from Node 22 CI and report actual executed browser results.
- [ ] Report implemented work and the remaining branch-deletion access limitation; leave merge/deployment for separate authorization.

## Execution decisions

The owner approved the implementation, so execution continues inline without another permission round. This is documentation and behavior-preserving formatting: reuse existing tests and one-off equivalence checks rather than add permanent tests that mirror formatting. Keep an execution ledger and QA artifacts outside the tracked source. The initial 133 branch candidates remain pending a write-capable deletion tool.
