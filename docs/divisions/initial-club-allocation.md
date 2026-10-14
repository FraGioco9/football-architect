# Initial club allocation — approved ID policy, provisional UI

**Owner-approved prospective allocation** (2026-10-14): [GAME-VISION #95](https://github.com/FraGioco9/football-architect/issues/95). This policy governs the **future initial** club grouping. The UI remains a static preview with **no active season**, sports ranking, fixture scheduling or game simulation. The original `football-architect-provisional-division-allocation-v1` schema is retained; `status: "provisional"` and `approved: false` remain unchanged.

## Source contracts

- [Club identities](../../data/clubs.json): all **320** permanent `(countryId, clubId)` identities (40 per country), with existing abbreviations, approved primary names and historical references preserved.
- [Divisions](../../data/divisions.json): the same eight countries, 16 competition IDs, original-language names, flags and logos; **16 places per division**.
- [Initial UI allocation](../../data/division-allocations.provisional.json): **256** participants in 16 provisional club lists, each protected by [the allocation validator](../../tools/validate-provisional-allocations.mjs).
- [CLUB-ASSET #61](https://github.com/FraGioco9/football-architect/issues/61): continue the **640 planned PNGs** for all 320 clubs, including 128 images for the 64 excluded clubs.

## Initial allocation, identical in all eight countries

| Country | First division: IDs 1–16 | Second division: IDs 17–32 | Outside gameplay: IDs 33–40 |
|---|---|---|---|
| Italy | IT-1 | IT-2 | 8 asset-only clubs |
| England | ENG-1 | ENG-2 | 8 asset-only clubs |
| Spain | ES-1 | ES-2 | 8 asset-only clubs |
| Germany | DE-1 | DE-2 | 8 asset-only clubs |
| France | FR-1 | FR-2 | 8 asset-only clubs |
| Portugal | PT-1 | PT-2 | 8 asset-only clubs |
| Netherlands | NL-1 | NL-2 | 8 asset-only clubs |
| Brazil | BR-1 | BR-2 | 8 asset-only clubs |

**Totals:** first division **128** + second division **128** = **256** provisional participants; **64** excluded from gameplay; all **320** identities remain in the catalogue. Club ID order is not a league ranking. The 160 historical first-tier references on IDs 1–20 document archival club details, **not** the current placement of IDs 17–20.

## Integrity and scope

The existing v1 validator fails closed on missing, duplicate, foreign, wrongly ordered, out-of-range or excluded IDs. The public competition manifest contains only IDs 1–32 (split by tier), while the source club catalogue retains all IDs 1–40. The shared standings shell and 16 competition URLs remain stable.

Ordinary public standings show no invented match statistics. Deterministic fictional results are permitted only in the separately guarded, loopback-only DEV Preview and are never allowed in published artifacts. This allocation does **not** activate careers, cups, promotion/relegation, matches or an official calendar. Those rules remain separate under [WORLD-TIME #94](https://github.com/FraGioco9/football-architect/issues/94).

Division logo source history, hashes, archives and 320 club artistic concepts are preserved. The former provisional 20+20 distribution is retained in Git history rather than a parallel schema, duplicated asset registry or compatibility layer.
