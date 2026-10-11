# Football Architect — Club registry audit and historical provenance (English)

**Scope:** a current English explanation of what the unchanged club identity catalogue and historical audit documents establish. This is **not a replacement** for the original-language source transcripts, archived approvals, club data, or a complete translation of every intermediate historical note.

## Current, non-superseded conclusions

| Property | Established current fact |
|---|---|
| Countries | **8**: IT, ENG, ES, DE, FR, PT, NL, BR |
| Stable club identifiers | **320/320**, using `(countryId,clubId)`, with clubId 1–40 within each country |
| Approved `abbr` | **320/320**, exactly three uppercase ASCII letters, globally unique |
| Documented `fullName` | **320/320**, from 318 direct pasted entries + an explicit IT,2 decision + a later direct IT,1 confirmation |
| Separately reconciled `approvedShortName` | **6** entries in the current catalogue |
| Historical first-tier source entries | **160**, preserving original city, stadium and previous names in `firstDivisionReference` |
| New club ID range | **21–40** in each country, **160** identities without a former first-tier game record |
| Full catalogue approval | **Not implicitly granted** by data transcription or coverage |
| CLUB-ASSET design approval | **0/5**; club crests have not been designed or finalized in that roadmap |
| Game integration | **Not authorized or represented** by the current identity catalogue |

The pre-reset historical audit counted **11 of 160** first-tier primary names matching their then-current planned names, **149** conceptual renames, and all **160 original cities and stadiums** preserved. Those figures describe a **historical source-code comparison**, not live functionality on current main.

## Approved corrections that supersede conflicting historical entries

| Stable key | Approved current identity | Non-authoritative earlier wording or correction |
|---|---|---|
| `IT,1` | **US Velaria Torino** · `Unione Sportiva Velaria Torino` · `VEL` | Its full name was initially recorded as a historical candidate, but was **subsequently confirmed directly by the user** |
| `IT,2` | **AC Rinascenti Bologna** · `Associazione Calcio Rinascenti Bologna` · `RIN` | Confirmed name and abbreviation; Bologna and Stadio delle Fornaci remain unchanged |
| `FR,27` | **FC Émaux** · `Football Club des Émaux de Limoges` · `EMX` | Replaces the superseded short name **FC Émail** |
| `FR,33` | **CS Garrigues** · `Cercle Sportif des Garrigues de Nîmes` · `GRG` | Replaces the superseded short name **CS Garrigue** |
| `PT,34` | **AC Fontes** · `Atlético Clube das Fontes de Caldas da Rainha` · `FTS` | Replaces `Atlético Clube das Fontes das Caldas da Rainha` |
| `BR,16` | **EC Falésia Clara** · `Esporte Clube Falésia Clara de João Pessoa` · `FCL` | Replaces EC Cabo Branco / Esporte Clube Cabo Branco de João Pessoa |

Changes in these identities are **historical approval outcomes**, not operations carried out by this English migration.

## Source chronology and precedence

1. **Original CLUBS-320 / CLUB-01–CLUB-05 roadmap** — now superseded as an operational roadmap, preserved verbatim in [registry-history.md](registry-history.md); its multiple historical percentages are snapshots, not current metrics.
2. **CLUB-02 abbreviation decision** — 320 explicit and globally unique three-letter identifiers approved. `IT,2 = RIN` replaced the old `FEL` candidate without changing the other 319 abbreviations.
3. **CLUB-01 name reconciliation** — 318 direct pasted full names were documented. An earlier IT,2-specific approval supplied that entry; IT,1 was confirmed directly later. Total direct-source evidence now covers **320/320**.
4. **Four documented superseding corrections** — FR,27, FR,33, PT,34 and BR,16. The corrected values prevail over the unedited pasted-source records.
5. **New CLUB-ASSET #61** — visual-only 320-club badge design roadmap. Its milestone approval remains **0/5**, independent of 320 identity and abbreviation records.

## Original records intentionally left unchanged

- [Original user name transcription and reconciliation](fullnames-source.md) — original Italian Markdown, including a now-superseded status description for IT,1. Its **exact original wording** is kept for audit integrity.
- [Full prior club roadmap and incremental audits](registry-history.md) — original Italian historical Markdown, including partial/obsolete counts and evidence context.
- [User-supplied complete reconciliation comment](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309).
- [Historical roadmap and audit archive comment](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091598842).
- Pre-reset Git baseline: `72d16de4a3ad410dab84fd9d1f42007a187a98b1`.

These are **immutable historical source references** and deliberately remain in their source language. They are not active English GitHub instructions. Do not change previous approvals, PR states, original-language proper nouns, past CI/QA claims or filenames merely to improve language compliance.

## Read-only reconstruction gate

The English [320-entry reference](fullnames-reference.en.md) preserves the exact data fields of `data/clubs.json`; the original historical records stay intact. A future approved migration must test all **320 stable IDs**, **320 abbreviations**, **320 full names**, the **six reconciled short names**, **160 historical records**, and links to original source evidence.

**Current phase P2: text-only documentation; no game-code changes, no database writes, no deployment, no merges.**
