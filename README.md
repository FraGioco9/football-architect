# Football Architect — Division and club identity catalogues

## Current repository status

This feature branch adds a **standalone static Landing page** to Football Architect's **asset and identity catalogues**. It does not provide a playable football-management game. It does not contain the former game runtime, app server, career saves, active scheduling/simulation, npm application commands, or a deployment workflow. Earlier application versions remain accessible in Git history and historical pull requests, but must **not** be presented as part of the current mainline.

The game-world baseline is **8 countries, 16 fictional division identities, and 320 documented fictional club identities**. The static Landing provides a localized introduction and two currently unavailable Guide / app actions; it does not add those unfinished destinations. Actual sports gameplay, current club-to-league allocations, finalized division/club SVG crests, and app integration are not provided by this branch.

## Run the landing page locally

Open `index.html` directly, or start a local static server from the repository directory on Windows:

```powershell
py -m http.server 2000
```

Then visit `http://127.0.0.1:2000`. No npm, Docker, or build step is needed. Run the landing contract tests using `node --test tests/landing.test.mjs`.

**English is the default on a first visit.** Deutsch, Español, Français, and Italiano remain available in that order. On return visits the site restores a supported value previously saved under `football-architect:language`. The custom Graphite & Petrol language dropdown uses the same surface, border, and typography as the site. It supports mouse, touch, and keyboard (arrows, Home/End, Enter/Space, Escape), with an accessible listbox and persistent language selection.

The **Enter the app** and **Guide** buttons show a localized notice that those destinations are not yet available rather than navigating to missing pages. Notices are fixed and dismissible; showing or hiding them never moves the existing boxes. They fade in with a subtle 8px rise (200 ms) and fade out over 180 ms without changing the page layout; reduced-motion preferences disable the visual animation. They auto-dismiss after five seconds, pause on mouse/pen hover or keyboard focus, and restart a full five-second countdown when the pointer or focus leaves. New notices reset the countdown, including when a new action interrupts the exit transition. The landing spans the available viewport width with responsive side padding, reserves a stable scrollbar gutter where supported, and uses a transparent scrollbar track with a subtle thumb. Text selection and iOS long-press text callouts are disabled on the static landing; interactive focus indicators remain available. The root `favicon.ico` and `favicon.svg` are provided. A 404 for Chrome DevTools `/.well-known/appspecific/com.chrome.devtools.json` is harmless; a 304 response for CSS is normal cache revalidation.

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
