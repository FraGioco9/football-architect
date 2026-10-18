# G10-PUBLIC-02 — Public Debug source exposure audit

**Status: PARTIAL SOURCE REVIEW — HOLD / NOT AUTHORIZED FOR PUBLICATION.**

Source baseline: `FraGioco9/football-architect` main `6eac99bf3223baf38023fd86866750335d4f524c`. Product decision in G10-PUBLIC-01: public Preview, including all intended Debug tools, without individually authenticated collaborators.

## Reviewed artifact contract

`tools/dev-preview-artifact.mjs` builds `protected_debug` from the public allowlist plus HTML script injection, seven explicit Debug module destinations, and `/__fa_dev__/artifact-manifest.json`. The artifact contract name and source comments still call it private: this is a **historical naming constraint, not a confidentiality guarantee** once public deployment is approved. The deterministic byte-for-byte audit, fixed manifest, file list and symlink rejection are useful protections and must remain intact.

Explicit Debug source assets in that builder:
- `tools/dev-debug-settings.mjs` → `/__fa_dev__/debug-settings.mjs`
- `tools/dev-standings-preview-client.mjs` → `/__fa_dev__/standings-client.mjs`
- `tools/dev-debug-widget.mjs` → `/__fa_dev__/debug-widget.mjs`
- `tools/dev-standings-preview-data.mjs` → `/__fa_dev__/standings-data.mjs` and `/__fa_dev__/dev-standings-preview-data.mjs`
- `tools/dev-competition-stats-client.mjs` → `/__fa_dev__/stats-client.mjs`
- `tools/dev-competition-stats-data.mjs` → `/__fa_dev__/stats-data.mjs`

Review also inspected `tools/publication-guard.mjs`, `tools/dev-standings-preview.mjs` and `.github/workflows/manual-vercel-preview.yml` for publication boundaries.

## Findings from source inspection

