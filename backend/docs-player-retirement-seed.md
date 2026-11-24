# Private retirement age (PLAYERS-01 #390)

Owner clarification: generate the player's actual future retirement age once at confirmed creation. Keep it private, independent of development aptitude, attributes, generation seed and valuation. Do not expose it in Admin preview/list/draft responses or public APIs.

Approved conditional probabilities, based on age reached at season end:

| Age reached | <=32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Retirement chance if still active | 0% | 2% | 5% | 12% | 25% | 45% | 70% | 90% | 100% |

At confirmation, run the independent annual draws in order, stopping at the first success; store the resulting integer `retirement_age` (33–40) in generated_players.payload_json. The age does not depend on the user-visible preview seed and is never redrawn on replay. This samples the same distribution as annual independent conditional draws. Public market valuation must not use the actual private retirement age.

Historical migration ID 36 stored a temporary `retirement_seed`. Migration 0037 converts existing players to the intended representation, assigns ages only where absent or null and removes the obsolete seed. Existing assigned ages are preserved. The verified DEV cohort is 150 players aged 16–19, none retired. Inspect cohort age/status before running against another environment. No remote application without the coordinated migration-name reconciliation and explicit environment authorization. No lifecycle, career status, contract or mandate effects are introduced here; season-end processing should later use the stored age.
