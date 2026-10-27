# CLEAN-UI-03 — declared asset footprint baseline

Read-only source-byte baseline from the Draft #323 repository tree. All figures below sum **raw checked-in blob sizes of directly referenced /assets links**, counting each unique path once per page. They do **not** represent gzip transfer bytes, dynamic network requests, cache effects, browser startup time, main-thread execution or performance improvements.

| Route | Direct script/style asset references | Raw asset bytes |
| --- | ---: | ---: |
| Dashboard | 9 | 233,327 |
| Calendar | 14 | 284,852 |
| Settings | 9 | 233,327 |
| Competitions index | 11 | 237,612 |
| Clubs index | 14 | 271,449 |
| Domestic competition IT-1 | 9 | 217,223 |

All six inspected route families have zero missing local /assets paths. Repeat with `node tools/measure-declared-assets.mjs dashboard/index.html calendar/index.html settings/index.html competitions/index.html clubs/index.html competitions/it-1/index.html`.

**Decision:** no selective loading changes can be defended from raw bytes alone. The Calendar has additional model/rendering code and Clubs extra directory scripts; competition detail already replaces generic app bootstrap with competition-specific scripts. Preserve script order, language/theme initialization and the public/DEV isolation gates. Do not trim landing.css or landing.js on the basis of filenames. The existing P4 network/behavior item is **still OPEN** until real browser request/transfer-size capture and responsive/keyboard test evidence; this is only the reproducible source baseline. No new checklist items or deploy.
