# SURNAMES-01 — National surname pools (DRAFT/HOLD)

## Fixed ranking targets — definitive owner policy

**50 fixed country ranks; 115,000 total national target, independent of seasons.** Ranks 1–25 = 3,000 each (75,000), 26–35 = 2,000 (20,000), 36–45 = 1,500 (15,000), 46–50 = 1,000 (5,000). The exact country codes and per-country targets reside in `catalog-v1.json`.

**Verified snapshot: 139,020 actual surnames in 50/50 national JSONs; 0 missing versus each national target; 24,020 valid entries retained beyond country quotas.** Thus **30 `complete` / 20 `over_target` / 0 `partial` / 0 `pending` / 0 `blocked`**. **Owner decision (2026-11-06): RETAIN all 24,020 excess entries in the 20 `over_target` pools.** No trimming, random deletion, silent deduplication or changes to fixed national targets. The numerical target remains 115,000 and the actual inventory remains 139,020; this owner-approved retention does **not** mean the inventory equals the numerical target or has passed independent population-attestation and licensing review.

The catalog uses `kind: "surnames"` and `selection_policy: "uniform"`, matching the existing main-branch local player-name pool reader; no first-name or player generator code is changed by this PR.

Each country has `rank`, `target_count`, `actual_count`, `missing_count=max(0,target-actual)`, `excess_count=max(0,actual-target)` and `status`. `over_target` remains the status for actual > target even with accepted retention; `over_target_review_required:false`, `over_target_owner_decision:"retain"` and `excess_retention_authorized:true` record that the **quantity retention decision** is resolved. Further source/attestation/legal reviews remain separate. `production_ready:false` on every bank, including complete banks. All selection is `uniform`, never based on national rank, source incidence or any weight.

Each surname is stored only in its national `countries/<CODE>.json` as `{ "value": "Cognome" }`. The catalog does not duplicate surname arrays. Accept only NFC, Latin-script base letters with authentic accents/Latin combining marks, case-insensitive unique values within country, and documented compounds with separators. Latin transliteration is required for original non-Latin scripts.

## Batch A–M national provenance and actual counts

Rows below use the **latest inspected source branch HEAD**. The catalog also retains each file's **exact import SHA**, independent of HEAD-only test/metadata commits, along with all original 500-entry source PRs, original HEADs and Git blobs.

