# Football Architect

Football Architect currently provides a **static football-world catalogue and application preview**, with separate fictional DEV tools. It is not yet a playable management game or an authoritative shared-world backend. There are no active careers, saves, player accounts or production simulation in this branch.

## Current scope

- **8 countries, 16 domestic divisions and 2 international cups**: Sovereign Cup and Federation Cup.
- **320 documented club identities**, with **256 provisional domestic participants** (16 per division) and **64 asset-only clubs**. Provisional allocations are not official season membership or historical results.
- Landing, Guide, Dashboard, Calendar, Settings, Competitions and Clubs pages, plus competition and club subpages.
- English by default, with Deutsch, Español, Français and Italiano; dark/light themes. Browser preferences are stored per origin, so the site and app subdomains have separate storage.
- A 56-day Calendar projection and protected fictional DEV season/day controls. Public pages do not run the DEV simulation or fabricate approved results.

ARCH-CLEAN-02 [#268](https://github.com/FraGioco9/football-architect/issues/268) is complete within its recorded scopes and accepted exceptions. The remaining shared-world/admin work is tracked by [#315](https://github.com/FraGioco9/football-architect/issues/315); this preview does not implement that backend.

## Local preview

Use **Node.js 22**. From the repository root, run:

```sh
node tools/dev-app-preview.mjs
```

No npm install, Docker, application build or database is required. The launcher binds to loopback only and prints the site/app URLs. Stop it with **Ctrl+C**.

| Page | Canonical local URL |
| --- | --- |
| Landing | `http://localhost:2000/` |
| Guide | `http://localhost:2000/guide/` |
| Dashboard | `http://app.localhost:2000/dashboard` |
| Calendar | `http://app.localhost:2000/calendar` |
| Settings | `http://app.localhost:2000/settings` |
| Competitions | `http://app.localhost:2000/competitions` |
| Domestic overview | `http://app.localhost:2000/competitions/it-1/overview` |
| Domestic fixtures | `http://app.localhost:2000/competitions/it-1/fixtures?season=2` |
| Domestic history | `http://app.localhost:2000/competitions/it-1/history` |
| International standings | `http://app.localhost:2000/competitions/int-1/standings` |
| Clubs | `http://app.localhost:2000/clubs` |
| Club overview | `http://app.localhost:2000/clubs/it/1/overview` |

Open and refresh the relevant URLs. Site links should use `localhost:2000`, while app links retain `app.localhost:2000`. A plain static file server may not reproduce canonical routing. The launcher still prints a historical query-based History example; use the explicit History route above for current navigation.

**Troubleshooting:** check Node.js 22 and the repository working directory. If port 2000 is occupied, stop only the preview process you own. Check path case for a 404. Do not bind the canonical launcher to `0.0.0.0`. For an explicitly requested LAN/iPhone preview, use the separate `node tools/dev-standings-preview.mjs` launcher and the PC's private IPv4 address; `app.localhost` refers to the same device, not a remote PC.

### Fictional DEV controls and reset

A fresh DEV session defaults to **Season 1 / Day 1**, before official matches. The General debug controls select **Season 0–4** and **Day 1–56**; Day is disabled in Season 0. National matchday progress is derived from the world day, including domestic postseason events. The competition season selector browses available seasons without changing the active DEV world.

On competition and club pages, **Reset all** returns the fictional preview to **Season 0 / Day 1**, clears matchday progress and disables fictional standings. Season 0 is the unstarted state; it does not supply completed seasons or historical records. The Calendar's **Reset** uses the lower-level world-clock reset, which clears its storage keys and falls back to **Season 1 / Day 1**. These are different existing actions, not production-world reset commands.

DEV progress is session-local. Earlier seasons may be projected as complete and the current season includes only reached events, but **reaching an event is not proof of a verified result**. History titles and records require the relevant completed dataset. Fictional DEV output must never be copied into canonical History or presented as an official shared world. See [the world-clock boundary](docs/architecture/a05-01-world-time-freeze.md) and [historical source issue #177](https://github.com/FraGioco9/football-architect/issues/177).

To clear only the language preference for the current origin, run this in the browser console:

```javascript
localStorage.removeItem('football-architect:language');
location.reload();
```

## Source layout and generation

| Responsibility | Source |
| --- | --- |
| App shell | `templates/app-page.html` |
| App generation | `tools/generate-app-pages.mjs` |
| Competition layout | `tools/render-competition-page.mjs` |
| Club generation | `tools/generate-club-pages.mjs` |
| Canonical catalogue lookups | `assets/world-catalog.mjs` |
| Competition definitions and rules | `tools/competition-catalogue.mjs`, `assets/rules-registry.js` |
| Route identities | `assets/routes-registry.js` |
| Independent hosting/publication policy | `vercel.json`, `tools/publication-guard.mjs` |
| Calendar model and presentation | `assets/world-calendar-model.js`, `assets/world-calendar.js`, `assets/calendar-simplified.js` |
| Shared appearance and language | `assets/landing.css`, `assets/landing.js`, `assets/app.css`, `assets/app.js` |

Edit the source templates/renderers/catalogues, then regenerate:

```sh
node tools/generate-app-pages.mjs
```

The current generator checks **23 HTML pages** (Dashboard, Calendar, Settings, Competitions index, shared shell and 18 competition routes), the competition manifest, the club template and the club manifest. Do not hand-edit generated HTML or manifests. The same generator drives club output through the club generation module.

To check without rewriting files:

```sh
node tools/generate-app-pages.mjs --check
```

Generation must remain deterministic, including UTF-8 and canonical line endings. Preserve approved CSV and SVG bytes; avoid checkout-only normalization in commits. Shared app pages depend on `landing.css` tokens and the `landing.js` Settings language selector, so those files are not landing-only dependencies.

## Checks

Run the existing contracts using Node.js 22; browser suites require Chrome/Chromium. Set `CHROME_BIN` to an executable if automatic discovery cannot find it.

```sh
node --check assets/landing.js
node --check assets/app.js
node --check assets/app-search.js
node tools/generate-app-pages.mjs --check
node --test --test-concurrency=1 tests/*.test.mjs
```

In Windows PowerShell, the test command is:

```powershell
node --test --test-concurrency=1 (Get-ChildItem .\tests\*.test.mjs | Select-Object -ExpandProperty FullName)
```

`tests/int24-browser-qa.mjs` additionally uses Playwright Chromium and the running canonical local preview. Its results are separate from the Node contract suite. Browser QA should cover the affected routes, EN/DE/ES/FR/IT, dark/light, desktop and 390/320px layouts. Desktop emulation does not certify real iPhone Safari. Report failed, skipped and unavailable checks honestly; a generic green CI status does not establish that a browser job ran.

## Navigation and visible features

App page routes omit trailing slashes. Domestic detail URLs use `/competitions/<id>/<view>`; club detail URLs use `/clubs/<country>/<clubId>/<view>`. Domestic and club roots normalize to Overview. International cup links use an explicit supported view, such as `/competitions/int-1/standings`; do not invent a cup Overview route. History and Rules omit the season query; other competition views can retain an explicit season. Use the route registry and existing hosting compatibility rules rather than inventing aliases. Removed `/app/...` routes are not current entry points.

The sidebar links Dashboard, Calendar, Settings, Competitions and Clubs. Competition pages share generated layouts, localized tabs, standings/fixtures/statistics/history/rules/awards and the appropriate domestic/cup views. Rules come from validated versioned definitions; historical rules resolve from stored snapshots or an explicitly recognized legacy baseline. Current catalogue rules must not silently rewrite past seasons.

Calendar shows the current simplified Season/Week interface, event markers and dialogs for the approved **56-day cycle**. Days 1–55 are active-season days; day 56 is transition. It is a read-only projection: navigation cannot advance a production world or manufacture results. See [Calendar tracking #236](https://github.com/FraGioco9/football-architect/issues/236) for delivered static/DEV work and outstanding real-world integration.

The top-bar Search is local navigation over available pages/sections and catalogued domestic divisions. It is not a player search, saved-career search or backend query. Settings provides language/theme choices and honest unavailable career/data states. The Guide currently explains Divisions and Clubs; its expanded handbook remains separate work in [#255](https://github.com/FraGioco9/football-architect/pull/255).

The shell retains its historical disabled Continue control, without an active career runtime. There is no shared app Skip to content link in the current template; the known bypass-block accessibility limitation remains unresolved. The semantic main landmark and page headings remain available. This cleanup does not change those behaviors.

## Canonical data and artwork

| Resource | Canonical source | Scope |
| --- | --- | --- |
| Domestic divisions | [data/divisions.json](data/divisions.json) | 16 divisions, two tiers per country, 16 provisional places each |
| International cups | [data/international-competitions.json](data/international-competitions.json) | Sovereign and Federation definitions |
| Club identities | [data/clubs.json](data/clubs.json) | 320 identities; stable `(countryId, clubId)`, IDs 1–40 per country |
| Approved identity source | [data/clubs-registry.csv](data/clubs-registry.csv) | Twelve canonical fields, including names, original description, colours and stadium |
| Provisional participants | [data/division-allocations.provisional.json](data/division-allocations.provisional.json) | IDs 1–16 in tier 1, 17–32 in tier 2; 33–40 retained as asset-only |
| Identity documentation | [docs/clubs/README.md](docs/clubs/README.md) | Schema, source provenance and integration rules |
| National flags | [assets/flags/](assets/flags/) | Currently tracked national-flag SVG assets |
| Division artwork | [assets/divisions/](assets/divisions/) | Primary/compact SVGs for all 16 domestic divisions; preserve source artwork |
| Available club crests | [assets/clubs/](assets/clubs/) | Existing catalogued SVGs; the complete 320-club asset programme remains unfinished |

Identity is independent of current division membership. Do not rename, renumber or regenerate clubs as part of maintenance. The twelve CSV fields do not themselves supply translated descriptions, rivalries, crests or kits; other approved catalogues/assets provide the implemented additions. See [CLUB-IDENTITY #163](https://github.com/FraGioco9/football-architect/issues/163) for outstanding identity work. Earlier art approval/production snapshots remain in their dated GitHub records, not as claims about current file coverage.

Club crests are discovered at `assets/clubs/<countryId>/<clubId>/crest.svg`. Regenerate after adding/removing an SVG so manifests and publication paths agree. `assets/club-crests.js` enhances the relevant static/dynamic hosts; known crests reserve blank loading space, and absent/failed images use neutral placeholders. Passive image loading preserves source SVGs and colours. Public/protected staging includes exactly catalogued paths and rejects stale manifests.

## Publication boundary

Stage only the fail-closed allowlisted public artifact. Hosting the repository root is not an approved publication path. Public division search intentionally fetches the allowlisted `data/divisions.json`; this is not permission to publish arbitrary source data. Protected source-only catalogues, generators and fictional DEV provider/clock code stay outside public runtime dependencies; keep `protected_debug` separate. Neither ordinary public Stats nor History promotes DEV data to approved records. The manual Preview workflow requires its independent owner authorization and is not part of the local development commands.

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

## Maintenance record

The [conservative cleanup design](docs/superpowers/specs/2026-10-27-conservative-cleanup-design.md) and [branch inventory](docs/maintenance/2026-10-27-branch-inventory.json) record the 2026-10-27 audit. The inventory is a dated snapshot, not a live branch registry or proof of deletion. Re-fetch branch heads and open PRs before removal, retain exact SHA recovery references, and preserve unmerged work. Issue and PR closure must be justified by actual completed or superseded scope, not age alone.

Admin World local foundation and the optional same-origin Settings API bridge are documented in [local operations](docs/admin-world-01-operations.md). The production preparation prerequisite remains blocked pending an approved catalogue. No remote database setup or deployment is part of these instructions.
