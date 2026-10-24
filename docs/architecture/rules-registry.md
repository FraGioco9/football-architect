# ARCH-CLEAN-02 — PR-03 Rules Registry (A02)

Status: **Draft / HOLD**. Parent: issue #268. Frozen base: `c4d2482c0d32b4e503b7d337f40a1744679a6c49`.

## Approved six-file perimeter

- NEW `assets/rules-registry.js`
- MODIFY `tools/competition-catalogue.mjs`
- MODIFY (only if strictly needed) `assets/competition-model.js`
- NEW `tests/rules-registry.test.mjs`
- NEW `tests/rules-registry-integration.test.mjs`
- NEW `docs/architecture/rules-registry.md`

No file beyond the listed six may be changed without additional authorization. The historical model can remain untouched because existing immutable snapshot/legacy fail-closed behavior is a frozen compatibility requirement.

## A02 contract

Three immutable rules versions: `domestic-top-v1`, `domestic-second-v1`, `international-int24-v1`. Eighteen competition bindings (eight top tier, eight second tier, two cups). Cup variation allowlist: `int-1` uses `SOVEREIGN-FINAL`, `int-2` uses `FEDERATION-FINAL`. Any other difference between two definitions under the same profile version fails closed; validation delegates to the existing `competition-rules.js` engine.

Pure `createRulesRegistry(definitions, engine)` owns private indexes; exposes `getProfile(version)`, `getCompetition(id)`, `resolveCompetitionRules(id)`, `getHistoricalBaseline(id)`, `listBindings()` and `listCompetitions()`. The returned values are deeply frozen. Historic snapshots remain controlled by `competition-model.js`; a registry query never replaces a persisted season snapshot.

Source JSONs, views, routing, providers, world clock, publication guard, workflows, hosting, and source rules engine remain unchanged.

## QA gates

Compare full normalized 18 definitions and public competition manifest, check snapshot/legacy fail-closed behavior, `node --test --test-concurrency=1 tests/*.test.mjs`, `node tools/generate-app-pages.mjs --check`, Chromium, CI exact-head, publication guard blob identity, and byte-identical generated outputs. No merge/deploy/DB.
