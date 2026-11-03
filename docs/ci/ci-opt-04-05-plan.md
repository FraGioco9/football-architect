# CI-OPT-04/05 implementation and audit

Baseline: `75a672591085fbe4099deb7aee619e88c7a6b12a`, the single-parent squash of PR #364. No historical implementation branch is a source.

## Design and execution plan

Retain the current workflow/check names and publication/security boundaries. Extend the conservative selector rather than introducing another CI architecture. Unknown, shared, CSS, database, routing and CI changes remain FULL until equivalent narrower coverage is demonstrated. Bounded backend pure-contract edits may select dependency-aware Node contracts, but runtime/security changes retain complete backend validation.

1. Audit current workflows, historical logs and baseline suites; inventory every test with an explicit canonical owner. Fail discovery before installs when files are added, removed or misclassified.
2. Consolidate exact-head selection and deduplicate essential/targeted files. Preserve complete final suites. Replace the one-shot evidence check with bounded state-aware observation: missing/pending blocks, failures/cancellations remain failures, only successful FULL steps at the requested HEAD count. A fresh HEAD invalidates the observation. Keep existing check identities and branch protections unchanged.
3. Preserve already-corrected historical assertions. Fix only demonstrated remaining timing/state problems. Record unresolved issues rather than broadening assertions or adding retries.
4. Stream logs and first-failure diagnostics into summaries and artifacts with category, expected/actual, source and PowerShell reproduction. Collect repeated signatures without automatic retries.
5. Benchmark equivalent commands and controlled failure injection, retaining raw timings, sample counts and uncertainty. Remove only provable repeated execution of identical files.
6. Run local checks before a single grouped push, create one Draft/HOLD PR linked to #360/#371, collect exact-head CI results and record remaining acceptance gaps.

## Audit findings

- Site classifier checks PR HEAD but its test job checks the synthetic merge SHA. Browser/Admin use PR HEAD. Final evidence must identify the actual tested source.
- The FULL gate immediately fails for absent/in-progress evidence, filters Site/Browser to manual dispatch only, and has no completion observation.
- Admin path filters can prevent a required workflow from existing. The gate's separate Admin regex misses CI/shared changes.
- Essential and selected Site lists overlap for Admin. Selector scenarios rerun entire area suites already included in FULL.
- Pure backend discovery excludes runtime tests by suffix before validating their contents. New wrongly named tests can escape the intended ownership check.
- Historical `/settings` 404 is already narrowly handled on the squash baseline. Standings clear-state now expects its actual one-row empty state; tooltip assertions already use instance identity. No application changes are proposed for these resolved cases.

## Constraints and review focus

One Draft/HOLD PR; grouped commits; no merge, deploy, remote database, secrets, branch-protection or publication-guard modifications. Unknown impact fails closed. Pending/skipped/cancelled evidence never passes. Test cancellation/new pushes/reruns, empty and unrecognized discovery, duplicate test selection, first failure serialization and subprocess exit propagation. Benchmarks must not present diagnostic-only samples as end-to-end repair measurements.

## Measured optimization follow-through

First hosted acceptance at 7604d6a passed all four workflows on the exact source/base. It measured 552 seconds in the serial Admin foundation job. Preserve all nine account suites in each engine but move the two engines into independent jobs; retain Chromium Settings and require actual source proof from both jobs. Local executable shell/evidence tests and a focused independent review validate this scheduling change before the second grouped commit. Protection audit is now available via rulesets and shows only landing is required; adding the FULL gate remains separately protected.

## Final #371 measurement closeout

Measure all computational repair phases in paired, alternating controlled runs: same faulty source, immutable tests/workload, two fixed failing reproductions, source-only known correction, and complete final passing coverage. Add genuine focused Node replay with nested-parent safety and Windows path handling, preserve the original suite for history correlation, stream complete assertion details, and remove import-format dependence from backend discovery. Publish one grouped closeout commit after local RED/GREEN and whole-tooling validation. The owner has authorized squash merge after final exact-head required checks; no further approval is needed for that merge. Do not infer permission for deployment, remote D1 or secrets.
