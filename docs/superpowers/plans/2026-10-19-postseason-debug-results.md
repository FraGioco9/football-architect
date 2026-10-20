# Post-season Debug Results Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, followed by one whole-branch review.

**Goal:** Add Debug matchdays 31–33 and render deterministic play-off/play-out results across all eight countries, plus accessible score-header tooltips.

**Architecture:** Keep the league at 30 rounds. Extend only private Debug progress to 33 and generate post-season fixtures independently from the immutable final league ranking. The public bracket accepts prepared results but never generates fictional data.

**Tech Stack:** Plain JavaScript, Node built-in tests, static generated HTML/CSS.

**Spec:** User request of 19 October 2026: day 31 first legs; day 32 return legs; day 33 promotion final. Existing Rules define the venue, aggregate, extra-time and penalty rules.

## Global Constraints

- Eight Tier 1 play-outs and eight Tier 2 promotion play-offs, in all five interface languages.
- Home grounds: lower seed hosts the first leg; better seed the return; better-ranked finalist hosts the final.
- No away-goal weighting. Resolve a tied aggregate/final with extra time and then penalties.
- League fixtures, standings and Stats remain at 30 matchdays. League History remains based on the completed regular season.
- Keep all fictional generation in the existing private DEV data module. No manifest, catalogue, workflow, database, merge or deployment changes.

## Review Focus

- Progress 29/30/31/32/33 must reveal only played matches, and rolling back must clear later results and finalists.
- Past seasons must resolve to completed post-season day 33; future seasons must not leak participants or results.
- Extra-time goals count in the aggregate; shoot-out goals do not.
- Season switches and failed refreshes must preserve snapshot/restore semantics.
- Tooltip labels must work with hover, keyboard focus, tap, Escape and language changes.

## Task 1: Private progress and deterministic generation

**Files:** `tools/dev-standings-preview-data.mjs`, `tests/postseason-preview.test.mjs`, existing Debug control tests.

**Interfaces:** `DEBUG_MAX_MATCHDAY = 33`; `previewSeasonProgress(season, progress)` returns 0–33; `previewSeasonMatchdays` still returns 0–30; `createPreviewPostseason(division, matchday, season)` returns visible ties, final and winner.

- [x] Write failing tests for all 16 divisions, four seasons and progress boundaries.
- [x] Implement deterministic two-leg ties and final with extra time/shoot-outs.
- [x] Verify stage visibility, venues, aggregate accounting and stable league snapshots.

## Task 2: Bracket rendering, Debug integration and tooltips

**Files:** `assets/competition-page.js`, `assets/app.js`, `assets/app.css`, `tools/render-competition-page.mjs`, `tools/dev-standings-preview-client.mjs`, generated competition documents.

**Interfaces:** `faPostseason.prepare(rows, results = null)` validates before returning a commit function; `snapshot()` restores rows and results together.

- [x] Add DOM regression tests for scores, finalists, winner, rollback and reset.
- [x] Render staged scores and localized extra-time/penalty summaries; preserve mirror/seed layout.
- [x] Extend slider/input maximum to 33 and feed selected-season post-season progress into the bracket.
- [x] Add translated header tooltips and keyboard/touch dismissal.
- [x] Regenerate HTML and verify consistency.

## Task 3: Integration and exact-head CI

**Files:** `tests/g10-public-02-browser.test.mjs` plus the existing tests affected by the new Debug range.

- [x] Change invalid Debug input coverage from 31 to 34 and exercise 31–33 in the browser integration test.
- [x] Run targeted and full tests; report environmental browser limitations explicitly.
- [ ] Request whole-branch review, update PR #220, and verify exact-head CI without merging or deploying.

Local validation: 229/231 tests pass; the two browser tests require Chrome, unavailable locally. Whole-change review found no critical or important issues. Addressed both minor tooltip accessibility findings and reran the eight runtime tests successfully. Exact-head browser and full-suite CI pending publication.
