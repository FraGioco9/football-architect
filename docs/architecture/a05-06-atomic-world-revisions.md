# A05-06 — Atomic World Progress transitions and independent revisions

**Issue:** #268 / A05-06. **Baseline main:** `76a55470ae18f0b0c7a17252c3bd7ff372d8044f`. **Status:** Draft/HOLD.

## Atomic transition contract

The single global World Progress owner accepts a candidate `{season,day}` only after validating the source, season boundary and 56-day abstract-day range. A successful transition publishes one consistent next snapshot; no consumer may observe a partially updated season/day combination. Invalid candidates do not alter the current snapshot. A transition that represents no change does not advance the world revision.

The existing protected DEV `createDevWorldClock` implements atomic session-storage updates with rollback on write failure. DEV Season 0 is an explicit disabled state: `day=1`, null active snapshot, zero national progress, no generation of verified results. The DEV store and its revision are **not** public authoritative results or a production scheduler. This checkpoint specifies invariants and does not claim all future world-clock sources already support the same implementation.

## Independent revisions and stale-response safety

| Revision owner | Changes when | Must not change when |
| --- | --- | --- |
| `worldRevision` | Accepted, effective World Progress transition | Merely choosing a Viewed Season, rerendering, invalid/no-op transition |
| `viewRevision` | A page changes its Viewed Season/route-specific read context | World-clock ticks with unchanged view selection |
| `providerRevision` | A validated provider dataset publication or explicit invalidation | Clock progress alone, unless a defined provider invalidation is actually published |

These are **logical independent monotonic counters**, not claims that the current runtime already exposes all three names. A consumer request captures the applicable `viewRevision`, `providerRevision`, season and competition identity; late responses must be rejected when any relevant captured key no longer matches. The world transition may cause a new projection without mutating historical provider content or forcing a viewed-season change. Each snapshot and revision pair is read atomically by its owner; cross-owner updates require explicit event ordering rather than one shared mutable counter.

## Rejection and equivalence cases

- Invalid season/day, unavailable or improperly provenanced clock: fail closed, no partial publish.
- Storage failure during DEV multi-key updates: restore earlier keys, emit no successful transition.
- Idempotent candidate: no extra revision or duplicate event dispatch.
- Concurrent/pending async provider responses after a view or provider revision change: discard stale delivery, never overwrite a newer or unrelated competition.
- Change in World Progress while viewing past/future season: only relative calendar projection changes; no implicit Viewed Season switch or match resimulation.
- Disable DEV Season 0: null World Progress snapshot; independent Viewed Season may remain selected; no completion inferred.

## Ownership, implementation gate and regressions

This A05-06 lot **specifies** atomic transitions and revision ownership. It does not implement new runtime counters or claim consumer migration. A05-07 must capture behavior equivalence before refactoring; A05-08 integrates DEV World Clock and A05-10 integrates page consumers. A04 continues to own provider provenance, results and data revisions.

Reuse existing `tests/cal-world-56a.test.mjs`, provider lifecycle tests, `tests/a04-11-isolation-boundary.test.mjs`, full Site checks and Chromium exact-head workflows. No changes to source, public runtime, generator, data, CI workflows, publication guard, deployment or DB. Check full exact-head CI and mergeability before seeking separate merge authorization.
