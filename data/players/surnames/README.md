# SURNAMES-01 — National surname pools (research only, DRAFT/HOLD)

## Fixed ranking targets (owner decision, 2026-11-06)

**Fixed 50-country ranking**, independent of seasons: positions 1–25 × 3,000 (75,000); 26–35 × 2,000 (20,000); 36–45 × 1,500 (15,000); 46–50 × 1,000 (5,000). **Aggregate target = 115,000.** Codes and order match PLAYERS-03, which is untouched.

**Actual entries: 117,216** across 50 JSONs, but this does **not** mean all national targets are met: **18,801 missing within under-target countries** and **21,017 excess retained intact** (net 2,216 above target). Surpluses are not transferable between nations.

Statuses: **21 complete**, **10 partial**, **0 pending**, **16 over_target**, **3 blocked**. All entries remain `production_ready:false`. Numerical completion is not source or licence certification.

Each catalog country has `rank`, `target_count`, `actual_count`, `missing_count=max(0,target-actual)`, `excess_count=max(0,actual-target)` and `status` (`pending`, `partial`, `complete`, `over_target`, `blocked`). `over_target` entries require an explicit review decision: **no automatic truncation or deletion**. `blocked` marks unresolved source conflicts while retaining the last valid file.

All surname entries are exactly `{ "value": "..." }`, with `selection_policy:"uniform"`. There is never a `weight`, `probability`, `frequency_weight` or `selection_weight`. Source ranks and estimated incidences are *attestation references only*, not probabilities. No generator integration.

## Fixed-rank band table

| Ranking | Target per country | Countries | Target total |
| --- | ---: | ---: | ---: |
| 1–25 | 3,000 | 25 | 75,000 |
| 26–35 | 2,000 | 10 | 20,000 |
| 36–45 | 1,500 | 10 | 15,000 |
| 46–50 | 1,000 | 5 | 5,000 |
| **Total** | | **50** | **115,000** |

## Expansion branches (verified Git SHAs)

| Batch | Pinned source HEAD / status | Integrated countries |
| --- | --- | --- |
| A | [78b6ed4e166e](https://github.com/FraGioco9/football-architect/commit/78b6ed4e166e7a5f64b2f9969520f710c38ab135) | ENG 3000; POR 3000; BRA 3000; WAL 3000 |
| B | [4186616986aa](https://github.com/FraGioco9/football-architect/commit/4186616986aa2d03773d5c3527f2010bab87e26c) | BEL 3000; SUI 3000; GER 3000; AUT 3000 |
| C | [3c426196b5dc](https://github.com/FraGioco9/football-architect/commit/3c426196b5dc261cfc0ab88fea59301b02481b86) | NED 3000; NOR 3000; DEN 3000; SWE 3000 |
| D | [988b7c7c9128](https://github.com/FraGioco9/football-architect/commit/988b7c7c9128c74d188866555cb73c7b9c657a10) | ARG 3000; MEX 3000; COL 3000; CHI 3000 |
| E | [7a2c81d4aa9d](https://github.com/FraGioco9/football-architect/commit/7a2c81d4aa9db7f47d6ce3a07a6fa9729236181d) | JPN 3000; TUR 3000; KOR 1011; GRE 3000 |
| F | [cf02a6e67424](https://github.com/FraGioco9/football-architect/commit/cf02a6e67424d0a7616abc4b83618cb7d12d7a01) | CRO 3000; RUS 3000; HUN 1299; SRB 3000 |
| G | PENDING source | Retain original 500; no importable expansion |
| H | [f99141f8e6bc](https://github.com/FraGioco9/football-architect/commit/f99141f8e6bcdd52f26e696d56da98c380fb3df2) | SEN 3000; CIV 3000; NGA 3000; MLI 1517; MLI updated 927 → 1517 |
| I | [770079a8c4b6](https://github.com/FraGioco9/football-architect/commit/770079a8c4b6825e9e89e5441fe8c3374568c1f3) | AUS 999; COD 1001; CMR 1000; RSA 1000 |
| J | [f77e603ca835](https://github.com/FraGioco9/football-architect/commit/f77e603ca835571fcd7fe710488bfde60e336943) | ECU 889; URU/PAR/VEN BLOCKED |
| K | [3297ebb7e356](https://github.com/FraGioco9/football-architect/commit/3297ebb7e356365897ad027e651186c7954c7f0d) | UKR 3000; SVK 3000; PAN 3000 |
| L | [846db25c63ef](https://github.com/FraGioco9/football-architect/commit/846db25c63ef66cee6618993de9ddb599b9b06cf) | ESP 3000; FRA 3000; ITA 3000; USA 3000 |
| M | [67343d344909](https://github.com/FraGioco9/football-architect/commit/67343d3449090632737d70ee168385be49592b41) | CAN 3000; POL 3000; SCO 3000 |

**Batch J conflicts:** source branch `research/surnames-3000-batch-j` currently drops earlier verified `Pena` (URU), `Santa Cruz` (PAR), `Lacruz` (VEN). Those files were **not** imported. Keep the original 500 for those three countries until the sources explicitly retain all previous names. ECU 889 stays integrated.

**Full preservation:** Original 50×500 Git blobs, their source PR/branch/HEAD and file SHA are retained in the catalog. `preservation_baseline_commit` pins the previously integrated snapshot (`b34db4ed7e50a60efdfaee7f538756877753654f`); Node 22 QA verifies its *entire national surname arrays* are prefixes of new files. MLI's previous 927-entry blob is also recorded in `previous_expansion`. All new country files are referenced by exact source branch HEAD and blob SHA. Never import workflow/test experiments from source branches.

## Original 500-entry source batch manifest

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


## QA and constraints

Node 22: `node --test tests/surnames-01-catalog.test.mjs`. Checks 50 fixed ranking codes, four tier boundaries, target aggregate 115,000, each `actual_count` against real JSONs, `missing_count`, `excess_count`, status, source SHA and provenance, Unicode NFC and `Script=Latin`, authentic separators (including Dutch `'s`/`'t`), no internal duplicates, `uniform`, no probability weights, `production_ready:false`, no loss of any existing surname, and no changes to PLAYERS-03.

All country sources retain their original per-country notes: territory-specific attestation, transliteration, period, coverage, and licencing caveats. **Individual national attestation and redistribution rights remain unapproved for production.** The PR is DRAFT/HOLD: no merge to `main`, source PR closure, force push, deploy, DB change or PLAYERS-03 change. Only targeted automatic GitHub Actions, no redundant manual workflows.
