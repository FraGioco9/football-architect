# Football Architect — Carriere e menu minimale

Un gioco **offline e single-player** con menu, scelta della squadra, salvataggi di più carriere e semplice simulazione del trascorrere del tempo. Non esistono partite, risultati, classifiche o altri moduli gestionali.

## Avvio su Windows

Node.js 20+; nessuna dipendenza da installare:

```powershell
node .\server.mjs
```

Apri http://127.0.0.1:2000. Porta 2000, solo loopback.

## Pagine

- / — Menu iniziale con l'ultima carriera valida.
- /new-career — **Passaggio 1/4: Allenatore**. Nome, cognome, data di nascita, nazionalità e luogo di nascita obbligatori, con errori IT/EN e messaggio vicino ad Avanti. Menu resta nella testata. Nessun salvataggio in questa fase.
- /new-career/country — **Passaggio 2/4: Nazione**. Selezione esplicita tra 8 Paesi con bandiere SVG HD offline dal catalogo locale `flag-icons` 4:3; Indietro conserva l’allenatore.
- /new-career/league — **Passaggio 3/4: Campionato**. Scelta esplicita del campionato disponibile per la nazione selezionata; oggi il catalogo contiene **un campionato per ciascuno degli 8 Paesi**. Il campionato resta una scelta nella bozza e non modifica lo schema dei salvataggi.
- /new-career/team — **Passaggio 4/4: Squadra**. Tabella compatta di 20 club senza scrollbar interna, con reputazione e capienza, selezione esplicita, riepilogo del club, pulsante Rosa disabilitato e conferma «Inizia carriera». Il salvataggio viene creato solo in questo passaggio.
- /careers — Layout originale a griglia di card, con salvataggi separati: carica, rinomina, esporta, importa JSON o elimina con conferma. I salvataggi corrotti sono esportabili/eliminabili ma non caricabili.
- /settings — Pannelli originali di preferenze e gestione dati, con lingua IT/EN e operazioni disponibili per carriere locali.
- /simulation — Avanzamento del tempo per 1/7/30/365 giorni, o continuo interrompibile.

## Persistenza

IndexedDB `football-architect-careers-v1`, schema 1, stores `careers`, `snapshots`, `preferences`. Il profilo è memorizzato nei metadati della carriera, senza un quarto store o migrazioni distruttive. Scritture di metadati e snapshot nella medesima transazione. La lingua rimane una preferenza globale localStorage.

La voce «Recupera simulazione precedente» non è più disponibile. Le sessioni minimali e gli archivi IndexedDB storici restano intatti, ma non vengono aperti né migrati automaticamente.

In caso di errore di scrittura la simulazione si interrompe e segnala il problema. Le carriere danneggiate sono elencate in modo isolato.

## Verifica

```powershell
node --test .\tests\minimal-core.test.mjs .\tests\career-menu.test.mjs
```

Per la verifica Windows controlla: navigazione Allenatore → Nazione → Campionato → Squadra (quattro URL), Menu in alto, pulsanti Indietro e passaggi senza salvataggi prematuri, tre carriere indipendenti, refresh e riapertura, import/export, IT/EN, viewport 320/390px, tabella senza scroll interno, hover integro, nessuna partita.

Non eseguire deploy o merge senza autorizzazione esplicita.


## Regole condivise per tutte le pagine

I token CSS definiscono la larghezza massima `--fa-page-width` (1200px), il padding orizzontale `--fa-page-gutter`, il margine superiore `--fa-page-top`, il titolo `--fa-title-size`, la dimensione del testo `--fa-body-size`, la distanza dopo l'intestazione `--fa-heading-gap` e il padding dei pannelli `--fa-panel-padding`. La classe `fa-page-heading` è usata da Menu, Nuova carriera, Le tue carriere, Impostazioni e Simulazione. Le strutture originali restano distinte, ma condividono tipografia, allineamento e spaziature.

## Messaggi di errore

- `src/feedback.js` centralizza messaggi IT/EN, avvisi error/warning/success, notifica accessibile e pulsante di chiusura.
- Non vengono esposti messaggi tecnici grezzi. Le anomalie IndexedDB e JSON hanno testo comprensibile e non cancellano i salvataggi.
- Il nome allenatore non valido mostra l'errore sotto il campo, con `aria-invalid` e focus conservato.
- Se IndexedDB non è accessibile, la pagina mostra un errore recuperabile e il pulsante Riprova.
- Se un salvataggio fallisce, la simulazione automatica si interrompe. Importazione, rinomina ed eliminazione mostrano conferma.
- Il collaudo browser Windows resta necessario: prova IT/EN, vista 320/390 px, messaggi chiudibili e dati locali invariati.

## Profilo allenatore

Il nuovo profilo obbligatorio comprende esclusivamente **Nome, Cognome, Data di nascita, Nazionalità e Luogo di nascita**; nome completo e dati anagrafici vengono salvati insieme nella stessa transazione IndexedDB. La data deve esistere e non essere futura; tutti i campi sono obbligatori con messaggi sotto al campo in IT/EN. Import/export conserva il profilo completo. Le carriere create prima dell'aggiunta del profilo rimangono leggibili e importabili senza compilazioni inventate, mentre ogni nuova carriera necessita di tutti i cinque campi. Non vengono aggiunte esperienze, patentini, altre nazionalità, lingue o filosofie tattiche.


## Controlli condivisi

- Le caselle interattive vengono evidenziate solo dopo un clic diretto sulla casella, non dopo hover o clic sulla label. Il focus da tastiera mantiene un indicatore distinto. Il bordo di errore riprende quello di selezione, in rosso.
- L'errore del form Allenatore compare accanto al pulsante Avanti, mentre i campi da correggere hanno il bordo rosso.
- Il calendario del sito ha mese, anno, settimana da lunedi, selezione giorno, date future disabilitate e chiusura tramite Esc o clic esterno.
- Nazionalita usa un menu scrollabile con 249 territori ISO tradotti in IT/EN, salvando il codice a due lettere per le nuove carriere. I vecchi profili non vengono migrati o cancellati.
- I componenti condivisi risiedono in src/site-pickers.js e src/site-picker-ui.js.

## Tabelle del sito

La tabella **Squadra** allinea i contenuti di ciascuna colonna con un contenitore dedicato e di altezza uniforme: stemma e nome, città, fondazione, reputazione, capienza e icona Scelta. Le celle rimangono elementi nativi di tabella e lo scorrimento resta quello della pagina. **Nessuna regola globale di allineamento viene applicata a tutte le tabelle**: le altre tabelle conservano i propri stili.

## Bandiere SVG offline

Il catalogo locale `assets/flags/` contiene **271 bandiere SVG 4:3** da [lipis/flag-icons](https://github.com/lipis/flag-icons), conservate come file vettoriali e distribuite secondo la licenza MIT in `assets/flags/LICENSE`. Non è incluso alcun asset quadrato `1x1`. Tutti i 271 file SVG della directory principale sono accessibili tramite `/assets/flags/<codice>.svg` (MIME `image/svg+xml`, header `X-Content-Type-Options: nosniff`); il server accetta esclusivamente nomi di file regolari con caratteri minuscoli, numeri e trattini, e non serve directory annidate o file sconosciuti. L'interfaccia utilizza attualmente otto di queste bandiere nella selezione Nazione, in Le mie carriere e nella simulazione. Le risorse sono locali e funzionano senza connessione Internet.

La fase relativa ai **loghi dei club** è separata e non è inclusa in questo intervento.
