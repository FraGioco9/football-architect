# Football Architect — RST-00 Windows completion

RST-00 is **completed** through a separate Windows completion addendum for the four checks that could not be executed in the original environment: **B04, B05, C03 and D02**.

## Final status

- Historical RST-00 snapshot: **16 PASS / 4 NON ESEGUITO** — preserved unchanged as the original record.
- Windows completion addendum: **4 PASS / 0 FAIL / 0 NON ESEGUITO**.
- Resolved checks: **B04 PASS, B05 PASS, C03 PASS, D02 PASS**.
- Final certification: GitHub Actions **run #28** (`37317502128`) on head `57cb9dce69c816fb0750063d4149a85ba4db59d3`.
- Final evidence artifact: `rst00-windows-evidence`, artifact id `11349275597`.
- Artifact digest: `sha256:cbce496715d9105e7bb2f3550650cd4a28d4a5e2b70795c575f59ca9945bb917`.
- The workflow completion gate requires all four result files to report `PASS`; otherwise the workflow fails.

The original 16/4 snapshot is not rewritten retroactively. The Windows addendum closes the four execution gaps and completes RST-00.

## B04 — native browser zoom

B04 uses the browsers' native Settings mechanism to set default page zoom to **200%**. It does not use CSS zoom, transforms, device scale factor, or CDP page-scale emulation.

Final evidence:

- Chrome: viewport ratio **2.0**, DPR ratio **2.0**, native zoom observed.
- Edge: viewport ratio **2.0**, DPR ratio **2.0**, native zoom observed.
- Geometry was captured across all core pages and Careers.
- No horizontal overflow was observed in the final B04 page matrix.

## B05 — accessibility / keyboard

B05 completed the automated accessibility and keyboard/focus matrix and is **PASS**. Any quality findings discovered by the scan remain recorded in the evidence as baseline findings rather than being hidden or silently converted into test failures.

## C03 — persistence

C03 is **PASS** for Chrome and Edge using disposable real-browser profiles, including IndexedDB integrity, checkpoint restore, JSON export/import preview, and persistence across browser relaunch.

## D02 — performance baseline

D02 is **PASS** with the required cold/warm samples, navigation samples, cached returns, input responsiveness and raw performance evidence recorded in the artifact.

## Safety / scope

- Frozen release: `Football-Architect-2.0.0-UX-STABILE-ESSENZIALE.zip`.
- Expected SHA-256: `686f3abaea01807b04d1811da093f6b017eb372f1abb57e6788e6d52bc78d74c`.
- The ZIP was verified before and after the final run and remained unchanged.
- The workflow expands the ZIP only into a disposable working directory.
- No deployment step exists.
- Browser profiles and careers are synthetic and disposable.
- **RST-01 was not started.**
- **WRD02.05 remains non-certified.**
