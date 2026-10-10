# Football Architect — Division and club catalogues

**Current status:** This repository contains the division and club catalogues and a standalone static Landing and a short Guide explaining divisions and clubs. It does not include a game engine, an internal Home, login, saves, matches or automatic deployment.

## Run the website locally

Open `index.html` directly, or start a local static server from the repository directory on Windows:

```powershell
py -m http.server 2000
```

Then visit `http://127.0.0.1:2000/` for the Landing or `http://127.0.0.1:2000/guide/` for the Guide. No npm, Docker, or build step is needed. Run the site contract tests using `node --test tests/*.test.mjs`.

**English is the default on a first visit.** Deutsch, Español, Français, and Italiano remain available in that order. On return visits the site restores a supported value previously saved under `football-architect:language`. The custom Graphite & Petrol language dropdown uses the same surface, border, and typography as the site. It supports mouse, touch, and keyboard (arrows, Home/End, Enter/Space, Escape), with an accessible listbox and persistent language selection.

**Enter the app** shows a localized unavailability notice. **Guide** opens the dedicated explanation page. Notices are fixed and dismissible; showing or hiding them never moves the existing boxes. The landing spans the available viewport width with responsive side padding, reserves a stable scrollbar gutter where supported, and uses a transparent scrollbar track with a subtle thumb. The root `favicon.ico` and `favicon.svg` are provided. A 404 for Chrome DevTools `/.well-known/appspecific/com.chrome.devtools.json` is harmless; a 304 response for CSS is normal cache revalidation.

## Guide

The [Guide](guide/index.html) currently explains only two game-world concepts: **Divisions** (country-specific competitions with first and second tiers, each designed for 20 clubs) and **Clubs** (football teams with persistent identities independent of divisions). It is a simple informational page, **not** an asset explorer, club registry, search interface or claim that gameplay is implemented. The Landing and Guide use the same English-default language selector and shared preference. See [UI-GUIDE roadmap #67](https://github.com/FraGioco9/football-architect/issues/67).

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
