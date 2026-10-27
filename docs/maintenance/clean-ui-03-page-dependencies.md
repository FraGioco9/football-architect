
# CLEAN-UI-03 — generated route dependency verification

PR #323 / issue #322, checkpoint 19. Use `node tools/audit-page-dependencies.mjs dashboard/index.html calendar/index.html settings/index.html competitions/index.html clubs/index.html`.

This read-only command loads actual checked-in HTML script references and follows only literal relative JS imports inside local `/assets/` files. External scripts, non-local paths, unavailable files, package-style imports and other cases remain explicitly unresolved. It is not a JavaScript parser, does not recognize computed imports or dynamically injected scripts, and cannot certify that a resource is unused. It does **not** modify HTML, CSS, scripts, generators, manifests, assets or publication configuration.

Tests exercise transitive imports, path guards, missing modules and real page discovery. The owner requests final-only CI acceptance for the Draft PR; no manual workflow dispatch or merge/deploy is authorized.
