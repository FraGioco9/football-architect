# Football Architect — RST-00 public Windows harness

Public-safe test harness for the four RST-00 baseline checks that could not be executed in the original runner: **B04, B05, C03 and D02**.

## Safety / scope

- The bundled `Football-Architect-2.0.0-UX-STABILE-ESSENZIALE.zip` is an exact copy of the frozen 2.0.0 release.
- Expected SHA-256: `686f3abaea01807b04d1811da093f6b017eb372f1abb57e6788e6d52bc78d74c`.
- The workflow expands the ZIP into a disposable working directory and never writes back into the ZIP.
- No deployment step exists.
- Browser profiles and careers are synthetic and disposable.
- RST-01 is not present and cannot be started by this workflow.
- WRD02.05 remains non-certified.

The run uploads `rst00-windows-evidence` with the Windows addendum and raw evidence.

## Important B04 behavior

B04 requires **verifiable native browser zoom**. The harness attempts a headed Windows browser and keyboard zoom. If the GitHub-hosted runner cannot provide a real interactive headed browser or the viewport does not prove native zoom, B04 is recorded as `NON_ESEGUITO`; it is never replaced with CSS zoom, device scale factor, transform, or CDP page scale.

The historical RST-00 record stays 16 PASS / 4 NON ESEGUITO. This workflow creates a separate Windows addendum.
