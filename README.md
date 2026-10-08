# Football Architect — base minimale

Un prototipo **locale e offline** con tre pagine: menu iniziale, scelta della squadra e simulazione del trascorrere del tempo.

- Otto Paesi reali, 20 club originali e inventati per Paese.
- Scelta della squadra, data reale di avvio, avanzamento di giorni/settimane/mesi e simulazione continua interrompibile.
- **Non esistono incontri, calendari di partite, risultati, classifiche, motori partita o altri moduli manageriali.**
- La singola sessione minimale viene conservata nel browser con la chiave `football-architect:minimal:v1`.
- I vecchi salvataggi IndexedDB delle versioni precedenti **non vengono aperti, migrati, sovrascritti o cancellati**.

## Avvio su Windows

Node.js 20+ (nessuna dipendenza da installare):

```powershell
git clone https://github.com/FraGioco9/football-architect.git
cd football-architect
node .\server.mjs
```

Apri http://127.0.0.1:2000.

## Test

```powershell
node --test .\tests\minimal-core.test.mjs
```

Nessun deploy incluso. Nessuna roadmap o documentazione del vecchio gestionale inclusa nel codice.
