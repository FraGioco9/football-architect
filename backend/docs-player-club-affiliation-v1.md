# Player–club affiliation V1 — implementation slice 1 (#509)

**State:** V1 storage, guarded Admin read/write API and Admin Contracts page in Draft/HOLD. No public affiliation endpoints, remote D1 migration, deployment or backfill.

The forward-only `0022_player_club_affiliations.sql` migration creates exactly
two columns: `player_id` (positive persisted numeric footballer ID, primary key,
FK to `generated_players(id)` with cascade on **explicit player deletion**),
and `club_key` (the current canonical club key). The `(club_key,player_id)`
index supports full-roster reads in stable player-ID order. A player with no row
is unassigned; a player cannot be linked to multiple clubs. Multiple players
may belong to the same club. Existing players are **never backfilled**.

All **320 canonical clubs**, active or inactive, are eligible, but the future
protected Admin mutation API **must validate club keys against the authoritative
club catalogue**. The SQL whitespace check is not a substitute for that
validation. Draft preview candidates have no persisted player ID and cannot
have an affiliation. Retirement and season transitions never expire links.

World reset must not delete/alter persisted player rows or affiliations.
`reset-world-command.ts` already preserves players after #526; this slice
adds a direct D1 regression proving links and source rows survive sporting reset.
Legacy `world_generation` on player records remains historical provenance, not
a filter for public/Admin persisted-player visibility. Any stale Admin changes
must still be rejected using live world generation/revision and expected link.

Current Draft/HOLD increments:
1. Protected Admin atomic assign/reassign/unassign with permissions, CSRF,
   strict player/club identity, world revision and expected-affiliation guards.
2. Admin /admin/contracts UI with a third directory card, search, current-club editing,
   pagination and five-language site styling. Server authorization remains authoritative.

Future separately reviewed increments:
1. Current `GET /api/players?page=N` adds nullable `clubKey`, detail
   `GET /api/players/:id`, and **unpaginated**
   `GET /api/clubs/:clubKey/roster` with one root `clubKey` and complete
   `players[]` (no repeated per-player `clubKey`).
2. Additional API/Worker concurrency, reset, privacy and browser QA.
   No claim of public data exposure, remote deployment or production readiness.

**Evidence:** Previous schema-only exact-head CI PASS (52 Python migration and 282 Worker/D1 tests). Admin Contracts and subsequent UI/route changes remain subject to new exact-head CI and owner QA; no FULL PASS is claimed for this increment until GitHub reports it.
