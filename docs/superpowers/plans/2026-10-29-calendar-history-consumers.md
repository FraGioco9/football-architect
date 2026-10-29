# Calendar and History authoritative consumers

Goal: complete the remaining public-consumer implementation for #315 without claiming final test/browser/CI acceptance. Preserve selected-season independence, immutable results/rules and DEV isolation.

- [x] Author tests for a global daily calendar read, no-results/unsupported/final-day states, daily fixture parity, saved scores and stale/reset responses; author History view-model tests for genuine closure, champion/table consistency and active/reset clearing. Execution deferred by owner.
- [x] Reuse the existing backend evidence validation for one anonymous daily calendar projection; expose saved matches for all18competitions with versioned participant bindings and known phase/tie/leg metadata. Keep the local bridge bounded and GET-only.
- [x] Feed sealed History into existing champion/final-table/team-season-record presentation while retaining unavailable player/all-time records. Keep authoritative provenance distinct from verified-history approval.
- [x] Connect Calendar's current week/day and selected-day dialog to private validated public reads; no browser-event authority, no local-storage world state, no speculative knockout fixtures. Bind request leases to selected season/day and recheck world generation/revision.
- [x] Inspect syntax/types/diff and independently review. Update only the original public-integration checkbox as implementation completion if all five consumers are wired; keep runtime/browser/CI acceptance explicitly pending.

Review focus: calendar entries must match canonical day/marker/participants/rules; no fixture/result count claims from missing source; History only for actual closed selected season with final table/champion consistency; reset and concurrent day selection clear stale payload; public season2 queries never fall back to1; five locales/English default; DEV remains separate. No merge/deploy/remote D1.

Source review: corrected History record key historyBestAttack to match existing markup, and covered it in the authored view-model test. Calendar uses one shared-validated daily read and waits for its dialog UI to initialize; same-day reopening revalidates rather than reusing stale cached sporting payload. Syntax/whitespace inspection passes; full tsc has only the same9pre-existing diagnostics. No runtime/browser/tests/CI execution. Public integration receives implementation credit only; final acceptance remains open.
