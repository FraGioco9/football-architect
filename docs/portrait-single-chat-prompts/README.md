# Football Architect — New Chat per Player (V4.1)

**Modalità ufficiale proposta per rigenerare ritratti e per i nuovi giocatori.**
Questo pacchetto contiene **23 prompt completi e indipendenti**, ricostruiti dai
valori iniziali verificati nel database DEV, senza alcun aggiornamento D1.

## Pacchetto pronto per i 23 ritratti esistenti

- [Scarica tutti i 23 prompt in ZIP](../portrait-single-chat-prompts.zip) — contiene **23 file Markdown**, uno per giocatore, e un README.
- [Apri tutti i prompt in un solo documento](../portrait-single-chat-prompts-all.md) — ogni giocatore ha un blocco di testo autonomo da copiare.

I giocatori inclusi sono **44, 45–63, 98, 145, 148**, tutti attualmente con un ritratto WebP approvato su `main`.
I nuovi ritratti sono **V4.1 opt-in**: non sostituiscono gli asset esistenti e
non aggiornano i vecchi snapshot V3.

### Procedura: una chat, un giocatore, una immagine

1. Apri **una nuova chat nel progetto Football Architect** per il giocatore scelto.
2. Dal file Markdown corrispondente, **copia tutto il prompt**, non soltanto il nome. Il prompt include l'identità V4.1, il fingerprint, il profilo fisico, le istruzioni di immagine e il QA.
3. Invia il prompt. Genera **esattamente una immagine**, completa il QA tecnico e visivo **prima** di chiedere una seconda immagine o passare al giocatore successivo.
4. Per PASS o PASS CON NOTA, accetta automaticamente la **candidata locale**, registrando eventuali note. Per FAIL, registra i motivi e rigenera individualmente con lo stesso identikit, senza modificare il fingerprint; evita retry infiniti.
5. Verifica sempre i byte del PNG: **RGBA reale, nessuna scacchiera disegnata**. Poi prova il WebP finale 320×362, margine alto target **3–8 px** (0–12 solo con capelli integri), margini laterali e bordi.
6. **Conserva i file e l'evidenza QA**. Non effettuare upload, sostituzioni su GitHub, merge, deploy o modifiche D1/Production senza autorizzazioni distinte.

### Come riprendere una chat dopo un FAIL

Resta nella chat del *solo* giocatore, chiedendo «Rigenera lo stesso identikit V4.1, correggendo soltanto questi errori QA: ... . Una sola nuova immagine.» Se il modello continua a copiare un volto diverso, interrompi e riapri una chat pulita con il **medesimo prompt originale**; non cambiare l'identità per farla passare.

## Per i giocatori futuri

Il repository contiene `tools/export-player-chat-prompts.mjs`, un esportatore **senza API esterne né D1**. Richiede un file JSON di giocatori con identificativi permanenti e **attributi fisici iniziali verificati**. Esempio di input:

```json
[
  {
    "id": 200,
    "name": "Example Player",
    "nationality": "ITA",
    "secondary_nationality": null,
    "initial_verified": true,
    "attributes": { "strength": 65, "speed": 71, "agility": 68, "stamina": 62 }
  }
]
```

L'indicatore `initial_verified:true` va impostato **solo dopo aver verificato gli attributi iniziali nel batch di generazione**. Il programma non può attestare questa verifica da solo e non deve sostituire silenziosamente i valori correnti/evoluti.

Su Windows PowerShell, dalla radice del repository:

```powershell
node tools/export-player-chat-prompts.mjs --input .\\verified-initial-players.json --out .\\new-chat-prompts
```

Otterrai un file `<id>-<Nome-Cognome>.md` per giocatore, con l'esatto prompt canonico V4.1 e i controlli QA. Il comando non genera immagini e **non sovrascrive prompt già esistenti**.

### Tracciamento e pubblicazione

Ogni nuova chat può riportare in una issue GitHub ID, versione dello snapshot, fingerprint, identificativo della generazione, SHA dei file e QA. Un registro centrale permette poi di integrare solo le candidate accettate, con un passaggio di pubblicazione esplicitamente approvato. Per gli attuali 23, mantenere intatti `assets/players/portraits/<id>.webp` finché le sostituzioni non sono verificate e approvate.

**Nota sulla versione:** i prompt in questo pacchetto sono stati prodotti con V4.1 al commit `0d9ada1534153b9c33b89080ac464bd1d5cc4fca`. Se in futuro cambieranno le regole di identità, servirà una **nuova versione** e nuovi fingerprint, mai una modifica silenziosa ai prompt già approvati.
