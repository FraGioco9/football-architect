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
