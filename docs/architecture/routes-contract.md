# ARCH-CLEAN-02 — A03 PR-04A Compatibility Freeze
Baseline: `c49e67cc6052ad4ff7d89f37075fb4d287f1b5c8`. Draft/HOLD: no merge, deploy, database, or runtime migration.
## Frozen hosting oracle
`vercel.json` Git blob SHA-1 `b8afd0babb019680223c39be48e659f92aae39a5`, 29 ordered redirects and 7 ordered rewrites. `tests/routes-compatibility.test.mjs` embeds every rule verbatim as JSON and checks byte hash and deep structure, including conditions and ordering.
## Allowed scope
Only `assets/routes-registry.mjs`, `assets/subpage-routes.mjs`, `tests/routes-registry.test.mjs`, `tests/routes-compatibility.test.mjs`, and `docs/architecture/routes-contract.md`. Existing ROUTE-02 facade retains the exact public return shape for domestic clubs/divisions. New pure A03 API adds `parseRoute`, `buildRoute`, `canonicalizeRoute`, `resolveRouteIdentity`; cups are handled without changing legacy facade support.
## Deferred dynamic oracle
DEV HTTP status/Location and browser popstate/refresh/query tests must be captured against this baseline before any consumer migration. Existing DEV and browser behaviors can intentionally differ from hosting (e.g. legacy `view`, temporal query stripping, INT-24 root). Do not normalize them centrally until the data are measured and approved.
## Gates
Full Node suite, generator --check, generated artifacts equivalence, exact-head CI, Chromium, publication guard unchanged, source hosting blob unchanged. File scope extension requires HOLD and renewed permission.
