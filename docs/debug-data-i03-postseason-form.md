# I03 — postseason and Form shared preparation

This block adds `dev-protected-domestic-postseason.mjs` and `dev-protected-domestic-form.mjs`, both pure, fail-closed adapters. The postseason adapter validates the 52/53/54 world-day pattern, 2 top-tier / 5 second-tier matches, completed score types, and conceals future entrants, scores and deciding metadata. The protected presentation model now includes this validated postseason view (not yet published through the existing postseason renderer).

Form is calculated exclusively from completed **regular league** fixtures, with per-club W/D/L, score, round and home/away position, ordered latest-first and capped at five. The new shared domestic presenter consumes the same Form data instead of its old duplicated computation.

Remaining before an opt-in renderer can be used: binding the existing Form tooltip interaction lifecycle; passing the correctly mapped knockout fixtures to the existing postseason component, which currently assumes fully known participants; shared season-context commit and rollback; and I06 visual/security tests. No production/runtime activation.
