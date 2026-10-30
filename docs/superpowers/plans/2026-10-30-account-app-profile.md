# App account experience Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Work stays in the existing PR #329 Draft/HOLD.

**Goal:** Deliver styled app-only account entry with persistent language and an atomic unique registration username plus optional nationality and city.
**Architecture:** Reuse the established account Worker and static frontend. Add a small shared account UI module/CSS and additive D1 profile migration; keep authentication and permission boundaries authoritative in the Worker.
**Tech Stack:** Existing HTML/CSS/JavaScript, TypeScript Worker, D1 SQLite, Node test runner, Vitest and Playwright.
**Spec:** docs/superpowers/specs/2026-10-30-account-app-profile-design.md

## Global Constraints
- App subdomain for account entry; local app.localhost:2000. No invented production domain.
- EN/DE/ES/FR/IT; saved language takes priority over browser language.
- Required unique username; proposed format 3–24 ASCII letters/digits/underscore, case-insensitive.
- Optional validated country code and optional trimmed city, maximum 100 Unicode characters.
- Existing email/password access, verified identity, permissions and historical audit principals preserved.
- Draft/HOLD; no remote D1, provider setup, outbound email, merge or deploy.
- Focused implementation checks; final full CI exact-head acceptance remains separate.

## Review Focus
- Existing accounts with no profile survive additive migration and continue to log in.
- Cross-origin language survives localhost to app.localhost without sharing localStorage directly.
- Verification/reset tokens survive trusted host handoff without being logged or copied into unrelated links.
- Concurrent case-variant usernames create at most one account and retain no orphan profile/token.
- Language changes preserve typed fields, busy state and localized feedback.

### Task 1: Registration profile and atomic uniqueness
Files: create backend/migrations/0016_player_profile.sql and backend/src/player-profile.ts; modify backend/src/player-registration.ts, registration runtime fixtures, and migration contracts.
Interfaces: parseRegistrationProfile(input) returns display username, normalized username, nationality|null and city|null; registerPlayer consumes validated fields in the existing atomic account/token insert.
- [ ] Add failing migration tests: old identity preservation, case-variant uniqueness, nullable old profiles, account deletion and transaction rollback.
- [ ] Add failing registration tests: missing/invalid username, optional blanks, country validation, Unicode city length, unknown-field rejection, collision and concurrent collision, delivery failure cleanup.
- [ ] Implement additive nullable profile columns with a unique normalized username key and validation constraints. Keep new-profile enforcement in the registration boundary; do not require old fixture/account backfill.
- [ ] Extend registration with an explicit allowed field set and atomic conflict handling. Preserve generic duplicate-email responses, existing throttling and provider-off 503.
- [ ] Update existing self-service registration fixtures to include explicit unique usernames.
- [ ] Run focused Python migration and Vitest registration/security checks. Record actual failures and results.

### Task 2: Shared account style, host and language behavior
Files: create assets/account-ui.js and assets/account.css; modify assets/landing.js, assets/app.js, tools/dev-standings-preview.mjs and account link producers as required by existing routing conventions.
Interfaces: shared account UI exposes current supported language, a language-change subscription and a trusted app account-link builder; use football-architect:language and existing trusted app-origin configuration.
- [ ] Add failing behavior tests for trusted host conversion, invalid origins, safe return values, language transfer and stored preference precedence.
- [ ] Implement branded account header/form layout using existing logo, CSS tokens, theme.js and an accessible five-language control.
- [ ] Update trusted site-to-app links to carry only supported language values. Reject arbitrary host/redirect query values; preserve only necessary one-time credentials during direct account handoff.
- [ ] Enforce local site-host account redirection before serving forms. Apply matching hosted routing rules only through the repository's approved host/config mechanism, with exact publication oracle updates for intended differences.
- [ ] Verify no form or account API request executes on the site host, no redirect loops, and no credentials leak to unrelated links.
- [ ] Run focused routing, publication and shared-UI contract checks.

### Task 3: Account forms and final integration
Files: account/{index,login/index,register/index,recover/index,verify-email/index}.html; assets/account-{login,onboarding,recovery,verification,settings}.js; relevant Node/Playwright contracts.
- [ ] Add failing browser tests for dark/light at 320/390/1440, five locales, keyboard control and preserved input on language change.
- [ ] Apply shared account chrome to all five pages; preserve existing account management actions.
- [ ] Add required username and optional localized nationality/city controls to registration. Send the exact backend payload and display localized collision/validation states.
- [ ] Replace navigator-only locale initialization with shared account locale handling and update all labels, errors and status messages dynamically.
- [ ] Keep safe return allowlist, CSRF, provider-off state and one-time token scrubbing intact.
- [ ] Run focused frontend/backend checks, then inspect actual rendered account pages. Record any browser/runtime limitation honestly.
- [ ] Review the whole diff, update issue/PR evidence and leave original checklist items open until their full acceptance criteria pass.
