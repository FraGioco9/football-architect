# Football Architect — 404 concept for owner review

**Status: DESIGN PROPOSAL ONLY. Not implemented, tested in a browser or published.** Related: issue #485, issue #493, Draft/HOLD PR #500.

## Layout

One minimal public-header layout using existing Football Architect brand, theme and locale controls; no private/sidebar/Admin data. Typography-led (no mascot or fictional club crest) with modest "404", clear heading and **one sole navigation action to Dashboard**. No Home or Competitions action. Render meaningful English text on first paint before JavaScript.

```text
  FOOTBALL ARCHITECT                         Language   Theme

       404
       Page not found
       This address doesn't lead to a Football Architect page.

       [ Go to Dashboard ]

       Check the address if you followed an old or saved link.
```

Content width around 680px, aligned to existing page typography. Reuse `assets/theme.js`, `assets/landing.css`, shared semantic `--background`, `--text`, `--surface`, `--border`, `--focus` tokens and approved brand asset. Test Dark and Light at 320/390/768/1440 px; keep the single Dashboard action legible and easily tappable at 320/390, avoid overflow, preserve visible keyboard focus and contrast. No load animations or API dependency. The **only navigation destination** on the 404 page must be the fixed, same-origin `/dashboard` URL. The brand header must not introduce a Home or Competitions link: show its brand as noninteractive text/image, or link it to `/dashboard` if existing shared components require a link. Never interpolate an untrusted `next` or `returnTo` URL.

## Proposed copy

| Language | Title | Description | Only action | Hint |
|---|---|---|---|---|
| EN | Page not found | This address doesn't lead to a Football Architect page. | Go to Dashboard | Check the address if you followed an old or saved link. |
| DE | Seite nicht gefunden | Unter dieser Adresse gibt es keine Seite von Football Architect. | Zum Dashboard | Prüfe die Adresse, wenn du einem alten oder gespeicherten Link gefolgt bist. |
| ES | Página no encontrada | Esta dirección no lleva a ninguna página de Football Architect. | Ir al Dashboard | Comprueba la dirección si has seguido un enlace antiguo o guardado. |
| FR | Page introuvable | Cette adresse ne correspond à aucune page de Football Architect. | Aller au tableau de bord | Vérifiez l'adresse si vous avez suivi un ancien lien ou un favori. |
| IT | Pagina non trovata | Questo indirizzo non corrisponde a una pagina di Football Architect. | Vai alla Dashboard | Controlla l'indirizzo se hai aperto un link vecchio o salvato. |

Use existing EN default and EN/DE/ES/FR/IT preference handling. Localized text and language control must not require authentication.

## Proposed HTTP/security contract — not implemented

- Unknown **document GET**: actual HTTP **404**, with localized HTML; **HEAD**: 404 and no body. Never 200 with merely a visible "404" label.
- Missing JS/CSS/image/JSON/API: preserve 404 and correct content-type semantics; never return successful HTML as script/data. Keep unsafe paths **403** and unsupported methods **405**.
- Admin unauthorized access is **not** the same as unknown route. No private Admin content or permission bypass.
- Known aliases use exactly one **308** to their canonical destination with allowed query preserved; unknown paths must not create redirect loops.
- Keep user-submitted query/fragment out of 404 copy and the sole fixed `/dashboard` link. No external redirect/return target or automatic navigation: a missing page must remain an HTTP 404 until the user chooses Dashboard.
- Selected Cloudflare Preview and DEV should agree. An eventual `404.html` needs explicit public allowlist and Worker static-asset behavior tests; this design alone changes neither.

## Review gates

- [ ] Owner approves minimal header and layout (vs full app sidebar). **The sole link destination `/dashboard` is owner-specified**, so do not add Home, Competitions or Back links.
- [ ] Owner approves wording in five languages.
- [ ] Owner approves Dark/Light, 320/390/768/1440 and keyboard behavior.
- [ ] Owner approves HTTP 404/HEAD and asset/API/Admin permission separation.
- [ ] After approval: implement under Draft/HOLD; run Chromium/WebKit and exact-head CI. Merge and Preview/Production deploy require separate authorization.

**This file is not an implemented 404 page.**
