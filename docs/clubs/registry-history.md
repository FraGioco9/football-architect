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

| Key | Source-code name | Approved primary name | Original city and stadium to preserve |
|---|---|---|---|
| `IT,2` | AC Rinascenti Bologna | **AC Rinascenti Bologna (unchanged)** | Bologna — Stadio delle Fornaci |
| `IT,3` | SC Portuale Genova | **FC Portuale Genova** | Genova — Campo di San Vento |
| `IT,14` | US Partenope Nuova Napoli | **US Partenope Napoli** | Napoli — Stadio di Pietramare |
| `ES,12` | SC Brétema Coruña | **SD Brétema** | A Coruña — Campo da Brétema |
| `NL,15` | Deventer FC IJselrand | **FC IJsselrand** | Deventer — IJselrand Stadion (original stadium place name preserved) |
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

| Property | Approved value |
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
- **69/320 `fullName` values RECOVERED from earlier design responses** (IT 1.3–20; ENG 1–20; PT 1–10; NL 1–10; BR 1–10). Although earlier responses included the listed values, the absence of a fully accessible primary-source register meant those rows remained **PENDING RECONCILIATION**, not 69 new user approvals.
- **245/320 `fullName` values NOT RECOVERED** from unequivocal documentation. Their 245 approved primary `name` values and abbreviations remained preserved; expansions were not invented.
- **75/320 extended names available as evidence or documentary candidates** = 6 confirmed + 69 recovered (23.44% of catalogue). **Final CLUB-01 gate still OPEN**; recovered candidates did not equal formal validation.

| Country | Confirmed | Recovered (to reconcile) | No reliable source | Total |
|---|---:|---:|---:|---:|
| IT | 2 | 19 | 19 | 40 |
| ENG | 0 | 20 | 20 | 40 |
| ES | 0 | 0 | 40 | 40 |
| DE | 0 | 0 | 40 | 40 |
| FR | 2 | 0 | 38 | 40 |
| PT | 1 | 10 | 29 | 40 |
| NL | 0 | 10 | 30 | 40 |
| BR | 1 | 10 | 29 | 40 |
| **Total** | **6** | **69** | **245** | **320** |

### A. Six previously confirmed full names

| Identity | Primary name | Confirmed FullName |
|---|---|---|
| `IT,2` | AC Rinascenti Bologna | **Associazione Calcio Rinascenti Bologna** |
| `IT,27` | US Varesina | **Unione Sportiva Varesina** |
| `FR,27` | FC Émaux | **Football Club des Émaux de Limoges** |
| `FR,33` | CS Garrigues | **Cercle Sportif des Garrigues de Nîmes** |
| `PT,34` | AC Fontes | **Atlético Clube das Fontes de Caldas da Rainha** |
| `BR,16` | EC Falésia Clara | **Esporte Clube Falésia Clara de João Pessoa** |

### B. 69 full names recovered from previous responses — NOT finally validated

Transcriptions came from earlier design-response summaries (Italy and England, 9 October 2026, 22:32–22:35 UTC; Portugal 22:46, Netherlands 22:47, Brazil 22:48 UTC). Since some other historical sources contained an **incompatible alternative catalogue**, each row below was matched to the exact `countryId+clubId+name` key in CLUBS-320; names from alternative catalogues were not imported. Definitive use of these strings as `fullName` required corroboration against the approved source.

<details><summary>Recovered list — 69 associations</summary>

| Identity | CLUBS-320 primary name | Recovered FullName (to verify) |
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

## CLUB-01 — ES/DE/FR research, second pass (10 October 2026)

**Permitted activity:** documentary research and issue update; no code, branch, PR, merge, deployment or database changes. **Unchanged `main` baseline, read-only verified:** `72d16de4a3ad410dab84fd9d1f42007a187a98b1`.

### Sources consulted and evidence standard

