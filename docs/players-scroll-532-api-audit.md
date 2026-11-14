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

## Reproducible local synthetic SQLite measurements (2026-11-14)

Command (Python 3.11+, no dependencies): `python tools/bench-public-players-532.py --sizes 1000,10000,50000 --repeats 13`. The script **only** uses `sqlite3.connect(":memory:")` with deterministic synthetic players; it never opens a user, development, hosted or remote database. Representative run: Python 3.13.5, SQLite 3.46.1, warmed up then 13 timings per case, milliseconds. The synthetic JSON payload is smaller than an actual generated-player record; host CPU, database cache, Cloudflare D1 network and real data distributions differ.

| SQL scenario | 1k median / p95 | 10k median / p95 | 50k median / p95 |
| --- | ---: | ---: | ---: |
| `COUNT(*)`, no filter | 0.002 / 0.080 | 0.003 / 0.006 | 0.007 / 0.039 |
| `COUNT(*)`, JSON nationality | 0.516 / 0.583 | 5.928 / 10.518 | 27.998 / 29.321 |
| `COUNT(*)`, two JSON skills | 0.619 / 0.992 | 6.847 / 7.518 | 33.937 / 35.449 |
| First 50, `id DESC` | 0.036 / 0.037 | 0.035 / 0.416 | 0.035 / 0.062 |
| Last 50, deep `id DESC OFFSET` | 0.080 / 0.265 | 0.587 / 0.693 | 2.904 / 4.234 |
| First 50, JSON age sort | 0.922 / 1.265 | 8.650 / 13.742 | 40.368 / 43.484 |
| First 50, nationality filter + age sort | 0.725 / 1.191 | 7.515 / 8.898 | 34.629 / 39.638 |

At 10k, `EXPLAIN QUERY PLAN` shows `SCAN generated_players` for nationality counts, an index/PK-assisted lookup for the default ID order and `USE TEMP B-TREE FOR ORDER BY` for the JSON-age sort. These are **local synthetic timings, not D1 SLO compliance**. No index or API change is justified without representative D1-equivalent data and actual browser memory/network observations.

## Nonvisual append announcements (automated exact-head CI PASS at `b73c9bb`; new browser metrics pending)

The current approved UI retains a disabled localized Loading... button during append, hides it at EOF and provides no visible appended-count/footer copy. In this PR, an *independent persistent* `.sr-only` `role=status`/polite live region follows the sentinel, outside the pager that hides at EOF. It announces the newly appended count and displayed total, EOF and errors in EN/DE/ES/FR/IT. The existing focusable table scroll region receives keyboard focus before a focused fallback button is disabled. Sorting/filtering clears stale append text. A focused regression test exercises append, EOF/error/retry and focus handoff. This does **not** imply a real VoiceOver/NVDA signoff.

## Browser-only synthetic API / DOM metrics (pending exact-head Browser QA)

The Chromium browser suite now runs `verifyPlayersScrollBrowser` against an **intercepted 1,000-player fixture**. It reports time to first synthetic data, the number and total bytes of mocked API responses, 50/100/250/1,000-row DOM growth, heap observations when exposed by Chromium, and median/p95 append timing. It also activates Load more using the keyboard, checks focus handoff and the status announcements, and reaches EOF without any remote DB. The observer is disabled in this diagnostic to exercise the manual fallback deterministically.

The measurements are CI-runner and synthetic-payload diagnostics only, **not** production Worker/D1 latency, real network bandwidth, or evidence that live assistive technology announces the text. Do not set pass/fail latency budgets from these numbers. Actual D1/Worker p50/p95 and manual NVDA/VoiceOver remain pending.

## Targeted acceptance matrix and limits
| Area | Evidence | Remaining action |
| --- | --- | --- |
| Public API query grammar and legacy URL retirement | Existing parser/DEV/source tests and approved #567 contract | No compatibility rollback; ensure documentation remains consistent |
| Cardinalities 0, 1, 50, 51 and page 2 | Real public-read contract tests | PASS on previous exact-head #600 SHA `dbcdf11b` (recheck new head after accessibility edits) |
| World generation changes | Actual read function with synthetic world-generation transition | PASS on previous exact-head #600 SHA `dbcdf11b` (recheck new head) |
| Concurrent append, EOF, retry, count shift, ID overlap | Existing executable frontend behavior tests in `tests/players-directory.test.mjs` | Full browser smoke remains important |
| Rapid overlapping sorting/refetch | Executable stale-success/stale-error test | PASS on previous exact-head #600 SHA `dbcdf11b` (recheck new head) |
| Auto-append accessibility | This PR adds a persistent visually-hidden localized live region with append/EOF/error announcements and keyboard-focus handoff from Load more | CI and actual screen-reader/keyboard AT verification still required; sitewide focus remains #596 |
| Performance | Measured in-memory synthetic SQLite p50/p95 and plans for 1k/10k/50k; reproducible stdlib-only script included | Real D1 latency/bytes and browser heap/DOM measurements not yet verified |

## Safe follow-up performance protocol
1. On a **local throwaway DB only**, load 1k/10k/50k synthetic player rows. Do not change an existing user DB or any remote D1 instance.
2. Measure p50/p95 first 50, subsequent five segments, `COUNT(*)`, no filter vs common nationality vs 1–4 JSON skill filters, ID/name/age/skill sorts, and first vs deep `OFFSET` values; collect `EXPLAIN QUERY PLAN` and bytes returned.
3. Measure renderer DOM nodes and heap after 50/250/1000/5000 appended rows, time to first content, and Back/Forward restoration. Compare with an approved baseline. The historical tentative target of <=250 rendered rows is **not** implemented and must not be declared PASS.
4. Verify keyboard traversal of the manual button, live announcements for appended results, EOF/retry and focus restoration, without adding visible footer/loading copy contrary to the approved UX.
5. Propose an index/count-cache/cursor/virtualization change only if measurements justify it. Such changes require a separate scoped approval; no automatic migration, deploy or merge.

**Operational gate:** Draft/HOLD audit PR, no remote DB/deploy. #532 stays open until remaining measurable performance and accessibility acceptance is supported by evidence.
