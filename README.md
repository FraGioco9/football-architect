# Football Architect — Cataloghi divisioni e club

**Stato:** il progetto conserva cataloghi di divisioni/club e una Landing statica, senza motore del gioco, Guide/Home interne, login, salvataggi, partite o deploy automatici.

## Landing in locale

Apri `index.html` direttamente o avvia su Windows `py -m http.server 2000` dalla cartella del repository, poi visita `http://127.0.0.1:2000`. Non occorrono build, npm o Docker. Test: `node --test tests/landing.test.mjs`.

Lingua iniziale **English**, poi Deutsch, Español, Français, Italiano; la preferenza viene salvata localmente. I due pulsanti **Enter the app** e **Guide** annunciano la futura disponibilità delle destinazioni, senza aprire pagine inesistenti.

## Cosa rimane
- **8 Paesi, 16 divisioni** in [data/divisions.json](data/divisions.json): 2 livelli per Paese con nomi/ID fittizi approvati, capacità indicativa 20 club per livello; **nessuna divisione integrata nel gioco**.
- **320 identità club** in [data/clubs.json](data/clubs.json), chiave stabile `(countryId,clubId)`, 320 nomi completi documentati e 320 sigle `abbr` approvate e univoche.
- **160 dati storici di prima divisione** (vecchie denominazioni, città, stadi) nel campo `firstDivisionReference` dei primi 20 club per Paese. I vecchi nomi non sono automaticamente quelli approvati più recentemente.
- **Otto bandiere** dei Paesi interessati, dal pack preesistente, più [licenza](assets/flags/LICENSE). Eliminati gli altri SVG del pack che non servono a questi cataloghi.
- La documentazione integrale dei [320 nomi completi](docs/clubs/fullnames-source.md) e [320 sigle, riconciliazioni e audit](docs/clubs/registry-history.md), conservata senza modifiche alle fonti.
- La [direzione artistica divisionale approvata](docs/divisions/design-direction.md).

## Stato dell'identità grafica
Le roadmap di progettazione [DIV-ASSET #60](https://github.com/FraGioco9/football-architect/issues/60) e [CLUB-ASSET #61](https://github.com/FraGioco9/football-architect/issues/61) rimangono fonti di riferimento. **Non esistono ancora 16 + 320 stemmi finali**: non inventare SVG/loghi o dati che non risultino approvati. I 320 `fullName` sono disponibili, ma non tutti hanno ricevuto una convalida formale congiunta. Il catalogo della prima divisione nel vecchio codice aveva solo 160 club, mentre i restanti 160 sono progettazione documentale: non sono stati implementati nel gioco.

## Correzioni da conservare
- IT,1: **US Velaria Torino**, `VEL`
- IT,2: **AC Rinascenti Bologna**, `RIN` (non AC Felsina Bologna)
- FR,27: **FC Émaux**, `EMX`
- FR,33: **CS Garrigues**, `GRG`
- PT,34: **AC Fontes**, `FTS`
- BR,16: **EC Falésia Clara**, `FCL`

## Provenienza e reset
- Baseline storica `main`: `72d16de4a3ad410dab84fd9d1f42007a187a98b1`.
- Riconciliazioni integrali: [issue #61, commento completo](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091538309) e [archivio](https://github.com/FraGioco9/football-architect/issues/61#issuecomment-6091598842).
- Il reset è **un nuovo commit**, non una riscrittura irreversibile della cronologia Git. Le vecchie branch/PR possono restare accessibili ma non rappresentano il nuovo `main`.
