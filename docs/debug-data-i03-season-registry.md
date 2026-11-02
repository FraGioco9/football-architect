# I03 — Stable club identities across season changes

The protected server adapter now joins season participants to the **permanent** `data/clubs.json` catalog by exact `COUNTRY-ID` identity before returning the day projection. It includes only the sixteen club records of the selected domestic competition (or 24 for an international cup), never infers identity from current position or tier.

The browser's protected domestic-context adapter validates every `canonicalId`, country, numeric club ID, unique participant membership and display name. The prepared event carries the season-specific `clubs` registry, allowing a future atomic UI transaction to replace table rows when promotions and relegations change membership. This avoids the old DEV preview's limitation of requiring the same sixteen club IDs in every season.

This change **does not** automatically replace the visible table or club crest layout. It is an identity integrity prerequisite for a consistent shared DOM commit, still opt-in behind both I03 DEV flags and a protected HttpOnly session.

I06 must validate identity stability across all countries and seasons, including the 64 inactive clubs, team links, crests, and first-paint dimensions.
