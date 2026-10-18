# G10-PUBLIC-02 — Public Debug source exposure audit

**Current disposition (2026-10-18): PASS for the reviewed static-content and Debug capability exposure scope. PUBLIC DEBUG PUBLICATION REMAINS BLOCKED / NOT AUTHORIZED.**

This section supersedes the earlier partial-review/HOLD conclusions below for the source and artifact scope identified here. Preserve those earlier records as historical evidence. This is an exposure review conclusion, not a deployment authorization, provider configuration certification, penetration test or guarantee against every possible vulnerability.

## Final content and browser evidence

- Reviewed PR #201 HEAD: `bc2e2855813f8aec557eaeb0cdea650eff1b22a9`.
- PR #201 squash-merged as main `c1609071cef9f1d5884717b971bdae564f1ef21d`; both commits have tree `474e35f2e7bc211e84793cf2cc462b8add72a186`. The audited source therefore matches that merged snapshot.
- Fresh source extraction, offline public/Debug staging, exact byte/manifest checks and full content-class inspection completed on the reviewed HEAD. The heuristic scanner reported zero findings; the conclusion also incorporates the data, links, asset structures, script behavior and browser evidence described below.
- Exact-head Chrome acceptance and site contracts: [PR run #39157575557](https://github.com/FraGioco9/football-architect/actions/runs/39157575557), **167/167 PASS**, zero failures/skips.
- Post-merge source assertion and site contracts: [main run #39158710813](https://github.com/FraGioco9/football-architect/actions/runs/39158710813), **167/167 PASS**, zero failures/skips.
- Debug artifact: **347 files / 5,147,704 bytes**; public-only artifact: **339 files**. Exactly seven Debug module destinations plus the hash manifest are added. The 22 inherited app HTML files intentionally gain Debug/fictional-season markup; other inherited public files remain byte-identical.
- Debug manifest SHA-256: `a42dcefbaed4306ee5ab79410d2168d8f58162bcb70568b933e8ee1e28985446`.
- Inventory SHA-256: `aff15850040097b72f23643b472e177e35c6075fbbe3489543c7f202cdd9876f`, calculated over sorted, newline-terminated `path sha256` lines for every staged file.

| Content / capability | Reviewed evidence | Result |
| --- | --- | --- |
| Four JSON files | Competition manifest, division catalogue, Debug path/hash manifest and explicit Vercel routes; all parsed and inspected for unexpected data/reference classes | PASS |
| Competition data | 16 provisional divisions; all exposed field values for 256 clubs match the canonical catalogue projection; `approved: false`; no account, wallet, email or real-user record identified | PASS |
| 24 HTML files and three CSS files | Local route/resource references and inline initialization scripts reviewed; no forms, iframe/object/embed elements, event-handler attributes, external resource targets, remote CSS URLs/imports or HTML comments identified | PASS |
| 300 SVG files | Parsed every file; checked element types, event attributes, href/src and CSS references; no script, foreignObject, embedded image, external resource or XML entity declaration identified | PASS |
| PNG and ICO payloads | PNG contains IHDR/IDAT/IEND only; all three embedded ICO PNG payloads inspected without text/EXIF chunks or trailing payload | PASS for exposure; ICO container defect below |
| Seven JS and seven module destinations | Fixed local script-loading list, relative module closure, deterministic fictional generators, constant SVG icon strings and DOM text display paths inspected | PASS for reviewed behavior |
| Network and storage effects | Four explicit fetch call sites read static same-origin JSON with default GET; no privileged header or server-mutation operation identified; Debug controls change sessionStorage/UI state, with theme/language in localStorage | PASS for reviewed behavior |
| Chrome behavior | Canonical deep links for Seasons 1–4, season-picker transitions, standings, Fixtures, Stats, slider/number/steppers, rejected input, page/global reset, persistence, cross-navigation exceptions and observed same-origin GET-only requests | PASS on exact HEAD |
| Mobile scope | Debug panel horizontal bounds at 390/320px; separate theme render matrix at 1440/390/320, Dark/Light | PASS for these assertions; not full accessibility or real-device acceptance |

The SVG descriptions reviewed consist of flag titles and a Nepal construction description; SVG text elements belong to flag artwork. No credential, private user record, administrative endpoint, source map or environment file was identified in the staged output. Module scripts and fictional data are intentionally public under [PUBLIC-01](g10-public-01-requirements.md); their visibility must never be treated as confidentiality.

The scanner remains heuristic. Chrome request observation covers the exercised flow, not every possible browser state, navigation or exploit. Static source and content inspection supplies evidence for the unexercised event paths; this is not exhaustive AST/dataflow analysis or security penetration testing. See [runtime review](g10-public-02-runtime-review.md) for capability details.

## Incidental findings and release boundary

- **Favicon correctness:** inherited `favicon.ico` stores three image-directory size/offset fields in big-endian form rather than ICO little-endian form; Pillow cannot identify the container. Its 16/32/48px embedded PNGs have normal chunks and no metadata payload. Identical in public and Debug; no change made. This asset correctness defect is not an exposure blocker.
- **Flag documentation drift:** README still cites lipis/flag-icons and a retained MIT license file, whereas current `assets/flags/SOURCE.md` documents the replacement with Hampus Borgos imagery and PR #152 records replacement/removal of the superseded license. Reconcile separately; this audit does not independently certify upstream licensing. Neither source document is shipped in the artifact.

**PUBLIC-02 exposure review: PASS for the pinned snapshot. PUBLIC-03: implementation prepared only in the authorized Draft PR branch; review/merge remains pending. PUBLIC-04: OPEN / separate Preview deployment and hosted acceptance required.**

The owner separately authorized PUBLIC-03 implementation from main `7352d720bd994d39631096281370b17cdab3d821`, limited to this workflow, four tests and two PUBLIC-02 documents. Only that Draft PR branch replaces the unconditional Debug refusal with the gates below. This does not authorize merge, manual workflow execution, deployment, Vercel SSO/settings, Git integration, DNS, alias, permissions, production or database changes. Anonymous accessibility and the consequences of any future provider configuration change remain unverified until PUBLIC-04. Before an eventual release, compare the exact approved artifact again; do not transfer this conclusion to changed bytes without review.

## PUBLIC-03 candidate workflow boundary

- `public` remains the default. Both contracts require an owner-only `workflow_dispatch` (both original and triggering actor, including reruns) from current main, an exact 40-character approved SHA contained in main and the latest matching automatic Site checks run completed successfully. A merged-PR source additionally requires the exact merge commit, repository/base identity and green PR-head CI. Source/CI checks run again in the publisher and before deployment/alias assignment.
- `protected_debug` additionally requires `expected_debug_manifest_sha256`: the exact owner-approved 64-character lowercase SHA-256 of `__fa_dev__/artifact-manifest.json`. Missing, malformed or different approval fails closed. The reviewed manifest hash above is evidence for the unchanged artifact, not standing authorization to deploy it.
- The uncredentialed staging job runs site tests, invokes the existing selected builder and verifies its exact bytes. It uploads `approved-preview-bundle`: `site/` plus an external `publication-manifest.json` binding schema, contract, source SHA, sorted paths and every file hash. Its digest travels separately as a job output. This transport digest differs from the historical newline inventory digest above.
- After download, the publisher independently verifies that digest, identity, complete inventory and every file hash with inline Node code, rejecting symlinks, unsafe paths, unexpected repository content and public Debug references. For Debug it also checks the owner-approved internal manifest and all of its entries, including exactly seven module destinations. The fixed static `vercel.json` routing equality is retained; build/function/config overrides are rejected before credentials.
- The publisher never checks out source or imports/executes downloaded repository code. Only the final deployment step receives `VERCEL_TOKEN`. CLI `64.5.0` is pinned; its exact npm package was inspected for native `VERCEL_TOKEN` support, and neither deploy nor alias CLI arguments contain the token. Installation runs without Vercel credentials.
- The exact project/team, `--target=preview`, READY/provider target checks, stable alias ownership/availability checks and post-assignment deployment identity checks are retained. The external transport manifest is outside the deployed `site/`; the default public payload remains isolated and unchanged.
- Local gate fixtures exercise the actual inline source, staging and download verification scripts. These offline results establish workflow policy behavior, not provider access or a successful hosted deployment. Existing SSO remains unchanged; anonymous access, live Debug controls and hosted acceptance belong to PUBLIC-04.

## Historical partial-review record

The following material is retained verbatim as the evidence available at its earlier baselines. Its HOLD/current/outstanding statements do not override the current scoped disposition above.


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
