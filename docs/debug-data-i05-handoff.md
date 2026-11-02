# DEBUG-DATA-01 — I05 protected integration handoff

PR #340, Draft/HOLD; implementation in progress and not accepted.

## First I05 block (2026-11-02)

- The existing loopback-only `/__fa_dev_private__/season-view` competition
  endpoint now uses the shared I04 epoch-aware reader rather than calling the
  older per-request projector directly. The corpus remains an unsealed
  candidate and the reader retains its validated export plan in memory.
- The opt-in source coordinator explicitly validates Debug namespace,
  dataset ID, unsealed candidate status, season, world day, competition,
  standings/event arrays, and the absence of future results before publishing.
- Fixed the DEV coordinator's imports to point at the actual
  `dev-protected-domestic-*.mjs` modules.

## Boundaries

This is a **foundation for I05**, not completion of cross-page integration.
No public route, global Debug cutover, or I03 renderer activation is added.
The current protected endpoint only covers competition IDs; Stats/History,
clubs and Calendar still require shared consumer adapters and route-scoped
read contracts. The I03 pending/rollback work also remains incomplete.
Do not claim that pages now display S1–S5 from the new corpus.

## Follow-up I05 work

- Extend protected read contracts for Stats, History, Calendar and club pages
  without leaking sealed future values.
- Attach route-specific consumers to a single validated source identity and
  revision; preserve first-paint geometry and avoid DOM remounts.
- Implement source OFF / Season 0 rollback across all consumers.
- Retain the existing UX until I06 verification and explicit cutover gate.

Per owner instruction, the broad failing regression suite is deferred to I06.
No new tests were run for this block; existing targeted workflow results are
not treated as acceptance evidence. No merge, deploy, remote D1 or mail.

## Second I05 block

Created `tools/debug-data-i05-view-adapters.mjs`, pure candidate-only Calendar and club-schedule projections. These consume an already validated protected competition view, preserve provenance, reject cursor mismatches and future score/knockout leaks, and never modify the input. They are deliberately **not injected or activated** in Calendar or Club UI yet. Full view integration, dedicated tests and I06 regression remain open.

## Third I05 block

Added `tools/debug-data-i05-consumers.mjs`, a single candidate-only bridge that validates one protected view and exposes Calendar and per-club projections with a common source identity and cursor. The bridge is not injected in runtime. An attempted integration into the DEV source coordinator could not be committed; it remains open and no page activation is claimed. Full regressions stay deferred to I06.

## Fourth I05 block — coordinator wiring

The protected DEV source coordinator now imports `prepareProtectedConsumers`, validates the same protected projection for Calendar and club schedule consumers, publishes a `fa:protected-debug-consumers-ready` candidate event with source revision, and clears the cached consumer reference when the source resets, becomes unavailable, or enters Season 0. No public page renderer subscribes yet; activation remains withheld pending I06 acceptance. Tests were not run under the owner-approved deferment.

## Fifth I05 block — Statistics, History and International candidates

- Added pure `projectProtectedStandings`, `projectProtectedStats`,
  `projectProtectedCompetitionHistory`, and `projectProtectedInternational`
  to the protected consumer adapters. Each derives only from the already
  day-redacted projection and retains Debug provenance and source coordinates.
- Stats provides existing validated team standings fields only; player
  statistics remain explicitly unavailable until supported by canonical data.
- History exposes a candidate champion/final table only on a complete day-56
  projection. This is not an official archive receipt or finalized Debug seal.
- Cup consumer shares the same fixtures, redacted standings and provisional
  history interface; no cup renderer has been activated.
- The shared candidate bridge now exposes these consumers alongside Calendar
  and club schedules. Failed or unavailable source requests clear the prior
  consumer reference, avoiding retained cross-season candidates.

No page integration, runtime activation, full test suite, public endpoint,
remote D1 or deployment in this block. I05 remains **in progress**.

## Sixth I05 block — candidate source transitions and rollback

- Fixed the I03 protected Domestic controller's presenter import to the actual DEV-only module path.
- Cursor change (day/season), route change, source-unavailable and pending-fetch notifications now release protected DOM ownership in the gated controller.
- The source coordinator clears both previous candidate view and consumers synchronously at the start of every refresh, before awaiting the network request. It emits an explicit pending event and continues to reject stale responses by revision.
- Debug OFF and Season 0 continue to emit source-change events and clear all candidate ownership. No consumer is injected into the public site; activation remains disabled.
- No test run or acceptance is claimed. Review final pending/rollback appearance and source-epoch race cases during I06.
