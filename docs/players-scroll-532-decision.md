# PLAYERS-SCROLL-01 (#532) — Phase A audit and recommendation

**Status:** owner approved automatic scroll-end loading using offset, without loading/end-of-results labels, and explicitly retired page URLs on 2026-11-14. PR #567 is Draft/HOLD, subject to automated/manual QA; no merge/deploy authorized. Source audited on `main@a558a0dd6086f00773ed9ee951f9d12412f127ae` (2026-11-14). No hosted Preview, Safari or D1 performance benchmark is claimed. The independent default-order correction is implemented separately in the same Draft/HOLD PR.

## Existing contract (verified in source)

- **Historical baseline (superseded):** `GET /api/players?page=N` and Previous/Next were the former pagination contract. The current API accepts only `offset` (0, 50, 100, ... up to 499900) and returns the existing `{ players, count, page, pageSize, totalPages }` JSON shape; SQL continues using `LIMIT ? OFFSET ?`. Old `page` API query parameters now return 422, while public browser URLs containing `page` discard that selection and start at offset 0. Sorting/filtering remain server-side.
- Filters and sorting run **before** LIMIT/OFFSET in D1 for the entire dataset. Each request performs `COUNT(*)` with the same predicates. Many sort/filter expressions use `json_extract(payload_json,...)`; existing generated-player indexes concern world/batch plus the integer primary key, not every expression. Actual `EXPLAIN QUERY PLAN`, measured count cost and byte/request profiles are **pending**.
- Stable public numeric IDs are `INTEGER PRIMARY KEY AUTOINCREMENT` (migration 0021) and player detail uses `/players/<id>`. World reset preserves persisted player identities; the Worker checks `world.generation` around reads but this alone does not snapshot concurrent player insertions across separate page requests.
- Admin generation preview has its own client-side pagination and authorization; club roster is a distinct, unpaginated endpoint. Neither should be coupled to the public directory's scroll decision. The current public directory projection does **not** include a club; detail does include nullable `clubKey` through the canonical `player_club_affiliations` relation.

## UX options

| Option | Benefits | Costs and compatibility |
| --- | --- | --- |
| 1. Keep numbered Previous/Next | Existing `?page=N` permalinks, bounded DOM/network, clear footer and keyboard navigation | Requires explicit page clicks; less fluid exploration on touch |
| 2. Automatic infinite scroll with `IntersectionObserver` | Minimal friction on mobile, progressive fetching | Footer access, keyboard/screen-reader discovery, history/scroll restoration, large DOM and duplicate/skip protection are harder; no observer fallback if JS fails |
| 3. Explicit **Load more** (possible later opt-in hybrid sentinel) | Incremental exploration with clear control and end state, easier keyboard/VoiceOver access, retains existing API in V1 | Must define what deep-linked pages mean and cache/restoration; batch append still needs an upper bound |

**Latest owner-approved direction:** automatic loading near the end of the shell's central vertical scroll pane via `IntersectionObserver` sentinel, with a passive scroll fallback. The public directory accepts only strict `?offset=0,50,100,…`. Old browser `?page=N` selections are dropped, not converted; old API `?page=N` requests are rejected. No loading, end-of-results or "Loaded X of Y" message appears below the table; only retry/restart controls appear on errors. A manual button remains as an accessible fallback and retry control.

## Proposed URL and history contract (subject to approval)

1. A direct `/players?offset=N&sort=...` opens 50 players from the zero-based N (0, 50, 100, …, 499900). Offset 0 can be omitted. Legacy `?page=N` web links are **not converted**: `page` is removed by `replaceState` and the default offset 0 is shown, preserving valid view, sort, filters and fragment. The URL identifies the **initial** segment, not total progress.
2. When the user scrolls near the end, load offsets N+50, N+100, … automatically without changing the start-offset URL; append the rows below existing rows. An explicit Load more button remains for keyboard/manual access and retries. The player total in the header remains. While appending, the fallback button is hidden and no loading text or spinner is shown; at the last segment the footer disappears completely. On failure, the retry/restart control remains available.
3. Opening `/players/<id>` uses an ordinary link. On Back/Forward in the same live tab, BFCache retains the live rows and scroll; on a cold history return the page stores **only position/segment metadata in history state**, refetches up to four appended 50-row segments with consistency checks before painting and restores the originating player link focus and shell scroll. No player objects are written to history/storage. Longer cold returns fall back to the initial segment. On hard refresh/direct paste, reload **only the URL's initial segment** (not all previously appended pages) and let the user continue with Load more; document this distinction to users. Preserve unrelated valid query parameters and fragments.
4. Switching filters or sort clears the appended collection, increments a request generation token, renders exactly five reserved loading rows and requests page 1. Switching Overview/Attributes/group while the same server query is current should rerender without a network request. `popstate` must invalidate stale requests and preserve its requested starting segment and scroll target.

