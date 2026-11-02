# DEBUG-DATA-01 — I03 coordinated domestic presentation

## Scope and execution record — 2026-11-02

Continue from exact PR #340 HEAD `c6b69a4df7624c622bff1a12d71c19a69a0761b7`.
Owner requested direct implementation, substantial blocks, Draft/HOLD, no merge,
deploy or remote DB, and overall test execution deferred to I06.

Implementation plan for this block:
- [x] Expose and reuse the existing Form tooltip lifecycle for desktop/mobile.
- [x] Convert canonical Form IDs only at the domestic renderer boundary.
- [x] Prepare season-specific Fixtures and postseason catalogs without installing
  them until commit; snapshot both catalogs for rollback.
- [x] Adapt the same redacted knockout events into the existing bracket contract.
- [x] Commit context, Fixtures, bracket, desktop/mobile standings and tooltip
  listeners as one synchronous reversible update; notify consumers afterwards.
- [x] Release outgoing ownership before preparing its replacement; avoid restoring
  stale rows over a newer authoritative context.
- [x] Run syntax/patch checks only; document deferred acceptance below.

## Shared contracts

`faStandingsView.attachFormTooltips(clubs, entries)` is the site's existing
implementation, exported for the protected presenter. It retains pointer,
keyboard, touch, ESC, viewport/topbar and nested-scroll handling and the fixed
three-column score. Each instance gets a unique tooltip ID; cleanup removes all
listeners even without AbortController. Desktop and mobile entries are bound
together. Existing shared tooltip bindings are suspended while the protected
transaction owns the view and resumed on rollback, preventing an older open
tooltip from displaying data for detached rows. Outside clicks on the glyph inside a Form button count as inside.

`faFixtures.prepare(fixtures, {participants, ...})` validates against an explicit
seasonal catalog, installs it only at commit, and includes it in `snapshot()`.
The original rule-update behavior remains available to existing callers without
an explicit seasonal catalog. Protected calls reject a rule remount at prepare.
`faPostseason.prepare(rows, results, definition, {participants})` follows the same
catalog handoff. Both retain the existing controls and fixture/leg structure.

`prepareProtectedBracket` derives seeds, completed legs, aggregates and winners
from the already redacted events. It does not read sealed future results. The
bracket's pre-existing contract expects displayed goals including extra time;
Fixtures keeps regulation and extra-time goals separate internally, adding them
for display. Penalty scores stay separate in both views. A final's entrants may
be resolved from completed semifinals, never from an unplayed future result.

`faCompetitionContextApi.prepareProtectedSeasonData` is guarded by local DEV
and the separate `data-fa-i03-renderer=1` opt-in. It validates source identity,
season, rules and seasonal participants, stages a frozen context, checks context
identity/revision at commit, and publishes only after all presenters succeed.
The `protected-domestic` presentation owner prevents supplied standings and
Fixtures listeners from rendering the same snapshot a second time. Other
context consumers receive the normal committed event. Rollback restores the
prior context without incrementing its revision or notifying intermediate state.

The controller releases the prior transaction **before** preparing the next
one. Previously the next snapshot retained DOM owned by the transaction about
to be rolled back. Failure restores the base view; stale rollback only disposes
its own tooltip listeners if a newer context has taken ownership.

## Verification and remaining gates

Only JavaScript syntax checks and `git diff --check` were executed for this
block. These are not browser or functional acceptance. No tests were executed;
the following cases must be exercised in I06:

- S1–S5 seasonal promotions/relegations with identical club IDs/names/crests in
  Standings, Fixtures, Form and bracket; forwards and backwards day switches.
- Days before league closure, 52/53/54/56, including extra time, shootouts,
  unresolved legs and a pending final; no future-result disclosure.
- Desktop mouse/focus and mobile touch/Enter/Space/ESC, glyph clicks, outside
  clicks, scrolling, resize, language change and repeated cleanup/rebinding.
- Inject a failure at every commit stage; verify restored context, catalogs,
  bracket, rows, tooltips, focused club/control, expanded details and scrolling.
- Source OFF, Season 0, failed transport and rapid route/day/source changes;
  stale events must not restore prior Debug over newer global data.
- First paint, element identity, logo hydration, pending-data clearing and all
  other consuming views (Stats/History, international cups, clubs, calendar).

The separate renderer is **still not injected or enabled**. This block does not
complete I03 or enable Season 5 globally. Source transition/pending handling,
whole-source cutover and cross-consumer restoration still require integration
and I06 acceptance. No publication guard or public build allowlist was relaxed.
