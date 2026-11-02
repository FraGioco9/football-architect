# I03 shared browser source coordinator

The new `tools/dev-protected-debug-source.mjs` is an **opt-in client coordinator**, currently **not injected into pages**. It listens to existing `fa:debug-mode-change`, `fa:dev-progress-change`, `fa:dev-world-day-change` and `fa:competition-route-change` signals, as well as page restoration.

- Debug OFF or Season 0: immediately clears the candidate projection and emits `fa:protected-debug-source-change` with `kind:"global"`.
- Debug ON, Season 1–5 and a supported competition route: requests the protected local endpoint through the host-scoped HttpOnly session, with `credentials:"same-origin"`, without embedding or serializing an owner token.
- Stale responses are discarded using monotonic revisions and `AbortController`; settings changes do **not** reload pages.
- An unavailable local session emits `fa:protected-debug-source-unavailable`; it never silently substitutes fictional scores or writes to D1.
- This module does not directly replace the current DOM / standings source. Wiring and security/visual verification remain an explicit further I03 gate.

This file is **not in the public artifact allowlist**, and must not be added to public HTML or static asset bundles. Deployment remains disallowed.
