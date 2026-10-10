# Football Architect — Division and club identity catalogues

## Current repository status

The current `main` branch is an **asset and identity-catalogue repository**, not a playable football-management game. It does not contain the former game runtime, app server, career saves, active scheduling/simulation, npm application commands, or a deployment workflow. Earlier application versions remain accessible in Git history and historical pull requests, but must **not** be presented as part of the current mainline.

The game-world baseline is **8 countries, 16 fictional division identities, and 320 documented fictional club identities**. Actual sports gameplay, current club-to-league allocations, finalized division/club SVG crests, and app integration are not provided by this branch.


### Maintain the generated app pages

`templates/app-page.html` is the shared source for the Dashboard, Calendar and Settings HTML shells. After editing the template or its page-specific replacement map in `tools/generate-app-pages.mjs`, regenerate the three checked-in pages from the repository root:

```sh
node tools/generate-app-pages.mjs
```

Generation **writes** `app/dashboard/index.html`, `app/calendar/index.html` and `app/settings/index.html`. To verify the checked-in pages against the template **without writing files**, run:

```sh
node tools/generate-app-pages.mjs --check
node --test tests/*.test.mjs
```

The generator enforces byte-identical UTF-8 HTML in `--check` mode, which the Node.js 22 site-contract suite also tests. Review any generated HTML changes before committing. This is static generation only: it does not require npm, a build step, a backend, a deploy or a database, and the three direct app URLs remain unchanged.

## Local landing page

The repository also provides a standalone static Landing page (`index.html`) and a short World Guide (`guide/index.html`) explaining Divisions and Clubs, styled in Graphite & Petrol. It is not a playable game. The current `main` branch also includes static application-shell previews at `/app/dashboard/`, `/app/calendar/`, and `/app/settings/`, without an active career runtime.

To preview locally on Windows, run `py -m http.server 2000 --bind 127.0.0.1`; open `http://127.0.0.1:2000/` for the Landing or `http://127.0.0.1:2000/guide/` for the Guide. No npm, Docker, or build step is needed. Run `node --test tests/*.test.mjs` for all site contract checks.

English is the default language, with Deutsch, Español, Français, and Italiano selectable through a custom accessible dropdown. The language preference is persisted locally.

The **Explore app preview** CTA is a native, five-language link to `/app/dashboard/`, opening the **static Dashboard preview**, not a playable football-management game. It works without JavaScript and preserves normal browser back/new-tab navigation and keyboard focus. The **Guide** button still navigates to `/guide/`. The obsolete unavailable-app notice and its timer/animation code have been removed. The Landing remains responsive, reserves a scrollbar gutter, and prevents text selection.

These static informational pages do not enable gameplay or deployment.

### Reproducible local DEV (ENV-02)

Use Windows PowerShell in the repository root (the directory containing `README.md`, `index.html`, `assets/`, and `tests/`). DEV is a local-only preview of the current static site and is **not** a playable game or a deployment. Python 3 with the Windows `py` launcher and **Node.js 22** are the only tools needed; no Docker, npm install, build, backend, or database is required.

**Setup and start (terminal 1):**

```powershell
git rev-parse --show-toplevel
py --version
node --version
py -m http.server 2000 --bind 127.0.0.1
```

Run from the repository root so URL paths resolve correctly. Keep terminal 1 open while browsing `http://127.0.0.1:2000/`. Stop only this server with **Ctrl+C**. Binding to `127.0.0.1` prevents LAN exposure; do not replace it with `0.0.0.0` for normal local DEV.

**Static checks (terminal 2, same repository root; server not required):**

```powershell
node --check assets/landing.js
node --check assets/app.js
node --check assets/app-search.js
node --test (Get-ChildItem .\tests\*.test.mjs | Select-Object -ExpandProperty FullName)
```

All five existing `tests/*.test.mjs` modules use the built-in Node test runner. Verify each command exits successfully; a CI result does not replace the local browser smoke test.

**HTTP smoke test (terminal 2, while terminal 1 serves port 2000):**

