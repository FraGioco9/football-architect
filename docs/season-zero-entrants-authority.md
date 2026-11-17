# Season 0 entrant-confirmation authority (#675)

Season 0 has no `seasons` row or scheduled season events. Its two independent
operator confirmations are stored in `season_zero_approvals`, never inferred
from static division catalogues or Debug state.

- The snapshot is `loadApprovedSnapshot()`: the separately owner-approved,
  immutable first-season membership and rule set. Each Admin POST supplies a
  snapshot hash from its authenticated Calendar GET, plus the expected world
  generation and revision. The Worker recalculates the trusted hash.
- Every receipt binds the scope, generation, full snapshot hash, participant
  hash, rules hash, actor, timestamp and resulting revision. Inserts,
  `world_state` compare-and-swap revision increments and the audit operation
  are one atomic D1 batch. Both scopes are separately approved; a stale
  revision rejects concurrent submissions even across scopes. Reusing an
  idempotency key returns only the same actor's verified outcome.
- The anonymous Season 1 competition projection, while world is still Season 0,
  exposes club identities **only for the approved scope**. Its payload is
  `entrantsOnly`; it contains no fixtures, draws, results or rankings. The
  frontend retains unranked dashes until an actual official league match.
- `prepareSeason` re-verifies all Season 0 receipts and the trusted snapshot
  without changing their approval. During Season 1 Admin event initialization,
  each previously approved scope is copied into that season's standard
  completed, receipt-gated milestone (with the approved snapshot's same hashes).
  Unapproved scopes stay scheduled for normal day-1 confirmation. Thus no
  second competing authority or second confirmation for a preapproved scope.
- The existing authenticated RESET SEASON 0 rotates the generation and
  deletes approvals inside its guarded batch. A reset is also available for
  an unstarted world *only when there is an approval to invalidate*.
  Historical operations remain for audit, not public authority.

Migration `0032_season_zero_entrant_approvals.sql` rebuilds the world singleton
check to permit Season 0 revision increments while retaining the row and
phase/day constraints. Apply the migration through the regular migration
process **before** enabling the new Worker; do not run it against remote D1
as part of PR creation. All owner-approved sporting inputs remain unchanged.

Verification: local SQLite migration tests, Cloudflare D1 runtime tests for
independent scope reads, idempotency, snapshot mismatches, CAS, handoff,
reset and existing Season 1 mechanics, plus browser controller regression.
