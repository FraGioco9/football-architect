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
- /new-career — Pagina originale pre-reset: scelta di nazione, club e nome allenatore nella stessa schermata. Non crea salvataggi fino a «Inizia carriera».
- /new-career/team — URL precedente mantenuto per compatibilità di navigazione: reindirizza alla pagina unica `/new-career`.
- /careers — Layout originale a griglia di card, con salvataggi separati: carica, rinomina, esporta, importa JSON o elimina con conferma. I salvataggi corrotti sono esportabili/eliminabili ma non caricabili.
- /settings — Pannelli originali di preferenze e gestione dati, con lingua IT/EN e operazioni disponibili per carriere locali.
- /simulation — Avanzamento del tempo per 1/7/30/365 giorni, o continuo interrompibile.

## Persistenza

IndexedDB `football-architect-careers-v1`, schema 1, stores `careers`, `snapshots`, `preferences`. Scritture di metadati e snapshot nella medesima transazione. La lingua rimane una preferenza globale localStorage.

La voce «Recupera simulazione precedente» non è più disponibile. Le sessioni minimali e gli archivi IndexedDB storici restano intatti, ma non vengono aperti né migrati automaticamente.

In caso di errore di scrittura la simulazione si interrompe e segnala il problema. Le carriere danneggiate sono elencate in modo isolato.

## Verifica

```powershell
node --test .\tests\minimal-core.test.mjs .\tests\career-menu.test.mjs
```

Per la verifica Windows controlla: primo avvio, 3 carriere indipendenti, refresh e riapertura, import/export, corruzione di uno snapshot, salvataggi storici, lingua IT/EN, mobile 320/390px, nessuna partita.

Non eseguire deploy o merge senza autorizzazione esplicita.
