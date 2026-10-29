# Season2 persistent command layer

Goal: make the approved Season1→2 transition and Season2 calendar/start/advance/close safe at the backend layer. No new HTTP/UI activation entry point is exposed until subsequent consumer/event integration is complete. #315 remains18/22 (81.8%).

- [x] Author disposable D1 coverage for actual Season1 closure/approval, atomic prepare2/replay/concurrency/rollback, Season2 fixtures/start/day1–56/archive, preserved Season1 data, missing/tampered/commit-time-replaced approval, no automatic Season3 and invalid transitions. Tests remain unexecuted per owner.
- [x] Separate the private verified Season1 qualification source from its public Admin review packet. Permit archival Season1 reconstruction internally while current world is Season2; retain the externally visible closedSeason1 restriction.
- [x] Load the season-specific validated snapshot and exact source guards. Every Season2 mutation pins original Season1 snapshot/calendar/draws/results/ties/archive plus immutable owner approval in its own transaction.
- [x] Implement internal protected prepareSeasonTwo and parameterize existing calendar/lifecycle/closure SQL, payloads and archive IDs by supported season1/2. Preserve revision, idempotency, live-session, rollback and history guarantees.
- [x] Source review plus syntax/type inspection, documentation and GitHub evidence. No route, UI activation control, remote DB, migration, deploy, merge or test/CI execution in this block.

Review focus: no approval inferred from mere rules/participant validity; no rewriting closed Season1; approval/source evidence cannot change between validation and commit; Season2 replay/results/archive remain scoped correctly; missing/late-failed writes leave no partial season; unsupported Season3 fails closed.

Independent source review: no blocking correctness findings; source authority recursion terminates at Season1, SQL guard bindings match, source and target writes stay separate. Added forced final-batch interleaving, preexisting target, valid-content approval-byte replacement and revocation coverage following review. No tests executed. Syntax/whitespace checks pass; only the same9pre-existing TypeScript errors remain. HTTP/UI activation, public/event integration and checklist acceptance remain pending.
