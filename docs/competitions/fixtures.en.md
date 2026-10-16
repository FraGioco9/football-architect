# Competition Fixtures — first implementation

Issue: #147. Scope: the existing Fixtures tab in all 16 competition detail pages.

## Display decisions for review

- One round at a time, with a top-centered, labeled 1–30 selector styled with
  the shared site control and previous/next buttons. No repeated Fixtures heading.
  The round/match-count announcement is available only to assistive technology.
  Round 1 is the initial selection. Changing data preserves the selected round.
- Eight matches per round; home club, score when played, away club, timing and
  scheduled/full-time state. On narrow screens home/away clubs stack beside the
  score, preserving readable space for long names without truncation.
- No separate season selector or match-detail action in this first version.
- Dates and times remain unknown unless supplied. Supplied ISO timestamps must
  carry a time-zone offset; they are displayed in the browser's local time.
  This does not choose world-clock, kickoff or seasonal scheduling rules.
- Public pages contain an empty state with disabled navigation until a complete
  schedule is supplied. There are no fabricated official matches or results.

## Data and existing debug settings

The renderer validates a complete schedule: 240 games, 30 rounds, eight matches
per round, each active club once per round, and every directed home/away pairing
once. Scores are nonnegative safe integers in pairs or both null. Kickoff values
are valid explicit-zone ISO timestamps or null. Invalid input is rejected before
any current view is replaced. This feature displays supplied data and does not
implement a public fixture generator or match engine.

The existing DEV **Fictional standings** switch, **0–30 matchdays** slider,
**Reset current page**, **Reset all** and sessionStorage preferences apply to
Fixtures too. There is no additional debug panel, switch or persistence key.
The existing deterministic DEV model supplies both views; future scores are
removed and marked scheduled. No fictional-preview notice is displayed in Fixtures.
Turning the switch OFF or resetting restores both views. Preview data and its
generator remain excluded from publication.

## Implementation and verification

- [x] Generate accessible, localized Fixtures controls in the shared page generator.
- [x] Add a display-only runtime with validation, round navigation and rollback snapshots.
- [x] Connect the existing DEV controls to the same result model as standings.
- [x] Verify all 16 routes, 30 rounds, unknown/zero scores, invalid data, themes,
  five languages, 1440/390/320 widths, session restoration and both resets.
- [ ] Owner review and manual PC/iPhone Safari QA of the dedicated Draft PR.

The existing competition tabs, standings, inline Compact division logos, club
identities, flags and branding remain in scope only for regression checks.
No deploy, database change or manual workflow is part of this implementation.
