# Football Architect — Division and club identity catalogues

## Current repository status

The current `main` branch is an **asset and identity-catalogue repository**, not a playable football-management game. It does not contain the former game runtime, app server, career saves, active scheduling/simulation, npm application commands, or a deployment workflow. Earlier application versions remain accessible in Git history and historical pull requests, but must **not** be presented as part of the current mainline.

The game-world baseline is **8 countries, 16 fictional division identities, and 320 documented fictional club identities**. Actual sports gameplay, current club-to-league allocations, finalized division/club SVG crests, and app integration are not provided by this branch.

## Local landing page

The repository also provides a standalone static Landing page (`index.html`) and a short World Guide (`guide/index.html`) explaining Divisions and Clubs, styled in Graphite & Petrol. It is not a playable game. The HOME-01 branch also provides a static application-shell preview at `/app/dashboard/`, without an active career runtime.

To preview locally on Windows, run `py -m http.server 2000 --bind 127.0.0.1`; open `http://127.0.0.1:2000/` for the Landing or `http://127.0.0.1:2000/guide/` for the Guide. No npm, Docker, or build step is needed. Run `node --test tests/*.test.mjs` for all site contract checks.

English is the default language, with Deutsch, Español, Français, and Italiano selectable through a custom accessible dropdown. The language preference is persisted locally.

The **Enter the app** button displays a localized unavailability notice; the **Guide** button navigates to `/guide/`. Notices auto-dismiss after five seconds, pause on mouse/pen hover or keyboard focus, and restart the countdown when interaction ends. They animate in over 200 ms and out over 180 ms, with reduced-motion support. The layout is responsive, reserves a scrollbar gutter, and prevents text selection.

These static informational pages do not enable gameplay or deployment.

## Global application search (HOME-02 SEARCH-01)

Dashboard, Calendar and Settings now share a single top-bar search trigger. On desktop it resembles a compact search field; on narrow screens it becomes a magnifier button without adding tooltips, shortcuts or secondary filters. It opens a native modal with a short Graphite & Petrol entrance/exit animation (disabled with reduced-motion), keyboard focus management, Escape, arrow navigation, Enter selection and a clear empty state.