```powershell
$origin = 'http://127.0.0.1:2000'
$routes = @('/', '/guide/', '/app/', '/app/dashboard/', '/app/calendar/', '/app/settings/')
foreach ($route in $routes) {
  $response = Invoke-WebRequest -Uri ($origin + $route) -UseBasicParsing -ErrorAction Stop
  if ($response.StatusCode -ne 200) { throw "Unexpected HTTP status: $route" }
  Write-Output ('{0}: HTTP {1}' -f $route, $response.StatusCode)
}
try {
  Invoke-WebRequest -Uri ($origin + '/missing-env02/') -UseBasicParsing -ErrorAction Stop | Out-Null
  throw 'An unknown route unexpectedly succeeded'
} catch {
  if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404) { throw }
  Write-Output 'Unknown route: HTTP 404 (expected)'
}
```

All six listed URLs return HTTP **200**; the deliberately missing route returns HTTP **404**. `/app/` serves static `app/index.html` with HTTP 200, then **redirects in the browser via JavaScript** to `/app/dashboard/` (with a no-JavaScript meta-refresh fallback): it is **not** an HTTP 3xx redirect. Also manually open and refresh Landing, Guide, Dashboard, Calendar, and Settings, and check their internal links, styles and language selector across the five supported languages.

**Reset only the DEV language preference:** in the browser developer console at `http://127.0.0.1:2000/`, run:

```javascript
localStorage.removeItem('football-architect:language');
location.reload();
```

This removes only the stored language for that browser origin; it does **not** delete other site data or browser storage. English is the default. If local storage is unavailable, the UI should still work with the in-memory/default language. There are no current career saves, IndexedDB records, or remote databases to reset.

**Errors and fixtures:** if `py`/`node` is not recognized, check the local Python 3 launcher/Node.js 22 installation and PATH. If port 2000 is occupied, stop the existing process you own before retrying; do not kill unrelated processes or silently use another port. If pages or assets return 404, run the server from the repository root and check the exact case-sensitive paths and trailing slashes. Use the existing in-test DOM/localStorage mocks and canonical `data/divisions.json` and `data/clubs.json` as read-only catalogue fixtures; **no separate fixture folder, test data generation, career simulation, or reset script exists or is required**.


## Pull request workflow (PR-ONLY)

Football Architect follows a minimal, owner-authorized workflow:

**Temporary branch → Pull Request → exact-head CI → review → separately authorized squash merge → post-merge CI.**

1. **Branch and changes:** Verify the current `main` SHA before starting. Create a short-lived branch only with explicit owner authorization. Modify only authorized files and behavior.
2. **Pull Request:** Target `main`; write PR titles, descriptions, commits and documentation in English. Record the exact PR HEAD and base SHAs, changed files, and expected behavior.
3. **Exact-head CI:** Use the existing GitHub Actions test-only workflow, which checks out and asserts the PR HEAD SHA, checks JavaScript syntax, and runs Node.js 22 site contract tests. An outdated, missing or failed run does not establish merge readiness.
4. **Review:** Recheck the exact PR HEAD, current `main`, diff scope, CI outcome and mergeability. Report PASS, FAIL and UNKNOWN distinctly, including unverified browser and external-integration risks.
5. **Squash merge:** Obtain a **separate, explicit authorization** for the specific PR. Immediately revalidate the approved SHA, CI and mergeability; stop if any required gate changes. Do not delete branches without separate authorization.
6. **Post-merge CI:** Verify the new `main` SHA and the corresponding CI run. Report failures, skipped checks and incomplete runs accurately; never claim PASS before completion.

### Environment and deployment restrictions

- **DEV:** Existing local-only preview; start manually when authorized.
- **PREVIEW:** No automatic deployment or creation.
- **STAGING:** No automatic deployment or promotion.
- **PRODUCTION:** No automatic deployment or publication.

**Branch/PR creation, squash merge and deployment are three independent authorization decisions.** Authorization of any one never authorizes the others. No hosting, Vercel, Railway, DNS, billing, secrets or database operations are permitted by this policy. Any hosted release requires its own explicit authorization and security review.

### Residual external integration risk

The tracked GitHub Actions workflow is test-only, requests read-only repository permissions and verifies the source SHA. It contains no deployment steps. However, external GitHub Apps, webhooks, hosting-provider subscriptions and inaccessible administrative settings are not fully certified.

