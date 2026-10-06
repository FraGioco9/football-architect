# Football Architect

Offline single-player football management simulation.

## Avvio locale

Requisito: **Node.js 18+**. La build corrente è verificata con Node 20 e Node 24.

Su Windows:

```powershell
git clone https://github.com/FraGioco9/football-architect.git
cd football-architect
node .\server.mjs
```

Poi apri:

```text
http://127.0.0.1:2000
```


Non servono Docker, build, concatenazione di file base64 o `npm install`.


## Calendario carriera

La carriera usa date di calendario reali:

- una nuova carriera parte dalla data corrente;
- **Continua** avanza di un solo giorno per click;
- le giornate di campionato hanno una data precisa e vengono simulate soltanto quando quella data viene raggiunta;
- allenamento, recupero medico e scadenze collegate al calendario seguono il tempo della carriera;
- le date sono salvate con la carriera e mostrate nell'interfaccia;
- tra due stagioni è previsto un intervallo di 21 giorni, poi la prima giornata della nuova stagione è fissata 7 giorni dopo.

## Modifiche e test locali

Il gioco è direttamente nel repository:

- `index.html`
- `server.mjs`
- `assets/`
- `src/`

Per provare una modifica:

1. avvia `node .\server.mjs`;
2. modifica i file in `src\`;
3. aggiorna il browser;
4. verifica il comportamento a `http://127.0.0.1:2000`.

I salvataggi delle carriere sono nel profilo del browser tramite IndexedDB.
