# MATCH-STATS-EVENTS-01 — official event timeline proposal (#690)

> **STATUS: OWNER-APPROVED RULES (2026-11-18); IMPLEMENTATION IN PROGRESS / DRAFT-HOLD.**
> It does **not** authorize match-behavior code, a release, migration, remote D1 writes,
> historical receipt edits, world resets, a merge, or a deployment.
> Proposed numerical probabilities and substitution rules are interim game-design
> defaults, **not** claims about real-world football calibration.

## Current code contract and boundaries

- The single official simulation family is `temporary-lineup-v1`, with one
  automatically assigned 4-3-3 real XI when at least 11 eligible affiliated
  players exist; otherwise that **side alone** is a neutral team fallback.
- `backend/src/temporary-lineup-v1.mjs` records goal scorers, the initial
  eleven starters, 90/120 minutes and rating test evidence; it has no assist,
  card or substitution events.
- `backend/src/lineup-day-evidence-v2.mjs` and
  `backend/src/lineup-season-replay.ts` currently validate schema-v1
  per-match receipts with goal-only events and eleven full-match starters.
  Altering that shape without a versioned verifier would break replay.
- `backend/src/match-player-statistics.mjs` and
  `backend/src/public-sporting-read-lineup-v1.ts` already project frozen
  player data, but currently expose assists/red cards as unavailable and
  count all recorded appearances as starts.
- Keep Competition Stats **Overview (3 cards), Teams (7 cards, no per-match
  indicators) and Players (8 cards)** unchanged in structure and order.
  Match Detail #577 and Player Detail #578 keep their separate UI scopes.
- Absolutely no backfill of old receipts, old hashes, archive evidence or
  archived player rows. Frozen old results remain valid and byte-identical.

## Proposed rule set (approval gate)

### 1. Event clock and eligible actors

1. A single ordered event log covers regulation **1–90** and, only when
   already required by the canonical knockout rules, extra time **91–120**.
   Shootout kicks are outside the event/minutes/goals model.
2. The simulation first determines the official score and ET/PK outcome
   using its current seeded result authority. The *same writer* then
   constructs the coherent player-event timeline before creating the one
   immutable receipt. No reader simulates or repairs events.
3. All player actors must belong to that side's **frozen eligible roster**;
   scorers and assisting players must be actively on the pitch at the goal
   event, and cannot be the same player. A fallback side creates **no
   individual events, bench or player minutes**.
4. Event order is frozen as `minute + ordinal`, so simultaneous events
   have a reproducible order: dismissals / card resolution, substitutions,
   then goals (with an explicit tie-break sequence). Only actors eligible
   after preceding events may appear in the next event.
5. For event accounting, a starting player enters at elapsed minute 0;
   an outgoing player exits at the recorded elapsed minute `t`; an
   incoming player enters at `t`; final whistle is at 90 or 120.
   Played minutes are the sum of **nonoverlapping** active intervals.
   Substitutions are scheduled early enough that an entrant plays at
   least one minute. No invented stoppage-time minutes.

### 2. Goals and assists

1. Every new real-XI goal event has a frozen unique event ID, time/period,
   club side, real scorer ID and explicit goal-creation evidence:
   `open_play_pass` or `open_play_solo`.
2. An `open_play_pass` goal includes an independently simulated,
   same-sequence **final deliberate pass** from a different on-pitch
   teammate to the scorer. Only that passed-to-scorer evidence can produce
   `assistingPlayerId`. No inferred assists from position, existing
   roster, scorer name or read-time lookup. Provisional simple heuristic:
   a **65%** chance of generating a final-pass sequence when at least two
   active players exist, with passer choice weighted by frozen passing and
   vision; all draws are seed-derived and replayable. This rate needs
   explicit owner approval.
3. `open_play_solo` has `assistingPlayerId: null` meaning
   **verified no assist**, not unavailable. The goal event itself is
   the required attribution source for both goal and assist counters.
4. Exception policy, reserved for future *explicitly simulated* goal
   types: **own goal: no credited scorer or assist; penalty: no assist;
   direct free kick: no assist; rebound or material defensive deflection:
   no assist without an explicitly retained deliberate final-pass
   provenance**. These types are **not generated** in this interim
   iteration; do not label old goals as any of them or infer exceptions
   retrospectively. Own goals would also require a new explicit score
   reconciliation rule before being enabled.
5. Goal attribution must reconcile score and eligibility *after*
   dismissals and substitutions. Keep seeded goals, ET scores and
   shootout results separate; a goal may never be assigned to a player
   who had already left the pitch or been dismissed. A fallback side's
   goals remain explicitly unattributed team goals.

### 3. Yellow cards, dismissals and on-field headcount

