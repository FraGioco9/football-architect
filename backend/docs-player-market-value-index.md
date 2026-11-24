# #763 — derived market-value index (DRAFT/HOLD)

The canonical value is still computed from public sporting inputs by player-market-value.mjs.
Migration 0037 creates an indexed, discardable read model with a revision and configuration fingerprint. Pending rows are deliberately not treated as zero or unavailable. Global filtered/sorted GET fails closed until every retained player is covered and current. Normal directory/detail/roster reads continue to derive values; returned ranked rows are checked against that same calculator.

Generation publishes the index in its existing atomic transaction. SQL triggers invalidate age/status/role/attribute changes and add pending rows for direct inserts; foreign-key cascade deletes cache rows. Hidden seed/aptitude, affiliations and world resets that preserve player data do not affect valuation. Future progression/retirement writers must publish the new value in their own write transaction using the shared index helper, or explicitly refresh pending rows before enabling global valuation reads. No read-triggered repair. Changes to any coefficient or aggregate forecast exposure change the SHA-256 configuration fingerprint; bump the index algorithm token when suitability/forecast semantics change.

## Explicit maintenance, local only
After separately applying migration 0037 to an authorized LOCAL D1 state, from backend:
```powershell
node --experimental-strip-types tools/refresh-player-market-values.mts --state "<existing-local-state-directory>" --confirm-local-refresh
```
This command requires existing local state, does not apply migrations, and has a bounded retryable loop. No remote D1 support, deploy or automatic backfill. Before remote rollout, review an authorized maintenance procedure and version transition, measure real D1/Worker latency, and ensure coverage before serving global ranking. Do not simply deploy onto a pending index.

## Evidence gate
The local D1 test covers both rank directions, exact inclusive bounds, null-last, stable ID ties, 50/50/3 pages, dirty/config version fail-closed, stale CAS, affiliation and private-field independence, and SQL index plans. Run targeted runtime tests and the full exact-head CI. The large-world Worker/D1 performance audit is still required (6,400, 8,001, 10,000 and 30,000+ players; true cold/warm latency, CPU and row reads). No claim of hosted performance yet.


## Validation — 2026-11-24
Exact source audited at 16625612bba33e6ae05a968600deae6cf5fa6662 (includes #769 forecast). The actual local Worker Vitest run 45306082258 reported 321/322 tests passing; the indexed D1 integration test passed, but the generation test failed because the first committed response incorrectly reported alreadyCommitted=true. The post-commit metadata check can count trigger effects; replaced it with an in-transaction draft-status guard in addition to the existing exact player/portrait/index row-count guards. Await exact-head CI for the fix. Cache fingerprint also hashes the #769 synthetic exposure grid directly, not just its named version.

Separate in-memory SQLite 3.46.1 experiment: equivalent 0037 schema/SQL, simplified generated_players and affiliation tables, synthetic numeric cache values including ties/null/zero (not the actual forecast), 200-row SQL refresh batches, 30 warm iterations per operation with varying offsets (0, 50, 500 and up to 5000), readiness + count + ranked page in a single transaction. This measures SQL only, not canonical value computation, Worker CPU, remote D1 network or billing.

| Rows | DESC p50/p95 ms | ASC p50/p95 ms | Range + ASC p50/p95 ms | Position + min + ASC p50/p95 ms | Range + age ASC p50/p95 ms |
|---:|---:|---:|---:|---:|---:|
| 6400 | 0.328/0.547 | 0.336/0.498 | 0.326/0.417 | 18.937/20.516 | 11.175/14.775 |
| 10000 | 0.606/0.809 | 0.535/0.750 | 0.495/0.802 | 30.893/35.203 | 17.154/22.328 |
| 30000 | 1.490/1.715 | 1.433/1.811 | 1.316/1.767 | 106.627/116.248 | 56.911/68.143 |

All three populations: migration coverage, complete ASC/DESC IDs vs independent sort, pending state, each age/status/role/attribute invalidation, stale CAS rejection, private-field/affiliation independence, config mismatch, insert and cascade delete passed. Covering ASC/DESC indexes used for inner ranked query; outer sort only handles up to 50 rows. Range scans use range index; combined sporting filters may join/parse many stored payloads and sort before LIMIT, still a separate optimization gate. At 30k, SQL-only backfill took 321 ms excluding calculation; do not claim actual D1 or Worker duration.

**Remaining HOLD:** exact-head full CI, true local Worker/D1 performance at large populations and cold/warm/concurrent profiling; no remote DB changes. Do not extrapolate SQL-only timings to end-to-end speed.
