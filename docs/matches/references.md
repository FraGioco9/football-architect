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


## #605: published match-link resolution

`assets/published-match-links.mjs` indexes only authoritative, published
`/api/matches/seasons/:season/competitions/:id` responses. It verifies the
requested season and competition before exposing numeric IDs. League fixtures
join solely through the original `sourceFixtureId` (never the pair of club
names/IDs); reserved knockout legs join through immutable
`phaseId + tieId + leg`, with marker and day checks. Missing, corrupt,
unpublished or cross-season mappings yield **no link**.

For Club Fixtures, the original source `Fixture.id` stays unchanged;
complete and historical snapshots may resolve up to one published collection
per existing competition (maximum two), with no request per fixture and no
fabricated scores. The early published-draw projection still provides its
verified numeric IDs through the existing club API without extra fetches.
The world/source/season fence in the controller discards stale asynchronous reads.

The score text is the only linked region; crests and opponent names remain
separate. World Calendar and the competition historic/postseason consumers
remain for subsequent #605 stages.
