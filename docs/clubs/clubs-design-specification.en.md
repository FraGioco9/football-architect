# Football Architect — Clubs: Essential Design Specification

## Club universe

- 320 original fictional clubs across eight countries: Italy, England, Spain, Germany, France, Portugal, Netherlands, Brazil.
- 40 clubs per country.
- **CLUB-ESSENTIAL-02 — Approved A (2026-10-15):** The permanent canonical identifier is the pair `(countryId, clubId)`, independent of division. Club IDs are 1–40 within each country. A readable code such as `CLUB-IT-01` is used for documentation and asset naming, not as a replacement for the canonical identifier.

## Names and identity

- **CLUB-ESSENTIAL-01 — Approved A (2026-10-15):** Each club has exactly three naming fields: a **primary name**, a **full official name**, and a **three-letter abbreviation**.
- Abbreviations are explicit, uppercase, stable, and globally unique across all 320 clubs.
- Clubs are fictional, with original names consistent with their country's linguistic and football traditions.
- **CLUB-ESSENTIAL-04 — Approved A (2026-10-15):** Each club has a `city` field containing the official name of its real, permanent city. Multiple clubs may share a city.
- **CLUB-ESSENTIAL-05 — Approved A (2026-10-15):** Each club has one permanent official nickname, recorded in the club’s original language and displayed unchanged in every interface language.
- Each club has exactly two permanent official social colors: one **primary** and one **secondary** (**CLUB-ESSENTIAL-03 — Approved A, 2026-10-15**).

- **CLUB-ESSENTIAL-08 — Approved (2026-10-15):** Each club has one permanent official description, originally written in the club's own language. The original-language description is canonical and is translated for display in the other supported interface languages. The description conveys the club's identity, traditions, connection to its city, and football culture, without relying on changeable simulation state (such as its current division, results, staff, or players).

## Permanent visual identity

- Each club has one permanent official crest.
- Each club has three permanent, immutable official kits: Home, Away, and Third. Each includes shirt, shorts and socks.

## Stadiums and rivalries

- **CLUB-ESSENTIAL-06 — Approved A (2026-10-15):** Each club has one permanent exclusive stadium in its city. The stadium has an original fictional official name that remains permanent throughout the simulation.
- **CLUB-ESSENTIAL-07 — Approved A (2026-10-15):** Every club has at least one permanent historical rival and may have multiple historical rivals. Rivalries are reciprocal, between clubs of the same country, and permanent.
