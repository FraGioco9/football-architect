# Football Architect — World catalogues and static website

Football Architect currently documents a fictional football universe. This repository includes a static Landing and a World Guide, but **no playable game engine**, active careers, matches, account system or automatic deployment.

## Run locally

From the repository directory, run:

    py -m http.server 2000

Open http://127.0.0.1:2000/ for the Landing and http://127.0.0.1:2000/guide/ for the World Guide. The guide fetches local JSON, so **use HTTP rather than opening HTML with file://**. No npm install, Docker, bundler or external network is required.

Run checks with:

    node --test tests/*.test.mjs

The interface defaults to English. Deutsch, Español, Français and Italiano are also available; both pages share the optional local preference key football-architect:language.

The Landing has two actions: **Enter the app** provides an honest unavailability message; **Guide** opens the real World Guide. Search the guide by documented name, country, stable ID or abbreviation and filter by country and entry type.

## Canonical catalogues

- [data/divisions.json](data/divisions.json): **8 countries and 16 named divisions**, two tiers per country and a documented capacity of 20 places per division. The division catalogue does not assign clubs to current tiers.
- [data/clubs.json](data/clubs.json): **320 club identities**, 40 per country, keyed by countryId and clubId. All 320 full names are documented and all 320 abbreviations approved. Only explicitly approved short names are presented as such.
- **160 historical first-division references** optionally contain former names, city and stadium. They are **historical, not verified current assignments** and must not be described as confirmed club locations or venues.
- [assets/flags](assets/flags): SVG country flags from the licensed [flag-icons project](https://github.com/lipis/flag-icons). See [MIT licence](assets/flags/LICENSE). The interface uses only the eight relevant flags.
- [docs/clubs/fullnames-source.md](docs/clubs/fullnames-source.md) and [docs/clubs/registry-history.md](docs/clubs/registry-history.md): source and audit history for club names.
- [docs/divisions/design-direction.md](docs/divisions/design-direction.md): approved division identity design direction.

## Artwork boundaries

Final league and club emblem packs are not yet integrated into this website. The World Guide intentionally shows labelled placeholders, not fabricated badges. Design of **16 division emblems** and **320 club crests** is separate, tracked in [DIV-ASSET #60](https://github.com/FraGioco9/football-architect/issues/60) and [CLUB-ASSET #61](https://github.com/FraGioco9/football-architect/issues/61). The guide implementation follows [UI-GUIDE #67](https://github.com/FraGioco9/football-architect/issues/67) and does not change the canonical catalogues.

## Corrections to preserve

- IT,1 — US Velaria Torino, VEL.
- IT,2 — AC Rinascenti Bologna, RIN (not AC Felsina Bologna).
- FR,27 — FC Émaux, EMX.
- FR,33 — CS Garrigues, GRG.
- PT,34 — AC Fontes, FTS.
- BR,16 — EC Falésia Clara, FCL.

## Provenance

This project was reset to catalogue-only data before the static website was added. Prior application PRs and branches remain in Git history but do not represent current runtime functionality. No CI workflow here deploys the site or modifies databases.
