# Final test alignment for #315

Base remote source: 6de42e9fe7fa0ae9f9fd408225f9e73b9381d1a8. Existing isolated feature worktree.

Owner constraint: align tests before the final consolidated execution; no runtime/browser/CI execution in this alignment block. Static syntax/type/whitespace checks are allowed. No merge/deploy/remote D1.

- [x] Correct nine known type diagnostics without changing qualification policy.
- [x] Discover every pure Node backend contract; preserve separate Worker/operator runners and fail closed on missing coverage.
- [x] Update obsolete explicit-event blocking, qualification-approval, public Season2 and Admin controller fixtures to current contracts.
- [x] Wire actual disposable Worker/D1 browser lifecycle, separate anonymous session, historical navigation, reset and keyboard/five-locale checks into final Admin harness.
- [x] Align Site/CI selection and syntax coverage, inspect generator/source contracts, document final commands and source-only review.

Ruling: per-step runtime RED/GREEN is deferred by explicit owner request; authored scenarios are not execution evidence and no acceptance checkbox is closed here.

Source review: two P2 findings corrected (await terminal stale-projection rejection and track all authoritative commits; preserve explicit season in History/Rules preview redirects and update alias tests). No runtime review claims. No deferred minor findings.

Static evidence: full backend TypeScript exit0 after the nine fixes. Syntax and whitespace inspected before publication. Runtime/browser/CI execution and performance remain unverified; checklist stays19/22.

Ruling: the fixed historical browser URL oracle now retains explicit season for History/Rules; only those two recorded rows change. This is required by the already-approved independent viewed-season behavior. If wrong, shared History links would select the current season after reload.