1. Searched prior Football Architect project conversations for **40-club-per-country** proposals. An indexed summary identified assistant proposals dated **9 October 2026**: ES around **22:39:45 UTC**, DE around **22:41:56 UTC**, FR around **22:45 UTC**; the user approved those lists in subsequent messages. The summary contained **seven text strings** shown below, but **the entire original tables could not be inspected**: classify them as *recovered from secondary summaries*, not as individually validated full names.
2. Searched available historical project documents: found Football Architect 2.0 roadmaps and material, but **no complete register of the 320 approved full names**; no names were imported from an older or different game world.
3. Searched repository issues for exact strings including `Club Deportivo Alborada Madrid`, `Fußballclub Hafenstern Hamburg` and `Unión Deportiva Monteazul Valencia`: no independent document with those names. `Football Club des Émaux de Limoges` had already been explicitly approved and **was not counted twice**.
4. Compared all seven recovered names with the approved **country, ID and primary name**: 7/7 identity matches and no primary-name replacements. The original complete text was still unavailable, preventing final validation.

### Seven full names found in historical summaries (documentary candidates)

| ID | Approved primary name | Recovered `fullName` text | Historical evidence | Status |
|---|---|---|---|---|
| `ES,1` | CD Alborada | **Club Deportivo Alborada Madrid** | Proposal 2026-10-09 22:39:45 UTC | Recovered, **NOT validated** |
| `ES,2` | FC Mar de Cobre | **Futbol Club Mar de Cobre Barcelona** | Proposal 2026-10-09 22:39:45 UTC | Recovered, **NOT validated** |
| `ES,3` | UD Monteazul | **Unión Deportiva Monteazul Valencia** | Proposal 2026-10-09 22:39:45 UTC | Recovered, **NOT validated** |
| `ES,4` | CD Ribera Clara | **Club Deportivo Ribera Clara Sevilla** | Proposal 2026-10-09 22:39:45 UTC | Recovered, **NOT validated** |
| `DE,1` | SV Morgenrot | **Sportverein Morgenrot Berlin** | Proposal 2026-10-09 22:41:56 UTC | Recovered, **NOT validated** |
| `DE,2` | FC Hafenstern | **Fußballclub Hafenstern Hamburg** | Proposal 2026-10-09 22:41:56 UTC | Recovered, **NOT validated** |
| `DE,3` | TSV Silberwald | **Turn- und Sportverein Silberwald München** | Proposal 2026-10-09 22:41:56 UTC | Recovered, **NOT validated** |

**Fidelity note:** the spelling `Futbol Club` for ES,2 is retained exactly as found, without silently changing it to `Fútbol` or another spelling. Corrections require comparison with the original table or a new approval.

### France (FR) — limited negative result

- Search confirmed only that the earlier French 40-club proposal existed; **no new verbatim `fullName` rows were recovered**.
- Explicitly confirmed full names remained `FR,27` **Football Club des Émaux de Limoges** and `FR,33` **Cercle Sportif des Garrigues de Nîmes**.
- The **other 38 French `fullName` entries still lacked verifiable full-text sources**; do not derive them from short names.

### Updated status and unresolved records

| Country | Explicitly confirmed | Recovered in research (candidates to verify) | No recovered text | Total |
|---|---:|---:|---:|---:|
| IT | 2 | 19 | 19 | 40 |
| ENG | 0 | 20 | 20 | 40 |
| ES | 0 | **4** | **36** | 40 |
| DE | 0 | **3** | **37** | 40 |
| FR | 2 | **0** | **38** | 40 |
| PT | 1 | 10 | 29 | 40 |
| NL | 0 | 10 | 30 | 40 |
| BR | 1 | 10 | 29 | 40 |
| **Total** | **6** | **76** | **238** | **320** |

