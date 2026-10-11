# Initial division allocations — provisional review

**Status: PROVISIONAL / NOT APPROVED.** This register supports the static `UI-WORLD` preview in [PR #92](https://github.com/FraGioco9/football-architect/pull/92). It must not be used as an approved season membership file, authoritative league standings, historical sporting results or save-game initialization.

## Source of truth and evidence

- Club identities and `(countryId, clubId)` keys: [`data/clubs.json`](../../data/clubs.json) — 320 documented identities; no divisionId field.
- Division IDs, tiers and capacities: [`data/divisions.json`](../../data/divisions.json) — eight countries, 16 divisions, 20 planned places each.
- Explicit proposed mappings: [`data/division-allocations.provisional.json`](../../data/division-allocations.provisional.json) — **320 unique club placements**, with per-division lists and provenance.
- **160 first-tier placements (50%)** are *historically informed*: the 20 clubs with IDs 1–20 in each country have a `firstDivisionReference` containing legacy name/city/stadium information. **This is not a current membership approval**.
- **160 second-tier placements (50%)** are *derived*: the remaining IDs 21–40 in each country have no first-tier reference, so they fill the other tier as a working hypothesis. This does not constitute formal approval.
- **0/320 memberships approved canonically (0%)**. No user-approved exceptions to the proposed rule are documented.

## Review proposal (not a decision)

| Country | Tier 1 | Tier 2 | Provisional slots |
|---|---|---|---:|
| Italy | IT-1 — Lega Federale (IDs 1–20) | IT-2 — Lega delle Città (IDs 21–40) | 40 |
| England | ENG-1 — Crown League (IDs 1–20) | ENG-2 — Shield League (IDs 21–40) | 40 |
| Spain | ES-1 — Liga de la Unión (IDs 1–20) | ES-2 — Liga de las Regiones (IDs 21–40) | 40 |
| Germany | DE-1 — Meisterliga (IDs 1–20) | DE-2 — Vereinsliga (IDs 21–40) | 40 |
| France | FR-1 — Ligue des Sociétés (IDs 1–20) | FR-2 — Ligue des Régions (IDs 21–40) | 40 |
| Portugal | PT-1 — Liga Lusitana (IDs 1–20) | PT-2 — Liga Atlântica (IDs 21–40) | 40 |
| Netherlands | NL-1 — Oranjeliga (IDs 1–20) | NL-2 — Bondsklasse (IDs 21–40) | 40 |
| Brazil | BR-1 — Liga das Associações (IDs 1–20) | BR-2 — Liga das Regiões (IDs 21–40) | 40 |

Club ID ordering is **registry ordering, never position in a league table**. Until actual career, match and standings data exist, standings numbers, rankings, scores, matches and results remain unavailable. The table renders the provisional club list without inventing performance.

## Fail-closed contract

`tools/validate-provisional-allocations.mjs` and its tests reject missing/duplicate/foreign club IDs, unsorted or repeated IDs, wrong evidence type, source drift, invalid country/tier/capacity, deviations from the working 1–20/21–40 rule, and any attempt to mark the provisional manifest `approved: true` or `status: canonical`. The shared static page generator reads this manifest and validates it before rendering; `--check` must remain byte-identical.

### Gates before a future canonical decision

- [ ] Review all eight country pairs and their 20+20 rosters, including possible exceptions.
- [ ] Resolve whether historical references sufficiently justify first-tier membership or require explicit club-by-club confirmation.
- [ ] Approve or revise the derived second-tier allocations, separately from historical hints.
- [ ] Obtain explicit owner approval of the final assignment policy and entire 320-club mapping.
- [ ] After approval, use a separate authorized change to publish a canonical version and adopt it in the game runtime (when a runtime exists).

**Excluded:** changes to canonical club/division catalogues, crests, game saves, engine/simulation, deployment configuration, production and `main`. Approval is not inferred from tests or review of this document.
