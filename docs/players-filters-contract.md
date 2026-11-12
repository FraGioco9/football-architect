# PLAYERS-FILTERS-01 — Backend V1 contract (issue #512)

The first slice established the server-side contract; the follow-on slice adds compact accessible controls in `/players`. Secondary matching and final filter set remain provisional pending owner review. No migration or remote D1 write is performed in this slice.

## Read-only endpoint

`GET /api/players` accepts up to one of each optional query parameter (in any order):

| Parameter | Validation | Current semantics |
| --- | --- | --- |
| `page` | canonical decimal integer 1–9999 | Defaults to 1 |
| `nationality` | one of the 50 supported three-letter country codes, uppercase | **Primary** nationality only (pending owner decision) |
| `position` | GK, RB, CB, LB, RWB, LWB, DM, CM, AM, RM, LM, RW, LW, ST | **Primary** position only (pending owner decision) |
| `ageMin` / `ageMax` | inclusive integers 0–120, lower ≤ upper | Both optional |
| `foot` | `left` or `right` | Preferred foot |

All supplied filters are joined with **AND**. Omitted filters mean `All`. Name search, secondary-nationality/position matching, height, club and attribute ranges are not part of this first implementation slice. These semantics are provisional until owner review, not a final UX decision.

Unknown parameters, duplicate keys, malformed values, encoded/ambiguous query strings, reversed ranges and invalid combinations return HTTP **422** (`invalid_public_request`). The same pure query parser drives Worker validation and the local/shared DEV bridge allowlist; the bridge never forwards client cookies, CSRF tokens or credentials on anonymous reads.

Both `COUNT(*)` and the stable `ORDER BY created_at DESC, id ASC LIMIT 50 OFFSET ?` select from the **active world generation** with the identical SQL predicate. Page numbers beyond the filtered total return an empty `players` array while retaining the requested `page` and filtered `count`/`totalPages` (minimum 1). Output remains the approved `{count,page,pageSize,totalPages,players}` projection.

## Follow-on work / owner review

- Review whether nationality and position should include secondary values, the final filter set, and the compact desktop/mobile layout.
- Implemented: URL-synced, five-language controls with static first-paint dimensions, reset and filtered totals, empty/loading/error states. Visual QA remains outstanding.
- Review D1 `EXPLAIN QUERY PLAN` and selective expression indexes **before** deciding on a migration. No migrations or remote databases touched here.
- Run focused Worker + proxy + page tests and visual QA on exact PR head. Draft/HOLD; no merge/deploy without separate owner approval.
