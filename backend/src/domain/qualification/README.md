# Backend domain boundaries — BE-01

This directory contains the **pure international qualification policy** used by season planning and historical review. Four modules have moved here without changes to their algorithms, public function names, input contracts, error codes or persisted data.

| Module | Owns |
| --- | --- |
| `international-holder-review.ts` | Read-only holder evidence from sporting progression |
| `international-holder-allocation-proposal.ts` | Deterministic ChampionAwareV1 holder placement |
| `qualification-review-packet.ts` | Canonical approval evidence packet; never approves or writes |
| `season-qualification-pots.ts` | Deterministic INT24 pots from actual qualified IDs |

Dependencies flow from route/command modules into these pure policies. Keep storage and transport concerns in existing owners; do not import D1 adapters or HTTP into this directory. Existing `next-season-membership.ts`, `knockout-progression.ts` and `catalogue-snapshot.ts` remain in their current location until their cross-module consumers are audited.

## Migration and validation

Old `backend/src/*.ts` qualification policy paths were moved, and their TypeScript imports were updated in five source consumers and six backend contract/runtime tests. Test filenames have not changed, preserving `tools/run-contracts.mjs` discovery. No compatibility re-export wrappers are intentionally introduced: this is an internal-only TypeScript import migration.

Before review, run `npm --prefix backend run typecheck` and the focused qualification tests, plus the relevant season-read and schedule runtime tests. Confirm exact HEAD checks and do not merge until accepted. No SQL migrations, auth contracts or production configuration are changed.
