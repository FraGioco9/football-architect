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
