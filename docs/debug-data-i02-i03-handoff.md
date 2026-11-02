# I02 → I03 protected Debug read-model handoff

This module is a **pure read-model reference**, not an API or runtime integration.

## Contracts

- Season 0 is unstarted and is never synthesized from Seasons 1–5.
- Season 1–5, day 1–56, require explicit versioned local Debug data.
- Every request must validate the complete corpus lineage before selecting one competition.
- Fixture structural shell may be visible early, but future results and deciding-fixture tie-break metadata stay hidden.
- Standings are computed from only the league results played by the selected day, using the canonical domestic or INT24 ordering rules. Full-season champions, final tables and bracket outcome metadata remain hidden until day 56.
- Future knockout slots retain their scheduled round/day box, but participant IDs are hidden until their event day to avoid leaking results of preceding ties.
- A projection requires canonical `divisions` and `cupCatalog` inputs; it cannot silently fall back to stale Debug ranking rules.
- All projections clone data and do not mutate the immutable archived corpus.
- The existing live Debug source stays unchanged through I02.
- During I03, an authenticated local-only data adapter will be required before any page can read these projections; never expose private JSON through the static host or `/api/world`.

## QA deferred to I06

- Snapshot day 1, 16, 31, 52–56 and season transitions across all five seasons.
- Strictly no future score leakage from fixtures, ties, champions, final ranking.
- Both Debug OFF → global world and Debug ON → selected season/day, preserving first paint.
- Verify composition of 90 archives, exact SHA-256 manifest hashes, no public output.
- Verify postponed tied-knockout outcomes and champion-aware holder handoffs.
