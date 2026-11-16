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

Competition and Club Fixtures show the same full-card petrol hover and open
the canonical match page on a primary click outside the independent club and
competition anchors. Unknown or unofficial IDs never create a link.
The `/calendar` page intentionally displays no match-detail links.


For Competition Fixtures, the authoritative-season adapter retains original
`sourceFixtureId`, `marker` and `day` in addition to verified results.
The published match collection is read at most once per season/competition/world
revision, including scored/historical views. League links must match the
source ID **and** the marker, day and round; knockout links require a published
immutable phase/tie/leg slot plus marker and day. The sporting score is never
replaced by placeholder draw data.


## #605 Postseason knockout bracket links

The Postseason bracket's independently published match slots provide
separate `/matches/:id` links for the first leg, second leg and single-match
final. The 18px score cells are not the clickable hit area: the entire
single-match final card is a native link, while a two-leg tie uses two
full-height half-card native links (left = first leg, right = second leg).
Every linked card shares the full-box petrol hover and 150ms fade-out used
by Competition and Club Fixtures. Club name links remain independent.
Links use `phaseId + tieId + leg` from the canonical published collection,
with exact world generation/revision and selected season fencing. Reserved
knockout slots may open their official match detail even before club participants
have been determined. Unknown/unpublished/DEV slots remain plain text.


The standard competition Fixtures view also presents reserved knockout match slots
as TBD rows before qualification, for domestic postseason and international
knockout rounds. These rows derive only their phase/tie/leg from canonical
approved rules and acquire links strictly from the published official knockout
match index. They do not invent clubs, results, marker/day or kickoffs.

## #605 World Calendar boundary

The public `/calendar` page does not link to individual matches, including
knockout matches. Its original day-scoped API and browser rendering have been
preserved exactly; this feature introduces no new calendar-only database
lookup, no additional Calendar API fields and no links in Calendar event
details. Use the competition Fixtures/Postseason and Club Fixtures views for
match-detail navigation instead.


## Cross-page result navigation audit (stacked on PR #641)

Competition Standings uses the same authenticated-world, season-scoped public
competition match collection as Fixtures and Postseason. A recent-form badge
(W/D/L) may navigate to `/matches/<numericId>` **only after** matching its
verified played fixture by original `sourceFixtureId`, round, marker and day.
The desktop tooltip and compact/mobile tooltip remain usable on hover/focus;
the result badge becomes a native anchor for left-click, Ctrl/Cmd-click,
middle-click and new-tab context-menu navigation. Unverified, DEV, unpublished
or wrong-world form remains informational, never a fabricated match link.

QA checklist (both domestic divisions and INT-24 competitions, present and
historical seasons, desktop and iPhone Safari, EN/DE/ES/FR/IT):

- [ ] `/competitions/<id>/standings` — recent W/D/L results, desktop and compact.
- [ ] `/competitions/<id>/fixtures` — scheduled and scored league rows; all six INT-24 league rounds.
- [ ] `/competitions/<id>/fixtures` — reserved TBD knockout slots and each resolved leg.
- [ ] `/competitions/<id>/postseason` — separate first/second-leg links, single-leg finals.
- [ ] `/clubs/<country>/<clubId>/fixtures` — domestic/international, historical and resolved scores.
- [ ] `/matches/<matchId>` — canonical destination, prematch/completed, correct identity and result.
- [ ] Confirm club-name links still lead to the Club Overview, and native new-tab
      actions work without nested anchors.
- [ ] Confirm loading, 404/unpublished, reset, season change, Debug ON/OFF and
      world revision changes remove stale links without score or layout flashes.

Explicitly excluded: `/calendar` (no individual-match links by owner decision).
Competition History, Stats, Awards and Club History currently show aggregate
season/club outcomes rather than individual match-result records; they must not
invent a result link. Club Overview's next-match summary is not a scored-result
list. Any future per-match records added to those views require a separate
published-ID linkage check.
