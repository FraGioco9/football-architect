# ARCH-CLEAN-02 PR-02 — Canonical World Catalog (A01)
Status: **Draft / HOLD**. Based on `b5e0a0a05037404d02da455ff12824e55e7d3609`. Tracking: #268.

## Frozen scope
A01 only. New pure `assets/world-catalog.mjs`, Node I/O loader `tools/load-world-catalog.mjs`, baseline/negative tests, and minimal generator consumer substitutions. Existing canonical data, rules, routes, providers, world clock, hosting policy and workflows stay byte-identical.

## Contract
Separate namespace lookups for clubs versus divisions despite overlapping text IDs (e.g. IT-1). Full, uppercase canonical club keys, numeric IDs 1–40 without padding. Invalid IDs return null; malformed or conflicting input catalogues fail closed when constructed. All indexed values are immutable, internal Maps remain private, and result arrays cannot be mutated. Data are static facts: provisional allocations must never be interpreted as an active season.

320 clubs, eight countries, 16 divisions, two INT-24 cups, 256 provisionally allocated club identities, 64 outside gameplay, 352 unique rivalries indexed bidirectionally without duplicate source rows; EN/DE/ES/FR/IT translations with native-language original override.

## Allowed integration
Only Node generator boundaries use the catalog. The resulting public JSON/HTML must remain byte-equivalent to baseline. No runtime season/simulation behavior change or new browser requests.

## Verification
Run `node --test --test-concurrency=1 tests/*.test.mjs`, `node tools/generate-app-pages.mjs --check`, Chromium, exact-head Site checks, and publication guard regression checks before requesting approval. No merge, deployment, or DB work is authorized.