- **7/245 (2.86%)** entries previously lacking text were *recovered as documentary candidates*; **238/245** still had no recovered text.
- **82/320 (25.625%)** full-name texts then available (**6 confirmed** + **76 recovered but not fully validated candidates**); no new `fullName` was arbitrarily promoted to confirmed.
- The earlier 75/320 audit remains visible as a prior snapshot; **this summary superseded its counters at the time**.
- `IT,2` preserved in full: **AC Rinascenti Bologna / Associazione Calcio Rinascenti Bologna / RIN**, city **Bologna**, stadium **Stadio delle Fornaci**. Other 319 abbreviations unchanged; 320/320 globally unique.
- **CLUB-01: OPEN. CLUB-02: design approved, runtime integration not complete. Implementation roadmap: 0/5 (0%)**; no implementation checklist items marked complete.

**Recommended documentary action at that time:** recover the complete original ES, DE and FR 40-club tables before approving candidates or deriving names. Until then, retain `PENDING_SOURCE` and do not auto-generate names.


---

## CLUB-01 — Third pass: search for original ES/DE/FR tables (10 October 2026)

**Objective:** locate all **three original 40-club tables** (120 ES/DE/FR records) before assigning more `fullName` values. **Result: references to the original tables found, but complete table texts were NOT retrievable from then-accessible sources. No `fullName` entry was added or promoted during this pass.**

### A. Provenance of original tables

| Country | Documentary source found | Recoverable evidence | Unavailable evidence | Status |
|---|---|---|---|---|
| **ES** | Earlier Football Architect response on **9 October 2026, ~22:39:45 UTC**, *Liga de la Unión (IDs 1–20)* and *Liga de las Regiones (IDs 21–40)*; later approved by the user | Existence of the 40-row table and **four** recovered `fullName` texts (ES,1–4) | Other 36 full texts and the complete original table | **PARTIAL / NOT VALIDATED** |
| **DE** | Earlier Football Architect response on **9 October 2026, ~22:41:56 UTC**, *Meisterliga (IDs 1–20)* and *Vereinsliga (IDs 21–40)*; later approved by the user | Existence of the 40-row table and **three** recovered `fullName` texts (DE,1–3) | Other 37 full texts and the complete original table | **PARTIAL / NOT VALIDATED** |
| **FR** | Earlier Football Architect design on **9 October 2026**, *Ligue des Sociétés* and *Ligue des Régions*; 40 clubs approved | Two **explicitly confirmed** `fullName` values, FR,27 and FR,33 | Other 38 full texts and the complete original table | **PARTIAL / 2 CONFIRMED** |

**Source quality:** records of the 9 October responses came from **chronological references and earlier conversation summaries**, not permanent URLs or complete original messages. These establish the tables' existence and contextual approvals, **not** the exact unseen `fullName` strings. No link to an original table was found or invented.

### B. Reproducible supplementary checks

1. Searched **available project files and Library** for exact phrases including `Club Deportivo Alborada Madrid`, `Sportverein Morgenrot Berlin`, `Union Sportive Équinoxe Paris`, `Futbol Club Mar de Cobre Barcelona`, `Ligue des Sociétés`: no original 40-row ES/DE/FR catalogues found. Earlier Football Architect 2.0 materials belonged to previous versions and did not prove the current CLUBS-320 list.
2. Searched **GitHub Code Search** in `FraGioco9/football-architect` for `fullName`, `Club Deportivo Alborada`, `Sportverein Morgenrot`, `Ligue des Sociétés`: **zero results for all four queries**. Code Search does not establish that unindexed files or conversations are absent.
3. Inspected related issues: **#61** contained earlier research summaries; **no comment** provided an additional original table. Related DIV/CAL issues were not sources for full names.
4. `src/leagues.js` on `main` **`72d16de4a3ad410dab84fd9d1f42007a187a98b1`** retained the first 20 clubs per country in `name` fields and contained no `fullName`. Historical code names must not be promoted to `fullName` without approval.

### C. Outstanding ES/DE/FR scope

| Country | Confirmed `fullName` | Unvalidated recovered text | Unrecovered text | Text coverage |
|---|---:|---:|---:|---:|
| ES | 0 | 4 | **36** (ID 5–40) | **4/40 = 10.0%** |
| DE | 0 | 3 | **37** (ID 4–40) | **3/40 = 7.5%** |
| FR | 2 (ID 27.33) | 0 | **38** (ID 1–26, 28–32, 34–40) | **2/40 = 5.0%** |
| **ES + DE + FR** | **2** | **7** | **111** | **9/120 = 7.5%** |