1. Official player disciplinary events are `yellow` and
   `red` with `reason: direct | second_yellow` for red.
   A second-yellow red requires **two** ordered yellow events for the
   same active player, with the second immediately causing a single
   `red(second_yellow)` dismissal; a direct red needs no yellow.
   Every dismissal adds exactly **one** red-card total.
2. Proposed deliberately conservative interim limits: **at most one
   dismissal per side per match**; at most three other yellow cards per
   side. Independent deterministic side-level draws propose a **3%
   direct-red** chance or a **2% second-yellow** chance, mutually
   exclusive. These are proposed model probabilities, not approved
   competition rules. Select only currently eligible on-pitch players;
   never generate cards for fallback, a substitute who never enters, or
   a player who already left the field.
3. Dismissal closes that player's active interval at the event, removes
   them from goal/assist/substitution candidates, and **cannot** be
   replaced as an extra player. Other legitimate substitutions may
   occur later but do not restore the lost headcount.
4. If the goalkeeper is dismissed, immediately assign the keeper role
   to an eligible on-pitch real player chosen by canonical frozen
   goalkeeper suitability. A bench keeper may subsequently enter only
   by an otherwise legal replacement of *another* outfield player;
   the team remains one player short. This emergency role change is
   itself frozen and must not create a phantom goalkeeper.
5. Cards in ET obey the same rules and persist across the 90-minute
   boundary. A dismissed player never returns for ET or becomes eligible
   for a future individual shootout kick. The existing aggregate
   shootout has **no per-kicker attribution** and remains untouched.

### 4. Bench, substitutions and playing time

1. Keep the **exact existing starting-XI selection**. From additional
   eligible frozen affiliated players choose a **bench of up to nine**
   distinct real players, ordered deterministically by position fit and
   ID, prioritizing a declared goalkeeper when one exists. No manually
   submitted lineup or invented player may be used. With exactly
   eleven eligible players the bench is empty; with fewer than eleven,
   the side remains full team fallback, *not* a partial XI.
2. Proposed interim rule: **at most five player substitutions in
   regulation, across at most three in-play substitution windows**.
   Half-time changes do not use an in-play window. If extra time is
   played, allow **one additional substitute and one additional in-play
   window**; the breaks before ET and between ET periods do not use
   an in-play window. An unused normal substitution can also be used
   during ET. Substitution counts are limited by real bench size,
   and no substitution is mandatory.
3. Each substitution event freezes `outPlayerId`, `inPlayerId`,
   minute, side, affected roles and a deterministic event ordinal.
   Incoming players start with `started:false`, are recorded as
   **actual substitute appearances**, and cannot re-enter once
   substituted off. A never-used bench player has zero appearances
   and is omitted from match player totals.
4. A goalkeeper may be voluntarily replaced only by a frozen bench
   player eligible to play goalkeeper; freeze the keeper role change.
   An emergency goalkeeper is an actual active player in the GK role,
   not an extra player. No individual may occupy two roles or overlap
   two active intervals; at most eleven players per side at once,
   fewer after each dismissal.
5. New appearances, starts, substitute appearances, roles, goals and
   minutes are derived from this one ordered timeline and checked
   against the frozen side summary and score. No stat is derived
   from the current contract/roster at read time.

### 5. Clean sheets and unavailable-vs-zero

1. Preserve the approved **GK-role only** rule. A goalkeeper receives
   **one** clean sheet only if they actually occupy the GK role
   continuously for the *entire* 90/120-minute match and their team
   concedes zero goals before any shootout. An uninterrupted full-match
   keeper whose team conceded has a recorded **zero**.
2. A partial-match keeper, a player who only briefly takes the
   emergency GK role, or an outfield player receives **null / not
   eligible** for that match, not a fabricated clean sheet.
   A real emergency keeper covering the *entire* match at GK may
   qualify, despite their natural position being outfield.
3. New complete event receipts distinguish **recorded 0** (eligible
   player participated and no event occurred) from **null** (event
   type unavailable, no verified participation or an ineligible
   clean-sheet role). For older schema-v1 receipts, assists,
   dismissals and substitute counts remain **unrecorded**, not
   retroactively converted to zeros.
4. G+A/90 = `(verified_goals + verified_assists) * 90 / verified_minutes`,
   defined only for >0 minutes with **complete goal AND assist
   provenance for every recorded appearance of that player** in the
   requested competition/season. If even one counted appearance
   lacks assist coverage, assists and G+A/90 remain null for that
   aggregated row; do not divide a partial numerator by full minutes.
   The same complete-coverage rule applies to yellow-card, red-card and
   substitute totals on mixed old/new receipt populations. A second-yellow
   dismissal counts as two yellow cards and one red card; a direct red does
   not itself add a yellow. Yellow totals are derived only from verified
   frozen events, not added to or inferred for legacy receipts.
