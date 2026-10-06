# B-PC03 — immediate transition after new career creation

Manual clean-PC finding: creating a new career persisted correctly but left the onboarding screen visible until refresh.

Root cause: efresh(message) skipped ender() whenever a toast message was supplied.

Fix: render after every successful save, then show the optional toast.

RST-01 A02 hardening: after clicking start-career, the dashboard must become visible without any second action or reload.

Targeted gate: Chrome + Edge on Node 20 and Node 24.

Baseline ZIP SHA-256: 686f3abaea01807b04d1811da093f6b017eb372f1abb57e6788e6d52bc78d74c

Patched candidate SHA-256: $env:NEW_HASH

No deploy.
