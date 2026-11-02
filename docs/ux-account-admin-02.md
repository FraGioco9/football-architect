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

## Global progress audit — 2026-11-02

Authoritative progress is the durable `world_state` singleton projected by `GET /api/world`: `seasonNumber`, `day`, `phase`, `generation`, `revision`. Unstarted world is Season 0 / Day 0; preparing seasons use Day 0; active seasons use Days 1–56. Browser controls never advance this state. Debug OFF must ignore retained local progress and fictional-provider flags. Unavailable global data must not be replaced by simulated results.

This block corrects navigation retaining local season/card metadata, competition season menus failing to return from Debug to global choices, and club summaries having no authoritative producer. Club summaries read and validate both national divisions at the current global season, then commit only if world generation/revision/day remain unchanged. Club position and next fixture use real published standings and the current day; a source toggle invalidates late responses. Club updates replace the competition summary and current-division label without reloading the document. Calendar retains its validated world clock while loading a different day's details and omits loading text.

Audited paths: shared shell/sidebar and competition directory links; domestic/international competition contexts and downstream standings/fixtures/stats/history; calendar season/week/day selection; all club routes and the club overview summary; directory, Dashboard, Settings and account pages. Identity/catalogue-only pages have no sporting progress reader. Existing deliberate historic-season navigation remains supported; Debug OFF defaults to the global season, while an explicit historical selection is a view of that season, not a change to the global clock.

Remaining functional limits discovered by the audit:
- Club Roster, Fixtures, Stats and History panels are existing unavailable-data placeholders, not implemented authoritative views.
- The club directory's division filters/labels still use provisional catalogue membership; they are not a live global-season membership projection. This block resolves current membership for individual club summaries when both global division payloads are published.
- Public sporting projections currently support Seasons 1–2; unsupported/unpublished seasons remain explicit empty/unavailable states.
- No live remote `seasonNumber` / `day` values were read or changed in this audit.

Validation: 121 focused Node tests PASS, including authoritative season/calendar/history, club model, source toggles, global navigation, publication gate, API proxy and clock contracts. Updated obsolete assertions that expected cleared tables or a removed reload mechanism. Browser QA remains UNKNOWN: no browser binary was present and the Chromium download returned a truncated archive. Full exact-head CI remains deferred to the final gate; Draft/HOLD, no merge/deploy/remote D1/email changes.

### Source-switch presentation correction

Debug ON/OFF retains the last committed panel while the replacement source loads. Removed live transition CSS that hid competition/calendar panels, stopped blanking club summaries, and separated pending competition contexts from committed presentation updates. DEV teardown disposes listeners without restoring placeholders; statistics wait for their aggregate and History for its replacement. Obsolete DEV loads cannot repaint after Debug OFF. A confirmed empty Season 0 still commits its real empty state, rather than retaining scored standings.

Validation for this follow-up: 103 focused Node tests PASS, including pending/committed context behavior, non-destructive teardown, aggregate readiness and completed Season 0 publication. Real-browser QA remains pending as above.