5. Keep the existing **club-MP percentage thresholds**, ranking,
   no-players empty state, five-row cards, player portraits, translations
   and static first-paint geometry in #643. Preserve Teams and
   Overview exactly as approved.

## Proposed receipt/API evolution (no migration planned)

- Existing `schemaVersion: 1` match receipts retain the exact
  existing parser and byte-sensitive candidate digest. For **new**
  matches only, propose an additive `schemaVersion: 2` match
  receipt carrying `result.eventModelVersion: "lineup-events-v1"`,
  the frozen bench, ordered goal/pass/card/substitution/role events,
  attendance intervals and per-stat coverage. Keep
  `algorithmVersion: "temporary-lineup-v1"` as the **single official
  simulation family**, not an independent scorer/second engine.
- Verifiers must **dispatch strictly by frozen receipt schema**:
  validate legacy v1 as-is; validate new v2 event ordering, identities,
  roles, bench provenance, cross-team IDs, goal reconciliation, yellow
  to second-yellow linkage, max-on-pitch headcount, minutes, GK
  eligibility, rating provenance and substitutions.
  `lineup-day-evidence-v2` remains the day-envelope version; its
  already-stored `outcome_hash` and any archive/root hashes are
  never recalculated or re-saved.
- Writer derives the v2 receipt once in the **existing protected,
  atomic day transaction**, preserving generation, season, fixture,
  roster-source and candidate-digest guards and idempotency.
  JSON-backed per-match storage permits a versioned record without
  altering old rows. Do not add a migration unless an implementation
  proves it necessary and is separately authorized.
- `GET /api/matches/:id/stats` reads **verified frozen receipt**
  evidence but returns **only per-side player aggregates** and the existing
  `ratingVersion`: identities, roles, starts/sub appearances, minutes,
  goals, assists, **yellow cards**, red cards, GK clean sheets and ratings (null when
  historically unrecorded). It does **not** expose `events`,
  `eventModelVersion`, pass details, timestamps/ordinals, actor links,
  cards or substitutions as individual events.
  The detailed timeline stays internal to immutable schema-v2 receipts
  for verification and aggregation, not the public statistics payload.
  `GET /api/matches/:id` remains lean and score-only. Competition
  aggregates use the same verified projection; no per-player API fan-out
  or future-match leakage. Refined following owner API feedback on 2026-11-18.
- Do not change advanced physical Match Engine #452/#628, existing
  score output, historical receipts, club/team statistics schema,
  competition layout, or any remote environment as part of this
  design proposal.

## Verification gates after owner approval

1. Pure seeded-simulation tests: same inputs identical evidence;
   reordered SQL roster inputs identical result; no actor outside
   active intervals; goals reconcile after red cards/substitutions.
2. Assist tests: pass-to-scorer, solo null, self-assist forbidden,
   fallback exclusion, no inferred own-goal/penalty/free-kick/deflection
   assists, ET goals counted and PK kicks excluded.
3. Discipline tests: direct red, second yellow, two yellows linked,
   one dismissal counted once, dismissed cannot score/assist/re-enter,
   on-pitch headcount 10 or fewer, emergency keeper in GK role.
4. Substitution tests: 0/10/11/12+ roster sizes, up-to-nine bench,
   one/two/multi-change windows, 5+ET-1 limits, GK replacements,
   unused bench excluded, minutes/starts/subs summed correctly.
5. Receipt tests: legacy schema-v1 digest *unchanged*; schema-v2
   tamper detection; day replay and archive hashes; retries,
   concurrent world/source guards, full 56-day season, reset
   semantics, mixed legacy/new season coverage and historical seasons.
6. Contract tests: dedicated match-stats API, verified season
   aggregation and eight Players cards; no future leak; zero vs
   unavailable correctness; no changes in Overview/Teams.
7. Scoped Node + Worker/D1 tests, TypeScript, Chromium/WebKit
   responsive regressions, then exact-head CI. Owner visual QA before
   any separately authorized merge.

## Explicit decision requested

Owner approval is required for **all five choices**, together or with
requested changes:

- Assist policy: modeled final-pass event + **65%** provisional generation
  rate; no assist without same-sequence evidence, with listed exceptions.
- Discipline: 3% direct + 2% second-yellow per real-XI side,
  at most one dismissal/side, at most three other yellows.
- Substitutions: bench **9**, **5 changes / 3 in-play windows** in
  regulation, +**1 change / 1 window** in ET, with listed break rules.
- Keeper handling: frozen emergency role, no phantom 11th player after
  red, full-match GK clean sheet only.
- Proof/coverage: only **new** schema-v2 receipts have events; prior
  immutable schema-v1 evidence stays unreadjusted and unsupported
  counters stay null.

**Owner approved the listed rule choices on 2026-11-18.** Implementation is permitted on the Draft/HOLD branch. No merge, deployment, remote data changes or historical receipt rewriting is authorized.
