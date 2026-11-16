# Official published match references — #577

`assets/match-references.mjs` is a side-effect-free shared module for all
future consumers of official match references. Its companion `.d.mts` provides
TypeScript types for the hosted Worker. It has no HTTP or D1 access.

- `indexPublishedCompetitionMatches(payload)` accepts the verified
  `GET /api/matches/seasons/:season/competitions/:competitionId`
  contract and returns frozen `references[]` and `byMatchId`.
- `referenceFromPublicMatch(payload, expectedId)` extracts the same
  identity from `GET /api/matches/:id`, without leaking result data.
- Every entry contains only `matchId`, `season`, `competitionId`,
  `phaseId`, `round`, and `day`.

No new API, duplicate match catalogue, mutable cache, synthetic fixture,
generated result or cross-page navigation is introduced. Future consumers
(Competition Fixtures, Postseason, Club Fixtures, Calendar, History and
Dashboard) may use the exact same references, but linking those pages is
explicitly deferred.

The per-competition endpoint remains the authoritative published source; the
per-club endpoint remains the correct aggregated source for club consumers.
These reference utilities **do not authorize** unpublished data or replace
backend source/receipt checks.
