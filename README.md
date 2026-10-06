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

In alternativa puoi eseguire `avvia-windows.bat`.

Non servono Docker, build, concatenazione di file base64 o `npm install`.

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
