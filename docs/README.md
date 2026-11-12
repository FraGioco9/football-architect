# Football Architect — documentation index

**Living index**, checked against `main@f9b595636d02d4a1ebfdbd967e1a97c18f2dd41d` on 2026-11-06. A SHA in this or an older report is a dated baseline, never an assertion of the latest deployment. Document classes: **CURRENT** (implemented repository contract), **OPERATIONAL** (requires separate approval to execute), **HISTORICAL** (frozen implementation/CI evidence), and **PLANNED** (not implemented). Current code does not by itself certify live Production or physical Safari/VoiceOver.

## Current sources of truth

| Area | Canonical document |
| --- | --- |
| Project and quick start | [Root README](../README.md) |
| Components, ownership, REPO-05 private naming | [Architecture overview](architecture/overview.md) |
| Local Worker/D1, DEV, LAN and PowerShell | [DEV startup](architecture/dev-env-01-startup.md) |
| Routing and query semantics | [Routes](architecture/routes-contract.md) |
| Approved sporting identities and rules | [SH-01](architecture/sh-01-sporting-contracts.md) |
| World state, Season 0 and protected Debug | [SH-03](state/sh-03.md) |
| Public/Player/Admin API | [BE-02](../backend/docs-http-contracts-be-02.md) |
| Auth, CSRF and permission boundaries | [BE-05](../backend/docs-auth-security-be-05.md) |
| 56-day lifecycle and historical archive | [BE-04](../backend/docs-season-lifecycle-be-04.md) |
| Schema, repository, transaction boundaries | [BE-03](../backend/docs-d1-repositories-be-03.md) |
| CI/QA workflows and exact-head evidence | [CI guide](ci/README.md) |

## AI development preparation

[AI-AUTONOMY-01 pilot — DISABLED](ci/ai-autonomy-01.md) documents the owner-gated Codex Cloud trial and possible later offline orchestrator. [Agent instructions](../AGENTS.md) and the [non-executable policy](../.github/ai-autonomy/pilot-policy.yml) do **not** authorize or launch any task.

## Operational and environment records

[Local Player setup](../backend/docs-player-local-dev.md); [opt-in shared Dev/Preview](../backend/docs-shared-nonproduction.md); [Hosted Preview preparation](../backend/docs-hosted-preview.md); [Gmail preparation](../backend/docs-gmail-preview.md); [Cloudflare environment blueprint](../backend/docs-cloudflare-auth-environments.md); [manual Vercel Preview](manual-preview.md); [owner-only Admin operations](admin-world-01-operations.md). Distinguish local loopback from shared nonproduction, and shared nonproduction from Production. Examples and planned names are not live resource evidence.

## Historical and specialist references

[FE-01 design](architecture/fe-01-design-system.md), [FE-02 mobile](architecture/fe-02-responsive-mobile-ux.md), [FE-03 performance](architecture/fe-03-frontend-performance.md), [FE-04 accessibility](architecture/fe-04-accessibility-i18n.md), [FE-05 visual](architecture/fe-05-visual-regression.md) remain merged implementation ledgers; check present source before treating old Draft/HOLD as current. FE-05 covers deterministic same-SHA samples, not approved cross-commit goldens.

[REPO-02 candidate ledger](maintenance/repo-02-candidate-ledger.md), [CI-FAST historical plan](architecture/ci-fast-01.md), [CI-OPT-02 costs](ci-opt-02-workflow-ledger.md), [CI-OPT-04/05 plan](ci/ci-opt-04-05-plan.md), [CI report](ci/ci-opt-04-05.md), [A01 catalogue](architecture/world-catalog.md), [A02 registry](architecture/rules-registry.md), [A04 provider](architecture/provider-contract.md), [Fixtures spec](competitions/fixtures.en.md) and [shared model spec](competitions/shared-model.en.md) preserve historical decisions. `docs/superpowers/` and `docs/maintenance/` are not current runbooks. Do not erase receipt hashes, prior commit identifiers, migration histories, old source names or contracts.

Use English for docs and PRs. Prefer one current owner per topic and links over copied instructions. Always label uncertain deployment, live email, real device QA and external integration status UNKNOWN until verified. Do not change public API/routes, storage keys, CLI entrypoints, historical test filenames or publication/exact-head gates for documentation tidiness.
