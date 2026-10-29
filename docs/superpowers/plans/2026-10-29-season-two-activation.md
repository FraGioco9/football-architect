# Season2 activation and public consumers

Goal: expose the protected existing Season1→2 preparation command only with durable owner approval, make both calendar paths operational for Season2 and preserve viewed Season1 history while current world is Season2.

- [x] Author HTTP/D1 and UI contract regressions for next-prepare authorization/CSRF/stale/replay, approved control eligibility, Season2 event preparation/progression/closure and independent historical Season1 reads. No tests run until final gate per owner.
- [x] Wire next-prepare through existing protected Admin boundary and Settings eligibility, five locales, CSRF/idempotency/single-flight and authoritative refresh. Keep no automatic Season3.
- [x] Generalize administrative initialize/reschedule/confirmation/stage/draw/publish/clock and closure projection for supported1/2, using the same exact source-authority guards as other Season2 mutations.
- [x] Separate actual world from viewed season state in public projections and validators. Support selected1/2 without fallback, dynamic seasonal memberships and correct historical archives; update selectors/current-season options and calendar controls from validated world reads.
- [x] Inspect syntax/types/diff and source-review; update lifecycle checklist implementation only if the protected1→2 path is wired throughout. Runtime/browser/CI acceptance remains open. No merge/deploy/remote D1.

Review focus: no unapproved activation, no inactive/stale Admin control, immutable historical Season1, no current-world clock used for historical result eligibility, no static inaugural membership assumption for promoted/relegated Season2 clubs, no DEV relabeling/authority, no implicit Season3, no old results after reset.

Source review corrected two P2 findings: History must retain selected season in URL; Calendar arrows must use validated public season limit. Inspection also corrected Fixtures inaugural-only availability and clearing of unknown Season2 membership placeholders. The outdated Settings renderer is synchronized with actual full markup. New exported browser scenario is authored for the final disposable seeded-world harness, not run. Syntax/whitespace checks pass; full tsc reports only the same9pre-existing diagnostics. Implementation credit19/22 only; runtime/browser/CI acceptance remains pending.
