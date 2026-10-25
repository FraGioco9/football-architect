# A05-01 — WORLD-TIME 56-day calendar and event snapshot freeze

**Tracking:** #268, A05-01. **Status:** Draft/HOLD until exact-head CI and authorized merge.

## Immutable reference baseline

Main integration SHA: `9897e0b2fea6229bf704fc6d2578c79cf34ff2fc`.

| Authoritative reference | Git blob SHA |
| --- | --- |
| `assets/world-calendar-model.js` | `65b1e4b6d30cb9b3c3f36c1464e3b3e44bcd70f3` |
| `assets/world-clock-adapter.js` | `e5990dea00db5392cdd9b0f8bd701dc05dbbffba` |
| `tools/dev-world-clock.mjs` (protected DEV only) | `12067d51e2cf97a556a918d029f297980f7257fc` |
| `tests/cal-world-56a.test.mjs` | `a5a2996ac6f18f0a24a173cf9c8c67fd754b7114` |

These references freeze the **existing, reviewed** WORLD-TIME read-only projection
and its event snapshots. The canonical time axis has **56 abstract days**,
not real-world dates or clock time. Domestic progress follows the checked-in
`NATIONAL_DAYS` mapping, and the calendar snapshot must not infer that a
scheduled/reached event has been played, completed or approved as a result.

The world calendar and public adapter are read-only; the DEV clock lives only
in the protected tooling boundary. DEV Season 0 must continue to expose no
active snapshot or advancing competition progress. A viewed historical season
must not rewrite world progress or trigger resimulation.

## What is and is not accepted in A05-01

- Freeze existing 56-day calendar/snapshot source identity by main SHA and blob
  IDs, without replacing the existing files, inventing fixtures or changing
  historical rules.
- Reuse existing `tests/cal-world-56a.test.mjs`,
  `tests/world-calendar-model.test.mjs` and the already-required full
  exact-head Site checks / Chromium. Do not create duplicate golden matrices.
- A05-02 remains responsible for detailed N/I/final abstract slot mappings;
  A05-03–10 own separation, projections, atomicity, consumer integration.
  This document is not evidence that those later checkpoints are complete.
- The public publication plan and its anti-deploy boundary remain unchanged.
  No generated-file changes, database writes, workflows or deployment.

## Verification gate

On this evidence-only PR, both GitHub Site checks and INT-24 Chromium must
complete successfully on the **exact PR HEAD**; check mergeability separately.
Do not mark A05-01 CLOSED or merge until separately authorized. After merge,
confirm new `main` HEAD and post-merge CI before advancing A05-02.
