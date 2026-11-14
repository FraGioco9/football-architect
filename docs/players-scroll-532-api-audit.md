# PLAYERS-SCROLL-01 (#532): API/D1 and edge-case acceptance audit

**Source baseline:** `main@557b13d8d2b8bcf5ea21c1fe5bd57db7e3f3fcd6` (2026-11-14, after merged #567). This audit is read-only with respect to remote databases. Mobile QA remains exclusively in #574 and the sitewide keyboard-focus audit in #596.

## Confirmed behavior
- Public `GET /api/players` accepts **strict** `offset` values from 0 to 499900 in 50-player increments; `page=N` is deliberately retired. The unchanged payload is `{players,count,page,pageSize,totalPages}`. The Worker and DEV/proxy use the shared filter allowlist. Illegal, duplicate, unknown, noncanonical and malformed parameters are rejected.
- `readPublicPlayers` takes a world generation snapshot before and after the read; a changed generation returns 409. ID identity is independent of season resets. Sort is server-authoritative, default `id DESC`, explicit sort expressions are allowlisted with an `id ASC` tie-breaker.
- The list query joins `player_club_affiliations` by its **unique** `player_id` primary key, avoiding fan-out and extra club requests; the displayed name is from the canonical club catalogue. Current club is exposed only in public Overview, as approved.
- A query makes **one separate COUNT(*) plus a SELECT per 50-player page** (and two world reads), even for later segments. `WHERE` predicates and many sort expressions call `json_extract(payload_json,...)`. D1 migrations 0020–0022 provide indexes for generated-player world/batch, `id` PK and club affiliation, but no dedicated expression indexes for nationality/age/name/skills.
- The client checks count, totalPages, pageSize, page and duplicate IDs across appended pages. A changed count/duplicate/stale world halts append and offers restart. An insertion followed by deletion can preserve count and still shift OFFSET boundaries; the current protection is **not** a database snapshot.
- The client appends all fetched rows to `current.players` **and to the DOM**. It does not virtualize long lists or enforce a 250-row retention cap. This needs large-list memory measurement, not an assumed PASS.

## Local SQLite query-plan illustration (NOT remote Cloudflare D1 evidence)
Using the equivalent migration tables and 10,000 **synthetic in-memory** generated-player rows in SQLite 3.46:
- `SELECT COUNT(*) FROM generated_players` used a covering index scan.
- A default `ORDER BY id DESC LIMIT 50 OFFSET 9950` scanned the primary table and searched the affiliation table using its primary key.
- `COUNT(*)` with a nationality JSON filter scanned `generated_players`.
- The filtered `ORDER BY json_extract(payload_json,'$.age') DESC, id ASC` scanned players and used a **temporary B-tree for ORDER BY**.

The plans demonstrate structural work to profile; they do not predict hosted D1 p50/p95 latency, bytes, cache behavior or production throughput.

## Targeted acceptance matrix and limits
| Area | Evidence | Remaining action |
| --- | --- | --- |
| Public API query grammar and legacy URL retirement | Existing parser/DEV/source tests and approved #567 contract | No compatibility rollback; ensure documentation remains consistent |
| Cardinalities 0, 1, 50, 51 and page 2 | Added runtime DB-adapter tests in this PR | PASS only after exact-head CI |
| World generation changes | Added rejection test against actual read function | PASS only after exact-head CI |
| Concurrent append, EOF, retry, count shift, ID overlap | Existing executable frontend behavior tests in `tests/players-directory.test.mjs` | Full browser smoke remains important |
| Rapid overlapping sorting/refetch | Added executable stale-success/stale-error test in this PR | PASS only after exact-head CI |
| Auto-append accessibility | Native Load more/Retry button exists; loading rows have status semantics | Screen-reader announcement of **new appended rows** is not demonstrated; keyboard/VoiceOver test pending |
| Performance | Source analysis and local illustrative query plans above | Hosted-equivalent D1 `EXPLAIN QUERY PLAN`, p50/p95, bytes, memory/DOM and benchmark baselines remain to be measured |

## Safe follow-up performance protocol
1. On a **local throwaway DB only**, load 1k/10k/50k synthetic player rows. Do not change an existing user DB or any remote D1 instance.
2. Measure p50/p95 first 50, subsequent five segments, `COUNT(*)`, no filter vs common nationality vs 1–4 JSON skill filters, ID/name/age/skill sorts, and first vs deep `OFFSET` values; collect `EXPLAIN QUERY PLAN` and bytes returned.
3. Measure renderer DOM nodes and heap after 50/250/1000/5000 appended rows, time to first content, and Back/Forward restoration. Compare with an approved baseline. The historical tentative target of <=250 rendered rows is **not** implemented and must not be declared PASS.
4. Verify keyboard traversal of the manual button, live announcements for appended results, EOF/retry and focus restoration, without adding visible footer/loading copy contrary to the approved UX.
5. Propose an index/count-cache/cursor/virtualization change only if measurements justify it. Such changes require a separate scoped approval; no automatic migration, deploy or merge.

**Operational gate:** Draft/HOLD audit PR, no remote DB/deploy. #532 stays open until remaining measurable performance and accessibility acceptance is supported by evidence.
