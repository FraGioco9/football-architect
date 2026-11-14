# ME-PB-54 / A1.3b.1 — persisted calendar -> real Rapier fixture boundary

**Progress:** partial A1.3b. The approved fixture authority ingress
is implemented, but player–club affiliation/roster binding and any
authorized production match execution are still **NOT** implemented.
A1 main remains **2/4 (50%)**, Match Physics V1 **8/20 (40%)**.
PR #481 remains Draft/HOLD. No official fixture results are changed.

## Backend source (read only)

`backend/src/physical-fixture-calendar-bridge.ts` deliberately uses
the actual trusted sporting source already consumed by lifecycle:

1. `readWorld(db)` gets current durable generation/season/day/revision.
   Callers provide the expected revision, which must match exactly.
   Only active days 1–55 are eligible.
2. `loadSeasonSportingEvidence(db,world)` reconstructs the **actual
   persisted current-season calendar**, approved snapshot and both
   signed draw outcomes. It does NOT trust caller-supplied fixture
   arrays, a request seed, a self-rehashed JSON document or a bare
   claim of approval. `requireGeneratedSchedule` verifies a trusted
   in-memory generator provenance and bindings.
3. A fixture is eligible only when its exact ID occurs **once** among
   signed initial-schedule fixtures AND its scheduled day equals
   `world.day + 1`. Dynamic knockout fixtures not yet represented in
   the initial schedule must fail closed; they are not invented.
4. `readWorld(db)` is checked again; a changed generation, revision,
   day, season or phase returns `stale_world`. The returned receipt
   contains frozen, seven-field fixture identity and approval hashes
   tied to that exact world revision. No writes occur.

## Physics integration seam (not official scoring)

The opt-in `runDuePhysicalFixtureWindow` consumes that trusted
read-only receipt and calls the **already existing**
`match-engine/src/physical-fixture-step-runtime.mjs` producer, thereby
performing real Rapier 60Hz ball + 22 canonical shoe physics for
1–600 bounded ticks. It hashes measured ball and genuine foot
START/END/ACTIVE events, then checks world identity again. It is **not
routed to Worker HTTP, season lifecycle, match result storage or
season archive**, and it does not change temporary scores.

There is only one globalResponse parameter. The model is the same
physical A1.2/A1.3a Rapier world; there are no new simulation knobs.
The receipt explicitly states:
- `fixtureCalendarVerifiedAtRevision=true`: membership in an
  actual D1-backed approved schedule as of a specific revision;
  NOT a perpetual fixture authority or a signed client token
- `rosterBound=false`: 22 canonical tactical placeholders are **NOT**
  the club's actual 22 registered footballers
- `matchResultsAuthorized=false`, `officialMatchResult=null`,
  `scoreAuthority='external-temporary-score-v1'`;
  no goal, action, possession or interception is official

## Dependencies remaining

Issue #509 approved a minimal `player_club_affiliations` table, but
the migration/assignment API and authoritative current club rosters
are still absent. There is no approved fixture-day roster selection,
formation/boundness or eleven-player lineup source. **Never substitute
a synthetic `home-10` / `away-10` label for a persisted player ID.**
Do not add a guessed `club_id` field to player payloads or generate
affiliations during match execution.

To finish A1.3b: implement and authorize #509 affiliations; obtain
trusted current-club rosters and lineup authority, map those to the
22 physical players, support qualified knockout fixture authority,
and decide how an actual match runtime will be invoked from the
lifecycle **without overwriting** the immutable
`temporary-score-v1` receipts. Approval of any score-authority
migration is separate. Only then can A1.3/A1.4 and A1 main gates be
considered.

Local D1 integration tests reconstruct a real approved Season 1 and
verify future/due day guards, immutable hash evidence, no persisted
roster table, no score write, invalid/revision mismatches, and
fail-closed behavior before a physical run when Rapier is absent.
These tests do **not** claim a completed physical season or production
simulation.

Tracking:
- https://github.com/FraGioco9/football-architect/issues/480
- https://github.com/FraGioco9/football-architect/issues/509
- https://github.com/FraGioco9/football-architect/pull/481
