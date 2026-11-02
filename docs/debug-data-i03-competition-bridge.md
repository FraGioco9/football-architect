# I03 — Opt-in DEV competition source bridge

**Default OFF.** The source bridge is delivered only on loopback DEV competition pages when both `FA_DEBUG_I03_PROTECTED=1` and `FA_DEBUG_I03_BROWSER_BRIDGE=1` are set. The virtual module endpoint itself enforces the same flags. It is never a public artifact and never runs on hosted preview.

The bridge reads current DEV season/day/competition, requests protected projections only through an already-established host-scoped HttpOnly session, and emits `fa:protected-debug-source-change` or `fa:protected-debug-source-unavailable`. It cancels previous requests and rejects stale responses. Debug OFF emits `kind:global`; Debug ON Season 0 emits `kind:debug-unstarted` and never substitutes Season 1.

The old DOM data consumers are **not replaced** here. This is the opt-in event producer only; no table or fixture is yet rendered from the protected source. A follow-up I03 block must connect each consumer after defining the exact per-page projection schema. A missing/expired session must not trigger an automatic fallback to old fictional outcomes.

Manual bootstrap remains outside browser assets via `POST /__fa_dev_private__/session` with owner bearer. Never embed the bearer in HTML, JS, query strings or local/session storage. Browser behavior and security validation are outstanding for I06.