The search covers **only currently available in-app pages and sections**, using their existing localized labels: `/app/dashboard/`, `/app/calendar/`, `/app/settings/` and real heading anchors. It matches case- and accent-insensitively, suggests the three pages for an empty query, and follows all five existing language choices (English default). There is no saved query history, backend call or invented search result for unimplemented player, club, fixture or career screens. New destinations require an explicit catalog entry and an existing route. This feature is tracked by [HOME-02 SEARCH-01 issue #76](https://github.com/FraGioco9/football-architect/issues/76).

## App shell preview (HOME-01)

Open `http://127.0.0.1:2000/app/dashboard/` after starting the same static file server. This standalone application Home is an early **visual shell**, restored from the historical UX-SHELL PR #59 and its pre-reset design reference PR #32. The sidebar uses the original Home category, Dashboard and Calendar icons, desktop/tablet widths of 210/180 px and mobile rails of 58/52 px. The top bar keeps club, career date/phase and the Continue control, with explicit unavailable/disabled states while no career runtime exists. A standalone **Settings** page at `/app/settings/` (static `app/settings/index.html`) restores the historical Settings and saves layout. Its single Settings entry is pinned to the bottom of the sidebar, with no category heading. Direct links and refresh work without client-side route fallback. The five-language selector appears **only inside Settings**, not in the app top bar; the existing site preference remains shared with Landing and Guide on the same browser/device. Career, save management and data operations are shown as unavailable until their runtime exists.

Calendar is a directly loadable static page at `/app/calendar/` (`app/calendar/index.html`), and Settings opens `/app/settings/`. Both work after refresh, without hash routes or legacy redirects. Dashboard, Calendar and Settings share a single app-wide page-title and spacing system: one top-left title, no page pretitle or subtitle, and consistent content gutters. Calendar displays an honest empty state, not invented fixtures. HOME-01 no longer interprets `#calendar` or `#settings` as page routes; normal in-page accessibility anchors (for example, `#main-content`) remain available. The app uses the shared language preference and the approved branding. The Landing **Enter the app** action intentionally retains its unavailability notice until application integration is explicitly approved; open the preview URL directly for review.

No career data, IndexedDB writes, scheduling, simulation, automatic redirects, deployment or remote database work is added. Check the page's shell contracts with `node --test tests/app-home.test.mjs` (or all site tests with `node --test tests/*.test.mjs`).

## Guide

The [Guide](guide/index.html) currently explains only **Divisions** (country competitions with first/second tiers of 20 planned places) and **Clubs** (teams with persistent identities independent of their competition). A left sidebar navigates between the two explanations and highlights the selected entry. At 320/390px it becomes compact horizontal navigation above the text. The same English-default five-language selector and saved language preference are shared with the Landing. This is **not** an asset directory or club catalogue. See [roadmap #67](https://github.com/FraGioco9/football-architect/issues/67).

## Current resources

| Resource | Canonical source | Preserved facts |
|---|---|---|
| Division catalogue | [data/divisions.json](data/divisions.json) | 8 countries × 2 tiers = **16 divisions**, stable IDs and original-language names, indicative capacity of 20 clubs per tier, `implementedGame: false` |
| Club catalogue | [data/clubs.json](data/clubs.json) | **320** stable `(countryId,clubId)` identities, documented `fullName`, and **320 globally unique three-letter `abbr`** values |
| Historical first-tier references | `firstDivisionReference` fields in [data/clubs.json](data/clubs.json) | **160** legacy city/stadium/name records, attached to the first 20 club IDs per country, retained as **historical evidence**, not automatic approval of all current names |
| National flags | [assets/flags/](assets/flags/) | **271 SVG flags** from [lipis/flag-icons](https://github.com/lipis/flag-icons), in 4:3 format, including the flags used by the eight football countries |
| Flag pack license | [assets/flags/LICENSE](assets/flags/LICENSE) | Existing **MIT license**, retained verbatim |
| Club name and identity documentation | [docs/clubs/README.md](docs/clubs/README.md) | English operational index, complete 320-entry name/abbreviation reference, historical provenance and reconciliation |
| Division art direction | [docs/divisions/design-direction.md](docs/divisions/design-direction.md) | Approved modern football heraldry; first- and second-tier symbols in eight related national visual families |

**Important:** `approvedShortName` is present only for the **six explicitly reconciled entries**. An empty value must not be filled by inventing or inferring a short name. All 320 full names are documented, but documented text is not automatically formal approval of the entire historical name register.

## Graphic identity design status

- [DIV-ASSET #60](https://github.com/FraGioco9/football-architect/issues/60): **A01–A05 approved (5/5, 100% design)**, with **four visual PNG references approved (4/16, 25%)** separately. **No final SVG division badges** have been produced or integrated.
- [CLUB-ASSET #61](https://github.com/FraGioco9/football-architect/issues/61): separate **320-club crest design** roadmap, **0/5 design phases approved**. Its 320 existing identities and abbreviation approvals are the catalogue baseline, **not** 320 designed crests.
- [Draft DIV-ASSET reference PR #69](https://github.com/FraGioco9/football-architect/pull/69): English design decisions and approval logs on an independent branch. Its four approved original PNG samples are **in the user's persistent ChatGPT Library**, not GitHub binary blobs.
- Do not invent final team/league badges or imply that this repository provides a complete game.

## Identity corrections that must be preserved

| Stable club key | Approved short name | Approved abbreviation |
|---|---|---|
| `IT,1` | **US Velaria Torino** | `VEL` |
| `IT,2` | **AC Rinascenti Bologna** (not AC Felsina Bologna) | `RIN` (not `FEL`) |
| `FR,27` | **FC Émaux** | `EMX` |
| `FR,33` | **CS Garrigues** | `GRG` |
| `PT,34` | **AC Fontes** | `FTS` |
| `BR,16` | **EC Falésia Clara** | `FCL` |

These corrections do not change any existing country/club identifiers, city/stadium references, or source data.

## Historical provenance and preservation

- Historical pre-reset `main` reference: `72d16de4a3ad410dab84fd9d1f42007a187a98b1`. This reset was a **new commit**, not an irreversible rewrite of Git history.
- The original-language reconciliation records are retained **verbatim** at [docs/clubs/fullnames-source.md](docs/clubs/fullnames-source.md) and [docs/clubs/registry-history.md](docs/clubs/registry-history.md). These are **archival primary-source records**, not active English documentation. Their original Italian wording and historic superseded counts must not be silently rewritten.
- Direct source evidence: [club reconciliation comment](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309) and [historical registry archive](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091598842).
- English operational pages and 320-entry data views live under [docs/clubs/](docs/clubs/). Preserve proper names and original source filenames without translating them.
- All new GitHub-facing prose (issues, pull requests, documentation and commits) is **English**, regardless of chat language; localized in-game UI labels may still use supported languages.

**No merge, deployment, database modification, or runtime asset integration is implied by these documentation changes.**

Canonical Dashboard: `/app/dashboard/` (`app/dashboard/index.html`). The static `/app/` and `/app/index.html` entry points redirect to Dashboard with `window.location.replace`, preserving query strings and fragments. A no-JavaScript meta-refresh fallback is provided. Standard static servers normalize `/app/dashboard` to `/app/dashboard/`. Navigation and search use the canonical route directly.
