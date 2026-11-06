# PLAYERS-03 — Male first-name banks

**Active rule:** Collect **300 distinct single male given names** for each of Football Architect's 50 trial FIFA nationalities. A first name is a single Unicode word made from letters/combining marks: **no spaces, apostrophes, hyphens, punctuation or compound names**. Accents are allowed. The name's etymological/national origin is **not restricted**; resident or birth records with a male classification are valid input.

All banks store `given_names` as sorted `{ "value": "Name", "weight": observed_count }` objects. Counts are **from real sources**, never invented or padded. Weights are meaningful *within* the corresponding source population, not numerically comparable across countries. The file includes provenance. **No surnames**, second-nationality name selection, persistent player writes or runtime name-sampler integration are added.

## Collection progress

**2,100 / 15,000** single first-name slots saved in **7 / 50 countries**. **43 countries remain empty**. `catalog-v1.json` references the saved country files; the names themselves live only in `countries/<FIFA>.json`.

| Country | JSON file | Unique single names | Source and period |
| --- | --- | ---: | --- |
| Italy (ITA) | `countries/ITA.json` | 300 | Male local administrators, registry 1985–2014 (not national birth counts) |
| Spain (ESP) | `countries/ESP.json` | 300 | Spanish INE-derived male resident name frequencies, all ages |
| France (FRA) | `countries/FRA.json` | 300 | Official INSEE registered male births, 2000–2025 |
| United States (USA) | `countries/USA.json` | 300 | US Social Security Administration national male birth-name counts, 2016–2020 |
| Scotland (SCO) | `countries/SCO.json` | 300 | National Records of Scotland registered male births, 2000–2025 |
| Canada (CAN) | `countries/CAN.json` | 300 | Statistics Canada national male first names at birth, 2000–2025 |
| Poland (POL) | `countries/POL.json` | 300 | Polish Ministry of Digital Affairs national PESEL male **first** given names, 2025 |

### Source integrity, scope and limitations

**Batch 01:** Italy is derived from `mrblasco/genderNamesITA@af92b06158355beca12e020a8c19f0fe52381bed`; male occurrences of local-administrator names (not new births), source mirror lacks a declared redistribution licence for its counts. Spain is derived from `marcboquet/spanish-names@fb9664001e060e430a8e9314fc1992541f378297` (INE male residents; some accents missing in the mirror). France uses the [INSEE national 2025 first-name file](https://www.insee.fr/fr/statistiques/8595130), restricted to births from 2000 through 2025; source ZIP SHA-256 `4c3662bbc75a021a2203b9bed0beff7e85c7928779b88602814ed407cfee512e`, national CSV SHA-256 `5ec80c06cd9266cc5680885c6a219148bcdfaa53d65086f4ea9d2c584431fbfd`. INSEE Licence Ouverte 2.0. All three were rebuilt with a strict single-word filter in the previous block.

**Batch 02:** 
- **USA:** [US Social Security Administration, National Baby Names](https://www.ssa.gov/oact/babynames/limits.html), gender M, calendar years **2016–2020**, 300 top first-name strings by summed male birth counts; US public-domain government statistics. The SSA download returned HTTP 403 to automated GitHub runners, so the underlying annual source text was reacquired from the [hackerb9 mirror](https://github.com/hackerb9/ssa-baby-names) at immutable source commit `0b1a1316457d55447d1a1f7bfe57ee15e53cc2f0`. No old discarded PR #407 name bank was reused. The mirror's snapshot ends in 2020 and does **not** claim to be the latest SSA release.
- **SCO:** [NRS historical first forenames 1974–2025](https://www.nrscotland.gov.uk/publications/babies-first-names-2025/). Aggregate male Scottish registered birth counts **2000–2025**; source ZIP SHA-256 `e1dd892b576f75cc349caeee7a219aa9fad3857b1849bc2ce21bfd81c24b3085`. UK Open Government Licence v3.0. Unlike an all-UK source, these are specifically Scottish births.
- **CAN:** [Statistics Canada table 17-10-0147-01](https://www150.statcan.gc.ca/n1/en/catalogue/1710014701). Keep only `GEO=Canada`, `Sex at birth=Male`, `Indicator=Frequency` and **2000–2025**; sum observed positive `VALUE` and skip suppressed source cells. Source ZIP `17100147-eng.zip`, SHA-256 `c2c4a0b9c40c1116bf4229b97ae0680af4ffdd3721834533c31d4145ed56f420`. Data adapted under the Statistics Canada Open Licence; this does not constitute endorsement by Statistics Canada.
- **POL:** [Polish government national first names dataset](https://dane.gov.pl/pl/dataset/219,imiona-nadawane-dzieciom-w-polsce/resource/1159536), **2025 first given names of boys**, directly from PESEL; CSV SHA-256 `447f64ad7008f7960341710322d4f4d20e928129753f9469a10abc593da92beb`. 300 selected from 959 eligible single-word male names. Verify the specific government's data reuse notice before commercial publication of the numeric counts. This source is explicitly about **first**, not middle, names.

The selected four are country-specific (no indiscriminate England/Wales shared pool), and national origins may be mixed as authorized. The different source periods are documented. Earlier Onomaverse research, surname candidates and PLAYERS-01 prototype identities were not reused as data for these new lists.

### Validation

`node --test tests/players-names-catalog.test.mjs` covers all 50 frozen country codes, exactly 300 Unicode NFC single-token male first names in **each of 7 populated banks**, unique casefold within each country, positive source counts sorted descending, source ID/registry coherence, no compound names or surnames, and 43 empty country entries. Exact-HEAD targeted Node 22 GitHub Actions only; avoid redundant manual runs.

**Draft/HOLD PR #407**: no merge without separate authorization, no deploy, D1/Worker, permanent footballers, or changes to PLAYERS-02 PR #400. These are research/catalog data, **not yet connected to the player generator**.
