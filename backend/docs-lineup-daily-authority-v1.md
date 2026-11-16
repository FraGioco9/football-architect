# #613 — Daily lineup result authority: cutover contract (proposal, HOLD)

Status: **not wired / not authorized for production**. PR #642 is Draft/HOLD.
Do not run migrations 0028/0029 remotely or merge without separate owner approval.

## Current architecture verified

1. `lifecycle-command.ts` already advances one sporting day at a time in an
   authenticated, guarded D1 `db.batch`. It replays authoritative old score
   receipts and knockout tie plans before finalizing the destination day.
2. `admin-calendar-publish.ts` and `admin-calendar-advance-plan.ts` also
   backfill days that passed before final international-calendar publication.
   This is limited to previously elapsed administrative days, **not** the
   entire upcoming 56-day season. The future lineup scorer cannot run there
   with a stale roster snapshot if matches are already due.
3. `season_day_outcomes.simulation_version` currently CHECKs only
   `temporary-score-v1`. The Sporting/Match/History/Archive readers and
   replay paths re-derive the full legacy score receipt rather than trusting
   the presence of stored rows.
4. Unpaginated live affiliated rosters exist and are mutable without changing
   the world revision; the staged #613 read helper provides per-club count,
   player record and affiliation guards. Receipt persistence and public
   match IDs are separate from the old day score envelope.

## Cutover decision

**Pin the simulation authority once per generation+season at preparation,
before day 1**, not when a match starts. No midseason activation or retroactive
rewrite. Existing `temporary-score-v1` seasons remain under their original
authority. For a newly pinned season, **every daily receipt, including empty
administrative days, must use a forthcoming versioned V2 envelope**, not
`temporary-score-v1`; mixing is rejected.

Migration 0029 and `lineup-daily-authority-v1.mjs` only stage this pin and
validate a necessary contiguous day prefix. They **cannot** activate it.
The old `season_day_outcomes` schema rejects new lineup simulation version
until a separate approved migration is designed; reader/archive/replay code
must recognize and independently validate both historical authorities first.

## Proposed authorized processing sequence (separate implementation)

1. During season preparation, check generation, revision, season snapshot,
   empty day results, empty match receipts and absent authority pin; append
   the pin to the authorized command's existing `db.batch`.
2. During calendar publication, generate **only elapsed** empty or due days
   using the pinned authority's versioned envelope; do not pre-generate
   future scores or freeze future real-player XIs.
3. On each `advance` operation, verify and load all preceding versioned day
   evidence, canonical source fixtures, knockout plans and results. Derive
   the due fixture set from the current trusted schedule/progression, not
   a user-supplied list. Keep every result generated after the previous
   world day, never on GET/refresh.
4. For each due fixture, read its current eligible club affiliates, derive
   the deterministic XI, preserve team-level fallback where needed, check
   the immutable public match number and independently verified source,
   and construct one immutable per-match receipt.
5. Commit, in **one authenticated D1 batch**, all roster snapshot guards,
   verified source guards, prior outcome guards, new match receipts,
   knockout tie plans, one new day envelope, world CAS advancement
   and the operator audit/idempotency record. No partial wins or "best
   effort" writes. A reassign or profile edit before commit aborts the
   entire transaction and forces a fresh planning pass.
6. Read models project only actually finalized immutable match receipts
   from the selected authority; historical `temporary-score-v1` rows keep
   their previous replay contract. No future-result or future-XI leakage.
7. Archive/standings/qualification replay use the same canonical V2 proof
   instead of re-simulating against the **current** roster; preserve
   deterministic knockout winner/aggregate/ET/PK resolution and exact
   fixture/result counts.

## Acceptance gates before enabling a single official result

- No V1/V2 mixed day receipts per season; no retroactive changes to
  historical results.
- New-player contract/change between read and commit aborts atomically
  even if world revision stays unchanged.
- Required fixture count and stable published IDs; no phantom IDs/players.
- New receipt hash, per-player scored goals and team/unattributed goals
  reconcile; no penalty-shootout goals in official scores.
- All 56 days replay chronologically using version-aware proof and new
  archival hashes; old seasons still replay byte-identically.
- Retry and operator audit remain idempotent, and current/future public
  consumers never manufacture missing sporting evidence.
- Worker D1 test (not just SQLite), Site, Admin, Browser and FULL exact-head CI
  pass; local/Preview QA and explicit owner approval for merge/deploy/remote
  D1/cutover follow separately.

**Important**: the pinned-season preflight is necessary but not sufficient:
it must never directly call `executeLifecycle`, write a day receipt or
authorize a remote migration. This document does not itself lift HOLD.
