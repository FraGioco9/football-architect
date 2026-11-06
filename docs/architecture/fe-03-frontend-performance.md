# FE-03 — Frontend Performance Optimization (#367)

> **Merged implementation / historical acceptance record — REPO-04 #358, 2026-11-06.** #367 was squash-merged in PR #402. Its optional lab profiler and synthetic 320-club microbenchmark are **not** evidence of Production CDN improvements or physical-device performance. See the [current CI/QA operating guide](../ci/README.md). Baseline SHAs, old open-PR wording and test run receipts below remain dated evidence; they are not current merge/deploy authorization.


## Baseline and boundaries

Implementation authorized by the owner on 2026-11-05. Started from verified main SHA 4af8fb11fd29aff60a1306407ce04dd0426f06d6, after squash integration of FE-01 #365 (PR #393), FE-02 #366 (PR #395, plus Safari follow-up PR #398), FE-04 #368 (PR #394), and SH-02 #354. FE-05 #369 owns new visual regression infrastructure, workflow changes and snapshots; FE-03 does not edit those surfaces. Open players generator PR #400 is unrelated.

Preserve: first-paint static HTML and reserved spaces, seven competition views, CSS/geometry, keyboard and translated accessible labels, 320 club identities, Debug and Season 0, routing, public/private isolation, world revision validation, abort/stale-response rejection, sports rules, HTTP contracts, and crest DOM reuse.

## P0: profile and evidence

The standalone tool at tools/fe-03-browser-profile.mjs is read-only and opt-in. It collects Chromium lab FCP, observed LCP, CLS, long-task count and duration, navigation timing, transfer/decoded resource sizes, network response status, and shell DOM counts. It covers 9 representative routes at 320, 390, 768 and 1440 pixels in a pairwise profile covering EN/DE/ES/FR/IT and dark/light.

Compare TWO checkouts against the same Node 22, Chromium, hardware, network, CPU, API state and hosting setup. Start the canonical local DEV launcher for the baseline commit in a separate terminal. Run the FE-03 profiler from the FE-03 checkout pointing to the baseline server, restart the server from the FE-03 PR HEAD, and repeat the profiler from the same FE-03 checkout:

~~~powershell
node tools/dev.mjs
node tools/fe-03-browser-profile.mjs before --runs=20

# Restart the local server using FE-03 HEAD; keep identical environment.
node tools/fe-03-browser-profile.mjs after --runs=20
~~~

Outputs are int24-browser-artifacts/fe-03-before.json and fe-03-after.json. Do not commit generated artifacts. DEV always sends Cache-Control: no-store; the tool uses cold Chromium contexts, so no claim about production CDN caching or warm-cache benefit is possible. Browser metrics and real interaction time have NOT been executed in the GitHub-connector-only environment and are UNKNOWN, not PASS. The profiler is a diagnostic, not a replacement for CI or the FE-05 suite. Results are p50/p75/p95, with HTTP errors recorded rather than hidden.

## P1: competition startup — candidate deferred after failed parity tests

An initial experiment replaced two standings outerHTML serialization/parse roundtrips with direct compact-shell insertion. The existing Site suite reported nineteen broken source/harness and competition state contracts during this change, so the experiment was **reverted completely**, rather than widening FE-03 into shared test harness migrations. The original competition initialization is preserved byte-for-byte from the base commit. No unmeasured script parallelism, loading order changes or new network cache policy are introduced.

A future separate change may revisit bootstrap speed only after before/after browser traces and a supported runtime/harness parity plan. P1's performance improvement is **NOT CLAIMED** in this PR.

## P2: avoid transient HTML creation when filtering Clubs

The Clubs directory already has 320 route-keyed static cards before any network request or JavaScript enhancement. The pre-existing cache maps canonical paths to those real nodes. Nevertheless every filter/keystroke previously formatted a fresh string for every result and parsed it in a detached DIV only to throw those new nodes away when cached cards existed.

FE-03 obtains the requested card list from the existing path-keyed cache, retains and reorders the original nodes, and skips string rendering and detached DOM parsing on cache-complete results. The old rendering fallback remains in place when there are zero matches or when any node is absent (legacy/incomplete DOM). Existing locale, aria-label, filter, URL, event, focus and crest behaviors are retained. The already-existing node reorder algorithm and canonical source of the 320 identities are unchanged.

Isolated synthetic JavaScript benchmark (not browser DOM timing): V8 isolate with 320 actual clubs from main's manifest, 3,000 repetitions, 707 ms generating simple card strings versus 323 ms retrieving from cached canonical keys (~54% less CPU for this narrow operation). This proof excludes real document parsing, layout, browser rendering, network and Web Vitals. No invented real-world interaction improvements should be inferred.

## Validation and risks

The existing SH-02 Node test and competition startup remain unchanged from the baseline after the failed P1 experiment. The Club Node test validates the cache fast-path/fallback; existing club/browser tests remain the runtime acceptance authority. No workflow, test ownership registry, screenshots, snapshots or other FE-05 infrastructure are modified.

Required final gate: exact-head Site + Browser + Admin + FULL evidence, all generated-page checks, relevant 320/390/768/1440 responsive and two-theme/five-locale regression suites, keyboard accessibility/focus, crest reuse, competition and club refresh, Back/Forward, Debug/source/season changes and error/slow response behavior. Actual iPhone Safari and before/after browser performance metrics remain UNKNOWN without live runs; avoid claiming PASS for them.

Remaining candidate deferred pending traces: sequential loading of competition scripts, CDN caching for stable asset URLs, manifest shape or cache rewrites, and global i18n event batching. Those could affect error ordering, source freshness, FE-04 accessible announcements, and FE-05 tests. They are intentionally out of this behavior-preserving PR without proof.

One focused Draft/HOLD PR, one grouped commit where possible, no merge, deployment, remote D1 changes, external integrations, or branch deletion without separate owner authorization.
