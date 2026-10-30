# Account form usability implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all six account-page improvements approved by the user on 30 October 2026.
**Architecture:** Extend existing account UI and shared dropdown binder. Use static control markup and current CSS tokens; retain server-owned auth and per-tab login returns.
**Tech Stack:** Static HTML/CSS, browser JavaScript, Node and Playwright.
**Spec:** User-approved six-point proposal in conversation; existing account-app-profile design.

## Global constraints
- EN/DE/ES/FR/IT, dark/light, mobile and keyboard support.
- Keep current auth APIs, neutral focus, nonselectable labels, selectable inputs, first-paint geometry and clean login URLs.
- Username: 3–24 ASCII letters/digits/underscore; new passwords: minimum 15 characters. No live availability endpoint.
- Generic registration/recovery confirmations; no account enumeration or claims that email was delivered.
- Draft/HOLD, no deployment, remote D1 or email. Exclude frozen club registry.

## Review focus
- Password visibility survives locale changes but resets when forms reset.
- Multiple invalid fields have separate descriptions; correcting one retains unrelated errors and existing help.
- Country searches with accents, empty results and keyboard selection cannot submit the registration form.
- Optional fields remain visible, optional and inside the same form.
- Success instructions localize and never turn 503/network failures into success.

### Task 1: Account input assistance
- [x] Add failing browser cases for visibility, blur/submit errors, description retention and live requirements.
- [x] Add static password controls and live requirement text; shared localized toggle and field-error APIs in account-ui.js.
- [x] Group optional registration fields in a subdued fieldset; retain visible country/city controls.
- [x] Verify new cases and account feedback/first-paint cases.

### Task 2: Searchable country dropdown
- [x] Add failing browser cases for accent-insensitive search, no results, Escape, keyboard selection and empty-value reset.
- [x] Add search header outside the listbox, retaining shared language-menu/options styles.
- [x] Extend faBindCompetitionMenu with optional search support; filter visible choices and guard empty selections without changing other menus.
- [x] Verify shared control and account-page suites.

### Task 3: Completion instructions and final integration
- [x] Add failing cases for generic 202 registration/recovery instructions, password-reset completion and 503 failures.
- [x] Localize explicit next steps and emphasize existing sign-in links after success.
- [x] Run new browser matrix, existing account, focus, profile/return and targeted Node checks; add CI coverage.
- [x] Review diff, preserve Draft/HOLD, and publish to PR #329.

## Validation evidence
- Account usability: 27 browser scenarios PASS (5 locales, light/dark, mobile/desktop, localized password visibility, country search/keyboard/empty results, field errors, generic recovery/reset instructions, pending account mutations).
- Existing account pages 35, feedback/first-paint 21, shared focus 12 and Profile/return journeys 25 browser cases PASS; 98 safe-return assertions PASS.
- Clubs full browser regression PASS; targeted Node 90/90 PASS; generator check 23/23 PASS; whitespace check PASS.
- Independent review found submit-button selection affected by new visibility controls. Reproduced with a failing browser regression, corrected explicit submit selection and single-flight guard; focused review confirmed the fix.
- No new complete Site/Worker or remote CI PASS claim. Original #170 checklist remains 12/15 (80%).
