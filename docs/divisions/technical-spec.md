# DIV-ASSET-A04 — Specifica di produzione approvata

**Inventario previsto:** 16 divisioni × 4 varianti = **64 SVG**, più un manifest e un README nel futuro pacchetto. **Non ancora prodotti: 0/64**.

## Formato

- SVG vettoriali autonomi, compatibili con browser moderni, con `viewBox="0 0 512 512"` e canvas intrinseco 512 × 512.
- Sfondo davvero trasparente, senza rettangolo opaco nascosto; colori HEX approvati, geometria vettoriale, nessun raster incorporato, script, riferimenti esterni, font remoti, gradiente o 3D.
- Composizione centrata. Margine di sicurezza di almeno **40 unità** sul master principale e **56 unità** sul compatto; non sovradimensionare sigilli di forme diverse fino a farli toccare il canvas.
- Testo vettorializzato in tracciati nell'output, senza distribuire i file dei caratteri. Conservare eventualmente sorgenti di lavoro separati dall'export finale, fuori dal pack runtime.

## Quattro varianti per ciascun ID

| Suffisso | Contenuto | Prove dimensionali |
|---|---|---|
| `primary` | Stemma pieno con nome ufficiale, simbolo e ornamentazione | 64, 128, 256, 512 px |
| `compact` | Stesso linguaggio con dettagli ridotti, senza lettering esteso | 16, 24, 32, 48, 64 px |
| `mono-dark` | Compatta, una tinta scura, per fondo chiaro | 16, 24, 32, 64 px |
| `mono-light` | Compatta, una tinta chiara, per fondo scuro | 16, 24, 32, 64 px |

## Nomenclatura

Formato `<id-lowercase>-<primary|compact|mono-dark|mono-light>.svg`, per esempio `it-1-primary.svg`. ID stabili; niente spazi, accenti o titoli nei nomi file. Il futuro pack isolato avrà `svg/` + `manifest.json` + `README.md`; **nessuna integrazione in `src/`, asset runtime, interfaccia, database o salvataggi**.

Il file [inventory.json](inventory.json) è il registro documentale preliminare: elenca nomi **attesi**, non link verso SVG già esistenti. Eventuali PNG raster derivati sono facoltativi e non fanno parte del requisito di 64 SVG.
