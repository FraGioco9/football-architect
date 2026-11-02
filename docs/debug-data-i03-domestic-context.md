# I03 domestic shared-context contract

The pure `tools/dev-protected-domestic-context.mjs` adapter converts a protected domestic day projection into a season-data payload consumable by the shared competition context.

It **does not invent or remap club IDs**: it requires the full 16-team participant identity set and can optionally compare against the mounted club registry. A promoted club that is missing from the mounted legacy table causes a fail-closed error; implementing the season-aware roster/crest registry is a separate I03 requirement.

It verifies 240 regular fixtures, a thirty-round day map, consistent played scores, standings membership, expected total matches played and non-leakage of future/postseason results. It exposes the full schedule with only the completed results, ready for the existing Fixtures component, and provides a separate postseason record set.

This module intentionally does **not** mutate DOM, navigate, call D1, or replace the legacy fictional Debug. Wiring to the shared context must preserve its exact revision-based commit/rollback policy; UI should not combine protected fixtures with legacy standings. No browser build or public artifact includes this module.

**I06 gates:** five seasons × all 16 divisions, promotion/relegation identity changes, day boundaries, desktop/mobile standings and fixtures, stale promise races and Debug OFF restoration.
