# DIV-ASSET-P02 — Stemmi campione inglesi approvati

Fase **P02 approvata in conversazione**: 2/2 campioni inglesi approvati, portando il totale a **4/16 (25%)**. I PNG originali sono nella Libreria persistente personale `/Football Architect/DIV-ASSET/`; qui si conservano descrizioni e checksum, **non** i file binari.

## ENG-1 — Crown League (prima divisione)

Campione approvato: `emblema_della_crown_league_i.png`, SHA-256 `8ff35e75fa7cfa4485f814e89abb6aefbef7eb293cf9d6c08cceb9508fa753fd`.

- Crest inglese di massima divisione: scudo classico blu navy con bordi pergamena/avorio e oro antico; corona araldica superiore e medaglione centrale con corona.
- Rami di alloro laterali, iscrizione `CROWN LEAGUE` in maiuscolo serif, numero romano `I`, segni divisori orizzontali.
- Atmosfera regale/heritage, più cerimoniale rispetto al secondo livello.
- Per realizzazione SVG definitiva, utilizzare **esattamente** A03: base `#17304A`, chiaro `#EEE4D2`, accento `#B99451`.

## ENG-2 — Shield League (seconda divisione)

**Solo versione corretta e approvata**: `emblema_araldico_shield_league_ii.png`, SHA-256 `b72d6a5ced753f65083d60c0f218d48a9d4b1299d5e14212f4dc398dcf806534`.

- Crest inglese della stessa famiglia, senza corona: scudo principale blu ardesia/grigio-acciaio, bordi multipli crema e argento chiaro.
- Medaglione centrale tondo contenente **uno scudo interno da rendere con geometria esattamente simmetrica sull'asse verticale**, punta e croce centrate, bordo speculare.
- Quattro quarti: campi alternati chiari e tratteggi diagonali; tratteggio bilanciato e ordinato. Allori argentati bilaterali, lettering `SHIELD LEAGUE` in maiuscolo e `II` in basso.
- Più semplice e meno cerimoniale di ENG-1, ma coerente in tipografia, silhouette e finitura.
- Per realizzazione SVG definitiva, utilizzare **esattamente** A03: base `#364C61`, chiaro `#F0EAE0`, accento `#CFD7DA`.
- **Revisioni:** la bozza originale `emblema_shield_league_ii.png` aveva un problema di asimmetria centrale segnalato dall'utente. È stata sostituita dalla versione corretta prima dell'approvazione della fase P02. **Non usare la bozza come riferimento né salvarla come approvata**. La simmetria geometrica definitiva sarà verificata sul master SVG A04.

## Regole del futuro export

PNG di anteprima: raster quadrato RGBA 1254 × 1254 con sfondo trasparente. Non chiamarli master SVG: le 4 varianti `primary`, `compact`, `mono-dark`, `mono-light` per ciascuna divisione sono **ancora da produrre**. Il sistema A01–A05 resta immutato. Nessuna integrazione runtime, merge, deploy o modifica ai database.
