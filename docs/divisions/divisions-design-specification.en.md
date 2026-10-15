# Football Architect — Divisions: Essential Design Specification

## Division system

- 16 official divisions across eight countries: Italy, England, Spain, Germany, France, Portugal, Netherlands, Brazil.
- Each country has two active national tiers: First Division and Second Division.
- **DIVISION-ESSENTIAL-01 — Approved (2026-10-15):** Each division contains 16 clubs.
- The 16-club membership of each active division is defined explicitly; tier placement is not recalculated automatically from club strength.
- Clubs remain affiliated with their national system.
- **DIVISION-ESSENTIAL-03 — Approved (2026-10-15):** One global governing body administers all 16 divisions under shared core sporting rules.
- **DIVISION-ESSENTIAL-04 — Approved (2026-10-15):** All 16 divisions remain active even when the user is not following them directly.

## Names and national identity

- Official division names remain in the language of their country and are unchanged when the interface language changes.
- The two divisions in each country share a national identity while retaining distinct identities of their own.

## Competition format

- **DIVISION-ESSENTIAL-05 — Approved (2026-10-15):** Each division plays home and away: 30 matches per club across 30 rounds.
- **DIVISION-ESSENTIAL-06 — Approved (2026-10-15):** Points: win 3, draw 1 per team, loss 0.
- **DIVISION-ESSENTIAL-07 — Approved (2026-10-15):** Ties on points are resolved first by a head-to-head mini-table: points, goal difference, then goals scored. Reapply the criteria to any subset still tied; overall goal difference and goals scored follow if needed.
- **DIVISION-ESSENTIAL-08 — Approved (2026-10-15):** The first-division team finishing first is the national champion; playoffs cannot take the title away from the regular-season leader.
- Playoffs and tie-break matches may be used selectively for other competitive outcomes; they are not required in every division.
- Club membership and ordinary rules remain stable throughout a season. Each new season starts with zero league points; previous results remain part of sporting history.
- **DIVISION-ESSENTIAL-09 — Approved (2026-10-15):** Results affect competition outcomes, tables, and sporting history only; they do not automatically affect other game systems.
- **DIVISION-ESSENTIAL-14 — Approved (2026-10-15):** Promotion and relegation are based on sporting results and follow the same rules in all eight countries. The number of places and any playoff format remain undecided.
- National cups are not part of the initial competition system. An international competition and its access rules have not yet been defined.

## Season structure

- **DIVISION-ESSENTIAL-10 — Approved (2026-10-15):** All eight countries share a common global seasonal calendar.
- **DIVISION-ESSENTIAL-11 — Approved (2026-10-15):** League rounds advance in a globally synchronized sequence across all 16 divisions.
- Exact dates, kickoff times, round frequency, and real-time season duration remain undecided.

## Future structure

- **DIVISION-ESSENTIAL-12 — Approved (2026-10-15):** A third division is a possible future expansion, not an active competition.
- Eight additional club identities per country remain outside the two active divisions and are inactive candidates for possible expansion.
- **DIVISION-ESSENTIAL-13 — Approved (2026-10-15):** If introduced, a third division is intended to launch in all eight countries together and contain 16 clubs. The current 40-club pool per country would require eight additional club identities to fill a third tier.

## Essential open decisions

- Number of promotion and relegation places and the exact use of playoffs (**DIVISION-REVIEW-70 deferred**).
- Exact calendar details.
- Whether and how an international competition will exist, including access rules.
- Whether and when to activate a third division.
