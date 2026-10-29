# Consolidated final verification — #315

Base published source:5cbf0734fd8bd447d474d6f5ec41dbc45d30724a, source tree6b71a3f1aec3fde2c778e2cc72310bff6f21d058. Isolated verification checkout used exactly that tree before fixes; its local commit identity is not remote exact-head CI evidence.

- [x] Execute Node22 contracts, migrations, types, generator and real Worker/D1 suite; inspect failures rather than infer acceptance.
- [x] Fix permanent-rule consumers: derive domestic phase markers once from world-calendar model; reuse for browser normalization and approved backend reconstruction. Explicit malformed markers fail validation, approved source data stays unchanged. Added calendar boundary regression observed RED→GREEN.
- [x] Correct test fixtures: reset disposable world generation before immutable data purge; restore full closed-source baseline between Season2 cases; fix short idempotency keys and HTTP-authentication timestamp assumptions; distinguish public authority from DEV provider fixtures.
- [x] Preserve pinned review semantics: only two candidate source checksums change, full candidate catalogue/manifest identical; approval file unchanged. Generator23/23 and approved snapshot regression preserved.
- [x] Execute complete corrected Worker/D1 suite146/146, Node contracts71/71, SQLite20/20, operator/bundle/restart10/10; types exit0. Source review found no P1/P2; review did not certify runtime/browser.
- [ ] Obtain complete Site/Admin/Browser hosted exact-head evidence, including actual two-session browser lifecycle, desktop/mobile/five-language/keyboard behavior. Local Chromium download returned a corrupt archive; do not count missing-browser failures as PASS.

Ruling: remove two obsolete source-text regex tests from admin-calendar-automatic-confirm.test.ts. They assert a superseded confirmation-only implementation; the actual atomic confirmation/artifact/rollback/concurrency Worker/D1 scenarios now execute successfully. Discovery includes all remaining25 pure contracts; no production safety test is excluded to hide a failure.

Ruling: fixture generation resets rotate generation and purge only disposable test D1, with immutable production triggers enabled. The protected reset endpoint and its negative/rollback tests remain unchanged.

Ruling: the original candidate review ancestry remains c187d4e; current raw-byte pins permit only the calendar-compatible source layout. Reconstructed full rules, candidate catalogue/manifest and fixed server-owned approval are unchanged. No new membership approval is inferred.

Ruling: final heavy Admin CI may run on Draft/HOLD only when PR body explicitly includes the marker `<!-- admin-world-final-verification -->`. This owner-requested final verification opt-in avoids changing the draft state or running heavy tests on ordinary draft pushes. Exact source checkout, local-only D1, read-only repository permissions and deployment guard remain intact. Remove marker after final evidence or when pausing final verification.

Checklist remains19/22 (86.4%) until actual acceptance evidence supports the three original remaining nodes. No new checklist nodes, merge, deployment, provisioning, remote D1 or real credentials.
