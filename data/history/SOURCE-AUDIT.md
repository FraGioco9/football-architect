# Competition History source audit

Audit date: 2026-10-17  
Scope: repository files on `main` at `42c77feef721133dead3123ff617a319f4ac144e`.

## Findings

### Identity and competition catalogues
- `data/clubs.json` contains club identity records keyed by `countryId + clubId`. The repository's club-identity issue (#163) describes the approved club catalogue as the identity reference, but this does not establish historical league participation.
- `data/divisions.json` contains division/competition identifiers and display metadata. Its `clubIds` arrays are empty in the inspected source, so it does not define historical participants.
- `data/division-allocations.provisional.json` explicitly declares `status: provisional` and `approved: false`; it must not be treated as canonical season membership.
- `app/competitions/_shared/manifest.json` contains 16 competition definitions and club entries, but explicitly declares `approved: false`. It may be used to inventory candidate competition IDs only, not as an approved historical source.

### Historical results
- The checked-in repository tree contains no authoritative completed final tables or historical match-result datasets for Seasons 1–4.
- The local DEV preview generator creates fictional schedules/standings and is intentionally isolated from public artifacts. Those outputs are not historical evidence and must not be copied into canonical history.

## Coverage
See `coverage-matrix.csv`: 16 competitions × candidate Seasons 1–4 = 64 cells. All 64 are marked `unavailable` because no authoritative final standings were found in the repository audit. This records a repository finding, not a claim that no records exist outside the repository.

## Decision needed before canonical data ingestion
1. Confirm/approve the competition and club identity source to be used by historical rows.
2. Identify an authoritative source for completed season results, or separately approve newly generated results as game canon.
3. Document season-specific participation, scoring rules and tie-breaks before validating final positions.

Until those decisions are resolved, History must remain empty/unavailable for these seasons and must not show definitive all-time records.
