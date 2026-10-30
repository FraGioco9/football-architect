# Shared account controls and Profile sidebar — 30 October 2026

Account panels use the existing app-panel component and site CTA buttons. Language and nationality use the exact language-control / language-trigger / language-menu / language-option components, bound by the existing faBindCompetitionMenu from competition-tabs.js. Native selects remain hidden form state only. Keyboard navigation, selection, Escape/outside close, localization and asynchronous country options share that binder. Reset events synchronize the visible menu after native form reset; its browser regression failed before the correction.

The static sidebar renderer adds Profile immediately below Settings across the generated app/competition/club pages. Labels support EN/DE/ES/FR/IT. On a normal same-origin click, the current server session decides between /account/ and /account/login/?next=%2Faccount%2F, preserving language. Public page load performs no session probe. Unknown/unavailable checks use account entry's existing authoritative error handling; no role is inferred. Cross-origin and modified clicks keep native account entry behavior.

Verified locally: generator check 23/23 plus manifests/club template; focused Node contracts 27/27; account Chromium 35 cases; Profile Chromium 20 cases (desktop/mobile, five locales, signed-out/authenticated); safe-return Chromium 22 assertions. Independent review completed, with the menu-reset state discrepancy corrected and covered by a reproduced failing browser regression.

A broad initial Site run had 749/750 PASS with a scheduled-round control timing failure in UI-THEME; full recheck status is recorded in the PR/issue. No backend identity/schema change, merge, remote D1, deployment or outbound mail. Original #170 checklist remains 12/15 (80%).
