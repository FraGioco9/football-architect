# Club identity catalogue

The sole approved club registry is [the canonical CSV](../../data/clubs-registry.csv), mirrored by [the flat JSON array](../../data/clubs.json). Both contain 320 clubs across eight countries, 40 clubs per country, ordered by country code and national club ID.

## Fields

| Field | JSON type | Meaning |
|---|---|---|
| countryId | string | Permanent country code |
| clubId | integer | Permanent national ID, 1–40 |
| city | string | Approved location, copied unchanged |
| primaryName | string | Default club display name |
| fullName | string | Official full name |
| compactName | string | Approved compact display label |
| abbr | string | Globally unique uppercase three-letter abbreviation |
| nickname | string | Permanent nickname in its original language |
| description | string | Canonical description in its original language |
| primaryColor | string | Primary social color in hex notation |
| secondaryColor | string | Secondary social color in hex notation |
| stadiumName | string | Permanent stadium name |

The stable identity is the pair `(countryId, clubId)`, independent of division, simulation state or names. No field is inferred or normalized. The only CSV-to-JSON type conversion is numeric `clubId`.

## Approved source

Imported from `football_architect_320_clubs_final_approved_offline(1).csv`, approved by the owner on 2026-10-16. Its SHA-256 is `6940d8bc1abebb6ef06c6d3f56077b4899877a66476b182d14f2fda097ae6d0f`. The checked-in CSV preserves those exact bytes. The regression suite fingerprints both the approved CSV and the full JSON payload, including every description and Unicode character.

Competition pages and their generated manifest read primary names directly from this JSON. The [provisional allocation](../divisions/initial-club-allocation.md) remains separate: IDs 1–16 per country in tier 1, 17–32 in tier 2, and 33–40 outside the division lists. All 320 club records remain in the catalogue.

Superseded anagraphic records, parallel naming catalogues and archival identity tables have been removed from the current tree. Earlier versions remain in Git history. The [design specification](clubs-design-specification.en.md) describes broader identity rules; this import does not create crest artwork, kits, rivalry links, translations or game state.
