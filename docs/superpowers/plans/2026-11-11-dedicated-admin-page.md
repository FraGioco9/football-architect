# Dedicated Admin page implementation plan

**Goal:** Move existing World administration from Settings to `/admin`, following the Account/Settings shell, and remove the old Settings view.
**Architecture:** Reuse the existing controller and protected API contracts. Generate a standalone static Admin shell; Settings contains preferences only. Expose the Admin sidebar link only after a live permission check; public navigation never calls Admin APIs. On `/admin`, reuse the controller's verified permission state for navigation.
**Scope:** Existing season/calendar operations, reviews and reset. No new backend permissions, database changes, deployments or automatic world mutations.

## Task 1: Route and page migration
- [x] Add failing route/publication and Settings-removal checks.
- [x] Generate `admin/index.html` using the shared shell and `renderAdminSettings`; mount the controller directly on this route.
- [x] Add `/admin` to routing/publication and recognize its active page in the shell.
- [x] Move browser/lifecycle fixtures from the retired Settings query to `/admin`; explicitly test the old query shows normal Settings without Admin calls.

## Task 2: Navigation and presentation
- [x] Test permission-gated navigation for anonymous, denied, read-only and write-enabled users.
- [x] Add the Admin sidebar entry using the shared navigation script and live account permissions. Recheck restored pages and remove stale links on denial.
- [x] Style the standalone page with shared panel/control tokens and responsive wrapping. Retain disabled operations, typed reset and snapshot approval.

## Task 3: Verification and review
- [x] Run focused Node route, Settings, Admin controller, permission and publication contracts.
- [ ] Run browser matrix including old Settings URL, direct Admin denial, read-only/write-enabled users, sidebar navigation, responsive geometry and safe local operation stubs.
- [x] Check generated output, review the diff, group changes into one commit and open one Draft/HOLD PR against current main.

## Review focus
- Direct access without permission must never reveal world/controls or issue mutations.
- Session revocation must disable controls and remove navigation access.
- Read-only Admins must see the world but cannot mutate it.
- Old `/settings?view=admin` must never mount administration.
- Local and published `/admin` must resolve through the public allowlist; protected APIs remain independently authorized.

## Review record

Independent review found that a `403 permission_denied` after a previously authorized mutation retained cached grants. Corrected by clearing Admin authority on this explicit authorization failure and propagating permission loss from event/proposal reads. Two Node regressions failed before the correction and pass afterward; browser coverage includes this separate 403 case. Navigation uses one live account-permissions GET on public app documents, no Admin API calls; `/admin` reuses its controller permission read.

Local browser execution is blocked by the execution environment (Chromium socket creation denied). Browser contracts are assigned to both Chromium and WebKit GitHub Actions jobs; owner visual QA remains pending.

Verification before PR: 136 focused Node checks PASS; generated output check PASS; CI test discovery PASS. Browser execution awaits exact-head GitHub Actions.

## Owner refinement — empty unauthorized Admin content

Keep `#app-admin` hidden in generated HTML and enforce its hidden display in the scoped stylesheet. Reveal the content only after the controller verifies its actor and Admin read grants. Signed-out, denied, failed checks and revoked states show no Admin title, panel, sign-in prompt or error message. Shared navigation remains available. Updated browser journeys to use the existing Profile entry for login and return to `/admin`. Follow-up: 77 focused Node checks PASS; generation and discovery PASS; browser checks pending CI.

## Owner refinement — compact operator interface

Default view shows Calendar with season/day/phase, Refresh, the next event and only currently available write actions. Hide unavailable/unauthorized command buttons; retain disabled single-flight behavior while an action is pending. Remove the introductory paragraph and lifecycle tutorial. Move actor, generation/revision, operation diagnostics, closure evidence, legacy calendar generation and event rescheduling into closed Details. Keep destructive reset in its own closed disclosure and show it only to writers with an existing season; typed confirmation remains mandatory. The full qualification review remains available when required. Track future 404/redirect work separately in #485.

## Owner refinement — remove Details, preview next-day simulations

Remove the Details section and its metadata/legacy/rescheduling controls from the UI. Keep protected reset and mandatory membership approvals. Show the destination day and I-x/D-x rounds before an available advance, using `assets/world-calendar-model.js`, the same calendar imported by backend sporting progression. Require matching authenticated world/event authority and published calendar before a sporting preview; hide unverifiable previews instead of inventing an empty day. Explicitly label verified non-match days. No new API call or mutation. Covers double matchdays, domestic-only days, both international finals, pauses, day 56, stale and unpublished states.

Verification for the next-day preview refinement: 79 focused Node checks PASS, generated output and discovery PASS. Chromium/WebKit browser regressions cover the preview before/after advance, a non-match day and stale calendar evidence; runtime results await exact-head CI.

## Owner refinement — inline reset and explicit daily prerequisites

Reset is a normal visible section when applicable, with its typed confirmation unchanged. Place busy feedback next to Refresh, independently of top-level result/error messages. Both frontend command availability and backend administrative advancement reject incomplete current or overdue actions; advancing no longer completes administrative actions automatically. Explicit event commands keep their own receipts/transactions. Existing world/event-row CAS, authorization, replay and rollback guards remain. Update both-season browser journeys and Worker tests to perform actions before advancing. Independent review found no important/critical defect; stale operator guidance was corrected.

Verification for explicit daily prerequisites: 80 focused frontend/publication checks, 97 backend Node contracts and 24 real local Worker/D1 tests across five impacted suites PASS; backend typecheck, generator and test discovery PASS. Worker tests cover rejection with zero/partial completion, explicit publication handoff, rollback, competing revisions, moved milestones, forged/missing evidence, credential revocation and approved Season 2 progression. Browser UI verification remains assigned to exact-head CI.