## Data consistency, API and performance decision

- **V1 may use existing OFFSET**, but order must be stable: default **`id DESC`** (independently approved in #532); explicit sorts use a deterministic unique ID tie-breaker. Run at most one append request; ignore a response after filters/sort or world source changes; de-duplicate IDs defensively. For inserts while browsing, OFFSET is **not snapshot-stable**: a new high-ID player can shift page boundaries. Detect duplicate IDs and unexpected counts, and reset/restart from the segment when necessary rather than silently claiming completeness.
- Do not add a breaking cursor parameter to the strict query parser or DEV/proxy allowlists for V1. **Reevaluate optional, versioned cursor/keyset only after profiling**, particularly for deep pages and concurrent inserts. Keyset for arbitrary JSON-derived sort fields needs a typed last-sort-value + ID tuple, fixed direction/null/collation semantics, strict validation and documented expiry/versioning; an ID-only cursor only solves default ordering.
- On world-generation changes, reset the current collection and invalidate in-flight responses; do **not** purge persistent player identities. On page/cursor invalidation or HTTP 409, show a retry/restart control; never append stale data to a new selection. Count is currently recomputed for every page; consider caching a query-scoped count only after measuring cost and ensuring invalidation semantics.
- Preserve `/players/<id>` and Admin Preview. The separately requested **Club** column needs a reviewed public directory LEFT JOIN/serialization of nullable club identity plus canonical label/route mapping; it is **not** a prerequisite for the scroll decision and should not manufacture affiliations.
- Test with 0/1/50/51/many players, deep links, Back/Forward/refresh/player-detail return, simultaneous fetches, network retry, inserts and world reset, keyboard/VoiceOver and iPhone Safari. Include a visible reachable footer and focus indicator. Compare p50/p95 time-to-first-50, requests/bytes per 200 players, COUNT/ORDER BY D1 plans, DOM count, long-scroll memory, scroll restoration and first-paint layout vs the current baseline. A tentative gate is **no >20% regression in p95 time to first data** with bounded rendered rows (target <=250) and exactly one in-flight append, subject to measured baseline and owner sign-off.

## Implementation sequencing / explicit gate

- **Independent, approved work now:** correct server default sort to `id DESC`; add targeted regression tests, verify existing five-row sort loading behavior. Further compact rows, global flag sizes/centering, desktop/mobile columns and canonical Club column require separately reviewed table/API implementation and visual QA under the same issue, not accidental CSS changes.
- **Owner revised direction (2026-11-14):** automatic near-end loading for the public directory, with offset-based batches; preserves the initial `?offset=N` URL, explicitly rejects legacy `?page=N` queries, discards obsolete browser `page` parameters, and keeps the current response shape and server-side sorts/filters. No visible loading or end-of-results messages are rendered below the player table. One request at a time; retries, stale-response protection, duplicate/changed-count restart and accessible localized progress are implemented in PR #567. BFCache retains live DOM/scroll on Back; a cold browser Back replays up to four appended pages using non-sensitive history metadata, while a hard refresh/direct link starts from the initial segment. Browser/Safari QA and performance measurements remain pending. Admin preview continues using numbered pagination.
- No schema migration, remote D1 operation, deployment or merge is authorized by this document.

## Subsequent UI block (#532): compact player rows and table flags

- Shared `.app-players-table` rows, covering public Overview/Attributes, club Roster and Admin preview, were first reduced to 42px and are now **38px** (from 44px originally). Shared vertical padding is now **6px** (previously 8px); header height, font sizes, widths and input targets remain unchanged. The five first-paint and refresh placeholder rows use the identical 38px height.
- Player-table nationality flags use **20 × 15px** (formerly 24 × 18px) in CSS and intrinsic image dimensions for public, Roster and Admin, with `object-fit:contain` and explicit center alignment in their cells. Flags retain their natural aspect ratio inside the box; the existing 54px flag column remains untouched.
- This is a source-level implementation, not proof of Safari visual QA. Globally smaller flags on non-player pages, full responsive column redesign and public Club column are still separate #532 follow-ups.

- **Further compactness adjustment (owner-approved follow-up):** all three shared player-table surfaces now use 38px body and skeleton rows with 6px vertical padding; 44px headers and 20×15px nationality flags remain unchanged. Visual QA on iPhone Safari is still outstanding.

## Additional row-density and hover-centering follow-up

- User-requested additional compression: shared player-table body and five reserved skeleton rows are now **34px**, with vertical cell padding **4px** (previously 38px / 6px). Header, column widths and font sizes are unchanged. This applies to public Players, Club Roster and Admin preview.
- Name cells keep an explicit 18px line-box vertically centered. The name link is an inline-flex box with fixed text geometry; a 1px hover/focus underline is drawn by an absolutely positioned `::after` below the text, so the underline does not affect row layout or name centering. The Club Roster specific decoration override was removed.
- Site/Worker contract regression tests were also updated to current approved `offset` and `id DESC` semantics after detecting stale expectations in the previous CI. Manual responsive visual QA remains pending.

## Latest player-row compactness adjustment

- Shared public Players, Club Roster and Admin preview row height and five first-paint/sort loading rows: **30px** (previously 34px), with vertical table-cell padding **2px**. Column widths, fonts, flags, and 44px headers are unchanged.
- The separate absolute underline on player-name links now uses **`bottom: 0` instead of `bottom: -2px`**, bringing it 2px closer to the text while keeping the centered line box stable on hover/focus. Visual Safari QA is still outstanding.

## Sitewide non-table flag sizing (#532)

- Shared world/competition/country-flag frame tokens reduced from **25×20 to 20×16px**; the competition flag frame's later override now uses the same CSS variables instead of reimposing the previous size. Embedded flag SVGs still preserve their 5:4 viewBox masks and `object-fit:contain`; no SVG content was changed.
- Club header, identity and first-paint country flag placements resolve to the shared 20×16 size, including the fixed min/max header dimensions; the existing Clubs directory flags were already 20×16, so no change was needed there. Static SVG intrinsic width/height attributes remain unchanged; the stylesheet sizes their frames at first paint without requiring mass regeneration of generated pages.
- Player detail flag and its skeleton are now **20×15px** (matching player table flag dimensions) in CSS and the renderer image dimensions. Existing title, age, tab, table column, flag tooltip, team crest and hit-area styling is preserved.
- Regression assertions cover new common flag slots and player-detail first-paint parity; visual mobile Safari QA remains pending.

## Shared player-table header density (approved next step)

- Public Players Overview/Attributes, club Roster and Admin player preview share a single table header style. The heading row is now **36px** (was 44px), with **11px** heading font size (was 12px) and 2px vertical padding. Sort buttons occupy 30px rather than 32px so they fit the reduced header without shifting headings or chevrons.
- Table data labels remain 13px, body and five loading rows remain at the approved 30px, and the columns, flag dimensions, sort order, name hover underline, and mobile horizontal scroll are unchanged. This is a shared CSS-only layout adjustment, pending manual desktop/iPhone Safari QA.

## Responsive player-table geometry (#532 next block)

- **Desktop (>720px):** retain the approved fixed 54px flag column, 248px Player column and 200px Positions (Attributes), with Overview min-width 782px, four-attribute min-width 982px and eight-attribute Technical min-width 1462px. Sorting, first-paint colgroup, global server filters and table data are unchanged.
- **Mobile / tablet (421–720px):** 44px flag, 216px Player and 176px Positions. Minimum widths are 720px Overview, 900px four-attribute groups, 1364px Technical, yielding ~116px per statistic at their minimum width. Club Roster Technical uses the same group-specific width as public Players.
- **Small phones (up to 420px):** 40px flag, 192px Player and 160px Positions. Minimum widths are 680px Overview, 856px four-attribute groups and 1272px Technical (~110–116px per statistic). This reveals the age column sooner without compressing long attribute labels.
- Long names and position strings on narrow screens truncate visually rather than increasing the approved 30px player rows; the full underlying text remains in the link or table cell for accessibility. The responsive table viewport allows intentional touch horizontal scroll with contained overscroll. Existing column order, widths during loading, the five 30px placeholders, 36px headers, 11px heading font, 13px body font, flag aspect ratio and hover underline remain untouched.
- Source-contract checks included; hosted Preview/actual iPhone Safari layout QA remains required before merge.

## Overview-only Club column (#532)

- Public /players Overview now includes **Club** after Player. Attributes, Roster and Admin Preview are unchanged. The paginated D1 read performs one LEFT JOIN to authoritative current player_club_affiliations, and derives the displayed club name from the canonical 320-club catalogue, not from client guesses or private contract data. Missing affiliation displays a translated Free Agent label; invalid club keys fail closed. The club name links to /clubs/<country>/<id>/overview, without any N+1 frontend requests.
- Generated and checked-in first-paint HTML reserve seven Overview columns and five matching loading rows. Direct Attributes preboot removes the Overview Club heading and uses its previous Position/skill columns. Public Overview minimum widths desktop 982px / <=720px 896px / <=420px 840px, with fixed Club width 200/176/160px; all existing fonts, flag dimensions, 30px rows, 36px header, filtering/sorting, offset scroll and club-detail links remain intact. Club header is non-sortable; no inaccurate client-only sort was added.

## Club logo, corrected Overview column order and underline parity

- Public `/players` Overview now displays **Flag | Player | Positions | Age | Height | Foot | Club**, while Attributes stays Flag | Player | Positions | skill columns. The third column uses `--app-players-positions-width` identically in both views (desktop 200px, <=720px 176px, <=420px 160px), just like the first two fixed-width columns. Generated and checked-in first-paint headings use the same order; loading rows still reserve seven cells and keep 30px height.
- Club entries show a fixed 18px crest slot followed by the canonical club name. A single cached fetch of the canonical public manifest resolves approved `clubCrests`; only exact matching approved asset paths are rendered. A neutral shield placeholder occupies the same slot where an official crest is not yet integrated or an image fails, without inventing a crest, exposing private contracts, or making per-row catalog requests.
- Both Player and Club name links use one **18px vertical line box and identical 1px absolute hover/focus underline at bottom:0**, so neither name moves vertically or has different text-to-underline spacing. Club crest and name align centrally in a 22px in-row flex track.

## Club crest 24×24 and larger player-table rows (requested follow-up)

- Approved club crest in public Players Overview increased **18×18 → 24×24px**, with a fixed 24×24 mark, 20×23 neutral shield fallback and vertically centered 28px crest/name track with 8px gap. Player and club links keep their approved identical out-of-flow underlines and center alignment.
- Shared player tables (public Players, Club Roster, Admin preview) now have **36px body and five empty loading rows** rather than 30px. Shared header grows **36→42px**, header font **11→12px**, sort button **30→36px** and body text **13→14px** for proportional readability. Existing flags, Overview/Attributes column order, responsive widths, filters, and offset loading remain unchanged. Manual desktop and iPhone Safari checks are pending.

## Sorting refresh: five rows only, no retained height (#532)

- Fixed the observed issue where sort/sort reset replaced the rows with the five correct blank loading rows but the scroll container kept the full height of a previously loaded 50–150+ row result set. Removed the inline `scroll.style.minHeight` height lock and its stale cleanup; the table now collapses to exactly five 36px loading rows with five matching separators as soon as the sort begins.
- The existing offset-based server sorting, asynchronous request invalidation, first paint, pagination/automatic append, stable 42px header, fixed column widths, 24px club crest and 14px text remain unchanged. The regression test evaluates the actual `showLoadingRows()` function with 150 old rows, and checks that all old rows are replaced, no height lock remains, and the UI remains busy until the new result arrives.

## Parity of other player tables to public /players (#532)

- Club Roster Info and Admin player preview Overview now share the public Players six common columns in the same order, **Flag | Player | Positions | Age | Height | Foot**, omitting Club because the Roster already identifies the club and the Admin preview contains unassigned candidates. In their Attributes groups the existing Flag | Player | Positions | skill columns remain unchanged.
- Every player table uses the same 54/248/200px fixed first three tracks (44/216/176px mobile; 40/192/160px on small phones). In Roster and Admin Overview, the remaining Age/Height/Foot tracks consume 28%/36%/36% of the available space, with Positions/Foot left-aligned and numeric fields centered. Names, flags, hover/focus underline, responsive scrolling, 36px rows, 42px header, 14px data and 12px header font, plus five matching loading rows already inherit shared CSS.
- Updated both Roster's generated/checked-in first-paint shell and its hydrated renderer, and Admin's generated/checked-in preview shell and hydrated renderer. Sorting still uses the original per-page data source and keys; Roster still lists all assigned players without pagination, while Admin preview preserves Previous/Next and its restricted draft/commit flow. No backend, club identities, database, or protected data contract was changed.
