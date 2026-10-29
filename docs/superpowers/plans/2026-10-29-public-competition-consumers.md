# Public competition consumer integration

Goal: connect existing competition Fixtures, Standings and Stats to the new anonymous authoritative source, retaining protected DEV isolation. Calendar/History remain a separate unfinished part of the original checklist item (17/22,77.3%).

- [x] Author pure adapter/controller regressions for saved league fixtures, standings, score-only stats, mismatched season/rules/identity, future scores, stale/reset responses, DEV disablement and two concurrent requests. Do not run tests until final owner gate.
- [x] Add a public-only source validator/adapter and cancellable context-bound loader. Recheck anonymous `/api/world` before commit; use no browser storage or privileged credentials. Preserve unknown/unavailable states on network failure.
- [x] Add explicit phase/tie/leg/neutral metadata to validated public fixture projection so existing fixture consumers can interpret known knockout plans without inventing participants or scores.
- [x] Connect competition initialization and source provenance without exposing an authoritative write method on the browser context API. Feed existing fixture, standings and stats renderers, retaining canonical labels and localization.
- [x] Explicitly allowlist only the new public runtime module; do not alter routing, hosting or security/publication gates. Inspect syntax/types/diff; document browser acceptance and Calendar/History integration as still pending.

Review focus: no fictional context on public pages, no relabeling authoritative as verified or DEV, unknown identities/rules rejected, malformed/future scores rejected, requests for obsolete route/season/generation cannot commit, public projection emptied after failed/reset refresh, known knockout metadata only, no fabricated player statistics.

Review finding: the initial currentMatchday adaptation used the last played event. Reused the canonical calendar and currentFixtureChoice helper to preserve next-event semantics; authored a focused regression. No tests executed per owner. Added local bridge allowlisting for bounded anonymous sporting GETs so local page reads can reach the existing Worker target. Calendar/History and browser acceptance remain open; no checklist increment.
