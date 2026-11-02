# DEBUG-DATA-01 — I02 completion gate

Implementation branch: PR #340 (Draft/HOLD). This describes the **candidate** pipeline, not an approved world snapshot.

## Single entry point

From repository root, only after end-stage review:
`node tools/debug-data-build.mjs`

This builds the unsealed candidate entirely in memory, validates its structure and plans 90 per-competition fragments. It does **not** write files, switch Debug data, call D1, or publish.

Optional private disk write requires a deliberate local command:
`node tools/debug-data-build.mjs --dataset-id debug-corpus-v1 --write-private --private-root <absolute-private-path>/debug-data-private`

The private root must exist **outside** the repository; output is immutable and non-runtime. Do **not** execute this until I06, when the user requests the final tests and end-stage validation.

## I02 acceptance checklist

- [x] Five sequential candidate seasons / sixteen domestic leagues / two international cups
- [x] Approved Season 1 participant baseline, subsequent promotion/relegation links
- [x] INT24 holder preservation with approved ChampionAwareV1
- [x] INT24 constructive three-pot home/away draw algorithm
- [x] International table with opponents' strength tiebreaks
- [x] Shared domestic/cup knockout tie resolver with match-level decision provenance
- [x] Candidate protected fragment export plan and local-only writer
- [x] Explicit no-activation CLI with fail-closed dataset validation
- [ ] I06: execute generation and compare all 90 fragments against canonical sports fixtures and calendar
- [ ] I06: verify knockout ET/penalty semantics, tie and ranking edge cases
- [ ] I06: verify immutable private writes, provenance, manifest byte hashes and security boundaries
- [ ] I06: approve I02 completion only after end-stage QA; otherwise reopen specific defects

**Never** replace active Debug or mark `UNSEALED_NOT_FOR_RUNTIME` as sealed before I06. No merge, deploy, remote D1 or public artifact changes.
