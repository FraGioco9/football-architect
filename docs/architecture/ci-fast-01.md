# CI-FAST-01 — scoped CI for protected provider changes

Tracking: #268. Draft/HOLD; no merge, deployment, or database operation.

The default remains full `Site checks` and INT-24 Chromium. The fast path
applies **only to pull requests** whose complete base-to-head diff consists of
existing allowlisted unpublished provider contracts, adapters, focused tests,
and their provider-contract documentation; it also requires a source/test file
rather than documentation-only changes. All unknown/invalid/empty diffs,
workflow changes, publication-policy changes, public assets, UI, routing,
calendar, sports rules, generated artifacts and push-to-main events are **full**.
The classifier fails closed if git diff or PR-base lookup fails.

Fast PRs run the targeted provider contracts and safety/publication tests.
Their Chromium job succeeds after an explicit eligibility check without
installing a browser. This **does not mean Chromium ran**, and check summaries
must distinguish a bypass from actual browser validation. Full-scope PRs run
the original complete sequential Node suite and 205-check browser workflow.
Main pushes run complete Node and Chromium regression; exact SHA assertions
remain in both workflows. No changes to publication allowlist or deployment.

No speculative runtime reduction is claimed. First exact-head CI on this
workflow-changing PR must run full suites; measure an eligible later PR to
establish actual speed-up. Required GitHub check names remain unchanged.
