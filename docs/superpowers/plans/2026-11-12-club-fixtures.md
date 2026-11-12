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
- [x] Add failing tests in tests/authoritative-season.test.mjs using its canonical fixture factory: club-only selection, stable same-day ordering, future score rejection, partial competition errors and Season 0.
- [x] Implement assets/club-fixtures-source.mjs: readClubFixtures({clubKey,season,world,fetchJson,manifest,signal}) and projectClubFixtures(fixtures,clubKey,season,day). Reuse validateAuthoritativeSeason and verified club history memberships.
- [x] Run node --test tests/authoritative-season.test.mjs; commit with plan and update #504.

### Task 2: Club Fixtures UI and adapters
- [x] Add failing pure-renderer tests in tests/club-pages.test.mjs for translated controls, opponent-only score perspective, venue tooltip labels and unknown participants.
- [x] Implement assets/club-fixtures.js pure renderer, assets/club-fixtures-controller.mjs, generated first-paint shell, club-page integration and scoped CSS; publish the new assets through the existing allowlist.
- [x] Add protected DEV fixture projection to tools/dev-competition-stats-client.mjs using existing preview/calendar readers; preserve unavailable international coverage.
- [x] Run targeted Club/source/generation/fixtures tests and generator consistency; commit and update #504.

### Task 3: Browser and QA evidence
- [x] Extend existing Club Chromium test for season/filter/navigation/loading/venue focus and responsive locale/theme coverage.
- [x] Run targeted browser and regression checks. Inspect final diff; fix material findings with reproducing tests.
- [x] Add docs/clubs/club-fixtures-qa.md separating automatic evidence from manual physical Safari/VoiceOver checks and unavailable coverage.
- [x] Commit QA; update #504; push once and create one English Draft/HOLD PR; inspect automatic CI without redispatch.

## Execution ledger
- Preflight complete: remote main fetched, AGENTS.md read, two open PR file lists inspected. Native worktree tools unavailable; isolated worktree created at /workspace/football-architect-504.
- Owner explicitly authorized execution and supplied approved design; no additional plan/design confirmation needed.

- Task 1 complete: 46508c2, source test RED→GREEN, 16/16 at first milestone.
- Task 2 complete: focused source/presentation/history/loading regression 101/101; targeted Chromium PASS including API/Debug, pending tab switch, refresh/history, focus/tooltips, stable controls and responsive locales/themes. Generator --check and CI discovery PASS.
- Independent final review: two P2 findings (focus loss during redraw and parser-time locale labels), both fixed with RED→GREEN tests. Screenshot review additionally found repeated opponent crest-host reuse; fixed with 15-vs-30 reproducer and passing Chromium rerun.
- Scope clarification: public API currently supports seasons 1–2; DEV adapter exposes domestic fixtures/postseason only. Missing international DEV snapshots stay explicit partial coverage. No new draw, fixture or result authority introduced.

- Task 3 QA: final targeted Node 118/118 and dedicated Chromium 1/1 PASS; generator/discovery/syntax/diff checks PASS. Existing broader Club browser test hit its 300-second timeout; unchanged main ff83a2a also timed out at the same 300-second limit. Physical Safari, VoiceOver and hosted/owner acceptance remain UNKNOWN.
- Final source-read audit: unknown canonical season uses reserved placeholder, never guessed Season 1; confirmed unavailable state removes loading placeholder. Both cases covered by RED→GREEN tests.

- Delivered one Draft/HOLD PR #529. Final icon audit corrected the away glyph to an actual airplane; unchanged-main browser comparison confirmed the same 300-second timeout. This follow-up is a fourth grouped venue/evidence correction; its automatic CI cycle supersedes the initial PR head, with no manual rerun.


## Owner-approved follow-up — toolbar / History / season policy
- [x] Reproduce Debug History publish → shell repaint → Fixtures request loop, then gate/deduplicate active Fixtures preview requests (22d28e0). Bounded Chromium regression RED→GREEN.
- [x] Next-match left; Competition then Season right; 14px tab separator gap; no Fixtures notice or its visible messages. Keep pending skeletons and internal data/source state.
- [x] Align viewed season policy with Standings: positive 1..current, minimum viewable 1 at canonical world 0, descending menu, latest default, invalid/zero→1, future→current, canonical URL replacement after clock confirmation.
- [x] Test public/DEV world 0/1/2, closed season, cold/warm History, source change, Back/Forward, first-paint geometry and locale/theme widths. 123 targeted Node checks and dedicated Chromium PASS; independent review no material findings.
- [ ] Physical Safari/VoiceOver and owner visual acceptance remain separate manual checks. No merge/deploy/remote DB authorization.
