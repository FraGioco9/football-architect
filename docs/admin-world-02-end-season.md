# ADMIN-WORLD-02 — Fine stagione D1 (issue #327)

## Contratto approvato

Un unico scheduler D1, nella tabella `season_admin_events` e nell'identità `(season_number,event_id)`. Dopo l'ultima attività sportiva del **giorno 56**, tre eventi distinti:

| Evento | day | event_order | Comando Admin |
| --- | ---: | ---: | --- |
| `season:archive` | 56 | 9000 | POST `/api/admin/seasons/archive` |
| `season:close` | 56 | 9100 | POST `/api/admin/seasons/close` |
| `season:next-prepare` | 56 | 9200 | POST `/api/admin/seasons/next-prepare` |

Gli ordini possono essere spostati rispettando la sequenza. Il giorno resta 56, senza introdurre un 57° giorno. Una ricevuta completata è immutabile; i comandi richiedono sessione, CSRF/Origin, generazione/revisione attese e chiave d'idempotenza. Le operazioni D1 usano batch atomici e `admin_operations`; un errore deve annullare anche la ricevuta.

## Archivio e preparazione

L'archivio legge e valida le 56 giornate, 4.082 risultati e 54 ties già persistiti, senza creare nuovi risultati. Scrive `season_archives`, `season_archive_summaries`, ricevuta `season:archive`, revisione e audit in una sola transazione, lasciando `world_state.phase=active`. La chiusura richiede questi dati e la ricevuta, completa `season:close` e imposta `closed`. La preparazione usa il **già approvato** snapshot di stagione 2, segna `season:next-prepare`, crea `seasons(2)` e imposta **giorno 0 / preparing**; non avvia automaticamente partite o calendari. Il motore di approvazione resta specifico per la transizione **1→2**: la generalizzazione N→N+1 è una limitazione esplicita.

## Migrazioni e recupero

- `0011_end_season_admin_events.sql`: allarga il vincolo `kind` della tabella originale con migrazione di copia senza perdere le cinque righe legacy, ricevute incluse. Non applicare manualmente in produzione senza backup e revisione.
- `0012_season_archive_summaries.sql`: aggiunge il riepilogo immutabile con `archive_hash`, `summary_hash` e JSON verificabile.
- Stagioni a 5 eventi rimangono leggibili; i nuovi 8 eventi devono essere presenti integralmente. Non inserire manualmente una selezione parziale dei tre eventi conclusivi.
- In caso di esecuzione fallita, leggere `world_state`, `season_admin_events`, `season_archives`, `season_archive_summaries` e `admin_operations`, quindi riprovare esclusivamente con il protocollo d'idempotenza e revisione; **non** riscrivere risultati né archivio.
- Le ricevute storiche sono legate alla stagione di origine; History è pubblicabile soltanto con ricevuta di chiusura sigillata e hash validi. Il reset amministrativo ruota la generazione prima dell'eventuale cancellazione autorizzata.

## Piano di verifica finale (non eseguito in questo blocco)

1. Node 22: TypeScript e policy di ordinamento/movimenti, contratti Admin.
2. SQLite: migrazioni `0011`/`0012`, integrità ricevute, reset e rollback.
3. Worker/D1: archiviazione → chiusura → approvazione → preparazione, replay, competing writes, rollback e letture storiche.
4. Site checks, test UI Admin Settings nelle 5 lingue, Chromium, generatore della pagina `settings/index.html`, guard anti-deploy e SHA esatto.

Su PR Draft/HOLD i test completi sono condizionati al gate finale esplicito. **Nessun deploy né merge** durante questa fase.
