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

## Seventh I05 block — DEV subscriber lifecycle

- Introduced `tools/dev-protected-consumer-registry.mjs` with revision-checked subscriptions, current snapshot and explicit invalidation. The coordinator publishes protected candidate projections to this registry and invalidates the previous snapshot synchronously before every fetch.
- Tightened the gated Domestic controller's revision guard: old asynchronous presentation events cannot restore an earlier dataset after source invalidation, while the successfully prepared presentation for the current pending revision is still permitted.
- The registry does not render DOM, load public assets or activate the I03 renderer. Calendar/Clubs/Stats/History/International renderer subscriptions remain to be implemented and validated.
- No broad tests were run. Full I06 verification and publication security gates remain outstanding.

## Eighth I05 block — reversible DEV page presenter bridge

Added `tools/dev-protected-page-bridge.mjs` with `attachProtectedPresenter`
for calendar, stats, history, international and club candidate projections.
Each explicitly opted-in page presenter supplies prepare, commit and rollback
callbacks. Subscription follows the shared revisioned registry; invalidation
releases the previous presenter transaction. Exceptions from prepare or rollback
are contained, and obsolete prepared candidate transactions are discarded.

This module is **not injected or auto-mounted**. No public page is yet rendered
from the new corpus; specific DOM presenter adapters and owner-approved I06
acceptance are still necessary. No full regression test run.

## Ninth I05 block — actual Stats renderer adapter

Added `tools/dev-protected-stats-presenter.mjs`, an optional DEV integration using the existing `faCompetitionStats.mount`/`update` API via the reversible page bridge. The protected Stats projection now carries played league events and canonical club metadata. Team metrics (clean sheets and current unbeaten streak included) are derived exclusively from events whose result is visible at the selected world day, not invented player data. The presenter can restore the previous Stats context on rollback. It is not injected or automatically enabled; browser/display acceptance is deferred and it must not be called complete.

## Tenth I05 block — gated existing Stats renderer connection

- Added `tools/dev-protected-stats-controller.mjs` as an **explicitly gated** connector to the existing competition Stats panel and its `faCompetitionStats.mount` API. It requires both `data-fa-i03-renderer=1` and `data-fa-i05-stats=1`, and is **not added to any public HTML**. It resets its reversible subscription on route/debug changes.
- Hardened the Stats presenter to reject missing numerical values rather than treat missing source metrics as zero, and to use a revision newer than the existing Stats context before update.
- This is integration code, **not page activation**. The module is not injected and has no verified browser acceptance; remaining Calendar, Clubs, International and History renderer work is open. Full regression remains deferred to I06.

## Eleventh I05 block — gated History panel connection

- Added `tools/dev-protected-history-presenter.mjs` and `tools/dev-protected-history-controller.mjs`. An explicit two-gate DEV opt-in attaches a hidden candidate-only text outlet within the existing History panel, with reversible commit/rollback through the shared I05 presenter bridge.
- Unfinished candidate seasons produce no champion display; complete candidate-only values are intentionally not marked official. Source invalidation clears the outlet, and disabling the gate removes it.
- Not injected into public page bundles; no historical archive replacement, automated activation or acceptance is claimed. Full History integration and I06 QA remain outstanding.

## Twelfth I05 block — protected International fixture outlet

- Added `tools/dev-protected-international-presenter.mjs` and `tools/dev-protected-international-controller.mjs`: a manually imported, two-gate DEV-only readout inside the existing International fixture panel. It accepts only validated `int-1` or `int-2` candidates and displays completed fixtures through the selected day, with reversible restoration.
- This is **not** a replacement for the International fixture cards and does not change matchday selectors, header geometry, leg boxes, or official fixture data. No public script imports or automatic activation were added.
- The actual /calendar and /clubs route viewers still require route-aware protected aggregation; the existing source coordinator currently serves only /competitions/:id. Do not claim those pages integrated. Tests remain deferred to I06.

## I05 world aggregation

Added protected world reader and authenticated loopback `world-view` endpoint for a shared S1-S5/day cursor across all 18 competitions. Added browser-safe day and club fixture selectors. Calendar and Club DOM renderers are not yet connected; test acceptance remains deferred to I06.

## I05 protected Calendar and Club source coordinator

