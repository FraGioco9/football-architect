# PLAYER-AUTH-01 — exact-head release gates (Draft/HOLD)

This is the **final execution checklist**, not evidence that gates have passed. Owner direction: do not start full CI until implementation and obsolete test updates are complete. No auto-merge, production deploy, remote D1, live email or real operator cutover.

## Final gate activation
- PR #329 now selects `admin-world-final-verification` on Draft, replacing focused diagnostic markers. This activates the complete Admin Worker/operator and Chromium/WebKit account gates without releasing or deploying.
- The original issue stands at **13/15 (86.7%)**. Production operator cutover and real Cloudflare email activation remain HOLD; a green CI does not authorize them.
- Capture the exact resulting HEAD and jobs before marking #15 passed. Site checks and generic Browser QA are separate workflows and must be checked independently for skips or failures.

## Gate A — implementation and security review
- [ ] Unified Player login/logout/session, registration/verification and recovery flows conform to a single browser session model.
- [ ] Owner-selected Account UI locale propagates to the email template in EN/DE/ES/FR/IT. Unrecognized locale uses English.
- [ ] Local, Preview and CI **cannot** invoke an outbound Cloudflare Email Service binding. The deployment stays disabled if incomplete; account creation/reset request returns 503 without delivery.
- [ ] Registration cannot confer Admin role; granting permissions without the explicit Player/legacy operator link is insufficient.
- [ ] All effective Admin permissions require an active verified Player, enabled matching legacy operator, valid link and `admin.access`. Read/write are distinct grants; write also requires CSRF and atomic authorization.
- [ ] Immediate Admin revocation does not remove normal Player sign-in access. A linked Admin cannot delete their Player identity without authorized transfer; legacy audit records are preserved.
- [ ] No token, password verifier, PII or binding credential in source, URL logs, CI output or public response. One-time token is immediately removed from browser URL.

## Gate B — focused verification (once code is frozen)
- [ ] Run static/typecheck and generated-site assertions once.
- [ ] Run all backend Worker/D1 tests, including simulated verification, recovery, revocation, Admin read/write and operator restart.
- [ ] Run operator-local tests and ensure all cutover readiness/rollback scenarios use disposable local state.
- [ ] Run complete Site checks and Browser QA in Chromium **and** WebKit on the final HEAD.
- [ ] Check EN/DE/ES/FR/IT at narrow mobile and desktop breakpoints for login/register/recovery, including keyboard, focus and dropdown behavior.
- [ ] Re-run only failing commands while repairing failures; after the last fix, require one final complete exact-head cycle.
- [ ] Record workflow URLs, commit SHA, pass/skip counts and acknowledged exceptions. Skipped gates are **not** passing gates.

## Gate C — separate operator/provider approvals
- [ ] Owner explicitly approves live operator cutover, exact environment and operator identities; restore path and revocation strategy reviewed. Local preflight readiness is not authorization.
- [ ] Cloudflare Email Service chosen and adapter authored. **Provider choice APPROVED**, but actual sender onboarding, DNS/binding configuration, real delivery, paid eligibility and deployment require separate authorization.
- [ ] Approval for production D1 and Worker configuration is independent of approval for this Draft PR. No remote changes until explicitly granted.
- [ ] Merge only under the existing protected exact-head/CI policy after all applicable approvals and no unresolved security regressions.

## Stop conditions
Any failing Worker, Site, Chromium or WebKit check; incomplete email setup; wrong D1 binding; link/grant mismatch; credential leak; unverified operator; or inability to revoke access: **STOP / HOLD**, do not deploy or start live cutover.

Current standing: **#170 = 13/15 (86.7%)**. The approved Cloudflare Email Service software integration is complete under #12; no real provider resources or delivery are active. The two open checklist items are actual operator cutover (#10) and final full acceptance (#15). Live email onboarding and smoke testing remain separately approved prerequisites under #15, not proof of a completed production activation. Technical code and newly authored tests are not equivalent to a verified release.
