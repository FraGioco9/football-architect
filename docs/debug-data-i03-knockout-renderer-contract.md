# I03 knockout / Form renderer integration — safe boundary

The shared domestic presenter now prepares postseason fixtures through the
`dev-protected-domestic-knockout-bridge.mjs` contract and passes them to the
existing `faFixtures.prepare` API. This is intentionally fail-closed:

- Future knockout entrants in the protected model are null until their world day.
  The legacy Fixtures validator does **not** support null entrants.
- If any participant remains unknown, the bridge returns `ready:false` and
  the renderer refuses to commit an inconsistent mixed screen.
- Extra time/penalty data needs a semantic conversion audit; the bridge refuses
  these unresolved outcomes rather than displaying invalid scores.
- Form continues to use the pure last-five completed-match model; creating new
  clickable desktop/mobile form marks and tooltip bindings remains a separate
  shared-view lifecycle task.

Because the controller remains absent from the page and no renderer flag is
enabled, the existing Debug UI remains unchanged. Completion requires adapting
the **existing shared fixtures component** to handle future anonymous entrants,
and correctly mapping ET/penalties, before enabling the renderer. Tests stay at I06.
