# Conservative site and repository cleanup

Date: 2026-10-27  
Repository: FraGioco9/football-architect  
Inspected main: `c40710cc2ccfcacb785d06aa51594e2ed07968de`  
Status: approach selected by owner; implementation design awaiting approval.

## Intent and selected approach

The owner requested cleanup of the whole site, including code, issues, pull requests and unused branches, and selected **conservative cleanup**. Reduce maintenance cost and stale tracking while preserving the current visual design, URLs and observable behavior.

Two approaches were presented: (1) conservative maintenance, selected by the owner; (2) maintenance plus page/navigation redesign, rejected for this scope. The selected approach offers smaller, easier-to-verify diffs and retains existing UX. It does not promise new features or a smaller runtime bundle unless dependency and regression evidence supports the change.

## Existing architecture and constraints

This is a static site/app preview and identity catalogue, not a deployed authoritative game backend. The implementation uses plain JavaScript, CSS, checked-in HTML and Node generators, without a package.json. Keep that architecture.

- ARCH-CLEAN-02 #268 is already complete (72/72 within its recorded scopes). Preserve accepted A02 DEV legacy and A03 routing exceptions; do not repeat that migration.
- Preserve canonical 320 club identities, 18 competitions, 256 provisional participants, 64 asset-only clubs and approved artwork bytes.
- Preserve 56-day calendar timing, Season 0 semantics, rules, historical provenance, world/view separation and fail-closed public/DEV isolation.
- Edit template/render/generator sources, never generated HTML manually.
- Keep publication policy independently validated. Do not deduplicate security checks merely because their text resembles another configuration.
- Keep current language/theme storage contracts, five locales, dark/light behavior, responsive layouts and accessibility.
- No gameplay, authentication, backend, database, hosting or workflow redesign. No merging PRs or deploying as part of the cleanup.
- Do not change or close unfinished Guide #255 / Admin World #316 as obsolete. Review remains separate from this maintenance.
- Never stage the canonical CSV's checkout-only line-ending normalization; preserve original tracked bytes.

## Evidence and administrative actions

The initial audit found 150 branches, four open PRs and nine open issues.

1. PR #280 closed without merging: #268 explicitly accepts the local DEV legacy lookup instead of the proposed consumer migration.
2. PR #311 closed without merging: A06 negative test work was integrated through #312/#313/#314 and closed in #268. Its unique unmerged scenario document remains accessible through the PR; do not claim that document was merged.
3. #236 updated with a dated reconciliation of merged Calendar lots (#237/#239/#241/#243/#244/#246/#256). Preserve the issue as open because real clock/shared-world integration and WORLD-TIME decisions remain outstanding. Historical filter/inline-details presentations were superseded by the simplified Calendar.
4. All nine issues remain open after inspection; there is no evidence that their complete scopes are done.

| Issue | Disposition and reason |
| --- | --- |
| #94 WORLD-TIME | Keep: kickoff, recovery, friendlies, live-clock and transition decisions remain open. |
| #95 GAME-VISION | Keep: living product decisions, not an implementation ticket completed by current UI. |
| #163 CLUB-IDENTITY | Keep: all 320 clubs' crest/kit/identity scope is unfinished. |
| #170 player login | Keep: deferred, unimplemented authentication scope. |
| #177 historical source | Keep: verified source/approval work remains; DEV History does not provide canonical results. |
| #232 awards | Keep on HOLD: winner data/rules not approved; static emblems are not winner computation. |
| #234 INT-24 | Keep: living specification, not completed merely because cup UI exists. |
| #236 Calendar | Keep and reconcile as above: static/DEV delivery does not complete live acceptance. |
| #315 Admin World | Keep: backend/admin implementation not delivered. |

## Branch cleanup specification

The companion `docs/maintenance/2026-10-27-branch-inventory.json` records all 150 names, exact head SHAs, associated PR numbers and dispositions. It is a dated audit record, not a live second source of truth.

- 133 branches have a merged PR and a current head identical to that PR's final head. They are eligible for removal after a fresh exact-ref/open-PR recheck.
- Protect main, the two active PR branches, the two just-closed unmerged residual branches, and all other review-preserve branches.
- In particular, `fix/manual-preview-merged-pr` has changed since merged #178 and also belonged to unmerged #179. Do not delete it based solely on the earlier merge.
- Preserve backup, experiment, reconciliation and closed-unmerged branches until their unique work is individually accounted for.
- A squash merge need not make the original branch an ancestor of main. Use matching final merged-PR head and review history, not just `git branch --merged`.
- Before actual deletion, re-fetch the exact ref, confirm the expected SHA and no open PR, then delete with an expected-SHA lease where supported. Skip any changed ref.
- Record actual successful deletions separately from candidates; inventory counts are not deletion counts.

