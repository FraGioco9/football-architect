# #763 — derived market-value index (DRAFT/HOLD)

The canonical value is still computed from public sporting inputs by player-market-value.mjs.
Migration 0037 creates an indexed, discardable read model with a revision and configuration fingerprint. Pending rows are deliberately not treated as zero or unavailable. Global filtered/sorted GET fails closed until every retained player is covered and current. Normal directory/detail/roster reads continue to derive values; returned ranked rows are checked against that same calculator.

Generation publishes the index in its existing atomic transaction. SQL triggers invalidate age/status/role/attribute changes and add pending rows for direct inserts; foreign-key cascade deletes cache rows. Hidden seed/aptitude, affiliations and world resets that preserve player data do not affect valuation. Future progression/retirement writers must publish the new value in their own write transaction using the shared index helper, or explicitly refresh pending rows before enabling global valuation reads. No read-triggered repair. Changes to any coefficient change the SHA-256 configuration fingerprint; bump the index algorithm token when suitability/forecast semantics change.

## Explicit maintenance, local only
After separately applying migration 0037 to an authorized LOCAL D1 state, from backend:
```powershell
node --experimental-strip-types tools/refresh-player-market-values.mts --state "<existing-local-state-directory>" --confirm-local-refresh
```
This command requires existing local state, does not apply migrations, and has a bounded retryable loop. No remote D1 support, deploy or automatic backfill. Before remote rollout, review an authorized maintenance procedure and version transition, measure real D1/Worker latency, and ensure coverage before serving global ranking. Do not simply deploy onto a pending index.

## Evidence gate
The local D1 test covers both rank directions, exact inclusive bounds, null-last, stable ID ties, 50/50/3 pages, dirty/config version fail-closed, stale CAS, affiliation and private-field independence, and SQL index plans. Run targeted runtime tests and the full exact-head CI. The large-world Worker/D1 performance audit is still required (6,400, 8,001, 10,000 and 30,000+ players; true cold/warm latency, CPU and row reads). No claim of hosted performance yet.
