# Initial club allocation — approved ID policy, provisional UI

**Owner-approved prospective allocation** (2026-10-14): [GAME-VISION #95](https://github.com/FraGioco9/football-architect/issues/95). This policy governs the **future initial** club grouping. The UI remains a static preview with **no active season**, sports ranking, fixture scheduling or game simulation. The owner-approved Season 1 selection is now kept separately from permanent identities. Derived UI projections retain `status: "provisional"` and `approved: false`; participant approval alone does not activate a real season.

## Source contracts

- [Club identities](../../data/clubs.json): all **320** permanent `(countryId, clubId)` identities (40 per country), with all twelve approved identity fields preserved.
- [Divisions](../../data/divisions.json): the same eight countries, 16 competition IDs, original-language names, flags and logos; **16 places per division**, canonical rules and no seasonal `clubIds`.
- [Season 1 selection](../../backend/catalogues/season-1.participants.json): **256** domestic places and **48** international entries (Sovereign IDs 1–3, Federation IDs 4–6 per nation). This is participant-only approval, not a full production initialization manifest. [Node projection](../../tools/load-season-one-preview.mjs) derives unapproved UI lists, checked by [the projection validator](../../tools/validate-provisional-allocations.mjs). No duplicate allocation file is maintained.
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

**Totals:** first division **128** + second division **128** = **256** provisional participants; **64** excluded from gameplay; all **320** identities remain in the catalogue. Club ID order is not a league ranking. Club names and identity fields do not determine league membership.

## Integrity and scope

The selection/projection validators fails closed on missing, duplicate, foreign, wrongly ordered, out-of-range or excluded IDs. The public competition manifest contains only IDs 1–32 (split by tier), while the source club catalogue retains all IDs 1–40. The shared standings shell and 16 competition URLs remain stable.

Ordinary public standings show no invented match statistics. Deterministic fictional results are permitted only in the separately guarded, loopback-only DEV Preview and are never allowed in published artifacts. This allocation does **not** activate careers, cups, promotion/relegation, matches or an official calendar. Those rules remain separate under [WORLD-TIME #94](https://github.com/FraGioco9/football-architect/issues/94).

Division logo source history, hashes, archives and 320 club artistic concepts are preserved. The former provisional 20+20 distribution is retained in Git history rather than a parallel schema, duplicated asset registry or compatibility layer.

D1 owns real current-world and seasonal snapshot membership. Season 2 onward follows certified sporting outcomes; the Season 1 selection does not govern those changes. `data/history/` is an optional official export only. See [Admin operations](../admin-world-01-operations.md).
