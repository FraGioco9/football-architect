# PLAYERS-FILTERS-01 — advanced read-only Players filtering (#512)

## UI

One non-modal animated right-hand drawer stays below the site header, in the browser top layer, without changing the shell, background clicks, scrollbar, table or first-paint geometry.

Name search appears before Nationality, followed by the expandable sections Nationality, Positions, Age, Height, Preferred foot, and Attributes. Nationality and Positions retain searchable multiple selection and optional secondary matching, but no longer display the 'Select multiple' caption. Include secondary is a matching-mode toggle, not an extra active-filter count. Selected values and the All dropdown option are centered. Age and Height minimum/maximum controls are plain number boxes, without custom +/- buttons or browser spinner arrows.

Attributes has four nested expandable groups: Technical (8 attributes), Mental (4), Physical (4), Goalkeeping (4). Each attribute has a checkbox. Its Min / Max (1–99 inclusive) number fields are shown only when selected; at least one bound must be filled before Apply. AND joins selected attributes; a group with no selections stays a compact single row. Group titles, input labels, values and errors are localized across EN/DE/ES/FR/IT.

On Apply, blank or invalid numeric limits are silently ignored. If both limits of a category form an inverted range, that range becomes inactive; no validation popup or inline error appears. A checked attribute with no valid bounds is deselected. All fields are draft-only until Apply. Reset clears active filters once. Closing without applying discards drafts. URL state, first-paint filter count, Browser Back/Forward, server pagination and empty state stay supported. The counter excludes both secondary matching toggles and counts each selected attribute separately.

## Query allowlist

GET /api/players supports page 1–9999; a name search (up to 80 Unicode NFC letters/digits and allowed punctuation, canonical URL-form encoding); nationality / nationalityScope=any; position / positionScope=any; inclusive ageMin/ageMax (0–120); inclusive heightMin/heightMax (100–250 cm); preferred foot left/right; and an attributes list.

Attribute syntax: attributes=passing_70_x,vision_x_90 (comma or encoded uppercase %2C). Each of the twenty allowed public skill keys can appear at most once, with a min and/or max 1–99, 'x' meaning omitted. Both omitted is rejected, as are reversed ranges, unapproved keys, duplicate keys, malformed encodings and unknown query keys. Scope flags require their corresponding nationality / position list. Invalid queries return HTTP 422.

Name search uses a bound literal LIKE substring over stored full name (fallback first+last); SQLite's NOCASE matching is case-insensitive for ASCII but not guaranteed accent-insensitive. All attribute paths are server-allowlisted and all thresholds are bound. The identical WHERE applies to COUNT and page SELECT over the active generation; no client-only filtering of loaded 50-player pages, changes to public JSON, schema migration, deployment or remote D1 writes.

## Tests and open work

Automated: parser security, named/encoded search, combined attribute ranges, primary/secondary nationality and positions, filtered count/pages; static HTML generator parity, first paint, drawer interactions and counter. Visual Chrome / iPhone Safari manual QA still required on 320/390/768/1440, themes and five languages. Review the D1 query plan before adding indexes. PR #515 remains Draft/HOLD until explicit merge authorization.

## Local DEV proxy regression and loading errors

The frontend uses URLSearchParams, which produces `%2C` for comma-separated nationality/position/attribute selections and percent-encoded UTF-8 names. The previous loopback proxy guard rejected *all* percent escapes before forwarding, resulting in HTTP 403 and the generic "Unable to load players" message. The guard now permits encoded URLs **only when the entire /api/players path passes the existing strict query parser**, leaving other encoded/unsafe routes blocked. The change is tested with positive canonical and negative encoded inputs. This corrects a confirmed loading failure in local DEV; if the shared remote Preview Worker is older than the branch, it must still be updated separately before it can serve new filter keys. No remote deployment was performed.


## Loading geometry, sort cycle and simplified drawer (2026-11-12)

**Loading:** The Players table reserves five completely **empty** 44px rows—no skeleton bars, shimmers, per-column placeholders, or visible loading text. Both the first HTML render and subsequent API requests reserve exactly the same width and row height as the eventual data, with a screen-reader-only loading status. The Players count similarly retains blank reserved space with no visual skeleton. In Attributes view, each empty row spans exactly the visible number of columns.

**Sorting:** Any sortable heading follows **descending → ascending → reset** on successive clicks. A newly selected column starts descending regardless of its type. Reset removes `sort` and `order` from the URL and uses the original server ordering. Only the currently sorted column shows a small chevron beside its label; the chevron has a stable 12px slot and rotates 180° around its center for ascending, without nudging text or changing column widths. `aria-sort` remains on the header, and clicking/focusing the label never produces mouse/touch highlight or text selection. Browser history and sort across the full server-side collection remain intact. Keyboard users retain an unobtrusive focus underline.

**Drawer:** Keep the user-approved thin separators, reduce the vertical gaps, and reserve a fixed position for each 16px chevron so opening sections only rotates the icon around its own center. Use **Min** and **Max** as the sole visible labels above the Age/Height boxes; no repetitive “Min age/height” or “All” placeholder inside those boxes. Show “Preferred foot” only in the expandable section heading; the dropdown uses that heading as its accessible label. Show applied-filter counts (trigger, sections and attribute groups) in true circular badges; secondary matching toggles do not add to the count. Labels and section headings cannot be text-selected and do not show hover/tap/click highlight. Focus-visible outlines remain for keyboard accessibility.

No filtering semantics, background-scroll behavior, scrollbar gutter, public projection or remote DB/deploy policy changes. Exact-head automatic CI and Chrome/iPhone Safari visual QA remain required. **PR #515 remains Draft/HOLD** until explicit approval.
