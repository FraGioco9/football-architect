# I03 — domestic extra time and penalties conversion

The protected knockout bridge now maps `tiebreak.method` and separate extra-time / penalty score objects from deterministic I02 events into the shared domestic Fixtures format. On penalty outcomes it supplies the explicitly required `homeId` / `awayId` fields, preserving the true identities.

The shared Fixtures validator:
- validates that extra time is present only on a played match and that its scores are nonnegative integers;
- resolves a two-leg draw first on regular aggregate, then on additional extra-time scores, and finally on penalties;
- rejects spurious extra time when aggregate has a winner, or penalties when extra time has a winner;
- retains its previously introduced TBD knockout slot representation without exposing future entrants.

The existing visible score continues to represent regular match goals; the status shows after-extra-time / penalties through its already-shared display code. No separate UI or hidden results are introduced.

**Still outstanding:** full Form tooltip interaction lifecycle, season-specific team map replacement inside shared Fixtures, desktop/mobile rollback and context publication. The experimental renderer controller is not loaded, and I06 tests/QA remain pending. No merge/deploy/remote D1.
