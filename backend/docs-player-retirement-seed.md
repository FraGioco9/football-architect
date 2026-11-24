# Private retirement seed (PLAYERS-01 #390)

The approved end-of-season conditional retirement probabilities by age reached are:

| Age reached | <=32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Retirement chance | 0% | 2% | 5% | 12% | 25% | 45% | 70% | 90% | 100% |

Each persisted player gets a **private permanent 128-bit hexadecimal `retirement_seed`** once. Newly confirmed players get one in the atomic commit, independent of generation options and `development_aptitude`; migration 0034 backfills existing records only if the field is absent, leaving every other value untouched. Preview/draft and public API payloads must never expose this seed.

This is **not a predetermined retirement age, static retirement propensity, or current retirement decision**. Future season-end retirement execution must independently derive a distinct reproducible draw from the private seed *and the applicable season / reached age*, then compare to that season's approved conditional probability; it must not consume the same fixed uniform value every year. Define replay, idempotency and lifecycle side effects separately before implementation. No `career_status` transition or contract effect is introduced here.
