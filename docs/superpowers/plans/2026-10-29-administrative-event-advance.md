# Atomic administrative event advancement

Goal: finish the movable administrative milestone implementation in #315 using the approved Workers/D1 architecture and existing event placement policy.

Contract: start activates day 1. Advance executes current-day scheduled milestones in ordinal order before moving one day forward. Reject overdue events, invalid dependencies, foreign/modified snapshot or artifact evidence. Retain individual event commands. No matches are finalized before publication; publication establishes deterministic sporting receipts through the destination day and hands off to the existing lifecycle.

## Implementation
- [x] Author real D1 regression cases for automatic confirmations, domestic generation, same-day draw/publication, moved event days, replay/concurrency, late audit rollback, corruption and day12→13 handoff.
- [x] Add a read/plan-only artifact builder. Recompute expected receipts/artifacts from the approved snapshot and immutable saved seed, returning transaction guards and writes without executing them. Validate existing completed evidence before trusting event status.
- [x] Wire this plan into the single clock batch: live session + exact world/snapshot/events/artifacts + new artifacts/receipts + world increment + audit. Reject crossing day12 without publication.
- [x] Permit the UI event advance at day12 for a valid administrative projection. Inspect the diff and compile types; do not execute test suites or dispatch CI.
- [ ] Update #315's single event checklist entry as implementation-complete, separately from pending acceptance, and keep #326 Draft/HOLD.

## Review focus
Missing/corrupt/extra artifacts and forged completed receipts must fail closed. Same-day events must consume outputs planned earlier in the same transaction. Concurrent changes to any read evidence must abort. Late failure must leave no partial world, event, draw or result mutation. Publication at day12 must persist real destination-day13 results rather than advance to a missing sporting receipt.

## Owner verification override
All automated test execution and CI alignment/execution are deferred to the final consolidated gate. New coverage is authored only; no PASS or RED→GREEN evidence is claimed. Existing obsolete expectations will be updated in that final test alignment block. No merge, deploy or remote D1.

## Static review
Independent source/migration review found no important runtime defects. Corrected the corruption-test setup to temporarily bypass and restore the completed-event immutability trigger. Added explicit missing/extra artifact, transaction-time evidence loss and credential-revocation cases following review. No tests executed; TypeScript remains blocked only in the unchanged files listed in operations documentation.
