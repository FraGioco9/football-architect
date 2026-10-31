# PLAYER-AUTH-01 — final acceptance status (30 October 2026)

**OPEN — PR #329 Draft/HOLD. Issue #170 remains 13/15 (86.7%).**

Latest restoration batch: 31 October 2026. Prior exact-head CI on `698b5ba` was green (Site 756/756, Worker 220/220); those results do not transfer to the new commit. The restored scenario and controller checks require a fresh final exact-head gate.
No merge, deployment, remote D1, real email, DNS changes or production Cloudflare configuration is authorized.

## Current correction batch

- Starting PR HEAD: `8a97aebbe9df7af0d24f45aa14b9e20aafae919d`.
- Integrates current main `eaf3b4bbfced9543893a99be1569a92c65bc73bb`, including #332/#333 npm/browser caches, independent operator job, obsolete-run cancellation and deduplication. Conflicting Admin workflow edits retain all Player account/browser gates and exact-head checks.
- The previous Site run 41100209153 passed 752 tests and failed only backend test discovery; Admin run 41100209254 failed for the same `Unclassified backend test: cloudflare-email-delivery.test.ts`. Browser run 41100209272 succeeded on that old HEAD.
- The email adapter suite was a Vitest file outside the Worker include patterns. It now uses Node's test/assert APIs with all five original cases retained, so the existing contract runner actually executes it before dependency installation. Discovery explicitly requires this suite; unknown tests still fail closed.
- Retired focused diagnostic workflow steps are removed. The final full Worker run includes the dedicated auth and historical suites once, before browser installation; ordinary Draft pushes retain the focused auth gate. Independent operator persistence remains required in final mode. Account Chromium/WebKit matrices remain intact.
- The signed-out Settings suite stays independent. The restored `tests/admin-world-lifecycle-runner.mts` now starts a real loopback Wrangler Worker, migrates temporary D1 and invokes the complete two-season browser scenario in the independent final operator job. It is no longer a dormant export or a syntax-only check.
- The scenario signs in through the Player page with a password distinct from the legacy Admin fixture. It verifies retired Admin login denial, preparation from Season 0, event initialization, Season 1 day 56/archive/close, explicit Season 2 approval, anonymous historical/fixture/calendar navigation, stale projection rejection across reset and fresh preparation.
- A real regression exposed by this scenario is fixed: successful preparation reloads the authoritative world/events so Initialize events becomes available without a manual Refresh. A controller regression also ensures a concurrent revocation cannot be overwritten by a late preparation response.


## Executed local checks for this batch

These checks were run against the combined working tree before the final commit; they are **not remote exact-head acceptance**.

| Check | Result |
| --- | --- |
| Backend pure Node contracts, including simulated Cloudflare adapter | 75/75 PASS |
| Worker/D1 Player auth, registration, recovery, Admin migration | 69/69 PASS |
| Disposable local operator bootstrap, preflight, grant/revoke rehearsal | 5/5 PASS |
| SQLite migration contracts | 38/38 PASS |
| TypeScript | PASS |
| Backend discovery and CI optimization contracts | 5/5 PASS |

Discovery was observed failing locally before the fix with the same error as both CI jobs. Full CI runs only after the final branch update. Record the final SHA, workflow URLs, conclusions and skipped gates before claiming acceptance.

## Remaining #10 — authorized actual operator cutover

Technical controls and disposable rehearsal are implemented. See `docs-player-admin-cutover-runbook.md` for identity matching, explicit linking/grants, audit preservation, revocation, backup and rollback.

Actual provisioning/cutover requires separate owner authorization naming environment and operator identity, verified email delivery, an authorized restorable backup and maintenance window. A local `ready:true` or passing rehearsal does not authorize remote changes or complete #10.

## Remaining #15 — final acceptance

1. Require final exact-head Site checks (`landing`), Browser QA, complete Worker/D1, operator persistence/restart, typecheck, migrations and Chromium/WebKit account matrices. Skips are not passes.
2. Review all failures and skips on the final HEAD; old green runs do not transfer. Do not waive historical failures without evidence.
3. Require the restored real-browser unified Admin two-season lifecycle to pass in its explicit final operator job. Signed-out Settings/browser and Worker unit tests do not substitute for this scenario.
4. Real Cloudflare sender/binding onboarding, DNS, delivery smoke testing and live operator acceptance remain separately authorized prerequisites. Mock/injected delivery cannot prove live delivery.
5. Preserve default-deny permissions, CSRF/origin/replay checks, public anonymity, historical audit and sporting data. No automatic release follows a green CI.

The approved Cloudflare provider software integration is complete under #12. Production activation is separate. #10 and #15 stay unchecked until their actual requirements are met.
