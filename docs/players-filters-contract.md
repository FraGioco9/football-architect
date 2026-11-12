# PLAYERS-FILTERS-01 — Backend V1 contract (issue #512)

The backend slice established the server-side contract. The follow-on UI now uses a **Filters button that opens a right-side native modal drawer**, with all five inputs, Apply and one-click Reset. The final matching semantics still require owner review. No migration or remote D1 write is performed in this slice.

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
- Implemented: modal drawer with parser-created trigger and applied-filter count; URL-synced five-language controls, native dialog focus trapping, Escape/backdrop/X dismissal, Apply batching, one-click Reset, static table first-paint dimensions and filtered totals. Visual QA remains outstanding.
- Review D1 `EXPLAIN QUERY PLAN` and selective expression indexes **before** deciding on a migration. No migrations or remote databases touched here.
- Run focused Worker + proxy + page tests and visual QA on exact PR head. Draft/HOLD; no merge/deploy without separate owner approval.

## Drawer interaction (owner-requested layout revision)

The only permanent filter UI is the **Filters** trigger on the Players page header; its numeric indicator shows the applied filter count from the initial URL before deferred hydration. The modal drawer overlays the page without changing its table or tab dimensions. Selections stay local to the drawer until **Apply filters**, which validates all five fields and performs at most one server-side GET. Closing via X, Escape or backdrop discards pending edits. **Reset filters** clears all active filters in one click, updates the URL and refreshes only if a filter or page was actually changed. Native `<dialog>` provides keyboard focus containment; focus returns to the trigger after close. The backdrop and responsive drawer remain within the same static HTML generator and publication contract.

## Motion, shell placement and shared dropdowns (2026-11-12)

The modal drawer is positioned from the current **bottom edge of the site topbar**, measured on opening and window resize; it never draws over the fixed top header. Its backdrop is transparent above that edge. Opening uses a 240ms right-to-left slide and closing uses a 220ms reverse slide with an animation-completion handler and fallback; both animations are disabled when the user prefers reduced motion. Closing is deferred until the exit animation finishes, including Escape and backdrop close. Nationality, Position and Foot use the site's canonical `language-control / language-trigger / language-menu / language-option` styling and combobox/listbox keyboard behavior (arrows, Home/End, Enter/Space, Escape). The underlying hidden selects remain the one source of draft form values and do not cause extra requests until Apply. Age fields remain numeric inputs.

## Scrollbar / click interception fix (2026-11-12)

The earlier `showModal()` unintentionally made the entire application inert and also set document-level `overflow:hidden`. Its closing helper reentered the close animation instead of actually dismissing the dialog. The drawer now opens with `<dialog popover="manual">` and `showPopover()` in the browser top layer, so the sidebar, topbar and existing document scrollers are left completely unchanged. The transparent, pointer-ignored backdrop cannot catch clicks. A pointerdown outside closes the drawer without preventing the underlying click or stealing its focus. The existing slide-in/out and reduced-motion behavior remain intact; the close transition now finishes with `hidePopover()`. The dynamic top inset is stored on the dialog rather than the HTML root.

All three language-style dropdown menus are temporarily portaled to the dialog root while open (above the form's internal scrollbar), placed on whichever side of the trigger has room, then returned to their original wrapper on selection or dismissal. Scrolling the filter form closes an open menu so it cannot float over the scrollbar. Opening/closing the drawer does not change any global scrollbar, body, main content, table dimensions, or underlying state. Only applying/resetting filters updates player data.