The seven ES/DE entries **had already been counted** in the second pass and were not counted again. No `fullName` was inferred from `FC/SC/CD/VfB/TSV` prefixes, cities, abbreviations or analogous spellings.

### D. Overall CLUB-01 status (authoritative counters at that time)

| Category | Clubs | Percentage of 320 | Classification |
|---|---:|---:|---|
| Full name **explicitly confirmed** | **6** | **1.875%** | Reusable as an approved decision |
| Recovered text **to reconcile** with the complete original | **76** | **23.750%** | Candidate, not an individual approval |
| `fullName` **without recoverable text** | **238** | **74.375%** | `PENDING_SOURCE`, do not invent |
| **Total** | **320** | **100%** | **Text coverage 82/320 = 25.625%** |

**Change since second pass:** +0 confirmed, +0 recovered, −0 missing. Counts remained unchanged because the complete original tables were inaccessible; no artificial progress was reported.

**Preserved and rechecked constraints:** `IT,2 = AC Rinascenti Bologna / Associazione Calcio Rinascenti Bologna / RIN` (Bologna, Stadio delle Fornaci), other 319 abbreviations unchanged; globally unique `320/320` register. **CLUB-01 OPEN; implementation checklists 0/5 (0%)**. Do not change approved primary names; no code or GitHub mutations beyond the authorized issue #61 text update.

**Documentation blocker:** the original tables, not merely their historical references, were needed to verify the remaining 111 ES/DE/FR cases without text; until then they remained `PENDING_SOURCE` and must not be recreated by analogy.

---

## CLUB-01 — Individual audit of 76 candidates (10 October 2026)

**Scope:** individually review all **76 candidate `fullName` strings** from the previous two issue inventories. Compare against `countryId + clubId`, the primary name in design registers and read-only `src/leagues.js` (`main` `72d16de4a3ad410dab84fd9d1f42007a187a98b1`). **Do not** equate textual compatibility with approval.

### Classification criteria

- **CONFIRMED (C):** accessible primary source containing the same full name, associated with the correct club and an explicit approval applying to that version.
- **INCOMPATIBLE (I):** documented conflict with ID, primary name or another final approved decision; a difference from the legacy code `name` alone is **not** enough, because planned renames already exist.
- **INSUFFICIENT EVIDENCE (P):** string appears only in a summary or in the issue, without a verifiable complete original table; a matching identity is not formal validation.

**Final result for all 76:** **0 C (0%) · 0 I (0%) · 76 P (100%)**. Lack of proven incompatibility **does not mean all 76 names are correct**; only that no contradictions were found in accessible sources.

### Available sources and evidence

1. **R1 (69 rows):** earlier issue #61 research text (69 candidates from historical proposal summaries, without fully accessible originals). The section *CLUB-01 — Supplementary documentary research* preserves the list, but is not independent primary-source proof.
2. **R2 (7 rows):** second issue #61 pass (seven ES/DE candidates, based on 9 October 2026 proposal summaries, not complete originals). The *ES/DE/FR research, second pass* section lists them, but is not access to the original proposals.
3. **Historical runtime catalogue:** `src/leagues.js` at `main` `72d16de4a3ad410dab84fd9d1f42007a187a98b1` confirmed original IDs/order, cities and stadiums for **76/76** pre-existing clubs. It had no `fullName` field and therefore validated none of the 76 full names.
4. **Primary-source search:** no complete originals of the tables or individual approvals were found in consulted conversations, documents and GitHub sources; no primary-source URL was invented.

### Individual verification register — 76/76

Legend for each row: **P = insufficient evidence**; **Identity OK = recognizable distinguishing name and valid ID; original city and stadium found in source code; not `fullName` approval**.

<details><summary><strong>IT: 19 candidates — 0 confirmed, 0 incompatible, 19 with insufficient evidence</strong></summary>

