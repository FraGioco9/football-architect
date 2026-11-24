# Economy DRAFT v5 read-only implementation

Owner-approved target and research: #755, #769 and #771. This implementation checkpoint is separate from the baseline research document to avoid duplicate source-of-truth files.

## Implementation checkpoint

Read-only v5 calculator uses the scale-25 synthetic grid from #771 at 544ade3971111f1eddaaeff39a622813454caa8d. Raw and rounded fixtures: [[16,50,159.329115122,160],[16,60,1091.534745799,1100],[16,70,3831.523755708,3900],[16,80,10110.472433112,11000],[24,50,71.869795179,72],[24,60,412.712498491,420],[24,70,1627.773770483,1700],[24,80,4773.905230856,4800],[32,50,38.654145957,39],[32,60,118.366321112,120],[32,70,502.384455769,510],[32,80,1501.566971357,1600],[39,50,8.455123898,9],[39,60,25.732988384,26],[39,70,107.130660978,110],[39,80,316.666431323,320]]. Isolated V8 checks: 401 assertions across 13 synchronous callbacks; no repository CLI, full CI or browser run asserted. Existing index SHA-256 config fingerprint includes exposure grid; v3 rows fail closed for global value sorting/filtering until explicitly refreshed. No new schema or remote refresh authorization. Current/archived read-only Rewards estimates use current draft reference, not actual payments or historical rule-version evidence. Historical ledger data must not be repriced.


CI correction: Admin browser QA expected the old 60M pool; the approved 2.4M assertion now matches the new configuration. Prior successful runs did not cover this new head. No remote refresh or deploy authorization.
