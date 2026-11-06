# SURNAMES-01 — National surname pools (research-only)

## Status and usage boundaries

- **50 country files are present**, with **25,000 surnames**: all **50 national pools contain 500 entries**. The catalog uses `complete` for structurally validated 500-entry pools. This does **not** mean person-level attestation or production/legal certification; each bank remains research-only.
- Every surname has **equal selection probability within its country pool**. The JSON entry schema is only `{ "value": "..." }`; **no weight, probability, rank or frequency field is permitted**. Country incidence/rank data are cited as evidence of a surname's occurrence **only**. There is no generator integration in this PR.
- All files have `production_ready: false`; country attestation, exact original spellings, romanization equivalence and upstream source/licensing rights require separate manual review before release.
- Codes are the same 50 national codes, in the same order, as PLAYERS-03 PR #407's catalog as verified at `5eaff1081d6c04edae858bd0999c95b09880c1ad`. **PLAYERS-03 files and PR #407 are untouched**.
- The country JSON files are imported **byte-for-byte** from the source Git blobs, without batch-local tests/workflows or unrelated changes. The catalog records **source PR, branch, exact source head and Git blob SHA per country** for conflict-safe future updates.

## Source batch manifest

| Batch | Countries | Source PR (Draft/HOLD) | Source HEAD pinned | Surnames |
| --- | --- | --- | --- | ---: |
| A | ENG, WAL, POR, BRA | [#433](https://github.com/FraGioco9/football-architect/pull/433) | [730d3ddff2b9](https://github.com/FraGioco9/football-architect/commit/730d3ddff2b9174578b9b2d4088fff8dbe6663c0) | 2000 |
| B | GER, AUT, SUI, BEL | [#429](https://github.com/FraGioco9/football-architect/pull/429) | [9320b6dae742](https://github.com/FraGioco9/football-architect/commit/9320b6dae74206f56a332fc7d6cd3d6870be21c8) | 2000 |
| C | NED, DEN, NOR, SWE | [#426](https://github.com/FraGioco9/football-architect/pull/426) | [1ad95c65aa30](https://github.com/FraGioco9/football-architect/commit/1ad95c65aa30c92fcb809377cdc3f11289be119f) | 2000 |
| D | ARG, MEX, COL, CHI | [#437](https://github.com/FraGioco9/football-architect/pull/437) | [7c479fbc6cb6](https://github.com/FraGioco9/football-architect/commit/7c479fbc6cb671822637bea95e48b8343eb5c6df) | 2000 |
| E | JPN, KOR, TUR, GRE | [#432](https://github.com/FraGioco9/football-architect/pull/432) | [2bd2ac265f33](https://github.com/FraGioco9/football-architect/commit/2bd2ac265f33f0a51ff2a4b9e43483a0819a4f58) | 2000 |
| F | CRO, SRB, HUN, RUS | [#436](https://github.com/FraGioco9/football-architect/pull/436) | [be72d9417f99](https://github.com/FraGioco9/football-architect/commit/be72d9417f9989e1908084b8a9ad058f0f97ee91) | 2000 |
| G | MAR, ALG, EGY, IRN | [#430](https://github.com/FraGioco9/football-architect/pull/430) | [fa56e62dbdc0](https://github.com/FraGioco9/football-architect/commit/fa56e62dbdc0883c40df03023c4c1a4f9f4a7bdb) | 2000 |
| H | SEN, CIV, NGA, MLI | [#428](https://github.com/FraGioco9/football-architect/pull/428) | [af6201b21847](https://github.com/FraGioco9/football-architect/commit/af6201b2184750473cb1408131fd3ddd11fc9b2c) | 2000 |
| I | COD, CMR, RSA, AUS | [#425](https://github.com/FraGioco9/football-architect/pull/425) | [1bbb482b7527](https://github.com/FraGioco9/football-architect/commit/1bbb482b752743a89005ade82053ec69193c628a) | 2000 |
| J | URU, PAR, ECU, VEN | [#434](https://github.com/FraGioco9/football-architect/pull/434) | [249bc36ac780](https://github.com/FraGioco9/football-architect/commit/249bc36ac78031fbd9ea7340784387c29e5c5fb3) | 2000 |
| K | UKR, SVK, PAN | [#431](https://github.com/FraGioco9/football-architect/pull/431) | [3b289e502f79](https://github.com/FraGioco9/football-architect/commit/3b289e502f796ad5bf16793d43717f0330d833b2) | 1500 |
| L | ITA, ESP, FRA, USA | [#427](https://github.com/FraGioco9/football-architect/pull/427) | [63e5320d8c54](https://github.com/FraGioco9/football-architect/commit/63e5320d8c54b7b56936e74984d884f5b0967379) | 2000 |
| M | SCO, CAN, POL | [#435](https://github.com/FraGioco9/football-architect/pull/435) | [bd7d58140456](https://github.com/FraGioco9/football-architect/commit/bd7d58140456fdb278278a638103eb421982c07a) | 1500 |

All 13 independent batch PRs remain open and untouched; do not merge or close them automatically. The source HEADs above are the verified snapshot for the integration. On a subsequent refresh, inspect each new source HEAD, compare per-country blob SHAs, report conflicts and never overwrite a changed national file automatically.

## Provenance and limits

The **national JSON `sources` arrays are the authoritative per-country citations** (source URLs, geography, periods, corpus/publisher, romanization conventions and caveats). Their existence does **not** constitute independent verification of each resident's surname or permission to redistribute the original data.

- **A**: England and Wales documented separately; Portugal's Forebears list yielded **355** eligible entries, supplemented by **145 additional Portugal-indexed surname spellings** drawn from six alphabetical lists on `sobrenome.info/portugal/{b,c,d,p,f,m}` (30 + 30 + 25 + 30 + 15 + 15). The original 355 entries are preserved in order; total **500**. Forebears and the supplemental lists are **secondary estimates**, not official resident registers; individual attestation and redistribution terms remain unverified. Brazil excludes apparent artificial multi-surname concatenations.
- **B**: Germany and Austria use source-backed lexicons/locale corpora; Switzerland combines country/regional evidence; Belgium includes Wallonia-specific source material, not nationwide frequencies. Licensing and population coverage need review.
- **C**: Netherlands uses a 2007 CBG/Meertens derivative; Denmark has an older ASCII-restricted teaching extract plus attested Danish orthographies; Norway and Sweden use statistical derivatives/mirrors with incomplete temporal/provenance guarantees.
- **D**: Argentina, Mexico, Colombia and Chile use country-tagged lists and secondary directory evidence; these do not establish unbiased nationwide frequency or independent person-level verification for every item.
- **E**: Japan retains source-published Latin romanizations; South Korea deduplicates documented alias romanizations; Turkey preserves attested Turkish diacritics; Greece retains source-published Latin forms with ELOT/ISO references. Source spelling does not always equal an official romanization.
- **F**: Croatia, Serbia, Hungary and Russia combine locale lists/corpora with country-specific references. Serbian and Russian Cyrillic sources are rendered in Latin Unicode using documented transliteration conventions. Rare/historic entries and redistribution permissions require audit.
- **G**: Morocco uses a secondary country-labelled list; Algeria a student/administrative transcription sample; Egypt family-classified entries from an onomastic corpus; Iran source-published Persian-to-Latin surnames. The samples are not representative population registries.
- **H**: Senegal, Côte d'Ivoire, Nigeria and Mali rely substantially on country-specific secondary modeled surname-incidence listings; historical period, surname-vs-given-name ambiguity, and reuse rights remain open.
- **I**: DR Congo is **COD** (not Republic of Congo); Cameroon, South Africa and Australia use territory-specific secondary sources. National estimated rank tables are not current official registries.
- **J**: Uruguay, Paraguay, Ecuador and Venezuela use independently country-labelled Forebears rows, in several cases noncontiguous ranking intervals. The original incidence order is not a selection weight.
- **K**: Ukrainian surnames are romanized according to the official Ukrainian 2010 standard from a lexical corpus, **not** a modern residents register; corpus/GPL rights need review. Slovak and Panamanian forms draw from country-specific secondary estimates.
- **L**: Italy includes a third-party wordlist; Spain, France and USA reference INE, INSEE and US Census respectively, with differing population periods. National surname occurrence is separate from an equal-probability generator.
- **M**: Scotland and Canada use their own territorial sources (including multiple Canadian language communities); Poland preserves Polish Latin diacritics and includes source spelling cross-checks. Third-party incidence estimates need licensing and spelling audits.

## Validation

`node --test tests/surnames-01-catalog.test.mjs` on **Node 22** checks the complete 50-code contract, file-to-catalog consistency, counts, NFC and `Script=Latin`, Latin-compatible combining marks, legal authentic separators, within-country uniqueness, strict `{value}` entries, no probability/weight keys, required sources, `selection_policy: uniform`, `production_ready: false`, source blob hashes and adversarial controls.

The targeted `.github/workflows/surnames-01.yml` runs automatically on pertinent PR changes only (no `workflow_dispatch`), with a separate diff guard prohibiting changes to `data/players/names/` and any unrelated paths. CI does not establish person-level national attestation or source redistribution rights.

**DRAFT/HOLD:** no merges to `main` without explicit authorization; no deploy, remote database modification, player-generator changes or PLAYERS-03 alterations.
