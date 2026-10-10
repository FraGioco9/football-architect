# Football Architect — Club identity documentation

This is the **English operational entry point** for the 320-club identity catalogue. It preserves the source-of-truth data, approval boundaries and historical audit trail without rewriting original Italian primary-source records.

## Current reference documents

- **[Complete 320-club name reference](fullnames-reference.en.md)** — a generated English table of exact `countryId`, `clubId`, `fullName`, `abbr` and explicitly reconciled `approvedShortName` fields read from [data/clubs.json](../../data/clubs.json).
- **[Club registry and provenance (English)](registry-audit.en.md)** — reconciliations, later approvals, historic counts and scope rules.
- **[Original name transcripts](fullnames-source.md)** — **unaltered Italian-language historical evidence**, including the original 318-row user transcription and follow-up annotations. Earlier notes in this archive may have become outdated.
- **[Original club identity audit](registry-history.md)** — **unaltered Italian-language historical evidence**, including former roadmap text, abbreviation inventories and incremental audits. Later sections override historical interim counts.

## Non-negotiable identity rules

- Eight countries, **40 clubs each**; **320 club IDs** and **320 unique three-letter abbreviations**.
- Never infer a club's `approvedShortName` from `fullName` or a historical `legacyName`: only six short names are explicitly reconciled in `data/clubs.json`.
- The original 160 `firstDivisionReference` city/stadium/name entries are historical; the remaining 160 clubs have no historical `firstDivisionReference`.
- The full-name evidence reaches **320/320**, but explicit approval of the **complete reconciled list** has not been conferred by transcribing source text.
- The **CLUB-ASSET #61 roadmap remains 0/5**, with no finalized club badge SVGs.

## Preservation policy

Original Italian descriptions are preserved as evidence, **not active GitHub authoring language**. Never translate names, approved abbreviations, city/stadium proper nouns, original filenames or historical Git SHA references. Any further corrections require a separate explicit authorization and update to canonical data, not a documentation-only language change.

See [CLUB-ASSET #61](https://github.com/FraGioco9/football-architect/issues/61) and [DIV-ASSET #60](https://github.com/FraGioco9/football-architect/issues/60).
