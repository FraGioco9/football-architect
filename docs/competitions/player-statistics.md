# Competition player statistics (#643)

Competition > Stats > Players uses the selected competition/season's verified immutable `temporary-lineup-v1` receipts, including its postseason. The owner's approved order is:

1. Test rating — mean of recorded ratings, with the number of rated appearances: `6.75 (20)`.
2. Goals.
3. Assists.
4. Goals + assists per 90 minutes: `(goals + assists) × 90 / minutes`.
5. Goalkeeper clean sheets.
6. Starts (substitute appearances): `12 (3)`.
7. Red cards.
8. Minutes.

There is no yellow-card ranking. Five-row previews, Show all, tied ranks, deterministic sorting, five translations and circular face photos are shared by every supported competition. Photos use generic persistent-ID paths and CSS cropping; missing files use a neutral silhouette. Player/name links open Player Detail; recorded-club text links preserve historical club contributions.

Only recorded values enter rankings. Null metrics display a dash, never a fabricated zero. The current simulator does not record assists, red-card events or substitutes. Therefore assists, red cards and G+A/90 remain unavailable; existing frozen appearances are all starts and have zero actual substitute appearances. Those event models are not invented by the read API. Minutes remain actual frozen minutes; shootouts do not inflate goals or minutes.

Clean sheets are derived for the **actual frozen GK role only**, including an emergency goalkeeper playing that role, when the recorded appearance covers the complete match and the opponent scored no regulation/extra-time goals. Shootout goals do not affect clean sheets. Outfield players and incomplete keeper participation have null clean-sheet eligibility. A full participating keeper who conceded has recorded zero. This needs no receipt rewrite or resimulation.

Ratings remain temporary `test-rating-v1` values, not a realistic evaluation model. The mean divides by **rated appearances**, excluding unrated historical receipts. Old unrated appearances remain in ordinary participation/minutes totals.

The backend aggregate and dedicated per-match statistics API reuse `frozenMatchPlayerStatistics`; there is no second sporting authority. The existing competition response retains only public player ID, identity and supported counters. New receipts freeze ID, full name and primary nationality. Complete frozen identities need no live directory reads; legacy competition rows may obtain missing labels through one collective bound ID-list query, without current affiliations or per-player requests. The original club and sporting counters always come from receipts.

Tests cover adapter/renderer contracts, mixed/XI/fallback matches, identity immutability, historical/unrated receipts, archive replay, a complete 56-day lifecycle and independent desktop/mobile match/statistics loading. Browser emulation is not physical iPhone Safari certification.
