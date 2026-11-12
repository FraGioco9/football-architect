# PLAYERS-FILTERS-01 — expandable server-side filters (#512)

This branch contains a read-only Players directory filter workflow. The right-side **Filters** drawer is a non-modal browser top-layer popover: it slides from the right **below the measured site header**, does not shift or lock the shell, preserves background scrollbars and closes when the user clicks outside. It contains five expandable native `<details>` sections; there is no introductory paragraph.

## UI

| Section | Controls | Matching |
| --- | --- | --- |
| Nationality | Searchable multi-select of all 50 supported nationalities, with an **Include secondary nationality** checkbox | Default: any selected **primary** nationality. Opt-in: primary **or** secondary nationality |
| Positions | Searchable multi-select of all 14 supported positions, with an **Include secondary positions** checkbox | Default: any selected **primary** position. Opt-in: primary **or** any secondary position |
| Age | Inclusive minimum/maximum, with site-styled **− / +** buttons changing by exactly 1; editable numeric entry | 0–120 |
| Height | Inclusive minimum/maximum in centimeters, with **− / +** buttons | 100–250 cm |
| Preferred foot | Site-styled single-choice dropdown | Left / Right / All |

Inside each multi-select, selected options remain ticked until toggled again; searching filters the *visible options* without changing the selection. Multi-select options within a section combine using **OR**; selected sections combine using **AND**. The secondary checkbox only matters when that section has selected values. The **All** option clears all choices in that section. Form values remain draft-only until **Apply filters**. Reset immediately clears every applied filter and requests the first page once, when necessary. Empty, loading, API error, 50-per-page pagination, first-paint URL state and all five site languages remain supported.

The three dropdowns use the site's `language-control/language-trigger/language-menu/language-option` classes. Open menus are temporarily moved to the drawer top-layer, outside its scrollable form; scrolling the drawer closes an open menu so scrollbars cannot be covered. Keyboard navigation supports arrows, Home/End, Enter/Space and Escape. Drawer/option animations respect `prefers-reduced-motion`; the only animated property of the drawer is its own transform. Background scrollbar/HTML/body overflow properties are never mutated.

## Canonical GET /api/players query

| Key | Validation | Semantics |
| --- | --- | --- |
| `page` | canonical 1–9999, default 1 | Stable 50-player pagination |
| `nationality` | 1–50 distinct approved 3-letter codes separated by commas | Multi-value primary nationality matches |
| `nationalityScope` | `any` only, requiring nationality | Match secondary nationality as well |
| `position` | 1–14 distinct approved position codes separated by commas | Multi-value primary position matches |
| `positionScope` | `any` only, requiring position | Match any secondary position as well |
| `ageMin`, `ageMax` | integers 0–120, inclusive, min ≤ max | Optional age interval |
| `heightMin`, `heightMax` | integers 100–250, inclusive, min ≤ max | Optional height interval |
| `foot` | `left` / `right` | Preferred foot |

Single-value `nationality=ITA` and `position=ST` remain backward-compatible. Browsers serialize commas as `%2C`; both plain commas and canonical uppercase `%2C` are accepted, but arbitrary percent escapes, duplicate keys, duplicate list items, unknown codes, empty values, aliases and out-of-range numbers return **422 invalid_public_request**. Scope keys without a matching nationality or position filter return 422. No name-search semantics are added.

SQL uses only bind parameters: `IN (...)` for each primary multi-selection, an opt-in `OR json_extract(...secondary_nationality) IN (...)`, and an opt-in `OR EXISTS (SELECT ... FROM json_each(...secondary_positions))`. All active filter predicates join with AND; the identical predicate and bound values are used for COUNT and LIMIT/OFFSET queries on the **active world generation**. No client-side filtering of a preloaded page, private projection changes, schema migration or remote D1 write.

## Tests and publication

- Shared query-parser valid/invalid coverage, proxy allowlist and Worker D1 integration for primary vs secondary matches, multi-choice OR, cross-section AND, height and filtered pagination.
- Static shell-generator parity, URL first-paint/selection tests, 5 sections, searchable dropdown controls, site-style stepper, no per-change GET, top-layer and scrollbar regression checks.
- Exact-head GitHub Actions and Chrome/iPhone Safari pointer/keyboard QA remain the merge gates. Use automatic CI rather than manually duplicating FULL runs. PR #515 stays **Draft/HOLD** until explicit merge authorization; no deploy or database changes.