| ID | Observation | Assessment |
| --- | --- | --- |
| PUB02-01 | The staged Debug dependency list is explicit; manifest and source bytes are verified against expected output, rejecting extra files and symlinks. | POSITIVE, builder-level only |
| PUB02-02 | Debug standings/stats modules generate deterministic fictional competition results using existing division data; the observed two browser `fetch` calls request `/competitions/_shared/manifest.json`. | NO HTTP MUTATION FOUND in inspected Debug modules |
| PUB02-03 | Debug UI controls write/read browser `sessionStorage`, and dispatch client-side UI events. | EXPECTED client-only state; not a server write |
| PUB02-04 | No direct `POST`, `PUT`, `PATCH`, `DELETE`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` usage was found in the five inspected Debug modules. | LIMITED negative source finding; not proof for all imports/runtime |
| PUB02-05 | Public artifact allowlist is separate from the Debug artifact. | PRESERVE; no Debug leakage into production/public-only artifact |
| PUB02-06 | Local `tools/dev-standings-preview.mjs` supports loopback or explicit LAN mode; it is not directly copied as a Debug browser asset by the builder. | KEEP local-server boundary independent |
| PUB02-07 | Manual workflow still refuses `protected_debug` with `exit 1` and deploys the `public` contract only. | REQUIRED HOLD |
| PUB02-08 | Existing Vercel project reports SSO enabled for `all_except_custom_domains`. | Public accessibility NOT established; requires later approval and validation |

No hardcoded credentials or obvious secret-bearing Debug request headers were identified in the *inspected* module logic. This does **not** represent a complete repository-wide or final-artifact secrets scan, browser/network acceptance, or exhaustive exploit review.

## Outstanding checks before PUBLIC-02 can PASS

1. Independently stage the exact prospective Debug artifact **offline** and enumerate every byte and path, including all inherited public assets, dynamic imports, source maps, configuration, manifests and redirects. Inspect for secrets, environment values, unpublished/internal data, personal information and URLs or client-controlled endpoints that reveal privileges.
2. Apply targeted static rules plus human review to full artifact: bearer tokens, credentials, signed URLs, service keys, `Authorization`, `process.env` / `import.meta.env`, `fetch`, XHR, WebSocket, form actions, mutation methods, administrative endpoints and dynamic code loading. Do not rely on a single regex or merely the absence of verb strings.
3. Verify that the fictional-data generators use only intentional public club data; inspect any inherited public-site scripts that the Debug pages execute.
4. Confirm every enabled UI control has only public-safe effects and cannot cause write-capable or privileged external operations, including via events and imported modules.
5. Confirm full import closure, deterministic manifest hashes, no symlinks, no extra/unexpected assets and unchanged public-only artifact isolation.
6. Record explicit reviewer PASS/FAIL per asset and any necessary remediation, with exact SHA and sanitized evidence. Unknown is HOLD.


## Additional inherited-runtime inspection (read-only, same main baseline)

Inspected the current source of `assets/app.js`, `assets/app-search.js`, `assets/competition-page.js`, `assets/competition-fixtures.js`, `assets/landing.js`, `assets/competition-tabs.js`, `assets/theme.js`, and `vercel.json` through GitHub file reads. In the inspected scripts, relevant explicit requests are reads: `app-search.js` requests `data/divisions.json`, `competition-page.js` requests the shared competition manifest, and Debug standings and statistics clients request `/competitions/_shared/manifest.json`. Visible state persistence uses browser `localStorage` or `sessionStorage`; the inspected scripts yielded no explicit mutation HTTP method. These are **limited source findings**, not a comprehensive transitive-call or runtime behavioral guarantee.

**Current audit limitation:** the full staged `protected_debug` output has not been constructed and inspected byte-for-byte in this review; the entire public allowlist (including brand images, flags, competition assets, generated division resources and all JSON) has not received a complete secret, privacy and integrity audit. No full-artifact PASS or publication approval can be issued from file-by-file source sampling. The `protected_debug` builder still describes its output as private; renaming or weakening its guard belongs to a separately authorized implementation phase, not this audit.

## Gate decision

**G10-PUBLIC-02 = PARTIAL / HOLD**, not PASS. No changes to code, test logic, workflow, Vercel settings, aliases, domains or permissions are authorized by this review. The existing manual workflow's unconditional refusal of the Debug contract **must remain** until PUBLIC-02 passes, a minimal workflow patch is separately reviewed and authorized, and an explicit Preview deployment is approved.

Prior G10-ACCESS confidentiality requirements have been superseded by G10-PUBLIC-01; exposure of *intentionally public* Debug tools is allowed as a product decision, but exposing secrets, administrative actions or personal data is not.

## Final evidence reconciliation — 2026-10-18

Manual GitHub Actions audit [run #39149968407](https://github.com/FraGioco9/football-architect/actions/runs/39149968407) completed **SUCCESS** on exact main SHA `41d70dc5f3901768eaef1f6715296f736af26e24`. Job `public-debug-offline-audit` completed successfully; the sanitized summary states `scannerExit: 0`, `debugFileCount: 347`, `publicFileCount: 339`, `findings: 0`, `categories: {}`. Both staging functions and their artifact-integrity assertions executed successfully. The extra 8 Debug paths correspond to seven staged Debug module destinations and one generated manifest. The underlying full JSON report is not uploaded and its individual byte hashes are not independently preserved in this audit document.

Previous red run #39148792408 at `aaeb5bf9` reported four `write_api` findings. Subsequent source inspection traced them to default-GET `fetch()` calls reading the competition shared manifest (two Debug clients), competition manifest (public competition page), and public `data/divisions.json` (app search). PR #199 adjusted the heuristic and merged as `41d70dc5`; the subsequent full staging scan produced zero findings.

**Assessment:** automated offline artifact staging, manifest integrity and the scanner's selected heuristic rules are **PASS on the pinned SHA**. No verified write-capable network call or hardcoded secret was identified by those checks. This is **not** a comprehensive security clearance. The scanner is pattern-based; it excludes a complete semantics-aware examination of dynamically constructed requests, transitive runtime behaviors, all values in static content, browser testing and operational exposure. An absent hit cannot prove a secret or privileged operation absent. Static GET inspection confirms only the four previously flagged call sites. Note also that Vercel anonymous accessibility and any SSO setting changes have not been tested or authorized.

**Decision: G10-PUBLIC-02 remains HOLD for final human sign-off.** The automated subgate is green, but an explicit review of artifact content, client behaviors and intended data disclosures is still required before changing the manual publication workflow. The existing `protected_debug` fail-closed refusal must remain. No Vercel Preview release, workflow unblocking, settings change, production action or G10-PUBLIC-03 implementation is authorized by this document.
