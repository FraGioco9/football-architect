# AI-AUTONOMY-01 — controlled Codex pilot (PLANNED / DISABLED)

**Coordination:** [#524](https://github.com/FraGioco9/football-architect/issues/524) · **candidate pilot:** [#504](https://github.com/FraGioco9/football-architect/issues/503) · **policy:** [`.github/ai-autonomy/pilot-policy.yml`](../../.github/ai-autonomy/pilot-policy.yml).

## Current status and scope

This is a **preparation runbook**, not a deployed automation. No GitHub Actions workflow, cron, webhook, Codex API request, automation, GitHub label rule or other agent dispatcher has been enabled. The policy has `automation.enabled: false` and `max_concurrent_tasks: 0`; **nothing consumes that file automatically**.

Preparation work is authorized under #524. **Starting Codex Cloud on #504 requires a new owner instruction**, as does any paid API/GitHub Actions implementation. A ChatGPT Plus subscription and API billing are not interchangeable.

## Phase 1 — Manual Codex Cloud evaluation (future, with owner authorization)

1. Review #504's acceptance criteria and the latest `main`. Check open PRs touching club pages, competition Fixtures, shared sporting calendar, canonical routing or World/Debug APIs. If conflicts exist, pause and coordinate instead of duplicating work.
2. The owner confirms the already published Codex Cloud environment is connected to `FraGioco9/football-architect` and checks access/available usage. Node.js 22 and read-only repository checks passed in the environment report; full-stack startup is not yet verified. Never paste tokens into issues, prompts or PRs.
3. Once explicitly authorized, the owner manually starts **one** Codex Cloud task for #504 with the scoped instructions below. Do not simultaneously start an unattended runner.
4. The agent inspects [`AGENTS.md`](../../AGENTS.md), relevant source/contracts and #504, then works from current `main` on a task branch. Note: `AGENTS.md` is not available on `main` until the preparation PR #525 is separately approved and merged; do not claim the agent has read it before then. It must follow existing first-paint, i18n, responsive, canonical season/day, no-future-score-leakage and test contracts.
5. Use grouped commits and one Draft/HOLD PR in English. No merge, deploy, remote DB write or preview publish. Update #504 only for verified progress with exact commit/PR links; mark manual Safari/visual QA UNKNOWN until performed.
6. Stop after the approved scope and report tests, unresolved choices, CI head, approximate duration, observed quota/credits if surfaced, retries and the owner's supervision required. If usage details are unavailable, record **UNKNOWN**, not an estimate presented as measurement.

### Suggested task text (use only after authorization)

> The owner has already prepared the issue-specific prompt for #504 (Club Fixtures). Once separately authorized, use that prompt along with AGENTS.md and the issue acceptance criteria. First check current main, active PRs and source ownership. Reuse existing competition Fixtures conventions, preserve canonical season/day and prevent future-result leakage. Implement one approved scope in a dedicated branch, with grouped commits, focused tests and one Draft/HOLD PR. Update #504 with evidence, progress and blockers; stop at any new product decision. Do not merge, deploy, access remote D1, change secrets or start another issue.

## Measurements and go/no-go

For each manual trial record:

| Field | Evidence |
| --- | --- |
| Issue / PR / exact HEAD | GitHub links and SHA |
| Acceptance criteria met | Checked vs #504, not merely code written |
| QA | Targeted tests with results; FULL exact-head only when relevant; manual device QA explicitly UNKNOWN until performed |
| Time | Elapsed wall time if observed; otherwise UNKNOWN |
| ChatGPT/Codex quota used | Usage indicator/credits if observable, otherwise UNKNOWN |
| Rework | Failed attempts, flaky tests, follow-up fixes and supervision required |
| Security | Confirm no secrets, remote writes, deploys, unauthorized scope |
| Decision | Owner approves further trial, revises guardrails, or stops |

Do **not** infer token counts from file sizes or treat subscription usage as API spend. Stop experimentation if quota, scope or CI becomes uncertain.

## Phase 2 — Optional offline automation (NOT IMPLEMENTED)

If the owner approves after seeing trial measurements, design a separate, auditable GitHub Actions/API controller. It must be **disabled by default** until explicit activation; schedule/event triggers are not implicit approval.

- **Eligibility:** a human owner approves a specific issue/scope separately (proposed labels `ai:ready`, `ai:working`, `ai:blocked` are placeholders, not existing rules). A label alone must not override issue-specific execution restrictions.
- **Safety:** one active lease/task at a time; preflight current `main`, active PRs, file overlap, status, ownership and dependencies; fail closed on ambiguity; never operate on an issue with conflicting active work.
- **Execution:** dedicated minimum-permission token, no untrusted PR code given secrets, task-specific branch, bounded time/output/retries, no automatic chaining, Draft/HOLD PR only.
- **Cost:** API key/billing separate from Plus; enforce a hard stop or preflight reservation under an owner-approved budget rather than relying on a mere warning or unverified dashboard. Default budget **$0**.
- **Evidence:** exact-head tests and status, checklist updates only for proven milestones, CI deduplication, blocked reporting, cancellation and emergency off switch.
- **Explicit prohibitions:** no merge, Preview/Production deploy, remote D1 or auth/account change, secrets or permissions modification, branch deletion, or issue closure without separate owner approval.

Before coding this controller, inspect repo CI and GitHub permissions to choose a secure implementation; no workflow in this preparation branch triggers or dispatches the agent.

## Validation for the preparation PR

- Files are Markdown/YAML only. Confirm that no `.github/workflows/` file, secret, permission, branch rule or deployment configuration changed.
- Verify file paths and relative links, no generated assets, and a clean `git diff --check`.
- This is a docs/policy-only change; code and runtime behavior are unchanged. Existing PR-triggered checks may run per GitHub configuration; **do not manually dispatch extra CI**.
- Final deliverable is a **Draft/HOLD** PR linked to #524. Merge and any activation are separately owner-gated.
