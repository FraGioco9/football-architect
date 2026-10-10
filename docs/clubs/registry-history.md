## CLUBS-320 ARCHIVE — Previous club registry roadmap (before CLUB-ASSET)

> This is a preserved copy of the former issue #61 text, retained to **protect audit evidence, 320 approved abbreviations and naming decisions**. It is historical and **is no longer the operational roadmap**. Issue #61 now exclusively covers graphics, as does DIV-ASSET #60. The reconciled transcription of all 320 full names is available in the [dedicated register](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309).

---

# CLUBS-320 Roadmap — Registry and identities of all 320 clubs

> **Exclusive scope:** Football Architect clubs, the static catalogue, names, abbreviations and identity attributes. It does **not** cover seasonal division affiliation or rules, fixtures, matches, tables, promotion/relegation, playoffs or saves.
>
> **Initial roadmap status:** **0/5 phases implemented (0%)**. Design of the **320 primary names** has been approved (100%), but this does not mean the catalogue is implemented or that 320 complete club records exist.

## Scope and approved decisions

- **8 countries:** IT, ENG, ES, DE, FR, PT, NL, BR.
- **40 fictional clubs per country**, **320 total**.
- For each country, stable numeric `clubId` values **1–40**; permanent identity is `countryId + clubId`. **Never change IDs** for sporting reasons.
- **First 20 clubs:** preserve the ID-to-**original city** association already present in `src/leagues.js`, and preserve **existing stadiums** unless a later decision changes them.
- **Clubs 21–40:** 20 new clubs already designed for each country; missing registry data must be designed rather than generated arbitrarily.
- Use both approved **primary and full names** from the design discussions; never derive the full name automatically from the short name.
- **Approved corrections:** `(BR,16)` **EC Falésia Clara** / **Esporte Clube Falésia Clara de João Pessoa**; `(FR,27)` **FC Émaux** / **Football Club des Émaux de Limoges**; `(FR,33)` **CS Garrigues** / **Cercle Sportif des Garrigues de Nîmes**; `(PT,34)` **AC Fontes** / **Atlético Clube das Fontes de Caldas da Rainha**.
- Explicitly retain **AC Rinascenti Bologna** (IT,2, as in the existing source catalogue) and **US Varesina**. The later preference from 10 October 2026 supersedes the previous approval of AC Felsina Bologna.
- Club names and abbreviations must be consistent with the linguistic traditions of their respective countries.
- No backward compatibility with old careers is required: that belongs to **SAVE-V2**, not this issue.

## Incremental roadmap — CLUBS ONLY

- [ ] **CLUB-01 — Consolidate catalogue and names (P0)**
  - Prepare one inventory of all 320 clubs with `countryId`, `clubId`, `name`, `fullName`, city, original stadium (where available) and proposed city for new clubs.
  - Compare entries 1–20 in each country against the actual repository catalogue, preserving existing IDs and cities.
  - Verify uniqueness of primary and full names, Unicode/diacritic normalization, country/language consistency and the four approved corrections.
  - **Gate:** 320/320 records reconciled and approved; 160 ID/city associations preserved; no collisions or unresolved required fields.

- [ ] **CLUB-02 — Unique abbreviations (P0)**
  - Define an explicit `abbr` value of **three uppercase Latin letters** for each club, without deriving it from name initials at runtime.
  - Verify uniqueness across **all 320 clubs**, not only within each country, as well as recognizability and abbreviation stability.
  - **Gate:** 320/320 abbreviations assigned and approved, zero duplicates; text crests and tables use the explicit value.

- [ ] **CLUB-03 — Identity, history and static properties (P0)**
  - Define/validate each club's `stadium`, `colors`, `founded`, `capacity`, `reputation`, `identityType` and a short fictional `history`.
  - Reuse the original stadiums of the 160 existing clubs; complete stadium details for new clubs. Do not invent data at integration time without a design decision.
  - Preserve geographic and linguistic consistency; avoid obvious identity duplicates or unwanted references to real clubs.
  - **Gate:** 320/320 complete records, validated values and original stadiums retained.

- [ ] **CLUB-04 — Minimal catalogue integration into the game (P0)**
  - Integrate all 320 records into existing modules (primarily `src/leagues.js` and only necessary identity consumers), reusing the architecture and keeping the repository lean.
  - Make `getClub(countryId, clubId)` and `getCountryClubs(countryId)` available for the full catalogue.
  - Show the primary name in lists, full name in details and explicit abbreviation on crests.
  - Represent the **initial tier** only as a catalogue value or initial association; do not implement current division membership or sporting logic.
  - **Gate:** 320 readable/searchable clubs, no duplicates and no fixtures, dynamic division or SAVE-V2 implementation in this phase.

- [ ] **CLUB-05 — Final verification and cleanup (P1)**
  - Automatically check all 320 records, IDs, cities, abbreviations, colors, stadiums and static data; verify IT/EN display, search/selection and responsive layouts.
  - Confirm invariants, minimal diff, CI on the **exact HEAD**, mergeability and **anti-deployment** policy before proposing a merge.
  - Remove only confirmed duplication or obsolete registry code, without speculative deletion.
  - **Gate:** 320/320 integrity, passing checks and regressions; no unrelated functional changes.

## Boundaries with related roadmaps

