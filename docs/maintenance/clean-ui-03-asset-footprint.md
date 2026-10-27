# CLEAN-UI-03 — declared asset footprint audit

This is a **local source footprint**, not network transfer size or browser performance. For each HTML route, the tool resolves absolute `/assets/` and relative `../assets/` links against that page, normalizes query/hash variants, deduplicates underlying files, and sums safe integer filesystem sizes. Non-local and traversing paths cannot be read from disk. Missing or invalid sizes are *unresolved*, not zero-byte resources. The Guide route is now covered alongside Dashboard, Calendar, Settings, Competitions, Clubs and domestic detail.

Command: `node tools/measure-declared-assets.mjs dashboard/index.html calendar/index.html settings/index.html competitions/index.html clubs/index.html competitions/it-1/index.html guide/index.html`.

The previous six-route baseline in this PR remains **historical and provisional** until the complete local test suite is run. These numbers cannot justify removing shared `landing.js` or `landing.css`, changing script execution order or claiming network savings. Remaining P4 performance acceptance requires browser request tracing, transfer-size/caching measurements and interaction/DEV-public isolation regression verification; that item stays unchecked.
