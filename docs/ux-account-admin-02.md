# UX-ACCOUNT-ADMIN-02 — implementation contract

Issue: #336. Draft/HOLD from main after #335.

## Screens and routing
- Keep regular /settings only for personal, visual, language and local developer preferences.
- Dedicated /admin contains world management controls. Auth and authorization remain server-side; unauthorized access gets a safe forbidden state without world data.
- Canonical Player paths remain /account/login, /account/register, /account/recover, /account/verify-email and account/profile pages. Existing login return logic must remain same-origin and path-safe.
- All five languages (EN DE ES FR IT), desktop/mobile layouts and accessible keyboard navigation.
- Static HTML is generated from the canonical template/generator; don't maintain two competing renderers.

## Debug Settings
- Single toggle in Settings, off by default. Available only on loopback local builds, not Preview/Production.
- Toggle gates visibility AND runtime use of developer-only controls; no debug state or URLs leak into published artifact.
- Persist in current developer session only; existing Season 0–30 debug calendar remains local-only.

## Account experience
- Shared design tokens, consistent labels/fields/errors, show/hide password, predictable first paint, responsive no-scroll where practical, no hover when pointer is only over a label.
- ESC closes dropdown and drops focus; no trailing slash routing; keep text input selectable.
- Use safe no-referrer/no-store policies for token-bearing pages and preserve one-time token handling.

## Admin isolation
- Relocate existing server-authorized world UI from Settings to /admin without replacing established permission checks or CSRF.
- Show sidebar Admin navigation only on confirmed server-derived `admin.access`, never on local-only Boolean state.
- No remote D1, mail provider changes, production deploy, or merge in this work without authorization.

## Acceptance
- Generator parity, publication guard, exact-head, Player/Admin tests, screen and keyboard QA at 320/390/768/1440 and Chromium/WebKit; broad tests at final gate.
