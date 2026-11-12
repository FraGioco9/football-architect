# Football Architect — 404 concept for owner review

**Status: DESIGN PROPOSAL ONLY. Not implemented, tested in a browser or published.** Related: issue #485, issue #493, Draft/HOLD PR #500.

## Layout

One minimal public-header layout using existing Football Architect brand, theme and locale controls; no private/sidebar/Admin data. Typography-led (no mascot or fictional club crest) with modest "404", clear heading and two accessible actions. Render meaningful English text on first paint before JavaScript.

```text
  FOOTBALL ARCHITECT                         Language   Theme

       404
       Page not found
       This address doesn't lead to a Football Architect page.

       [ Go to homepage ]       [ Competitions ]

       Check the address if you followed an old or saved link.
```

Content width around 680px, aligned to existing page typography. Reuse `assets/theme.js`, `assets/landing.css`, shared semantic `--background`, `--text`, `--surface`, `--border`, `--focus` tokens and approved brand asset. Test Dark and Light at 320/390/768/1440 px; stack the two links at 320/390, avoid overflow, preserve visible keyboard focus and contrast. No load animations or API dependency. Destination URLs must be **fixed, relative to the same origin**: primary `/`, secondary `/competitions`. Never interpolate an untrusted `next` or `returnTo` URL.

## Proposed copy

| Language | Title | Description | Primary | Secondary | Hint |
|---|---|---|---|---|---|
| EN | Page not found | This address doesn't lead to a Football Architect page. | Go to homepage | Competitions | Check the address if you followed an old or saved link. |
| DE | Seite nicht gefunden | Unter dieser Adresse gibt es keine Seite von Football Architect. | Zur Startseite | Wettbewerbe | Prüfe die Adresse, wenn du einem alten oder gespeicherten Link gefolgt bist. |
| ES | Página no encontrada | Esta dirección no lleva a ninguna página de Football Architect. | Ir al inicio | Competiciones | Comprueba la dirección si has seguido un enlace antiguo o guardado. |
| FR | Page introuvable | Cette adresse ne correspond à aucune page de Football Architect. | Aller à l'accueil | Compétitions | Vérifiez l'adresse si vous avez suivi un ancien lien ou un favori. |
| IT | Pagina non trovata | Questo indirizzo non corrisponde a una pagina di Football Architect. | Vai alla home | Competizioni | Controlla l'indirizzo se hai aperto un link vecchio o salvato. |

Use existing EN default and EN/DE/ES/FR/IT preference handling. Localized text and language control must not require authentication.

## Proposed HTTP/security contract — not implemented

- Unknown **document GET**: actual HTTP **404**, with localized HTML; **HEAD**: 404 and no body. Never 200 with merely a visible "404" label.
- Missing JS/CSS/image/JSON/API: preserve 404 and correct content-type semantics; never return successful HTML as script/data. Keep unsafe paths **403** and unsupported methods **405**.
- Admin unauthorized access is **not** the same as unknown route. No private Admin content or permission bypass.
- Known aliases use exactly one **308** to their canonical destination with allowed query preserved; unknown paths must not create redirect loops.
- Keep user-submitted query/fragment out of 404 copy and outbound links. No external redirect/return target.
- Selected Cloudflare Preview and DEV should agree. An eventual `404.html` needs explicit public allowlist and Worker static-asset behavior tests; this design alone changes neither.

## Review gates

- [ ] Owner approves minimal header, layout and links (vs full app sidebar).
- [ ] Owner approves wording in five languages.
- [ ] Owner approves Dark/Light, 320/390/768/1440 and keyboard behavior.
- [ ] Owner approves HTTP 404/HEAD and asset/API/Admin permission separation.
- [ ] After approval: implement under Draft/HOLD; run Chromium/WebKit and exact-head CI. Merge and Preview/Production deploy require separate authorization.

**This file is not an implemented 404 page.**
