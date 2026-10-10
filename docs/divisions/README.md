# Football Architect — DIV-ASSET, registro approvazioni

Stato: **A01–A05 approvate (5/5, 100% progettazione)**; **P01 approvata (2/16 campioni grafici)**. Riferimento: [issue #60](https://github.com/FraGioco9/football-architect/issues/60). Aggiornato 2026-10-10 secondo approvazioni esplicite in conversazione.

Questa cartella conserva decisioni, palette, concept e inventario per la **sola identità visiva divisionale**. Non è una libreria di loghi utilizzata dal gioco. Il repository attuale contiene cataloghi e documentazione, non una build attiva.

## Fonte canonica del progetto grafico

- [design-direction.md](design-direction.md) — A01, regole stilistiche.
- [concepts.md](concepts.md) — A02, 16 identità e simboli.
- [palettes-and-type.md](palettes-and-type.md) — A03, tutti i 48 codici HEX e gerarchia tipografica.
- [technical-spec.md](technical-spec.md) — A04, standard SVG, varianti, nomenclatura.
- [design-review.md](design-review.md) — A05, revisione, riserve e prove differite.
- [production-log.md](production-log.md) — registro delle approvazioni campione P01 e future fasi P02+.
- [p01-visual-brief.md](p01-visual-brief.md) — descrizione conservativa dei due campioni visivamente approvati; **non sostituisce le immagini**.
- [inventory.json](inventory.json) — manifest documentale delle 16 divisioni e delle 64 varianti SVG **previste**, non prodotte.

## Importante: stato file immagine

I campioni PNG P01 **sono stati generati e approvati nella conversazione**, ma **non sono ancora salvati come file binari in questo branch**; vedi SHA-256 e registro in [production-log.md](production-log.md). Sono conservati in una copia separata scaricabile dalla conversazione fino al caricamento esplicito su GitHub. Non dire che i 64 SVG esistono: **0/64 prodotti**.

## Procedura per le prossime approvazioni

Ogni nuova approvazione P02+ aggiornerà su questo branch `production-log.md` e, se necessario, `inventory.json`, più il file grafico effettivo quando disponibile un meccanismo di upload binario. **Non sostituire** uno stemma campione approvato senza una nuova approvazione. Niente modifiche all'app, deploy, DB o merge automatici.
