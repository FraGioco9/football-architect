# I03 protected competition presentation — atomic preparation

The protected domestic pipeline now separates three stages:

1. `dev-protected-domestic-context.mjs` validates the season/day data and catalog identities.
2. `dev-protected-domestic-presentation.mjs` creates a self-contained presentation model for all sixteen standings rows and 240 fixtures, joining club names by stable full club ID, never by position.
3. `dev-protected-domestic-transaction.mjs` requires a presenter with `prepare/commit/rollback`, so partial or failed updates can be rejected.

These are **pure modules**, without side-effectful browser mounting. The current preview renderer still uses its original Debug model. No protected scores are injected into the existing UI before a full shared renderer supports consistent desktop/mobile standings, fixture boxes, postseason, identity changes and rollback.

Next I03: implement the shared presenter and connect it to the gated browser coordinator, then verify it during I06. No deploy, D1 changes or runtime activation.
