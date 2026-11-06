# SURNAMES-01 — National surname pools (research-only)

## Status and usage boundaries

- **New cumulative target: 50 × 3,000 = 150,000 national surname entries.** Current verified snapshot: **72,816 / 150,000** across 50 files: **18 `complete` (3,000 each)** and **32 `partial`** (26 at 500, Mali/MLI at 927, COD/CMR/RSA/AUS at 1,001/1,000/1,000/999, and ECU at 889). No 500-entry bank is `complete` under this target. All 25,000 original entries are preserved. Status is a numerical completeness label, **not** independent population/source/licensing or production certification.
- Every surname has **equal selection probability within its country pool**. The JSON entry schema is only `{ "value": "..." }`; **no weight, probability, rank or frequency field is permitted**. Country incidence/rank data are cited as evidence of a surname's occurrence **only**. There is no generator integration in this PR.
- All files have `production_ready: false`; country attestation, exact original spellings, romanization equivalence and upstream source/licensing rights require separate manual review before release.
- Codes are the same 50 national codes, in the same order, as PLAYERS-03 PR #407's catalog as verified at `5eaff1081d6c04edae858bd0999c95b09880c1ad`. **PLAYERS-03 files and PR #407 are untouched**.
- The catalog preserves **original SURNAMES-01 batch source PR, branch, exact HEAD and original 500-entry Git blob SHA** for every nation. For 3,000-target expansions it separately records **expansion branch, exact HEAD and integrated blob SHA**. Every expanded bank retains its 500 original surname values **in the same order**. Files are imported byte-for-byte from expansion branches; no batch-local workflows/tests or unrelated changes are imported.

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

## Expansion to 3,000 — latest verified snapshot

**Target: 150,000** entries; **actual: 72,816** (18 complete at 3,000, 32 partial). No synthesized filler. **All original 50 × 500 values remain preserved**, with the original Git blob SHA and associated historical source PR retained per country. At each refresh compare source branch HEADs, each updated blob, original 500-name prefix, strict Unicode and the catalog before importing.

| Batch | Expanded branch snapshot (no source PR required) | Country counts currently integrated | Status |
| --- | --- | --- | --- |
| A | [78b6ed4e166e](https://github.com/FraGioco9/football-architect/commit/78b6ed4e166e7a5f64b2f9969520f710c38ab135) · `research/surnames-3000-batch-a` | ENG 3000; WAL 3000; POR 3000; BRA 3000 | complete |
| B | [4186616986aa](https://github.com/FraGioco9/football-architect/commit/4186616986aa2d03773d5c3527f2010bab87e26c) · `research/surnames-3000-batch-b` | GER 3000; AUT 3000; SUI 3000; BEL 3000 | complete |
| C | [3c426196b5dc](https://github.com/FraGioco9/football-architect/commit/3c426196b5dc261cfc0ab88fea59301b02481b86) · `research/surnames-3000-batch-c` | NED 3000; DEN 3000; NOR 3000; SWE 3000 | complete |
| D | `research/surnames-3000-batch-d` | Original 500 per nation retained | PENDING expanded JSON |
| E | `research/surnames-3000-batch-e` | Original 500 per nation retained | PENDING expanded JSON |
| F | `research/surnames-3000-batch-f` | Original 500 per nation retained | PENDING expanded JSON |
| G | `research/surnames-3000-batch-g` | Original 500 per nation retained | PENDING expanded JSON |
| H | [b44e3c9ed63e](https://github.com/FraGioco9/football-architect/commit/b44e3c9ed63e411cd9b644427023aa847db54a1a) · `research/surnames-3000-batch-h` | SEN 3000; CIV 3000; NGA 3000; MLI 927 | partial: MLI 927 |
| I | [770079a8c4b6](https://github.com/FraGioco9/football-architect/commit/770079a8c4b6825e9e89e5441fe8c3374568c1f3) · `research/surnames-3000-batch-i` | COD 1001; CMR 1000; RSA 1000; AUS 999 | partial |
| J | [f77e603ca835](https://github.com/FraGioco9/football-architect/commit/f77e603ca835571fcd7fe710488bfde60e336943) · `research/surnames-3000-batch-j` | ECU 889 imported; URU/PAR/VEN unchanged at 500 | PARTIAL / 3 preservation conflicts |
| K | `research/surnames-3000-batch-k` | Original 500 per nation retained | PENDING expanded JSON |
| L | `research/surnames-3000-batch-l` | Original 500 per nation retained | PENDING expanded JSON |
| M | [67343d344909](https://github.com/FraGioco9/football-architect/commit/67343d3449090632737d70ee168385be49592b41) · `research/surnames-3000-batch-m` | SCO 3000; CAN 3000; POL 3000 | complete |

**Mali**: the expanded H source currently documents **927** distinct surname entries (500 originals + 427 additional); it is **2,073 below 3,000** and must remain `partial`. The other H countries (SEN, CIV, NGA) are each at 3,000. Batch C is now integrated for all four nations. Batch I is integrated **only at the actual counts shown**, without manufacturing the remaining entries. Batch J ECU preserves its original 500 names and is integrated at 889; **do not import the other J files yet** because three source JSONs drop a previously integrated surname: URU omits `Pena`, PAR omits `Santa Cruz`, and VEN omits `Lacruz`. The source branch must retain each baseline surname before import. Other absent or still-uncommitted expansions remain unintegrated rather than inferred.

**Dutch surname grammar:** authentic Dutch particles such as `van 't Hof`, `in 't Veld`, and `'s Graeuwen` are accepted via a narrow syntax exception for the **`'s` / `'t`** particle at the beginning of a word; all other invalid leading/repeated separators continue to be rejected.

**Country source evidence:** the exact expanded JSON `sources` arrays retain publisher URLs, territorial scope and data limits. These sources have varying national reliability. A published country-tagged list, secondary incidence estimate or locale name corpus is not by itself person-by-person residency verification. Preserve `production_ready:false` until separate documentary and license checks.

**Sampling**: uniform among all currently available surnames **within** a national pool, no `weight`/`frequency_weight`/`probability`/`selection_weight`. The order of source rankings does not create sampling weights. Future generator work is out of scope.

## Validation

`node --test tests/surnames-01-catalog.test.mjs` on **Node 22** checks the complete 50-code contract, **3,000 per complete country**, actual counts for partial pools, original 500-surname prefix preservation, file-to-catalog consistency, counts, NFC and `Script=Latin`, Latin-compatible combining marks, legal authentic separators, within-country uniqueness, strict `{value}` entries, no probability/weight keys, required sources, `selection_policy: uniform`, `production_ready: false`, source blob hashes and adversarial controls.

The targeted `.github/workflows/surnames-01.yml` runs automatically on pertinent PR changes only (no `workflow_dispatch`), with a separate diff guard prohibiting changes to `data/players/names/` and any unrelated paths. CI does not establish person-level national attestation or source redistribution rights.

**DRAFT/HOLD:** no merges to `main` without explicit authorization; no deploy, remote database modification, player-generator changes or PLAYERS-03 alterations.