Created `tools/dev-protected-world-source.mjs`, an explicit-import DEV-only source adapter for `/calendar` and `/clubs/<country>/<clubId>`. It consumes the authenticated `world-view` candidate endpoint, checks the selected world cursor and dataset, derives the selected calendar-day events or club fixtures, and dispatches `fa:protected-world-ready`, `fa:protected-world-reset`, and unavailable events. Requests are aborted and invalidated on source changes, including Debug OFF and Season 0. No public import, DOM renderer integration, completed test acceptance or cutover is claimed.

## Fourteenth I05 block — gated route bootstrap and world readouts

Added `tools/dev-protected-i05-bootstrap.mjs` as a manually imported **local-only**, double-gated entrypoint for competition and world routes. When both `data-fa-i03-renderer=1` and `data-fa-i05-enable=1` are present, it imports the protected source and appropriate controller modules. No public HTML import was added.

Added `tools/dev-protected-world-presenter.mjs` for reversible candidate-only Calendar/Club played-match readouts. It preserves the underlying page geometry and existing widgets, clearing its output on source reset or errors. This is **not** a complete Calendar or Club UI data replacement. The protected world reader additionally rejects cursor/competition mismatches across its 18 projections.

**Remaining for genuine I05 completion:** replacing the readout outlets with actual Calendar and Club renderer data transactions, integrating full International fixtures/history rather than supplemental outlets, completing Stats data compatibility, and resolving the known I03 DOM/renderer regressions. I06 still owns broad QA. The DEV bootstrap is not injected, so visual behavior is not live. Do not mark I05 closed or the PR ready to merge.

## I05 continued integration corrections

A local-only manual bootstrap now imports protected competition and world controllers behind two DEV gates, and a reversible world readout is attached to the existing Calendar details host. World source checks now reject namespace mismatches and future-score leaks. Corrected additional broken relative imports in the protected Domestic presenter and presentation modules. These are commits on PR #340, not verified runtime acceptance.

**Status: I05 not yet complete.** The experimental candidate readouts are not equivalent to wiring the primary Calendar, Club and International widgets; Stats still requires renderer contract acceptance and Season 0–5 selector reconciliation. Do not mark the work package closed before those changes, and do not merge/cut over before I06.

## I05 implementation integration milestone — 2026-11-02

The protected local implementation now contains the following concrete paths:

- A strict two-flag, explicit `?faI05=1` localhost-only DEV bootstrap behind `FA_DEBUG_I03_PROTECTED=1`, `FA_DEBUG_I03_BROWSER_BRIDGE=1`, and `FA_DEBUG_I05_BROWSER_BRIDGE=1`. Its module graph is allowlisted under `/__fa_dev__/`. No public HTML or production deploy is changed.
- S0–S5 DEV controls, first-paint season bootstrapping and legacy preview guard ranges updated to include S5.
- Domestic candidate presentation through the existing shared standings/fixtures/postseason transaction, with corrected DEV module imports.
- International: separate guarded context transaction; candidate league standings mapped to the shared table shape, progressive completed knockout tie receipts; native `faFixtures.prepare` commit/rollback replacing the former supplemental INT readout.
- Calendar: world aggregation at a single source epoch across 18 competitions; on-day event rendering in the existing Calendar details region, including future fixture shells with hidden scores; selection updates without re-fetching or remounting the Calendar grid.
- Clubs: canonical dynamic division membership, position/points/next match, plus candidate fixtures and team stats in the existing Club tabs; replay after page listener initialization.
- Stats: existing renderer adapter using only sourced played fixtures and league totals; no fabricated player statistics.
- History: existing panel candidate current-season presentation and authenticated prior-season candidate archive. No unsealed candidate is claimed as an official historical record.
- All protected sources invalidate on Debug OFF, Season 0, route/cursor change and failed source reads; source revision checks reject old async responses.

**Implementation milestone, NOT QA acceptance**: this is not an approved I07 cutover. In I06 validate the actual UI transitions, INT knockout phases, Calendar geometry, Club tabs, History and Stats, accessibility, iPhone Safari, locale coverage, all existing failing tests, source-epoch races, and publication guards before any readiness/completion declaration. Do not merge, deploy or touch remote DB.

