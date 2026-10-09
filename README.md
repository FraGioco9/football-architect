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
- /new-career — **Passaggio 1/3: Allenatore**. Nome, cognome, data di nascita, nazionalità e luogo di nascita obbligatori, con errori IT/EN sotto ciascun campo. Annulla resta nella testata. Nessun salvataggio in questa fase.
- /new-career/country — **Passaggio 2/3: Nazione**. Selezione esplicita tra 8 Paesi; Indietro conserva l’allenatore.
- /new-career/team — **Passaggio 3/3: Squadra**. Tabella completa di 20 club senza scrollbar interna, selezione esplicita, riepilogo del club e conferma «Inizia carriera». Il salvataggio viene creato solo in questo passaggio.
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

Per la verifica Windows controlla: navigazione Allenatore → Nazione → Squadra (tre URL), Annulla in alto, pulsanti Indietro e passaggi senza salvataggi prematuri, tre carriere indipendenti, refresh e riapertura, import/export, IT/EN, viewport 320/390px, tabella senza scroll interno, hover integro, nessuna partita.

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
