# Football Architect — RST-01 preparation

RST-01 is defined as the final regression/stability certification after the functional roadmap, UX/UI consolidation, RST-00 and WRD02.05.

## Current state

**PREPARATION ONLY — NOT STARTED**

Baseline repository commit: `7f18d0831bef62d0c2a12b26fea973a22ec4f5ce`.

Frozen release:

- `Football-Architect-2.0.0-UX-STABILE-ESSENZIALE.zip`
- SHA-256 `686f3abaea01807b04d1811da093f6b017eb372f1abb57e6788e6d52bc78d74c`

The manifest declares **43 mandatory checks** across areas A–I.

## Safety model

The preparation branch cannot certify RST-01.

Execution is protected by independent gates:

1. the workflow is **manual-only** (`workflow_dispatch`); no push trigger can start RST-01;
2. execute mode requires the confirmation token `RUN-RST-01`;
3. the workflow passes `FA_RST01_EXECUTE=YES` only on the execute path;
4. `rst01-runner/execution-lock.json` must be `READY_FOR_EXECUTION`.

The current lock remains `LOCKED_PREPARATION`, so even a manual execute request is refused before any browser certification begins.

No deploy step exists.

## Plan mode

`npm run plan` validates the manifest and writes:

- `RST01-PREPARATION-PLAN.json`
- `RST01-PREPARATION-PLAN.md`

Plan mode performs **no browser launch, no game simulation, no save mutation and no deployment**.

## Execution architecture

When execution is explicitly authorized in a later step, the suite will:

1. reconstruct and verify the immutable release ZIP;
2. extract it to a disposable workspace;
3. run Chrome and Edge with disposable profiles;
4. execute the 43 mandatory scenarios;
5. run the 10-season × 8-country soak;
6. verify IndexedDB/checkpoint/export-import integrity;
7. record accessibility/performance findings separately from blockers;
8. verify the release ZIP is unchanged;
9. upload evidence;
10. require 43/43 PASS with zero FAIL and zero mandatory NON_ESEGUITO.

## Deliberate preparation lock

The current runner intentionally refuses the execute path after all authorization checks. This prevents the preparation work itself from starting RST-01.

The concrete scenario adapters A01–I05 are now implemented and statically reviewed on the preparation branch. They deliberately return `NON_ESEGUITO` when the requested feature/API cannot be identified deterministically, instead of manufacturing a PASS.

A later, separately authorized change must review any remaining adapter assumptions and switch the lock to `READY_FOR_EXECUTION`.

RST-01 remains **not started** until an actual certification workflow is explicitly authorized and launched.


## RST-01A hardening

The pre-execution read-only audit identified false-PASS risks in the first adapter draft. RST-01A hardened those paths without running the certification.

Key changes:

- A01 now requires a genuinely clean browser profile.
- A02 drives the real new-career UI and verifies return-to-menu + continue.
- A04 requires visible IT/EN text plus date/number/currency evidence.
- B03 completes import and validates persisted storage rather than stopping at preview.
- B04 corrupts the primary IndexedDB snapshot and requires recovery from a surviving valid copy.
- B05 mutates one of two persisted slots and proves the other slot remains byte-for-byte unchanged after reopen.
- C04/C05 require semantic cup/history evidence rather than key presence.
- D01 requires a distinct 11-player starting XI plus formation.
- D02 requires a persisted tactical-state transition.
- H04 uses cold/warm cache control and documented thresholds derived from certified RST-00 D02 medians.
- H05 records browser/page errors across the ten-season soak.
- I04 now reloads persisted saves at both mid-season and pre-rollover boundaries.
- top-level test dependencies are pinned to exact versions.

### Readiness after hardening

- **28/43 adapters: driver-ready for a future execution attempt**
- **15/43 adapters: intentionally blocked**
- **0/43 executed**
- execution lock: `LOCKED_PREPARATION`

Blocked behavioral drivers:

`D03 D04 D05 E02 E03 F01 F02 F03 F04 F05 G01 G03 G04 I01 I03`

These adapters return `NON_ESEGUITO` by design until a real behavioral driver exists. UI/API/state presence alone cannot produce PASS.

The detailed machine-readable matrix is in `rst01-runner/readiness.json`.

RST-01 remains **not started**.


## RST-01B behavioral drivers

RST-01B replaces the 15 remaining blocked/proxy adapters with behavioral drivers backed by the actual frozen 2.0.0 APIs.

### Result

- **43/43 drivers implemented**
- **43/43 registered**
- **0 blocked drivers**
- **0/43 executed**
- JavaScript static syntax gate: **PASS**
- frozen-release API contract: **100/100 names matched across 21 source modules**
- workflow runs during preparation: **0**
- execution lock: `LOCKED_PREPARATION`

New behavioral coverage includes real substitution rules/minutes, injury substitution and recovery, contract negotiations and expiry/release, academy promotion/development, transfer buy/sell/reject, loans/clauses, windows/free agents/registration, scouting uncertainty, two-season AI market activity, board evaluation/dismissal, staff/facility projects, manager interviews/appointments, and cross-module rollover/injury/transfer integrity.

The 10-season world soak now explicitly enables and validates WRD03 national cups, WRD04 continental competition and WRD05 official records/rivalries in addition to the eight leagues and divisions.

D05/I03 use a complete-season deterministic scan of the frozen fixture set for an official injury substitution. If the frozen deterministic season contains no such event, the check returns `NON_ESEGUITO`; it never fabricates an injury or PASS.

**Driver-ready is not equivalent to tested or PASS. RST-01 remains NOT STARTED.**


## Final pre-unlock gate

Status: **PASS — still locked**

The final read-only/static gate found and resolved four execution blockers before any RST-01 run:

- F04 now synchronizes `worldV1.day` after direct advanced-clock movement.
- I02 now consumes the current structured WRD03/WRD04 soak evidence.
- D04 now measures fitness immediately after the substitution match, before any later AI-substitution scan.
- H04 now measures post-GC `JSHeapUsedSize` through CDP.

Additional tightening:

- F02 proves loan return through the official `newSeason()` rollover.
- D03/D05 use complete-season deterministic observation windows.
- H02 explicitly checks landmarks and accessible control names in addition to keyboard/focus.
- RST-00 did not capture heap memory, so H04 documents a separate RST-01 memory guardrail: **256 MB maximum post-GC JS heap and 64 MB maximum post-GC growth**.

Final static state:

- registry: **43/43**
- syntax: **11/11 PASS**
- frozen release API contract: **101/101**
- stale-reference audit: **PASS**
- branch scope: harness/docs/workflow only
- release/source changes: **0**
- workflow runs: **0**
- execution lock: `LOCKED_PREPARATION`

The pre-unlock gate being PASS does **not** authorize execution. RST-01 remains **NOT STARTED**.
