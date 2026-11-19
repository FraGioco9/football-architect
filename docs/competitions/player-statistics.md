# Competition player statistics (#643)

Competition > Stats > Players uses the selected competition/season's verified immutable `temporary-lineup-v1` receipts, including its postseason. The owner's approved order is:

1. Rating — mean of recorded ratings, with the number of rated appearances: `6.75 (20)`.
2. Goals.
3. Assists.
4. Goals + assists per 90 minutes: `(goals + assists) × 90 / minutes`.
5. Goalkeeper clean sheets (appearances), e.g. `6 (13)`.
6. Starts (substitute appearances): `12 (3)`.
7. Red cards.
8. Minutes.

There is no yellow-card ranking. Five-row previews, Show all, tied ranks, deterministic sorting, five translations and circular face photos are shared by every supported competition. Photos use generic persistent-ID paths and CSS cropping; missing files use a neutral silhouette. Only the player name links to Player Detail; portraits and frozen-club labels are non-interactive. Club labels still represent the recorded club, not necessarily the current affiliation.

Only qualified recorded values enter rankings. The denominator is **the player's recorded club's matches played in this competition/season**, including postseason where relevant (not the competition-wide total). The dynamic thresholds are: **Rating** 50% of matches with a rated appearance (ceil); **Goals**, **Assists** and **Red cards** at least one recorded event; **G+A/90** at least one goal or assist plus minutes equivalent to 40% of games played (90 minutes per match); **Goalkeeper clean sheets** at least one clean sheet and participation in 50% of club matches (ceil); **Starts** 50% of club matches (ceil); **Minutes** 50% of available 90-minute match equivalents. There is no fixed minimum appearance or minute count. Missing club match coverage never qualifies. Null/unrecorded/unqualified metrics all display localized `No players`; they are never converted to zero. Each card reserves a fixed five-row content area and identical footer in filled and empty states: 60px rows on desktop and 52px on mobile. The current simulator does not record assists, red-card events or substitutes. Therefore assists, red cards and G+A/90 remain unavailable; existing frozen appearances are all starts and have zero actual substitute appearances. Those event models are not invented by the read API. Minutes remain actual frozen minutes; shootouts do not inflate goals or minutes.

Clean sheets are credited only after **at least 60 minutes actually playing as goalkeeper**, including a substitute or emergency goalkeeper regardless of the player's natural or initial position, when the opponent scored no regulation/extra-time goals across the match. Verified v2 receipts provide actual `gkMinutes`, including role changes; legacy receipts only support the frozen match GK role and total played minutes (at least 60), so unknown historic GK intervals are never inferred. Shootout goals do not affect clean sheets. Less than 60 recorded GK minutes (or no GK duty) yields null eligibility; a qualifying keeper whose team conceded has a recorded zero. This needs no receipt rewrite or resimulation.

Ratings remain temporary `test-rating-v1` values, not a realistic evaluation model. The mean divides by **rated appearances**, excluding unrated historical receipts. Old unrated appearances remain in ordinary participation/minutes totals.

The backend aggregate and dedicated per-match statistics API reuse `frozenMatchPlayerStatistics`; there is no second sporting authority. The existing competition response retains only public player ID, identity and supported counters. New receipts freeze ID, full name and primary nationality. Complete frozen identities need no live directory reads; legacy competition rows may obtain missing labels through one collective bound ID-list query, without current affiliations or per-player requests. The original club and sporting counters always come from receipts.

Tests cover adapter/renderer contracts, mixed/XI/fallback matches, identity immutability, historical/unrated receipts, archive replay, a complete 56-day lifecycle and independent desktop/mobile match/statistics loading. Browser emulation is not physical iPhone Safari certification.