- **DIV-16 — [Issue #60](https://github.com/FraGioco9/football-architect/issues/60):** division structure, seasonal registrations, standings, promotion and REG-01/REG-01.5. This issue defines the *club*, not its current division.
- **CAL:** match scheduling and calendar, including bye weeks.
- **SAVE-V2:** careers, IndexedDB, persistence and import/export.
- **MATCH:** match engine, results, extra time and penalties.
- Do not duplicate REG-01/REG-01.5 rules or their implementations.

## Working method

- Proceed **one phase at a time**, separately proposing remaining decisions and any implementations.
- Update checklists and percentages only after verified completion of the applicable phase.
- **This issue is only a roadmap and tracking record**: its creation **does not authorize** code, branch, PR, merge, deployment or database changes.
- **Recommended next step at that time:** complete the **read-only CLUB-01 documentary reconciliation** (full names and cities for the 160 new clubs).

## Progress

**0/5 phases implemented = 0%.**  
**Primary-name design: 320/320 = 100%.**  
**Abbreviations: 320/320 designed and approved, with `IT,2: RIN` final (replacing `FEL`); integration not implemented.**  
**Complete static records: pending consolidation/verification.**

---

## CLUB-02 — Register of 320 APPROVED abbreviations (design completed)

**Design APPROVED by the user on 10 October 2026.** Eight countries × 40 clubs; 320 codes, all three uppercase ASCII letters, with **zero global duplicates** and **zero format errors**. The register below uses the `countryId + clubId` key and the ordering of already approved primary names to distinguish abbreviations from division IDs. The complete XLSX/CSV register with names and uniqueness checks is available in the CLUB-02 conversation.

<details><summary>Full proposed register (320 countryId / clubId / abbr associations)</summary>

**IT**

01:VEL · 02:RIN · 03:POG · 04:COL · 05:COR · 06:ALT · 07:VAL · 08:LEV · 09:ADR · 10:FON

11:SME · 12:BEL · 13:NAV · 14:PAR · 15:TRI · 16:EUG · 17:ARV · 18:DOR · 19:BIZ · 20:FER

21:REC · 22:PPD · 23:FRM · 24:MPN · 25:BAS · 26:LIT · 27:VAR · 28:ACC · 29:MAR · 30:LVS

31:LUC · 32:PNV · 33:FIA · 34:VAD · 35:CAM · 36:REG · 37:SIL · 38:CAV · 39:VRB · 40:DUM

**ENG**

01:SWK · 02:CRB · 03:WME · 04:DCF · 05:MRF · 06:ALW · 07:NVA · 08:OAK · 09:RVB · 10:SBK

11:KRE · 12:HBS · 13:FNW · 14:STF · 15:BCT · 16:ASH · 17:EQY · 18:WDC · 19:MTV · 20:RCL

21:LFD · 22:WRC · 23:CRS · 24:BRD · 25:IRF · 26:DNH · 27:TDF · 28:WRF · 29:RDB · 30:CBN

31:WFR · 32:ELM · 33:NNV · 34:BGT · 35:LNV · 36:DWK · 37:SEV · 38:STM · 39:LMF · 40:CLM

**ES**

01:ALB · 02:MDC · 03:MTA · 04:RBC · 05:AVS · 06:ENC · 07:HRZ · 08:IZA · 09:LMB · 10:RBL

11:BRV · 12:BRT · 13:CLZ · 14:BHD · 15:MVD · 16:PNC · 17:AMA · 18:CIG · 19:LVA · 20:VLD

21:VGA · 22:SAT · 23:ARG · 24:ARL · 25:BNS · 26:EBC · 27:LLN · 28:PLM · 29:DRS · 30:CPN

31:AZH · 32:MVT · 33:ONY · 34:GDN · 35:ECN · 36:MSM · 37:MTP · 38:OLV · 39:SGR · 40:JUC

**DE**

01:MGR · 02:HST · 03:SBW · 04:RHG · 05:HBL · 06:LHD · 07:EBG · 08:NDW · 09:EFD · 10:SHN

11:BGL · 12:RBG · 13:WFD · 14:KPH · 15:AFD · 16:LCH · 17:FWD · 18:RBT · 19:HFT · 20:WKR

21:HVB · 22:BKS · 23:EBW · 24:KMB · 25:SLB · 26:WRK · 27:SZB · 28:LNF · 29:HSW · 30:LWT

31:FDH · 32:QHF · 33:MTH · 34:RWT · 35:MST · 36:STQ · 37:KHN · 38:SWT · 39:KPF · 40:DNW

**FR**

01:EQX · 02:MCL · 03:AZL · 04:ECT · 05:BLR · 06:AVL · 07:CLB · 08:BML · 09:EMR · 10:CHT

11:VRM · 12:VLF · 13:CTX · 14:ARD · 15:PNR · 16:BLD · 17:TNL · 18:VBR · 19:MSL · 20:OLR

21:BSP · 22:VPT · 23:ONV · 24:HND · 25:FGV · 26:VLC · 27:EMX · 28:UCL · 29:MVE · 30:ADL

31:GVC · 32:TRM · 33:GRG · 34:RMP · 35:FTV · 36:LCB · 37:MLR · 38:DBV · 39:FLT · 40:AUC

**PT**

01:MIR · 02:RBA · 03:CRV · 04:MDV · 05:SSN · 06:MRC · 07:ALJ · 08:SRM · 09:MTB · 10:ASV

11:PNB · 12:MAT · 13:UPL · 14:VDM · 15:CVD · 16:SRO · 17:RBJ · 18:VLA · 19:MTN · 20:TPL

21:BAL · 22:MLT · 23:PNH · 24:MRE · 25:CDR · 26:TGV · 27:TMA · 28:TUV · 29:LMR · 30:SRF

31:LFC · 32:DNM · 33:PCL · 34:FTS · 35:LNH · 36:MBR · 37:TJS · 38:MOL · 39:FLS · 40:ARX

**NL**

01:WPT · 02:HVL · 03:GNV · 04:BLM · 05:NWD · 06:DUS · 07:ZVB · 08:BSK · 09:RVR · 10:HVR

11:MLW · 12:MLI · 13:WTR · 14:ZHF · 15:IJR · 16:VHK · 17:DNR · 18:PZT · 19:PDV · 20:WSW

21:DPT · 22:KDZ · 23:GLW · 24:GWV · 25:ZDH · 26:ZSP · 27:RTM · 28:PDL · 29:HDZ · 30:VSD

31:KNW · 32:MHV · 33:RRB · 34:MJB · 35:BRK · 36:VNZ · 37:RST · 38:WLV · 39:SDZ · 40:IJP

**BR**

01:MRS · 02:VBL · 03:PDD · 04:MRA · 05:LTR · 06:SCR · 07:PMP · 08:PAZ · 09:PVN · 10:MJZ

11:RNB · 12:CSD · 13:ESV · 14:ILB · 15:DNS · 16:FCL · 17:MNV · 18:BTZ · 19:LGS · 20:PDC

21:CDO · 22:PTC · 23:TRB · 24:VDS · 25:MAA · 26:CFN · 27:FVL · 28:SRB · 29:ARC · 30:FNV

31:CCD · 32:AGV · 33:PDA · 34:SLN · 35:MND · 36:RSL · 37:IPB · 38:VRO · 39:MDA · 40:EQN

</details>

**Verifiable examples:** `(IT,2) AC Rinascenti Bologna → RIN` (**abbreviation updated and approved on 10 October 2026; FEL superseded**); `(IT,27) US Varesina → VAR`; `(DE,2) FC Hafenstern → HST`; `(DE,19) FC Hafentor → HFT`; `(NL,15) FC IJsselrand → IJR`; `(NL,40) FC IJsselpoort → IJP`; `(BR,16) EC Falésia Clara → FCL`; `(FR,27) FC Émaux → EMX`; `(FR,33) CS Garrigues → GRG`; `(PT,34) AC Fontes → FTS`.

**Constraints:** `abbr` is an explicit, globally unique static attribute, not derived from initials, and does not replace the `countryId + clubId` identity. This design involves no source catalogue or rendering changes.

**Progress:** **320/320 (100%) abbreviations APPROVED**, **zero duplicates**, **zero format errors**, **320 distinct primary names even after Unicode/diacritic normalization**. Implementation roadmap **0/5 (0%)**: CLUB-02 checklist intentionally unchecked because the implementation gate requires runtime consumption of explicit `abbr` values in crests and tables. No code, branch, PR, merge, deployment or database modifications were authorized.


---

## CLUB-01 — Read-only audit of the approved catalogue (10 October 2026)

**Verified baseline:** `main` `72d16de4a3ad410dab84fd9d1f42007a187a98b1`, `src/leagues.js`. No repository changes were made during this historical audit.

### Confirmed findings

- **320/320 primary names available** in the CLUB-02 register, with **320 distinct `countryId + clubId` identities** and **zero global duplicates**, including after Unicode/accent and punctuation normalization.
- **160/160 original `countryId + clubId + city` associations** match the approved cities: **20/20 in each of eight countries**. Original cities must not be changed.
- **160/160 original stadiums present** and associated with the same IDs in `src/leagues.js`; existing stadiums did not require replacement.
- **11/160 primary names** of original clubs already matched the selected names; **149/160 required planned renaming** without moving IDs, cities or stadiums (figures updated after restoring AC Rinascenti Bologna).
- **160/160 new entries (IDs 21–40)** were not yet present in source code; their cities were designed in the country catalogues, but could not be compared with prior code.
- **0/320 `fullName` fields implemented in the then-current static catalogue:** only the `name` property existed. Approved full names had to be recorded in a verifiable complete register **without inferring expansions**. Global uniqueness of all 320 `fullName` values could not yet be certified from a complete accessible inventory in that audit.

### High-priority individual reconciliations

| Chiave | Nome presente nel codice | Nome principale approvato | Città e stadio originali da conservare |
|---|---|---|---|
| `IT,2` | AC Rinascenti Bologna | **AC Rinascenti Bologna (invariato)** | Bologna — Stadio delle Fornaci |
| `IT,3` | SC Portuale Genova | **FC Portuale Genova** | Genova — Campo di San Vento |
| `IT,14` | US Partenope Nuova Napoli | **US Partenope Napoli** | Napoli — Stadio di Pietramare |
| `ES,12` | SC Brétema Coruña | **SD Brétema** | A Coruña — Campo da Brétema |
| `NL,15` | Deventer FC IJselrand | **FC IJsselrand** | Deventer — IJselrand Stadion (toponimo dello stadio lasciato intatto) |
| `BR,16` | Esporte Clube Cabo Branco João Pessoa | **EC Falésia Clara** | João Pessoa — Estádio das Falésias |

Corrections **FR,27 FC Émaux**, **FR,33 CS Garrigues** and **PT,34 AC Fontes** refer to new clubs (IDs > 20) and therefore could not be compared with existing source-code entries.

### Recoverable full names explicitly approved

- `IT,2`: **Associazione Calcio Rinascenti Bologna** — full name approved on 10 October 2026, permanently superseding *Associazione Calcio Felsina Bologna*.
- `IT,27`: Unione Sportiva Varesina.
- `BR,16`: Esporte Clube Falésia Clara de João Pessoa.
- `FR,27`: Football Club des Émaux de Limoges.
- `FR,33`: Cercle Sportif des Garrigues de Nîmes.
- `PT,34`: Atlético Clube das Fontes de Caldas da Rainha.

The six approved full names above did not constitute a complete 320-entry register: **314 `fullName` values still required recovery or confirmation** before closing CLUB-01. Do not invent name expansions without approval.

**Conclusion:** original ID/city/stadium verification for 160 existing clubs **PASS**; verification of 320 primary names and 320 abbreviations **PASS**; complete `fullName` reconciliation **PENDING**. CLUB-01 was not closed, and implementation remained **0/5 (0%)**. Design completion of CLUB-02 did not imply implementation; checklists were unchanged.


### Additional CLUB-01 decision — 10 October 2026

**New explicit user decision:** club `(IT,2)` **retains the name already present in `src/leagues.js`: AC Rinascenti Bologna**. The earlier proposed rename to AC Felsina Bologna was rejected.

- **Permanent ID:** `IT + 2`, unchanged.
- **City:** Bologna, unchanged.
- **Stadium:** Stadio delle Fornaci, unchanged.
- **Final CLUB-02 abbreviation:** `RIN`, approved on 10 October 2026 to replace `FEL`. Rechecking uniqueness across the complete register found 320/320 distinct codes, zero collisions and zero format errors; the other 319 codes were unchanged.
- **Approved full name:** **Associazione Calcio Rinascenti Bologna**. The previous form *Associazione Calcio Felsina Bologna* was superseded.
- **Reconciliation of 160 original clubs:** 11 primary names already aligned, 149 still to rename; all 160 original cities and stadiums present. CLUB-01 remained open.
- **No code, branch, PR, merge, deployment or database changes.**


### CLUB-02 — Final IT,2 approval on 10 October 2026

The user's final decision, overriding earlier historical references:

| Proprietà | Valore approvato |
|---|---|
| `countryId` | `IT` |
| `clubId` | `2` |
| `name` | **AC Rinascenti Bologna** |
| `fullName` | **Associazione Calcio Rinascenti Bologna** |
| `abbr` | **RIN** |
| `city` | **Bologna** |
| `stadium` | **Stadio delle Fornaci** |

**CLUB-02 design gate result:** 320/320 explicit abbreviations approved; 320/320 globally unique codes; zero duplicates or codes outside `[A-Z]{3}`. `RIN` was unused before the change and is now assigned only to `(IT,2)`. `FEL` was retired and assigned to no club. Other 319 records unchanged. **Do not mark CLUB-02 implemented** until `abbr` is actually consumed by runtime crests and tables; CLUBS-320 implementation stayed at 0/5. CLUB-01 audit: **6 explicitly validated full names, 314 still to reconcile**. No code, branch, PR, merge, deployment or database changes.


---

## CLUB-01 — Supplementary documentary research (10 October 2026)

**Scope:** read-only review of prior sources, updating only issue #61 text. The code baseline remained the one recorded in the previous audit; no commits, branches, PRs, merges, deployments or database changes.

### Evidence classification

- **6/320 `fullName` values EXPLICITLY CONFIRMED** by final decisions or recorded naming corrections.
- **69/320 `fullName` values RECOVERED from earlier design responses** (IT 1,3–20; ENG 1–20; PT 1–10; NL 1–10; BR 1–10). Although earlier responses included the listed values, the absence of a fully accessible primary-source register meant those rows remained **PENDING RECONCILIATION**, not 69 new user approvals.
- **245/320 `fullName` values NOT RECOVERED** from unequivocal documentation. Their 245 approved primary `name` values and abbreviations remained preserved; expansions were not invented.
- **75/320 extended names available as evidence or documentary candidates** = 6 confirmed + 69 recovered (23.44% of catalogue). **Final CLUB-01 gate still OPEN**; recovered candidates did not equal formal validation.

| Paese | Confermati | Recuperati (da riconciliare) | Senza fonte certa | Totale |
|---|---:|---:|---:|---:|
| IT | 2 | 19 | 19 | 40 |
| ENG | 0 | 20 | 20 | 40 |
| ES | 0 | 0 | 40 | 40 |
| DE | 0 | 0 | 40 | 40 |
| FR | 2 | 0 | 38 | 40 |
| PT | 1 | 10 | 29 | 40 |
| NL | 0 | 10 | 30 | 40 |
| BR | 1 | 10 | 29 | 40 |
| **Totale** | **6** | **69** | **245** | **320** |

### A. Six previously confirmed full names

| Identità | Nome principale | FullName confermato |
|---|---|---|
| `IT,2` | AC Rinascenti Bologna | **Associazione Calcio Rinascenti Bologna** |
| `IT,27` | US Varesina | **Unione Sportiva Varesina** |
| `FR,27` | FC Émaux | **Football Club des Émaux de Limoges** |
| `FR,33` | CS Garrigues | **Cercle Sportif des Garrigues de Nîmes** |
| `PT,34` | AC Fontes | **Atlético Clube das Fontes de Caldas da Rainha** |
| `BR,16` | EC Falésia Clara | **Esporte Clube Falésia Clara de João Pessoa** |

### B. 69 full names recovered from previous responses — NOT finally validated

Transcriptions came from earlier design-response summaries (Italy and England, 9 October 2026, 22:32–22:35 UTC; Portugal 22:46, Netherlands 22:47, Brazil 22:48 UTC). Since some other historical sources contained an **incompatible alternative catalogue**, each row below was matched to the exact `countryId+clubId+name` key in CLUBS-320; names from alternative catalogues were not imported. Definitive use of these strings as `fullName` required corroboration against the approved source.

<details><summary>Elenco recuperato — 69 associazioni</summary>

| Identità | Nome principale CLUBS-320 | FullName recuperato (da verificare) |
|---|---|---|
| `IT,1` | US Velaria Torino | Unione Sportiva Velaria Torino |
| `IT,3` | FC Portuale Genova | Football Club Portuale Genova |
| `IT,4` | AC Collina Firenze | Associazione Calcio Collina Firenze |
| `IT,5` | US Corallo Verona | Unione Sportiva Corallo Verona |
| `IT,6` | FC Altavia Parma | Football Club Altavia Parma |
| `IT,7` | US Valtena Modena | Unione Sportiva Valtena Modena |
| `IT,8` | AC Levantina Trieste | Associazione Calcio Levantina Trieste |
| `IT,9` | US Adriatica Bari | Unione Sportiva Adriatica Bari |
| `IT,10` | US Fontechiara Perugia | Unione Sportiva Fontechiara Perugia |
| `IT,11` | FC Smeralda Cagliari | Football Club Smeralda Cagliari |
| `IT,12` | AC Bellariva Lecce | Associazione Calcio Bellariva Lecce |
| `IT,13` | AC Naviglio Milano | Associazione Calcio Naviglio Milano |
| `IT,14` | US Partenope Napoli | Unione Sportiva Partenope Napoli |
| `IT,15` | AC Trinacria Palermo | Associazione Calcio Trinacria Palermo |
| `IT,16` | AC Euganea Padova | Associazione Calcio Euganea Padova |
| `IT,17` | US Arnoverde Pisa | Unione Sportiva Arnoverde Pisa |
| `IT,18` | FC Dorica Ancona | Football Club Dorica Ancona |
| `IT,19` | US Bizantina Ravenna | Unione Sportiva Bizantina Ravenna |
| `IT,20` | AC Ferrea Brescia | Associazione Calcio Ferrea Brescia |
| `ENG,1` | Southwick FC | Southwick Football Club |
| `ENG,2` | Crownbridge AFC | Crownbridge Association Football Club |
| `ENG,3` | Westmere Athletic | Westmere Athletic Football Club |
| `ENG,4` | Dockfield FC | Dockfield Football Club |
| `ENG,5` | Moorfield FC | Moorfield Football Club |
| `ENG,6` | Alderwick Town | Alderwick Town Football Club |
| `ENG,7` | Northvale Athletic | Northvale Athletic Football Club |
| `ENG,8` | Oakspire FC | Oakspire Football Club |
| `ENG,9` | Riverbank AFC | Riverbank Association Football Club |
| `ENG,10` | Seabrook Rovers | Seabrook Rovers Football Club |
| `ENG,11` | Kingsreach Town | Kingsreach Town Football Club |
| `ENG,12` | Harbourside FC | Harbourside Football Club |
| `ENG,13` | Fenwick Wanderers | Fenwick Wanderers Football Club |
| `ENG,14` | Stoneford Albion | Stoneford Albion Football Club |
| `ENG,15` | Bellcroft United | Bellcroft United Football Club |
| `ENG,16` | Ashcombe Athletic | Ashcombe Athletic Football Club |
| `ENG,17` | Eastquay FC | Eastquay Football Club |
| `ENG,18` | Willowden County | Willowden County Football Club |
| `ENG,19` | Maritime Rovers | Maritime Rovers Football Club |
| `ENG,20` | Redcliff Town | Redcliff Town Football Club |
| `PT,1` | SC Miradouro | Sport Clube Miradouro de Lisboa |
| `PT,2` | FC Ribeiralta | Futebol Clube Ribeiralta do Porto |
| `PT,3` | AC Carvalho | Atlético Clube Carvalho de Braga |
| `PT,4` | União Mondeverde | União Desportiva Mondeverde de Coimbra |
| `PT,5` | Sporting Sol Nascente | Sporting Clube Sol Nascente de Faro |
| `PT,6` | AC Maré Clara | Atlético Clube Maré Clara de Aveiro |
| `PT,7` | GD Alentejar | Grupo Desportivo Alentejar de Évora |
| `PT,8` | FC Serramar | Futebol Clube Serramar de Setúbal |
| `PT,9` | União Montebrilho | União Desportiva Montebrilho de Guimarães |
| `PT,10` | Académico Serra Nova | Clube Académico Serra Nova de Viseu |
| `NL,1` | VV Waterpoort | Amsterdamse Voetbalvereniging Waterpoort |
| `NL,2` | SV Havenlicht | Sportvereniging Havenlicht Rotterdam |
| `NL,3` | VV Groenveld | Utrechtse Voetbalvereniging Groenveld |
| `NL,4` | FC Blauwmeer | Eindhovense Football Club Blauwmeer |
| `NL,5` | VV Noorderwind | Groninger Voetbalvereniging Noorderwind |
| `NL,6` | HFC Duinroos | Haarlemse Football Club Duinroos |
| `NL,7` | SV Zilverbeek | Bredase Sportvereniging Zilverbeek |
| `NL,8` | VV Boskant | Tilburgse Voetbalvereniging Boskant |
| `NL,9` | FC Rivieren | Nijmeegse Football Club Rivieren |
| `NL,10` | SV Heuvelrand | Arnhemse Sportvereniging Heuvelrand |
| `BR,1` | AC Marés | Atlético Clube Sol das Marés do Rio de Janeiro |
| `BR,2` | AA Vila Brilhante | Associação Atlética Vila Brilhante de São Paulo |
| `BR,3` | EC Porto Dendê | Esporte Clube Porto do Dendê de Salvador |
| `BR,4` | União Maré Alta | União Esportiva Maré Alta do Recife |
| `BR,5` | FC Litoral | Futebol Clube Ventos do Litoral de Fortaleza |
| `BR,6` | CA Serra Clara | Clube Atlético Serra Clara de Belo Horizonte |
| `BR,7` | Grêmio Pampa | Grêmio Esportivo Pampa Dourado de Porto Alegre |
| `BR,8` | EC Pinheiro Azul | Esporte Clube Pinheiro Azul de Curitiba |
| `BR,9` | AA Planalto Verde | Associação Atlética Planalto Verde de Brasília |
| `BR,10` | SC Marajó Azul | Sport Club Marajó Azul de Belém |

</details>

### C. Remaining records and closure criteria

- The remaining **245** associations were already uniquely identifiable by CLUB-02 `countryId+clubId+abbr`, but lacked a **sufficiently substantiated `fullName` transcription** in this snapshot. Mark `fullName=PENDING_SOURCE` in design tracking, not in code.
- Do not infer `fullName` from `AC/US/FC` prefixes, short names, cities, legacy `src/leagues.js` names or alternative catalogues. Such data can provide candidates, not approvals.
- Permanently preserve `(IT,2): name=AC Rinascenti Bologna; fullName=Associazione Calcio Rinascenti Bologna; abbr=RIN; city=Bologna; stadium=Stadio delle Fornaci`.
- Preserve 320 approved unique abbreviations with zero collisions; do not alter them.
- **Implementation roadmap/checklist unchanged: 0/5 (0%)**. CLUB-01 remained open: 69 candidates to reconcile and 245 full names without conclusive sources.

**Operational decision:** do not create new full names or overwrite approved names. Without original text for remaining entries, do not claim `320/320 fullName` completion.


---

## CLUB-01 — Ricognizione ES/DE/FR — seconda passata (10 ottobre 2026)

**Operazione consentita:** ricognizione documentale e aggiornamento di questa issue; nessun codice, branch, PR, merge, deploy o database. **Baseline main immutata, verificata in sola lettura:** `72d16de4a3ad410dab84fd9d1f42007a187a98b1`.

### Fonti consultate e criterio di prova

1. Ricerca di precedenti conversazioni del progetto Football Architect sulle proposte di **40 club per Paese**. Un riepilogo indicizzato ha identificato proposte dell'assistente del **9 ottobre 2026**: lista ES circa **22:39:45 UTC**, lista DE circa **22:41:56 UTC**, lista FR circa **22:45 UTC**; l'utente approvò le liste nei messaggi successivi. Il riepilogo espone **sette stringhe testuali** riportate sotto, ma **non consente di ispezionare l'intera tabella originaria**: trattarle come *recuperate con evidenza di riepilogo*, non come denominazioni complete formalmente convalidate una per una.
2. Ricerca in documenti/progetti storici disponibili: trovate roadmap e materiali di Football Architect 2.0, ma **nessun registro completo delle 320 denominazioni approvate**; non sono state importate denominazioni di un universo precedente o differente.
3. Ricerca nelle issue del repository di stringhe esatte (tra cui `Club Deportivo Alborada Madrid`, `Fußballclub Hafenstern Hamburg`, `Unión Deportiva Monteazul Valencia`): nessun documento indipendente contenente queste denominazioni. `Football Club des Émaux de Limoges` è già registrato qui tra le approvazioni esplicite; **non** viene contato di nuovo.
4. Confronto delle sette stringhe con **Paese, ID e nome principale** già approvati: corrispondenze di identità 7/7, nessuna sostituzione dei nomi principali. La mancata disponibilità del testo integrale originale impedisce tuttora il gate finale.

### Sette denominazioni complete ritrovate nei riepiloghi storici (candidature documentali)

| ID | Nome principale approvato | Testo `fullName` recuperato | Traccia storica | Stato |
|---|---|---|---|---|
| `ES,1` | CD Alborada | **Club Deportivo Alborada Madrid** | Proposta 2026-10-09 22:39:45 UTC | Recuperato, **NON convalidato** |
| `ES,2` | FC Mar de Cobre | **Futbol Club Mar de Cobre Barcelona** | Proposta 2026-10-09 22:39:45 UTC | Recuperato, **NON convalidato** |
| `ES,3` | UD Monteazul | **Unión Deportiva Monteazul Valencia** | Proposta 2026-10-09 22:39:45 UTC | Recuperato, **NON convalidato** |
| `ES,4` | CD Ribera Clara | **Club Deportivo Ribera Clara Sevilla** | Proposta 2026-10-09 22:39:45 UTC | Recuperato, **NON convalidato** |
| `DE,1` | SV Morgenrot | **Sportverein Morgenrot Berlin** | Proposta 2026-10-09 22:41:56 UTC | Recuperato, **NON convalidato** |
| `DE,2` | FC Hafenstern | **Fußballclub Hafenstern Hamburg** | Proposta 2026-10-09 22:41:56 UTC | Recuperato, **NON convalidato** |
| `DE,3` | TSV Silberwald | **Turn- und Sportverein Silberwald München** | Proposta 2026-10-09 22:41:56 UTC | Recuperato, **NON convalidato** |

**Nota di fedeltà:** la grafia `Futbol Club` per ES,2 è mantenuta esattamente come nel frammento recuperato, senza correggerla automaticamente in `Fútbol` o `Futbol Club` alternativo. Eventuali correzioni ortografiche richiedono confronto con la tabella originaria o nuova approvazione.

### Francia (FR) — esito negativo circoscritto

- La ricerca conferma soltanto l'esistenza della precedente proposta francese dei 40 club, **senza recuperare nuove righe `fullName` testuali**.
- Restano con denominazione completa esplicitamente confermata `FR,27` **Football Club des Émaux de Limoges** e `FR,33` **Cercle Sportif des Garrigues de Nîmes**.
- Gli **altri 38 `fullName` francesi rimangono senza fonte integrale verificabile**: non dedurli dai nomi brevi.

### Stato aggiornato e residui

| Paese | Confermati esplicitamente | Recuperati in ricognizioni (candidati da verificare) | Senza testo recuperato | Totale |
|---|---:|---:|---:|---:|
| IT | 2 | 19 | 19 | 40 |
| ENG | 0 | 20 | 20 | 40 |
| ES | 0 | **4** | **36** | 40 |
| DE | 0 | **3** | **37** | 40 |
| FR | 2 | **0** | **38** | 40 |
| PT | 1 | 10 | 29 | 40 |
| NL | 0 | 10 | 30 | 40 |
| BR | 1 | 10 | 29 | 40 |
| **Totale** | **6** | **76** | **238** | **320** |

- **7/245 (2,86%)** precedentemente senza testo sono ora *recuperati come candidati documentali*; **238/245** rimangono senza testo recuperato.
- Totale **82/320 (25,625%)** con testo di denominazione estesa disponibile (**6 confermati** + **76 candidature recuperate e non pienamente convalidate**); nessun nuovo `fullName` è stato elevato arbitrariamente a confermato.
- L'audit storico precedente (75/320) rimane visibile come fotografia della fase precedente; **questo riepilogo è quello aggiornato e prevale per i contatori**.
- `IT,2` preservato integralmente: **AC Rinascenti Bologna / Associazione Calcio Rinascenti Bologna / RIN**, città **Bologna**, stadio **Stadio delle Fornaci**. Le altre 319 sigle rimangono immutate; 320/320 univoche.
- **CLUB-01: APERTA. CLUB-02: progettazione approvata, integrazione runtime non completata. Roadmap implementativa: 0/5 (0%)**; nessuna checklist implementativa spuntata.

**Prossima azione documentale raccomandata:** recuperare la tabella originale integra dei 40 club ES, DE e FR prima di convalidare le candidature o procedere a espansioni. In assenza di tale fonte, mantenere `PENDING_SOURCE` senza generare nomi automaticamente.


---

## CLUB-01 — Terza passata: ricerca delle tabelle originali ES/DE/FR (10 ottobre 2026)

**Oggetto:** cercare i testi integrali delle **tre tabelle originarie da 40 club** (120 record ES/DE/FR) prima di assegnare altri `fullName`. **Esito: riferimenti alle tabelle originali rintracciati, ma le tabelle integrali NON recuperabili dalle fonti attualmente accessibili. Nessun `fullName` aggiunto o elevato di stato in questa passata.**

### A. Provenienza delle tabelle originali

| Paese | Fonte documentale rintracciata | Cosa è recuperabile | Cosa NON è recuperabile | Stato |
|---|---|---|---|---|
| **ES** | Precedente risposta Football Architect del **09/10/2026, ~22:39:45 UTC**, tabella *Liga de la Unión (ID 1–20)* + *Liga de las Regiones (ID 21–40)*; successiva approvazione dell'utente | Esistenza della tabella a 40 righe e **quattro testi** `fullName` ES,1–4 già registrati nella seconda passata | Testo completo delle altre 36 righe e copia integrale dell'originale | **PARZIALE / NON VALIDATO** |
| **DE** | Precedente risposta Football Architect del **09/10/2026, ~22:41:56 UTC**, tabella *Meisterliga (ID 1–20)* + *Vereinsliga (ID 21–40)*; successiva approvazione dell'utente | Esistenza della tabella a 40 righe e **tre testi** `fullName` DE,1–3 già registrati | Testo completo delle altre 37 righe e copia integrale dell'originale | **PARZIALE / NON VALIDATO** |
| **FR** | Precedente progettazione Football Architect del **09/10/2026**, nel contesto *Ligue des Sociétés* + *Ligue des Régions*, approvazione dei 40 club | Due `fullName` corretti e già **esplicitamente confermati**: FR,27 e FR,33 | Testo originario delle altre 38 righe e tabella integrale | **PARZIALE / 2 CONFERMATI** |

**Qualità delle fonti:** le informazioni sulle risposte del 09/10 derivano dai **riferimenti cronologici e dai riepiloghi di conversazioni precedenti**, non da URL permanenti o da una copia integrale del messaggio originario. Confermano l'esistenza delle tabelle e le approvazioni di contesto, **non** consentono di attestare le singole stringhe `fullName` non visualizzabili. Nessun link a una tabella originale è stato identificato, dunque nessuno viene inventato.

### B. Verifiche supplementari riproducibili

1. Ricerca nei **file del progetto e nella Library disponibili** su frasi esatte come `Club Deportivo Alborada Madrid`, `Sportverein Morgenrot Berlin`, `Union Sportive Équinoxe Paris`, `Futbol Club Mar de Cobre Barcelona`, `Ligue des Sociétés`: nessun catalogo originale a 40 righe ES/DE/FR identificato. I materiali storici Football Architect 2.0 emersi appartengono a precedenti versioni, non provano il catalogo CLUBS-320 attuale.
2. Ricerca **GitHub Code Search** nel repository `FraGioco9/football-architect` per `fullName`, `Club Deportivo Alborada`, `Sportverein Morgenrot` e `Ligue des Sociétés`: **0 risultati per tutte e quattro le query**. La ricerca code non è prova dell'inesistenza di conversazioni o file non indicizzati.
3. Ricerca nelle issue collegate: **#61** contiene i riepiloghi delle passate precedenti; **nessun commento** di issue #61 contiene una tabella originale aggiuntiva. Le issue collegate DIV/CAL non costituiscono la fonte delle denominazioni complete.
4. `src/leagues.js` sul `main` **`72d16de4a3ad410dab84fd9d1f42007a187a98b1`** conserva le prime 20 squadre per Paese nel campo `name` e non contiene `fullName`. Le denominazioni storiche presenti nel codice non devono essere promosse a `fullName` senza approvazione.

### C. Perimetro ES/DE/FR rimasto irrisolto

| Paese | `fullName` confermati | Testi recuperati non convalidati | Testi non recuperati | Copertura testuale |
|---|---:|---:|---:|---:|
| ES | 0 | 4 | **36** (ID 5–40) | **4/40 = 10,0%** |
| DE | 0 | 3 | **37** (ID 4–40) | **3/40 = 7,5%** |
| FR | 2 (ID 27,33) | 0 | **38** (ID 1–26, 28–32, 34–40) | **2/40 = 5,0%** |
| **ES + DE + FR** | **2** | **7** | **111** | **9/120 = 7,5%** |

I sette testi ES/DE erano **già conteggiati** nella seconda passata; non si contano nuovamente. Nessun contenuto `fullName` dedotto da prefissi `FC/SC/CD/VfB/TSV`, città, sigle o grafie analoghe.

### D. Situazione complessiva CLUB-01 (contatori autoritativi)

| Categoria | Club | Percentuale su 320 | Qualificazione |
|---|---:|---:|---|
| Testo completo esplicitamente **confermato** | **6** | **1,875%** | Riutilizzabile come decisione approvata |
| Testo recuperato, **da riconciliare** con originale integrale | **76** | **23,750%** | Candidato, non approvazione specifica |
| `fullName` **senza testo recuperabile** | **238** | **74,375%** | `PENDING_SOURCE`, non inventare |
| **Totale** | **320** | **100%** | **Copertura testuale 82/320 = 25,625%** |

**Delta rispetto alla seconda passata:** +0 confermati, +0 recuperati, −0 mancanti. Questi numeri rimangono invariati proprio perché le tabelle integrali non sono risultate accessibili; nessun avanzamento artificiale.

**Vincoli preservati e ricontrollati:** `IT,2 = AC Rinascenti Bologna / Associazione Calcio Rinascenti Bologna / RIN` (Bologna, Stadio delle Fornaci), altre 319 sigle invariate; registro `320/320` univoco. **CLUB-01 APERTA; checklist implementative 0/5 (0%)**. Non modificare nomi principali già approvati; nessuna implementazione o mutazione GitHub diversa da questo aggiornamento della issue #61.

**Blocco documentale:** per completare la verifica dei 111 casi ES/DE/FR ancora senza testo occorre il contenuto originale delle tabelle, non soltanto il loro riferimento storico; fino a quel momento restano `PENDING_SOURCE` e non vanno ricreati per analogia.

---

## CLUB-01 — Audit individuale delle 76 candidature (10 ottobre 2026)

**Perimetro:** controllo individuale di tutte le **76 stringhe `fullName` candidate** raccolte nei due inventari precedenti di questa issue. Confronto con `countryId + clubId`, nome principale indicato nei registri progettuali e `src/leagues.js` (sola lettura, `main` `72d16de4a3ad410dab84fd9d1f42007a187a98b1`). **Non** trasformare compatibilità testuale in approvazione.

### Criteri di classificazione

- **CONFERMATA (C):** fonte primaria accessibile con la stessa denominazione completa, associata al corretto club, e approvazione esplicita riconducibile a quella versione.
- **INCOMPATIBILE (I):** contraddizione documentata con ID, nome principale o altra decisione finale approvata; una differenza dal vecchio `name` del codice **non** basta, perché nel catalogo progettuale sono già previste rinominazioni.
- **PROVA INSUFFICIENTE (P):** stringa riportata soltanto in un riepilogo o nella stessa issue, senza tabella originale integrale verificabile; anche se nome e identità risultano coerenti, non è una validazione formale.

**Esito finale sui 76:** **0 C (0%) · 0 I (0%) · 76 P (100%)**. L'assenza di incompatibilità dimostrate **non significa che tutti i 76 nomi siano corretti**: significa soltanto che non è stata trovata una contraddizione nelle fonti consultabili.

### Fonti ed evidenze disponibili

1. **R1 (69 righe):** testo della ricognizione precedente dell'issue #61 (69 candidature; riepiloghi di proposte storiche, senza originale integrale consultabile). Elenco testuale consultabile nella sezione *CLUB-01 — Ricognizione documentale supplementare* della stessa issue; la sua presenza non è una prova primaria indipendente.
2. **R2 (7 righe):** testo della seconda passata dell'issue #61 (7 candidature ES/DE; riepilogo di proposte del 9 ottobre 2026, senza originale integrale consultabile). Elenco consultabile in *Ricognizione ES/DE/FR — seconda passata*; non equivale a accesso alle proposte originali.
3. **Catalogo runtime:** `src/leagues.js` a `main` `72d16de4a3ad410dab84fd9d1f42007a187a98b1`: conferma **76/76** record preesistenti con l'ID implicito nell'ordine, la città e lo stadio originali. Non contiene il campo `fullName`: quindi non conferma nessuno dei 76 valori completi.
4. **Ricerca delle fonti primarie:** nessuna copia integrale delle tabelle originarie e delle approvazioni puntuali reperita tramite le fonti conversazionali, documenti disponibili e GitHub già esaminate; nessun URL di fonte primaria inventato.

### Registro di verifica nominativa — 76/76

Legenda per ciascuna riga: **P = prova insufficiente**; **Identità OK = nome distintivo riconoscibile e ID valido; città e stadio originali presenti nel codice; non è un'approvazione del `fullName`**.

<details><summary><strong>IT: 19 candidature — 0 confermate, 0 incompatibili, 19 prive di prova sufficiente</strong></summary>

| Club ID | Nome principale approvato | Denominazione candidata `fullName` | Fonte | Identità | Classe |
|---|---|---|---|---|---|
| `IT,1` | US Velaria Torino | Unione Sportiva Velaria Torino | R1 | OK | **P** |
| `IT,3` | FC Portuale Genova | Football Club Portuale Genova | R1 | OK | **P** |
| `IT,4` | AC Collina Firenze | Associazione Calcio Collina Firenze | R1 | OK | **P** |
| `IT,5` | US Corallo Verona | Unione Sportiva Corallo Verona | R1 | OK | **P** |
| `IT,6` | FC Altavia Parma | Football Club Altavia Parma | R1 | OK | **P** |
| `IT,7` | US Valtena Modena | Unione Sportiva Valtena Modena | R1 | OK | **P** |
| `IT,8` | AC Levantina Trieste | Associazione Calcio Levantina Trieste | R1 | OK | **P** |
| `IT,9` | US Adriatica Bari | Unione Sportiva Adriatica Bari | R1 | OK | **P** |
| `IT,10` | US Fontechiara Perugia | Unione Sportiva Fontechiara Perugia | R1 | OK | **P** |
| `IT,11` | FC Smeralda Cagliari | Football Club Smeralda Cagliari | R1 | OK | **P** |
| `IT,12` | AC Bellariva Lecce | Associazione Calcio Bellariva Lecce | R1 | OK | **P** |
| `IT,13` | AC Naviglio Milano | Associazione Calcio Naviglio Milano | R1 | OK | **P** |
| `IT,14` | US Partenope Napoli | Unione Sportiva Partenope Napoli | R1 | OK | **P** |
| `IT,15` | AC Trinacria Palermo | Associazione Calcio Trinacria Palermo | R1 | OK | **P** |
| `IT,16` | AC Euganea Padova | Associazione Calcio Euganea Padova | R1 | OK | **P** |
| `IT,17` | US Arnoverde Pisa | Unione Sportiva Arnoverde Pisa | R1 | OK | **P** |
| `IT,18` | FC Dorica Ancona | Football Club Dorica Ancona | R1 | OK | **P** |
| `IT,19` | US Bizantina Ravenna | Unione Sportiva Bizantina Ravenna | R1 | OK | **P** |
| `IT,20` | AC Ferrea Brescia | Associazione Calcio Ferrea Brescia | R1 | OK | **P** |

</details>

<details><summary><strong>ENG: 20 candidature — 0 confermate, 0 incompatibili, 20 prive di prova sufficiente</strong></summary>

| Club ID | Nome principale approvato | Denominazione candidata `fullName` | Fonte | Identità | Classe |
|---|---|---|---|---|---|
| `ENG,1` | Southwick FC | Southwick Football Club | R1 | OK | **P** |
| `ENG,2` | Crownbridge AFC | Crownbridge Association Football Club | R1 | OK | **P** |
| `ENG,3` | Westmere Athletic | Westmere Athletic Football Club | R1 | OK | **P** |
| `ENG,4` | Dockfield FC | Dockfield Football Club | R1 | OK | **P** |
| `ENG,5` | Moorfield FC | Moorfield Football Club | R1 | OK | **P** |
| `ENG,6` | Alderwick Town | Alderwick Town Football Club | R1 | OK | **P** |
| `ENG,7` | Northvale Athletic | Northvale Athletic Football Club | R1 | OK | **P** |
| `ENG,8` | Oakspire FC | Oakspire Football Club | R1 | OK | **P** |
| `ENG,9` | Riverbank AFC | Riverbank Association Football Club | R1 | OK | **P** |
| `ENG,10` | Seabrook Rovers | Seabrook Rovers Football Club | R1 | OK | **P** |
| `ENG,11` | Kingsreach Town | Kingsreach Town Football Club | R1 | OK | **P** |
| `ENG,12` | Harbourside FC | Harbourside Football Club | R1 | OK | **P** |
| `ENG,13` | Fenwick Wanderers | Fenwick Wanderers Football Club | R1 | OK | **P** |
| `ENG,14` | Stoneford Albion | Stoneford Albion Football Club | R1 | OK | **P** |
| `ENG,15` | Bellcroft United | Bellcroft United Football Club | R1 | OK | **P** |
| `ENG,16` | Ashcombe Athletic | Ashcombe Athletic Football Club | R1 | OK | **P** |
| `ENG,17` | Eastquay FC | Eastquay Football Club | R1 | OK | **P** |
| `ENG,18` | Willowden County | Willowden County Football Club | R1 | OK | **P** |
| `ENG,19` | Maritime Rovers | Maritime Rovers Football Club | R1 | OK | **P** |
| `ENG,20` | Redcliff Town | Redcliff Town Football Club | R1 | OK | **P** |

</details>

<details><summary><strong>ES: 4 candidature — 0 confermate, 0 incompatibili, 4 prive di prova sufficiente</strong></summary>

| Club ID | Nome principale approvato | Denominazione candidata `fullName` | Fonte | Identità | Classe |
|---|---|---|---|---|---|
| `ES,1` | CD Alborada | Club Deportivo Alborada Madrid | R2 | OK | **P** |
| `ES,2` | FC Mar de Cobre | Futbol Club Mar de Cobre Barcelona | R2 | OK | **P** |
| `ES,3` | UD Monteazul | Unión Deportiva Monteazul Valencia | R2 | OK | **P** |
| `ES,4` | CD Ribera Clara | Club Deportivo Ribera Clara Sevilla | R2 | OK | **P** |

</details>

<details><summary><strong>DE: 3 candidature — 0 confermate, 0 incompatibili, 3 prive di prova sufficiente</strong></summary>

| Club ID | Nome principale approvato | Denominazione candidata `fullName` | Fonte | Identità | Classe |
|---|---|---|---|---|---|
| `DE,1` | SV Morgenrot | Sportverein Morgenrot Berlin | R2 | OK | **P** |
| `DE,2` | FC Hafenstern | Fußballclub Hafenstern Hamburg | R2 | OK | **P** |
| `DE,3` | TSV Silberwald | Turn- und Sportverein Silberwald München | R2 | OK | **P** |

</details>

<details><summary><strong>PT: 10 candidature — 0 confermate, 0 incompatibili, 10 prive di prova sufficiente</strong></summary>

| Club ID | Nome principale approvato | Denominazione candidata `fullName` | Fonte | Identità | Classe |
|---|---|---|---|---|---|
| `PT,1` | SC Miradouro | Sport Clube Miradouro de Lisboa | R1 | OK | **P** |
| `PT,2` | FC Ribeiralta | Futebol Clube Ribeiralta do Porto | R1 | OK | **P** |
| `PT,3` | AC Carvalho | Atlético Clube Carvalho de Braga | R1 | OK | **P** |
| `PT,4` | União Mondeverde | União Desportiva Mondeverde de Coimbra | R1 | OK | **P** |
| `PT,5` | Sporting Sol Nascente | Sporting Clube Sol Nascente de Faro | R1 | OK | **P** |
| `PT,6` | AC Maré Clara | Atlético Clube Maré Clara de Aveiro | R1 | OK | **P** |
| `PT,7` | GD Alentejar | Grupo Desportivo Alentejar de Évora | R1 | OK | **P** |
| `PT,8` | FC Serramar | Futebol Clube Serramar de Setúbal | R1 | OK | **P** |
| `PT,9` | União Montebrilho | União Desportiva Montebrilho de Guimarães | R1 | OK | **P** |
| `PT,10` | Académico Serra Nova | Clube Académico Serra Nova de Viseu | R1 | OK | **P** |

</details>

<details><summary><strong>NL: 10 candidature — 0 confermate, 0 incompatibili, 10 prive di prova sufficiente</strong></summary>

| Club ID | Nome principale approvato | Denominazione candidata `fullName` | Fonte | Identità | Classe |
|---|---|---|---|---|---|
| `NL,1` | VV Waterpoort | Amsterdamse Voetbalvereniging Waterpoort | R1 | OK | **P** |
| `NL,2` | SV Havenlicht | Sportvereniging Havenlicht Rotterdam | R1 | OK | **P** |
| `NL,3` | VV Groenveld | Utrechtse Voetbalvereniging Groenveld | R1 | OK | **P** |
| `NL,4` | FC Blauwmeer | Eindhovense Football Club Blauwmeer | R1 | OK | **P** |
| `NL,5` | VV Noorderwind | Groninger Voetbalvereniging Noorderwind | R1 | OK | **P** |
| `NL,6` | HFC Duinroos | Haarlemse Football Club Duinroos | R1 | OK | **P** |
| `NL,7` | SV Zilverbeek | Bredase Sportvereniging Zilverbeek | R1 | OK | **P** |
| `NL,8` | VV Boskant | Tilburgse Voetbalvereniging Boskant | R1 | OK | **P** |
| `NL,9` | FC Rivieren | Nijmeegse Football Club Rivieren | R1 | OK | **P** |
| `NL,10` | SV Heuvelrand | Arnhemse Sportvereniging Heuvelrand | R1 | OK | **P** |

</details>

<details><summary><strong>BR: 10 candidature — 0 confermate, 0 incompatibili, 10 prive di prova sufficiente</strong></summary>

| Club ID | Nome principale approvato | Denominazione candidata `fullName` | Fonte | Identità | Classe |
|---|---|---|---|---|---|
| `BR,1` | AC Marés | Atlético Clube Sol das Marés do Rio de Janeiro | R1 | OK | **P** |
| `BR,2` | AA Vila Brilhante | Associação Atlética Vila Brilhante de São Paulo | R1 | OK | **P** |
| `BR,3` | EC Porto Dendê | Esporte Clube Porto do Dendê de Salvador | R1 | OK | **P** |
| `BR,4` | União Maré Alta | União Esportiva Maré Alta do Recife | R1 | OK | **P** |
| `BR,5` | FC Litoral | Futebol Clube Ventos do Litoral de Fortaleza | R1 | OK | **P** |
| `BR,6` | CA Serra Clara | Clube Atlético Serra Clara de Belo Horizonte | R1 | OK | **P** |
| `BR,7` | Grêmio Pampa | Grêmio Esportivo Pampa Dourado de Porto Alegre | R1 | OK | **P** |
| `BR,8` | EC Pinheiro Azul | Esporte Clube Pinheiro Azul de Curitiba | R1 | OK | **P** |
| `BR,9` | AA Planalto Verde | Associação Atlética Planalto Verde de Brasília | R1 | OK | **P** |
| `BR,10` | SC Marajó Azul | Sport Club Marajó Azul de Belém | R1 | OK | **P** |

</details>

### Conteggio per Paese — audit delle sole 76 candidature

| Paese | Esaminate | C | I | P | Coverage audit |
|---|---:|---:|---:|---:|---:|
| IT | 19 | 0 | 0 | 19 | 100% |
| ENG | 20 | 0 | 0 | 20 | 100% |
| ES | 4 | 0 | 0 | 4 | 100% |
| DE | 3 | 0 | 0 | 3 | 100% |
| FR | 0 | 0 | 0 | 0 | N/A |
| PT | 10 | 0 | 0 | 10 | 100% |
| NL | 10 | 0 | 0 | 10 | 100% |
| BR | 10 | 0 | 0 | 10 | 100% |
| **Totale** | **76** | **0** | **0** | **76** | **100%** |

### Distinzione tra copertura documentale e approvazione

- **Verifica individuale delle candidature:** **76/76 (100%) esaminate**, di cui **0/76 formalmente convalidate**.
- **Nomi completi già confermati al di fuori delle 76 candidature:** **6/320 (1,875%)**, invariati.
- **Testo di nome completo disponibile:** **82/320 (25,625%)** = 6 confermati + 76 candidati non convalidati.
- **Ancora senza testo recuperabile:** **238/320 (74,375%)**.
- **In attesa di conferma formale o recupero:** **314/320 (98,125%)**.
- **ROADMAP CLUBS-320 implementativa:** **0/5 (0%)**, checklist invariata.

### Protezioni e passaggio successivo

- `(IT,2)` resta **AC Rinascenti Bologna**, `fullName = Associazione Calcio Rinascenti Bologna`, `abbr = RIN`; città **Bologna**, stadio **Stadio delle Fornaci**. Il club non è incluso tra le 76 candidature non convalidate.
- Le altre 319 sigle restano invariate; 320 sigle globalmente univoche approvate in CLUB-02.
- **Non scrivere in codice le 76 candidature come `fullName` definitivi**: occorre reperire la fonte primaria o una nuova approvazione esplicita; non inventare espansioni.
- Le 76 restano **PENDING_SOURCE** e CLUB-01 rimane **OPEN**. La prossima attività utile è reperire le tabelle originali o sottoporre le 76 stringhe esistenti a una convalida esplicita, **senza cambiare il contenuto delle proposte**.

**Policy rispettata:** unico aggiornamento autorizzato a issue #61; nessun commit, branch, PR, merge, deploy, database o modifica a codice/test.


---

## CLUB-01 — Riepilogo corrente delle tabelle fornite dall'utente (10 ottobre 2026)

**Fonte più recente:** [registro di riconciliazione con tutte le 320 posizioni]( https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309 ). La tabella è stata **fornita direttamente dall'utente in questa conversazione**; il contenuto integrale è nel commento collegato, distinto dagli audit storici riportati sopra. I contatori nei paragrafi delle passate precedenti sono snapshot ormai **superati**.

- **318/320 (99,375%)** denominazioni complete ricevute nel nuovo testo (IT,3–40 + tutti i 40 club di ENG, ES, DE, FR, PT, NL, BR).
- **IT,2:** denominazione già **approvata esplicitamente**: `AC Rinascenti Bologna` / `Associazione Calcio Rinascenti Bologna` / `RIN`; Bologna e Stadio delle Fornaci invariati.
- **IT,1:** `US Velaria Torino` / **`Unione Sportiva Velaria Torino`**, **confermato nel nuovo messaggio dell'utente del 10 ottobre 2026**. L'identità `(IT,1)` è mantenuta e il testo completo è ora fonte diretta, non più una candidatura documentale.
- **4 discrepanze con decisioni successive**: `FR,27` FC Émaux (non Émail); `FR,33` CS Garrigues (non Garrigue); `PT,34` *Atlético Clube das Fontes de Caldas da Rainha* (non *das Caldas da Rainha*); `BR,16` *EC Falésia Clara / Esporte Clube Falésia Clara de João Pessoa* (non Cabo Branco). Prevalgono le decisioni più recenti; le versioni ricevute sono conservate come traccia nel commento.
- **Testi `fullName` disponibili con fonte diretta dell'utente o approvazione puntuale: 320/320 (100%)**. Composizione: 318 righe nel precedente incollato, IT,1 confermato nel nuovo messaggio, IT,2 già approvato esplicitamente. **Nessun `fullName` privo di testo utente**. Non equivale all'approvazione formale dell'intero registro riconciliato.
- **Fonte disponibile ≠ approvazione complessiva**: le 318 righe sono state fornite dall'utente, IT,1 è stato ora confermato e IT,2 era già approvato; tuttavia la presentazione dei dati non viene interpretata automaticamente come approvazione formale conclusiva di tutto il registro. **CLUB-01 rimane aperta soltanto per gate finale di convalida progettuale e controllo delle quattro eccezioni già gestite**.
- **CLUB-02 invariata:** 320/320 sigle approvate e univoche, `IT,2 = RIN`; roadmap **implementativa 0/5 (0%)**. Nessuna modifica al codice, branch, PR, merge, deploy o database.


### CLUB-01 — Conferma documentale IT,1 del 10 ottobre 2026

- **Nuova fonte primaria: messaggio esplicito dell'utente in questa conversazione.** Club `IT,1`: `name = US Velaria Torino`, `fullName = Unione Sportiva Velaria Torino`.
- Il nome completo non è più una candidatura di una risposta storica: **è stato fornito direttamente dall'utente**. Il registro da 320 posizioni del [commento #6091538309](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309) va letto con questo **aggiornamento prevalente** rispetto alla nota storica sul club IT,1.
- **Copertura documentale aggiornata: 320/320 `fullName` (100%)** con testo utente o approvazione individuale. Composizione verificabile: **318 + 1 (IT,1) + 1 (IT,2) = 320**.
- **Invariate** le approvazioni successive: IT,2 = **AC Rinascenti Bologna / Associazione Calcio Rinascenti Bologna / RIN**; FR,27 = FC Émaux; FR,33 = CS Garrigues; PT,34 = *Atlético Clube das Fontes de Caldas da Rainha*; BR,16 = EC Falésia Clara.
- **CLUB-01 ancora aperta** per l'approvazione formale finale del registro, senza interpretare la sola trascrizione come conferma dell'intero catalogo. **Roadmap implementativa invariata 0/5 (0%)**; nessun codice, branch, PR, merge, deploy o database modificato.

