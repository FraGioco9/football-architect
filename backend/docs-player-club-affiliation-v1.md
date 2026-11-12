# Player–club affiliation V1 — implementation slice 1 (#509)

**State:** schema and isolated regression tests only, Draft/HOLD. No public or Admin
affiliation endpoints, UI, remote D1 migration, deployment or backfill in this slice.

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

Future separately reviewed increments:
1. Protected Admin atomic assign/reassign/unassign with permissions, CSRF,
   strict player/club identity, world revision and expected-affiliation guards.
2. Current `GET /api/players?page=N` adds nullable `clubKey`, detail
   `GET /api/players/:id`, and **unpaginated**
   `GET /api/clubs/:clubKey/roster` with one root `clubKey` and complete
   `players[]` (no repeated per-player `clubKey`).
3. API/Worker concurrency, reset, privacy and browser QA. No claim that any
   endpoint or permission boundary exists before these increments land.

**Manual SQL smoke:** SQLite foreign keys/PK/cascade/empty-key behavior PASS
against the proposed table and index. GitHub exact-head CI and full actual
D1 migration/runtime results are **PENDING** until this PR is checked.