| Club ID | Approved primary name | Candidate `fullName` | Source | Identity | Class |
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

<details><summary><strong>ENG: 20 candidates — 0 confirmed, 0 incompatible, 20 with insufficient evidence</strong></summary>

| Club ID | Approved primary name | Candidate `fullName` | Source | Identity | Class |
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

<details><summary><strong>ES: 4 candidates — 0 confirmed, 0 incompatible, 4 with insufficient evidence</strong></summary>

| Club ID | Approved primary name | Candidate `fullName` | Source | Identity | Class |
|---|---|---|---|---|---|
| `ES,1` | CD Alborada | Club Deportivo Alborada Madrid | R2 | OK | **P** |
| `ES,2` | FC Mar de Cobre | Futbol Club Mar de Cobre Barcelona | R2 | OK | **P** |
| `ES,3` | UD Monteazul | Unión Deportiva Monteazul Valencia | R2 | OK | **P** |
| `ES,4` | CD Ribera Clara | Club Deportivo Ribera Clara Sevilla | R2 | OK | **P** |

</details>

<details><summary><strong>DE: 3 candidates — 0 confirmed, 0 incompatible, 3 with insufficient evidence</strong></summary>

| Club ID | Approved primary name | Candidate `fullName` | Source | Identity | Class |
|---|---|---|---|---|---|
| `DE,1` | SV Morgenrot | Sportverein Morgenrot Berlin | R2 | OK | **P** |
| `DE,2` | FC Hafenstern | Fußballclub Hafenstern Hamburg | R2 | OK | **P** |
| `DE,3` | TSV Silberwald | Turn- und Sportverein Silberwald München | R2 | OK | **P** |

</details>

<details><summary><strong>PT: 10 candidates — 0 confirmed, 0 incompatible, 10 with insufficient evidence</strong></summary>

| Club ID | Approved primary name | Candidate `fullName` | Source | Identity | Class |
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

<details><summary><strong>NL: 10 candidates — 0 confirmed, 0 incompatible, 10 with insufficient evidence</strong></summary>

| Club ID | Approved primary name | Candidate `fullName` | Source | Identity | Class |
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

<details><summary><strong>BR: 10 candidates — 0 confirmed, 0 incompatible, 10 with insufficient evidence</strong></summary>

| Club ID | Approved primary name | Candidate `fullName` | Source | Identity | Class |
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

### Counts by country — audit of only the 76 candidates

| Country | Reviewed | C | I | P | Audit coverage |
|---|---:|---:|---:|---:|---:|
| IT | 19 | 0 | 0 | 19 | 100% |
| ENG | 20 | 0 | 0 | 20 | 100% |
| ES | 4 | 0 | 0 | 4 | 100% |
| DE | 3 | 0 | 0 | 3 | 100% |
| FR | 0 | 0 | 0 | 0 | N/A |
| PT | 10 | 0 | 0 | 10 | 100% |
| NL | 10 | 0 | 0 | 10 | 100% |
| BR | 10 | 0 | 0 | 10 | 100% |
| **Total** | **76** | **0** | **0** | **76** | **100%** |

### Distinction between documentary coverage and approval

- **Individual review:** **76/76 (100%) candidates examined**, **0/76 formally validated**.
- **Previously confirmed full names outside the 76 candidates:** **6/320 (1.875%)**, unchanged.
- **Available full-name text:** **82/320 (25.625%)** = six confirmed + 76 unvalidated candidates.
- **Still missing recoverable text:** **238/320 (74.375%)**.
- **Awaiting formal confirmation or recovery:** **314/320 (98.125%)**.
- **CLUBS-320 implementation roadmap:** **0/5 (0%)**, checklists unchanged.

### Safeguards and next steps