**External integration / anti-deploy risk: UNKNOWN.** Review available safeguards immediately before repository operations and document unresolved risk. The absence of a deployment job in the tracked workflow does **not** guarantee that unrelated integrations cannot deploy. Stop if required controls fail or the owner has not explicitly accepted residual UNKNOWN risk for the specific operation. A passing CI run or completed merge never grants deployment authorization.

## Global application search (HOME-02 SEARCH-01)

Dashboard, Calendar and Settings now share a single top-bar search trigger. On desktop it resembles a compact search field; on narrow screens it becomes a magnifier button without adding tooltips, shortcuts or secondary filters. It opens a native modal with a short Graphite & Petrol entrance/exit animation (disabled with reduced-motion), keyboard focus management, Escape, arrow navigation, Enter selection and a clear empty state.

The search covers **only currently available in-app pages and sections**, using their existing localized labels: `/app/dashboard/`, `/app/calendar/`, `/app/settings/` and real heading anchors. It matches case- and accent-insensitively, suggests the three pages for an empty query, and follows all five existing language choices (English default). There is no saved query history, backend call or invented search result for unimplemented player, club, fixture or career screens. New destinations require an explicit catalog entry and an existing route. This feature is tracked by [HOME-02 SEARCH-01 issue #76](https://github.com/FraGioco9/football-architect/issues/76).

## App shell preview (HOME-01)

Open `http://127.0.0.1:2000/app/dashboard/` after starting the same static file server. This standalone application Home is an early **visual shell**, restored from the historical UX-SHELL PR #59 and its pre-reset design reference PR #32. The sidebar uses the original Home category, Dashboard and Calendar icons, desktop/tablet widths of 210/180 px and mobile rails of 58/52 px. The top bar keeps club, career date/phase and the Continue control, with explicit unavailable/disabled states while no career runtime exists. A standalone **Settings** page at `/app/settings/` (static `app/settings/index.html`) restores the historical Settings and saves layout. Its single Settings entry is pinned to the bottom of the sidebar, with no category heading. Direct links and refresh work without client-side route fallback. The five-language selector appears **only inside Settings**, not in the app top bar; the existing site preference remains shared with Landing and Guide on the same browser/device. Career, save management and data operations are shown as unavailable until their runtime exists.

Calendar is a directly loadable static page at `/app/calendar/` (`app/calendar/index.html`), and Settings opens `/app/settings/`. Both work after refresh, without hash routes or legacy redirects. Dashboard, Calendar and Settings share a single app-wide page-title and spacing system: one top-left title, no page pretitle or subtitle, and consistent content gutters. Calendar displays an honest empty state, not invented fixtures. HOME-01 no longer interprets `#calendar` or `#settings` as page routes; the real section anchors used by Global Search remain available. The app-only Skip to content link and `#main-content` target are present on Dashboard, Calendar and Settings; each page also retains the semantic `<main>` landmark. The app uses the shared language preference and the approved branding. The Landing **Explore app preview** link now opens `/app/dashboard/` directly. It remains a non-playable static preview, without functional careers, match simulation or saves. The known WCAG 2.4.1 Bypass Blocks risk from HOME-03 skip-link removal remains unresolved.

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

- [DIV-ASSET #60](https://github.com/FraGioco9/football-architect/issues/60): as of **2026-10-10**, **16/16 primary artistic identities approved (100% art approval)** across eight countries. Artistic approval is distinct from production: **no final SVG division badges have been produced or integrated**. See the issue for the current canonical approval register and dated historical references.
- [CLUB-ASSET #61](https://github.com/FraGioco9/football-architect/issues/61): as of **2026-10-10**, **5/8 roadmap gates approved (62.5%)**, **320/320 crest concepts approved (100%)**, and **0/640 final accepted PNGs (0%)**. The eight-club Primary-only pilot is in progress, not artistically accepted as final imagery. Concept approval is distinct from accepted production assets.
- [Historical DIV-ASSET reference PR #69](https://github.com/FraGioco9/football-architect/pull/69): **closed without merge**. It remains a historical documentation reference, not a live independent branch or a source of final repository assets; see [#60](https://github.com/FraGioco9/football-architect/issues/60) for canonical visual approvals and provenance.
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
