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
- /new-career — Nome dell'allenatore obbligatorio (non crea un salvataggio).
- /new-career/team — Selezione di una delle 160 squadre inventate negli 8 Paesi. **Solo "Inizia carriera" salva realmente la sessione.**
- /careers — Salvataggi separati: carica, rinomina, esporta, importa JSON o elimina con conferma. I salvataggi corrotti non possono essere caricati, ma possono essere esportati ed eliminati.
- /settings — Lingua IT/EN.
- /simulation — Avanzamento del tempo per 1/7/30/365 giorni, o continuo interrompibile.

## Persistenza

IndexedDB `football-architect-careers-v1`, schema 1, stores `careers`, `snapshots`, `preferences`. Scritture di metadati e snapshot nella medesima transazione. La lingua rimane una preferenza globale localStorage.

Le vecchie sessioni `football-architect:minimal:v1` restano intatte e si possono **recuperare esplicitamente** in Le mie carriere, una sola volta per archivio. Non viene cancellato né migrato automaticamente alcun IndexedDB storico.

In caso di errore di scrittura la simulazione si interrompe e segnala il problema. Le carriere danneggiate sono elencate in modo isolato.

## Verifica

```powershell
node --test .\tests\minimal-core.test.mjs .\tests\career-menu.test.mjs
```

Per la verifica Windows controlla: primo avvio, 3 carriere indipendenti, refresh e riapertura, import/export, corruzione di uno snapshot, salvataggi storici, lingua IT/EN, mobile 320/390px, nessuna partita.

Non eseguire deploy o merge senza autorizzazione esplicita.
