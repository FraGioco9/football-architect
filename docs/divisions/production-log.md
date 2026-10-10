# DIV-ASSET — Registro produzione e approvazioni

Il progetto grafico A01–A05 è **approvato e terminato (5/5, 100%)**. Questo registro mantiene distinta la produzione campione dalla consegna finale dei 64 SVG.

| Fase | Identità | Decisione | Immagini approvate | SVG finali |
|---|---|---|---|---|
| P01 | IT-1 Lega Federale | Approvata in conversazione | 1 campione PNG | 0/4 |
| P01 | IT-2 Lega delle Città | Approvata in conversazione | 1 campione PNG | 0/4 |
| P02+ | Altri 14 stemmi | Da progettare/produrre | 0 | 0/56 |

## Integrità campioni approvati — PNG originali salvati nella Libreria persistente, non ancora caricati nel repository

- **IT-1**, nome originale locale `stemma_della_lega_federale_i.png`, RGBA 1254 × 1254 px, SHA-256 `bfd87c44cd029b0fac73cf077cb30ea64175cb2da68f7666ad61297acc976ede`.
- **IT-2**, nome originale locale `emblema_lega_delle_città_ii.png`, RGBA 1254 × 1254 px, SHA-256 `0d8569f841fd1e822a0ad7c5e7a2319d8664e33a334378f4bd075526778db1e7`.

**Conservazione confermata:** i due PNG originali sono stati caricati nella Libreria persistente di ChatGPT in `/Football Architect/DIV-ASSET/`, con i nomi originali indicati sopra (IT-1 e IT-2). **NON sono inclusi nei commit GitHub di questo branch**; il collegamento GitHub attuale non trasferisce automaticamente il binario dal runtime. Le impronte SHA-256 permettono di controllare una futura importazione su GitHub. Il backup è quindi **GitHub per i documenti + Libreria persistente per i due PNG**, non tutto su GitHub.

Le anteprime generate rappresentano approvazione **visiva/compositiva**; per i definitivi SVG applicare gli esatti HEX A03, la tipografia vettorializzata e le quattro varianti A04. Non reinterpretare un PNG come master SVG già esistente. Aggiungere al registro nuove approvazioni solo dopo consenso esplicito dell'utente.

## Protocollo update futuro

Aggiornare **solo branch documentale** e PR associata con nuove approvazioni, senza merge automatico, deploy, modifica database o integrazione del gioco. Il repository include una baseline di club separata: non toccare `docs/clubs`, `data/clubs.json` o altri ambiti fuori DIV-ASSET.
