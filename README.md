# Football Architect — Division and club catalogues

**Current status:** This repository contains the division and club catalogues and a standalone static landing page. It does not yet include a game engine, internal Guide/Home pages, login, saves, matches, or automatic deployment.

## Run the landing page locally

Open `index.html` directly, or start a local static server from the repository directory on Windows:

```powershell
py -m http.server 2000
```

Then visit `http://127.0.0.1:2000`. No npm, Docker, or build step is needed. Run the landing contract tests using `node --test tests/landing.test.mjs`.

**English is the default on a first visit.** Deutsch, Español, Français, and Italiano remain available in that order. On return visits the site restores a supported value previously saved under `football-architect:language`. The custom Graphite & Petrol language dropdown uses the same surface, border, and typography as the site. It supports mouse, touch, and keyboard (arrows, Home/End, Enter/Space, Escape), with an accessible listbox and persistent language selection.

The **Enter the app** and **Guide** buttons show a localized notice that those destinations are not yet available rather than navigating to missing pages. Notices are fixed and dismissible; showing or hiding them never moves the existing boxes. They auto-dismiss after five seconds, pause on mouse/pen hover or keyboard focus, and restart a full five-second countdown when the pointer or focus leaves. New notices reset the countdown. The landing spans the available viewport width with responsive side padding, reserves a stable scrollbar gutter where supported, and uses a transparent scrollbar track with a subtle thumb. Text selection and iOS long-press text callouts are disabled on the static landing; interactive focus indicators remain available. The root `favicon.ico` and `favicon.svg` are provided. A 404 for Chrome DevTools `/.well-known/appspecific/com.chrome.devtools.json` is harmless; a 304 response for CSS is normal cache revalidation.

## Available project assets

- **8 countries and 16 divisions** in [data/divisions.json](data/divisions.json): two fictional tiers per country, with a target capacity of 20 clubs per tier. These divisions have not been integrated into gameplay.
- **320 club identities** in [data/clubs.json](data/clubs.json), with stable `(countryId,clubId)` keys, documented full names, and approved unique `abbr` values.
- **160 historical first-division references** (old names, cities, and stadiums) in `firstDivisionReference` for the first 20 clubs in each country. Historical names are not necessarily the latest approved identities.
- **SVG flags and their [license](assets/flags/LICENSE)**, including the eight countries represented in the league catalogue.
- The [320-club full-name source](docs/clubs/fullnames-source.md), [club abbreviations and reconciliation history](docs/clubs/registry-history.md), and [approved division design direction](docs/divisions/design-direction.md).

## Visual-identity status

The [DIV-ASSET roadmap #60](https://github.com/FraGioco9/football-architect/issues/60) and [CLUB-ASSET roadmap #61](https://github.com/FraGioco9/football-architect/issues/61) remain the design references. The complete set of 16 final division crests and 320 final club crests is not yet finished. Do not invent crests or unapproved information. All 320 club full names are documented, though some have not received final joint validation. The historical game implementation covered only 160 first-tier clubs; the remaining 160 are documented designs, not integrated gameplay.

## Club identity corrections to preserve

- IT,1: **US Velaria Torino**, `VEL`
- IT,2: **AC Rinascenti Bologna**, `RIN` (not AC Felsina Bologna)
- FR,27: **FC Émaux**, `EMX`
- FR,33: **CS Garrigues**, `GRG`
- PT,34: **AC Fontes**, `FTS`
- BR,16: **EC Falésia Clara**, `FCL`

## Provenance and reset

- Historical `main` baseline: `72d16de4a3ad410dab84fd9d1f42007a187a98b1`.
- Reconciliation records: [issue #61, full comment](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309) and [archive](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091598842).
- The reset was a **new commit**, not a destructive rewriting of Git history. Old branches and PRs may remain accessible, but do not represent the current `main`.
