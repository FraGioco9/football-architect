# BE-04 — Canonical season lifecycle and sporting policy boundary

Issue #351. Baseline: `main@6dba946d3f97d63d2bb550aa20cb6c92197666c5` (rebased after #380 and #354) following squash-merges #359/#381, #384, BE-01/#348, BE-02/#349, SH-01/#353. Preserve the approved model. #350 independently owns persistence.

## Command flows, owners and invariants

| Flow | Pure policy / evidence | Command and effect owner | Preserved behavior |
| --- | --- | --- | --- |
| Season 0 → Season 1 prepare | `approved-season-one.ts`, `catalogue-snapshot.ts` | `commands.ts` | Frozen approved first-season snapshot; no Season 0 results |
| World revision and phase | `domain/lifecycle/lifecycle-policy.ts` | `world-repository.ts`, `command-guards.ts` | Proposal cannot replace authenticated D1 CAS and operation receipt |
| World calendar | `assets/world-calendar-model.js`, `season-calendar-evidence.ts` | `calendar-command.ts` | 56-day immutable Season 1 projection and SHA pin |
| Administrative milestones | `domain/calendar/admin-calendar-policy.ts` | `admin-calendar-initialize.ts`, `admin-calendar-command.ts`, `admin-calendar-confirm.ts` | Five setup events and three terminal milestones at day 56, ordered 9000/9100/9200 |
| Administrative start/advance | `domain/calendar/admin-calendar-execution-policy.ts` | `admin-calendar-clock.ts`, `admin-calendar-advance-plan.ts` | Distinct versioned operation and 1–12-day artifact preparation |
| Domestic calendar / international draws | `initial-schedule.ts`, `initial-draws.ts`, `domain/qualification/season-qualification-pots.ts` | `admin-international-draw.ts`, `admin-calendar-publish.ts` | 16 domestic divisions, INT24 pots, eligibility and no same-country league-phase ties |
| Sporting day & knockout | `knockout-progression.ts`, `sporting-day-payload.ts`, `domain/lifecycle/lifecycle-policy.ts` | `lifecycle-command.ts`, `season-sporting-evidence.ts` | One authoritative destination day; recompute day/knockout receipts; day 56 ends sporting play |
| Archive | `season-archive-summary.ts`, `domain/calendar/terminal-milestone-policy.ts` | `season-archive-command.ts` | 56 day receipts, 4,082 results, 54 ties; immutable summary, signed archive hash |
| Close | `domain/calendar/terminal-milestone-policy.ts` | `season-close-command.ts` | Completed archive receipt then scheduled close event; day 56 active → closed |
| Qualification / approval | `domain/qualification/*`, `season-two-snapshot.ts` | `season-two-candidate-read.ts`, `season-two-approval-command.ts` | Domestic promotion/relegation/postseason, INT24 holder allocation; independent approval authority |
| Closed N → preparing N+1 | `domain/lifecycle/lifecycle-policy.ts`, `terminal-milestone-policy.ts` | `season-two-prepare-command.ts`, `season-two-initial-schedule.ts` | Current executor supports Season 1→2 after approved candidate, three terminal receipts; do not generalize to arbitrary N |
| Reset to Season 0 | Separate reset contract | `reset-world-command.ts` | Explicit confirmation rotates generation, resets revision, no historical backfill |
| Historical reads | Immutable archive and snapshot policies | `season-archive-read.ts`, `public-sporting-read.ts` | Past season results never reprojected with current rules |

## Narrow pure-policy extraction

`domain/calendar/terminal-milestone-policy.ts` exports read-only predicates for archive-window, close-window and next-season preparation eligibility. The completed-archive receipt check is now shared by close and prepare. Each command still supplies its own original error code and independent, versioned D1 source guards. In particular, `archive-season-v2`, `close-season-v2` and `prepare-season-two-v2` retain their original SQL statements, transaction ordering, idempotency keys, generation/revision checks, audit log entries, receipt hashes and failure behavior. No rule or contract is strengthened or weakened.

## Deliberately distinct boundaries

- `admin-calendar-clock.ts` and `lifecycle-command.ts` share command verbs, **not** the same persisted state machine. Their receipts, validation and day windows differ. Do not consolidate by name.
- Archive, close, prepare and reset keep separate command versions, source-hash authority and CAS; pure predicates are **not** authorization.
- The existing season authority circular import (`season-snapshot-authority` → `season-two-initial-schedule` → `season-two-candidate-read` → `season-sporting-evidence`) remains to avoid changing Season-2 evidence semantics.
- #350 owns D1 repositories/migrations, schema, query plans and transaction boundaries; #354 owns DOM/rendering; #380 owns local-dev launchers. This PR changes none of those surfaces.
- Season 0, exact Season 1 calendar bytes, 56 days, 30 domestic rounds, international 24-club phases, postseason, outcome algorithm versions, promotion and qualification rules, archival reads and public/DEV isolation remain unchanged.

## Equivalence and acceptance

`backend/tests/terminal-milestone-policy.test.ts` compares each new predicate to the previously inlined command condition over a cross-product of changed IDs, scope, day, order, state, receipts, missing rows and pending blockers. It also asserts nonmutation. Command-facing changes are only substitutions of these identical checks, not SQL or error mapping.

Run the existing targeted backend policy/calendar, sporting day, knockout, archive, Season 1→2, reset and idempotency suites, followed by `npm --prefix backend run typecheck` and `npm --prefix backend run test:contracts`. Before final review verify exact PR HEAD and explicitly report skipped/failed Worker/D1/CI evidence. No remote DB, historical rewrite, merge or deploy.