- `(IT,2)` remains **AC Rinascenti Bologna**, `fullName = Associazione Calcio Rinascenti Bologna`, `abbr = RIN`; city **Bologna**, stadium **Stadio delle Fornaci**. This club is not among the 76 unvalidated candidates.
- The other 319 abbreviations remain unchanged; 320 globally unique abbreviations approved under CLUB-02.
- **Do not write the 76 candidates into code as final `fullName` values** without primary-source recovery or a new explicit approval; never invent expansions.
- All 76 remain **PENDING_SOURCE** and CLUB-01 remains **OPEN**. The next useful action was to recover original tables or submit the existing 76 strings for explicit approval **without altering the proposals**.

**Policy preserved during this historical audit:** only issue #61 text was updated; no commits, branches, PRs, merges, deployments, database or code/test changes.


---

## CLUB-01 — Current summary of user-provided tables (10 October 2026)

**Most recent source:** [320-position reconciliation register](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309). The user **directly supplied this table in the conversation**; the complete text is in the linked comment and must be distinguished from the older audits above. Counts in earlier passes are **superseded historical snapshots**.

- **318/320 (99.375%)** full names received in the new submission (IT,3–40 and all 40 clubs from ENG, ES, DE, FR, PT, NL, BR).
- **IT,2:** existing **explicitly approved** name: `AC Rinascenti Bologna` / `Associazione Calcio Rinascenti Bologna` / `RIN`; Bologna and Stadio delle Fornaci unchanged.
- **IT,1:** `US Velaria Torino` / **`Unione Sportiva Velaria Torino`**, **confirmed in the user's new message of 10 October 2026**. Identity `(IT,1)` remains unchanged and the full name is now supported by direct user input rather than only by an earlier documentary candidate.
- **Four discrepancies versus later decisions:** `FR,27` FC Émaux (not Émail); `FR,33` CS Garrigues (not Garrigue); `PT,34` *Atlético Clube das Fontes de Caldas da Rainha* (not *das Caldas da Rainha*); `BR,16` *EC Falésia Clara / Esporte Clube Falésia Clara de João Pessoa* (not Cabo Branco). Later decisions prevail; original submitted variants are preserved as evidence in the linked comment.
- **Full-name text available from direct user submission or individual approval: 320/320 (100%)**. Breakdown: 318 rows from the earlier submission, IT,1 confirmed in a later message, IT,2 previously explicitly approved. **No `fullName` lacks user-provided text**. This does not mean the reconciled register as a whole has been formally approved.
- **Available source ≠ full approval:** the 318 rows were user-provided, IT,1 later confirmed, and IT,2 previously approved; however, merely submitting data cannot be treated as final formal approval of the entire register. **CLUB-01 remains open only for final design validation and review of the four already handled exceptions.**
- **CLUB-02 unchanged:** 320/320 unique approved abbreviations, `IT,2 = RIN`; **implementation roadmap 0/5 (0%)**. No code, branch, PR, merge, deployment or database changes were made during the historical entry.


### CLUB-01 — Documentary confirmation of IT,1 on 10 October 2026

- **New primary source: explicit user message in this conversation.** Club `IT,1`: `name = US Velaria Torino`, `fullName = Unione Sportiva Velaria Torino`.
- The full name is no longer merely a historical-response candidate: **the user directly supplied it**. The 320-position register in [comment #6091538309](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309) must be read with this **later overriding update** to the historical IT,1 note.
- **Updated documentary coverage: 320/320 `fullName` (100%)** with user-provided text or individual approval. Verifiable breakdown: **318 + 1 (IT,1) + 1 (IT,2) = 320**.
- **Later approvals unchanged:** IT,2 = **AC Rinascenti Bologna / Associazione Calcio Rinascenti Bologna / RIN**; FR,27 = FC Émaux; FR,33 = CS Garrigues; PT,34 = *Atlético Clube das Fontes de Caldas da Rainha*; BR,16 = EC Falésia Clara.
- **CLUB-01 still open** for final formal approval of the register; transcribing the text must not be mistaken for full catalogue approval. **Implementation roadmap unchanged at 0/5 (0%)**; no code, branch, PR, merge, deployment or database modifications during this historical audit.