| Batch | Latest source branch HEAD | Actual country entries (surplus above individual target) | Batch actual / target |
| --- | --- | --- | ---: |
| A | [eaad7ca8b455](https://github.com/FraGioco9/football-architect/commit/eaad7ca8b45587387b63ce18e55fc327931166fc) | ENG 3000; POR 3000; BRA 3000; WAL 3000 (+1500) | 12,000 / 10,500 (+1,500 excess) |
| B | [4186616986aa](https://github.com/FraGioco9/football-architect/commit/4186616986aa2d03773d5c3527f2010bab87e26c) | BEL 3000; SUI 3000; GER 3000; AUT 3000 | 12,000 / 12,000 |
| C | [13975cafd1b1](https://github.com/FraGioco9/football-architect/commit/13975cafd1b1d256a5046db0ae27777747588202) | NED 3000; NOR 3000; DEN 3000; SWE 3000 (+1000) | 12,000 / 11,000 (+1,000 excess) |
| D | [988b7c7c9128](https://github.com/FraGioco9/football-architect/commit/988b7c7c9128c74d188866555cb73c7b9c657a10) | ARG 3000; MEX 3000; COL 3000; CHI 3000 (+2000) | 12,000 / 10,000 (+2,000 excess) |
| E | [f6637d16282d](https://github.com/FraGioco9/football-architect/commit/f6637d16282d12d6e63c4ed802d757bee480bfaf) | JPN 3000; TUR 3000 (+1000); KOR 2000; GRE 3000 (+1500) | 11,000 / 8,500 (+2,500 excess) |
| F | [a8ec248cd466](https://github.com/FraGioco9/football-architect/commit/a8ec248cd466ddc79e14fbd9bbbf4f4b5346050b) | CRO 3000; RUS 3000 (+1000); HUN 1500; SRB 3000 (+1500) | 10,500 / 8,000 (+2,500 excess) |
| G | [9e6c15338eff](https://github.com/FraGioco9/football-architect/commit/9e6c15338eff77a8985664e9cb7296f56d3344a3) | MAR 3000; IRN 3000; EGY 3000; ALG 3000 (+1000) | 12,000 / 11,000 (+1,000 excess) |
| H | [f056e2d5f4d6](https://github.com/FraGioco9/football-architect/commit/f056e2d5f4d60375c1d85eb30c3324cdbc25aba3) | SEN 3000; CIV 3000 (+1000); NGA 3000 (+1000); MLI 1517 (+517) | 10,517 / 8,000 (+2,517 excess) |
| I | [aa3429c2bd4f](https://github.com/FraGioco9/football-architect/commit/aa3429c2bd4f0ffb6c50578c0f29161c28dcbb59) | AUS 2000; COD 1500; CMR 1500; RSA 1000 | 6,000 / 6,000 |
| J | [e98c84151711](https://github.com/FraGioco9/football-architect/commit/e98c84151711a0fc019b76b437221d0889550fc5) | URU 3001 (+1); ECU 3000; PAR 2001 (+1); VEN 3001 (+2001) | 11,003 / 9,000 (+2,003 excess) |
| K | [3297ebb7e356](https://github.com/FraGioco9/football-architect/commit/3297ebb7e356365897ad027e651186c7954c7f0d) | UKR 3000 (+1500); SVK 3000 (+1500); PAN 3000 (+2000) | 9,000 / 4,000 (+5,000 excess) |
| L | [846db25c63ef](https://github.com/FraGioco9/football-architect/commit/846db25c63ef66cee6618993de9ddb599b9b06cf) | ESP 3000; FRA 3000; ITA 3000; USA 3000 | 12,000 / 12,000 |
| M | [70be31b1146e](https://github.com/FraGioco9/football-architect/commit/70be31b1146e0c073289a373afb014fe6ec91fa9) | CAN 3000 (+1000); POL 3000 (+1500); SCO 3000 (+1500) | 9,000 / 5,000 (+4,000 excess) |

### Conflict reconciliation and genuine source corrections

- **Uruguay (`URU`)**: latest source contains 3,000, omitting earlier `Pena`; the original 500-entry prefix is preserved and the 2,501 new unique source entries appended → **3,001**. `Pena` and the source-attested `Peña` are kept as distinct Latin spellings pending review. Source blob `1113f9650e2e68a5396a6bd103b9abd0a6d428ab`; integrated reconciled blob `0d0a6b3a1a1fe4f80b45f17a154b9c1ef747647d`.
- **Paraguay (`PAR`)**: latest source contains 2,000, omitting `Santa Cruz`; its existing 500 are preserved, with all newly sourced unique values appended → **2,001**. Raw source `d10783ad531e67b5d4b5e596e1453afd71dfe233`; reconciled blob `799dc6e97219456c15401a06d4315591f55f275e`.
- **Venezuela (`VEN`)**: latest source contains 3,000, omitting `Lacruz`; preserve original 500, add 2,501 novel source values → **3,001**. Raw source `d3db5c45c11f0118b9948298533cc9b92d08c1d2`; reconciled blob `a1179f587bdf14bc5d3c7129caa30872460521af`.
- **Iran (`IRN`)**: the old list's `Farmer`, `Champion`, `Worker`, `Biggy`, `Desert`, `Brilliant`, `Intelligent`, `Dragonian`, `Memorial`, `Carpentry`, `Hunter` were **literal English translation glosses**, not attested Iranian Latin romanizations. The newer source supplies 11 explicitly indexed Latin corrections, each checked against the original Persian lexeme and another Iran-specific Latin directory. All other **489 original entries remain unchanged at their indexes**. The 11 explicit corrections, the source's original-script attestations, and the former original blob remain recorded and tested. The new 3,000-name raw Git blob is `8410811f3f7958b8be6cc2a56e807e4f620dcbe8`. **Independent attestation and redistribution review is still required**.

These reconciliations do **not** create surnames: every retained string already existed in a previous country JSON, and every new name is sourced from the new batch JSON. The three reconciled J pools are above target by one or more entries; **no values were discarded**. Exact source HEADs and raw/imported Git hashes remain distinct and auditable.

## Historical preservation and publication boundaries

The `preservation_baseline_commit` pins the previous cumulative HEAD `d27a46a5b0f5ac086d16e2de7786590820214255`. Node 22 compares every newly integrated pool with its previous complete JSON, including every former 500-entry base, except the **11 attested IRN mistranslation corrections explicitly enumerated in the catalog**. Versions of country blobs are tracked in `expansion_history`; reconciling J records the original source blob separately from the integrated composite SHA. No source PR, source branch, workflow, names file or database has been modified.

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

The original 13 source PR references are retained for immutable provenance. Their GitHub states may change independently; this integration does not merge, close or modify any source PR. The source HEADs above are the verified snapshot for the integration. On a subsequent refresh, inspect each new source HEAD, compare per-country blob SHAs, report conflicts and never overwrite a changed national file automatically.

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



## QA, source and rights limits

Use Node 22 `node --test tests/surnames-01-catalog.test.mjs`; GitHub's automatic SURNAMES-01 workflow checks exact repo scope, 50 countries, fixed-rank target sum 115,000, true actual/missing/excess counts and statuses, Unicode NFC + `Script=Latin`, strict `{value}` entries, no duplicates or weights, valid compounds, cited sources, IRN verified romanization replacements, composite J derivation and preservation of previous files. A `production_ready:false` flag **does not** certify population attestation; source sampling frames, cross-national names, historical periods, romanization conventions, distribution permissions and third-party source licenses still need independent review.

**Draft/HOLD**: never merge to `main`, deploy, write remote databases, update PLAYERS-03 / PR #407, force-push, or close/merge the source PRs without separate authorization. Do not run manual duplicate CI jobs.