**Current access limitation:** the connected GitHub toolset has no delete-ref/branch operation. A native Git push dry run failed because no write credential is configured. No branches have been deleted. Do not probe for credentials, create an auth flow, or use a signed-in browser without a separately permitted fallback. Administrative deletion can proceed through an available authorized write-capable tool or the owner's GitHub UI later; the code/document cleanup does not depend on it.

## Code and documentation changes proposed

Use two cohesive implementation lots after design approval; reuse the design/audit branch for the first documentation lot instead of creating a PR per checklist item.

### Lot 1: current documentation and repository tracking

Reconcile the README against actual source and current main, retaining history in clearly identified historical sections where useful.

- Correct Season 0 **UI reset** instructions using the actual Debug reset handler; distinguish it from low-level `createDevWorldClock().reset()`, which currently clears storage and falls back to Season 1.
- Describe fresh-session defaults separately from explicit reset; preserve runtime behavior.
- Replace obsolete Matchday-only instructions with current Season/World Day controls and derived competition progress.
- Correct current canonical routes, including explicit competition/club subpages and cup defaults, using the route registry and independent hosting tests as evidence.
- Update current catalogue/SVG and preview descriptions based on checked-in files. Do not imply that every planned club crest or the real game exists.
- Keep commands reproducible without npm installation. Preserve security/authorization documentation.
- Include the branch audit and issue dispositions. Do not manufacture a completed-issue count or close living design records to reduce numbers.

Definition of done: documentation claims trace to current code or confirmed GitHub state; only intended documentation files change; generator check is unchanged; no claimed browser/runtime certification for a docs-only diff.

### Lot 2: CSS readability and proven local duplication

`assets/app.css` is 110,803 bytes with accumulated Calendar/Fixtures/History overrides. First improve readability **in place** so stylesheet URL, request ordering and publication policy stay stable.

- Format valid rules consistently and add concise current-purpose section comments.
- Keep selector/declaration/media-query order, specificity, values, fallbacks and custom properties. Retain `!important` where required.
- Remove an exact duplicate or merge adjacent rules only when cascade equivalence is demonstrated, with relevant state/viewport evidence. No broad sorting, selector renaming or framework introduction.
- The literal backslash-n sequence around CAL-IMP-03 is a known parsing-risk area. Do not globally replace escapes or activate previously ignored CSS under the label of formatting. Preserve its runtime interpretation; report an actual bug separately if found.
- Do not delete Calendar declarations solely because simplified UI hides the corresponding static elements: investigate DOM, DEV hooks, translations, theme and restoration paths first.
- No visual redesign, spacing restyle or new controls. No numerical size-reduction target that encourages unsafe deletion.
- Remove a file only after static, generated, dynamic/DEV, publication and test references have all been checked. No generic asset purge: unused-in-HTML does not imply unused.

Dependencies reviewed: `landing.css` supplies shared tokens, while `landing.js` implements the language selector used by Settings. Removing either from app pages without a separately verified extraction would be unsafe. **Keep both in this conservative lot.** No speculative JS/module split is required. A later extraction should be proposed only for a measured need.

## Verification and acceptance

For documentation, inspect the targeted diff, check referenced paths and run `node tools/generate-app-pages.mjs --check`. Runtime tests are not evidence of prose correctness.

Before CSS changes, capture the exact unchanged base and establish the relevant browser baseline. Then:

1. Run generator check and `node --test --test-concurrency=1 tests/*.test.mjs` using Node 22 as required by repository CI.
2. Run the existing real Chromium checks relevant to Calendar, Fixtures, History, clubs, shell and themes; inspect required CI jobs at the exact proposed head. Do not label skipped browser work as PASS.
3. Compare before/after rendering and computed style for touched selectors at 1440/390/320 widths, dark/light, EN/DE/ES/FR/IT. Cover hover/focus/disabled/hidden states, modal close/escape and reduced motion where touched.
4. Keep generated output, catalogue, artwork and hosting rules identical. Any difference outside the approved scope stops that lot.
5. Review the final PR diff for unrelated files, especially CSV line endings. Report actual checks, failures and environmental gaps.

Use existing tests; add a test only for a concrete uncovered risk or proven defect. Do not introduce snapshot churn, tests mirroring formatting or a new build dependency.

## Builder decisions and completion reporting

The builder may choose formatting conventions, exact evidence commands and bounded rule groups while retaining the constraints above. If a planned removal cannot be proved safe, leave it in place and report why. Keep the two lots cohesive; split further only if review/testing makes the combined diff unsafe.

Completion reporting must separate: actions already performed, proposed changes, verified results and outstanding access blockers. A docs/design commit is not implementation completion. No global cleanup completion claim while code or branch deletion remains outstanding.
