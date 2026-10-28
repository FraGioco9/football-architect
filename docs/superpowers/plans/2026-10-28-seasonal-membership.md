# Seasonal membership separation implementation plan

Goal: execute the owner's approved catalogue/Season 1 separation on PR #316, Draft/HOLD.
Architecture: permanent division identity/rules have no members. The existing owner-approved Season 1 participant selection is the sole initialization input; Node consumers derive unapproved preview projections. D1 remains authoritative for real world/season snapshots. Production preparation stays blocked.
Spec: owner continuation request of 28 October 2026 and docs/admin-world-01-operations.md.

1. Audit all assignment consumers; add regressions for absent permanent membership, invalid Season 1 inputs, canonical rule/hash binding and public/DEV isolation. Observe failures before implementation.
2. Centralize the pure Season 1 participant check, load/validate selection at the Node I/O boundary, migrate generator/catalogue/CSV/search/tests and regenerate public manifests. Keep public approval false, all identities/rules and existing UI behavior.
3. Expose a Season 1-specific complete-snapshot validation path; preserve generic later-season validation and the null production loader. Test real canonical rules against selection independently of synthetic approval fixtures.
4. Verify Debug Settings configuration delivery and public exclusion, preserving sessionStorage and control behavior. Retire the provisional file only after consumers migrate and tests pass.
5. Run targeted Node/backend/typecheck/generator/publication checks, review the batch, then run FULL. Commit/push once to existing PR; update the same 20-item issue checklist with exact evidence, then inspect automatic exact-head CI.

Review focus: malformed inputs fail closed; duplicate cross-tier members; cup entries outside domestic membership; stale public approval; Debug config unavailable in protected artifact or leaked into public artifact. No workflow, security, routing, deploy, credentials or remote D1 changes.
