# B-PC03 — immediate transition after new career creation

Manual clean-PC finding: creating a new career persisted correctly but left the onboarding screen visible until refresh.

## Root cause

`refresh(message)` saved the career but skipped `render()` whenever a toast message was supplied. `start-career` sets `ui.page='dashboard'` and calls `refresh("Benvenuto…")`, so the state changed while the old onboarding DOM remained visible.

## Fix

After every successful save, `refresh()` now renders first and then shows the optional toast.

RST-01 A02 is hardened so that after clicking `start-career`, the dashboard must become visible without any second action or reload.

## Targeted gate

- Chrome + Edge on Node 20: PASS
- Chrome + Edge on Node 24: PASS
- one click on `start-career`
- no refresh or second action before dashboard assertion
- primary IndexedDB career persisted and Continue flow verified
- no deploy

Baseline ZIP SHA-256:
`686f3abaea01807b04d1811da093f6b017eb372f1abb57e6788e6d52bc78d74c`

Patched candidate ZIP SHA-256:
`4e7b354176f4633958b3f0e7c525fddd057294dc3cbc3a5027bbcf87a5de518e`

Targeted gate run: `37459759961`.
