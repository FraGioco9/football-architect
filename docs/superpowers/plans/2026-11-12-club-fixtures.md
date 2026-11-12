# Club Fixtures Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; execute inline under the owner's approved #504 specification.

**Goal:** Implement the individual club's chronological season Fixtures with existing presentation and canonical sources.
**Architecture:** Reuse authoritative competition validation and the per-world Club read cache; aggregate only the club's verified memberships. Keep presentation pure, mount controls inside the retained club shell, and fence asynchronous reads by world/source/season identity. Protected DEV reads use existing deterministic preview adapters and calendar bindings.
**Tech Stack:** Vanilla JS/ES modules, generated HTML/CSS, Node test runner, Chromium CDP.
**Spec:** Issue #504 and owner prompt (2026-11-12); design already approved, no new design approval requested.

## Global Constraints
- Canonical sporting days only; no invented dates/results/participants or future scores.
- Existing five tabs/header, fonts/tokens/dropdowns/tooltips/crest skeletons, EN/DE/ES/FR/IT and themes.
- One task branch, grouped commits, one English Draft/HOLD PR. No merge/deploy/remote database writes.
- Base: origin/main ff83a2a. Existing checkout's local registry changes preserved in a separate worktree.
- Open PRs #481/#454 inspected: avoid their shared app CSS/backend/DEV routing/CI ownership files. No overlapping feature implementation.

## Review Focus
- Wrong-world or late responses after a tab/source/season change.
- Future results, away perspective, shootout scores, neutral finals.
- Season 0, missing membership/calendar and partial competition failures.
- First paint before manifest or deferred scripts resolve.
- Direct URLs, refresh, Back/Forward, mobile overflow and keyboard controls.

### Task 1: Canonical fixture projection
- [ ] Add failing tests in tests/authoritative-season.test.mjs using its canonical fixture factory: club-only selection, stable same-day ordering, future score rejection, partial competition errors and Season 0.
- [ ] Implement assets/club-fixtures-source.mjs: readClubFixtures({clubKey,season,world,fetchJson,manifest,signal}) and projectClubFixtures(fixtures,clubKey,season,day). Reuse validateAuthoritativeSeason and verified club history memberships.
- [ ] Run node --test tests/authoritative-season.test.mjs; commit with plan and update #504.

### Task 2: Club Fixtures UI and adapters
- [ ] Add failing pure-renderer tests in tests/club-pages.test.mjs for translated controls, opponent-only score perspective, venue tooltip labels and unknown participants.
- [ ] Implement assets/club-fixtures.js pure renderer, assets/club-fixtures-controller.mjs, generated first-paint shell, club-page integration and scoped CSS; publish the new assets through the existing allowlist.
- [ ] Add protected DEV fixture projection to tools/dev-competition-stats-client.mjs using existing preview/calendar readers; preserve unavailable international coverage.
- [ ] Run targeted Club/source/generation/fixtures tests and generator consistency; commit and update #504.

### Task 3: Browser and QA evidence
- [ ] Extend existing Club Chromium test for season/filter/navigation/loading/venue focus and responsive locale/theme coverage.
- [ ] Run targeted browser and regression checks. Inspect final diff; fix material findings with reproducing tests.
- [ ] Add docs/clubs/club-fixtures-qa.md separating automatic evidence from manual physical Safari/VoiceOver checks and unavailable coverage.
- [ ] Commit QA; update #504; push once and create one English Draft/HOLD PR; inspect automatic CI without redispatch.

## Execution ledger
- Preflight complete: remote main fetched, AGENTS.md read, two open PR file lists inspected. Native worktree tools unavailable; isolated worktree created at /workspace/football-architect-504.
- Owner explicitly authorized execution and supplied approved design; no additional plan/design confirmation needed.
