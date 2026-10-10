# Football Architect — DIV-ASSET, registro approvazioni

Stato: **A01–A05 approvate (5/5, 100% progettazione)**; **P01 + P02 approvate (4/16 campioni grafici, 25%)**. Riferimento: [issue #60](https://github.com/FraGioco9/football-architect/issues/60). Aggiornato 2026-10-10 secondo approvazioni esplicite in conversazione.

Questa cartella conserva decisioni, palette, concept e inventario per la **sola identità visiva divisionale**. Non è una libreria di loghi utilizzata dal gioco. Il repository attuale contiene cataloghi e documentazione, non una build attiva.

## Fonte canonica del progetto grafico

- [design-direction.md](design-direction.md) — A01, regole stilistiche.
- [concepts.md](concepts.md) — A02, 16 identità e simboli.
- [palettes-and-type.md](palettes-and-type.md) — A03, tutti i 48 codici HEX e gerarchia tipografica.
- [technical-spec.md](technical-spec.md) — A04, standard SVG, varianti, nomenclatura.
- [design-review.md](design-review.md) — A05, revisione, riserve e prove differite.
- [production-log.md](production-log.md) — registro delle approvazioni campione P01 e future fasi P02+.
- [p01-visual-brief.md](p01-visual-brief.md) — descrizione conservativa dei campioni italiani.
- [p02-visual-brief.md](p02-visual-brief.md) — descrizione dei due campioni inglesi approvati, inclusa la revisione dello scudo ENG-2. I brief **non sostituiscono le immagini**.
- [inventory.json](inventory.json) — manifest documentale delle 16 divisioni e delle 64 varianti SVG **previste**, non prodotte.

## Importante: stato file immagine

I campioni PNG P01 e P02 **sono stati generati e approvati nella conversazione** e **conservati come originali nella Libreria persistente di ChatGPT**, nella cartella personale `/Football Architect/DIV-ASSET/`. I file PNG **non sono ancora presenti come blob binari in questo branch GitHub**. Nomi, dimensioni e SHA-256 di tutti e quattro sono in [production-log.md](production-log.md). Non dire che i 64 SVG esistono: **0/64 prodotti**.

## Procedura per le prossime approvazioni

Ogni nuova approvazione P02+ aggiornerà su questo branch `production-log.md` e, se necessario, `inventory.json`, salvando ogni immagine generata e approvata anche nella Libreria persistente, finché l'upload binario su GitHub non sia possibile. **Non sostituire** uno stemma campione approvato senza una nuova approvazione. Niente modifiche all'app, deploy, DB o merge automatici.
