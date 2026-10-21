# World Calendar data contract — CAL-IMP-01

Spec: [CAL-01 #236](https://github.com/FraGioco9/football-architect/issues/236),
WORLD-TIME QA-06 frozen by the owner on 2026-10-21. Related design records:
[WORLD-TIME #94](https://github.com/FraGioco9/football-architect/issues/94) and
[INT-24 #234](https://github.com/FraGioco9/football-architect/issues/234).
The data contract below is CAL-IMP-01. CAL-01A/B/C/D stay frozen.
CAL-IMP-02 adds the Season/Week presentation described at the end of this document;
CAL-IMP-03–05 remain deferred.

## Boundary

`assets/world-calendar-model.js` is a pure, dependency-free library, following
the repository's browser-global/CommonJS model pattern. It exposes
`faWorldCalendarModel` in a browser and `module.exports` in Node. It is not
loaded by any HTML or publication-allowlisted in CAL-IMP-01. CAL-IMP-02 loads it
only on `/calendar`, together with the presentation runtime; both assets are
explicitly required and allowlisted. No live data source is added.

The library constructs season-day and round/stage markers, **not individual
club fixtures**. It does not read a clock, network, storage, database, DOM,
existing simulation or fixture generator. It cannot advance the world or
recreate historical results. Actual fixture/result data remains owned by its
existing or future authoritative source; this API does not accept score fields.

## Frozen timeline

The cycle has 56 real days: 55 active-season days plus D56 transition. It spans
eight real weeks. One active real day represents one simulated football week;
the internal behavior of the transition day is not defined by this contract.

| Days | Meaning |
| --- | --- |
| D01–D12 | Preseason, no official events |
| D13–D31 | N01–N19, one national marker each day |
| D16/19/22/25/28/31 | I01–I06 paired with N04/07/10/13/16/19 |
| D32–D33 | Midseason pause |
| D34/35/37/39/40/42/44/45/47/49/50 | N20–N30 |
| D36/38/41/43/46/48 | I07–I12 |
| D51 | Pause |
| D52 | N31 |
| D53 | Federation Cup final, then N32 |
| D54 | Sovereign Cup final, then N33 |
| D55 | Pause |
| D56 | Transition |

Totals: 39 official-event days, 16 active days without official events and
47 markers: N01–N33, I01–I12, FEDERATION-FINAL and SOVEREIGN-FINAL.
The six ordinary double days have `pairing: "double"`; D53/D54 have
`pairing: "final"` and do not increase that six-day count. All paired events
are ordered international before national. N31–N33 are postseason markers,
not extra regular league rounds.

I01–I06 are league phase, I07–I08 playoffs, I09–I10 quarterfinals and
I11–I12 semifinals. Separate final markers replace historical joint I13.
Older 43-slot, 49-day and 52+1 references do not govern this model.

## API and identities

### `createSeason(season)`

`season` must be a positive safe integer; strings are not coerced. Returns a
deeply frozen object with `schemaVersion: 1`, `model: "WORLD-TIME-QA-06"`,
`season`, design `provenance`, and an ordered `days` array of length 56.

Each day has:

- `id`: `season:{season}:day:{day}`; stable, season-qualified, independent of UI.
- `day`: integer 1–56.
- `kind`: `preseason`, `official`, `pause` or `transition`.
- `pairing`: `null`, `double` or `final`.
- `events`: ordered round/stage marker objects.

Each event has:

- `id`: `season:{season}:{marker}`, e.g. `season:1:I01`.
- `marker`: N01–N33, I01–I12, FEDERATION-FINAL or SOVEREIGN-FINAL.
- `family`: `national` or `international`.
- `phase`: `league`, `postseason`, `playoffs`, `quarterfinals`, `semifinals` or `final`.
- `round`: the numeric N/I marker index, or `null` for a separately named final.
- `competitionIds`: all 16 existing domestic division IDs for national markers;
  `sovereign-cup` and `federation-cup` for I01–I12; only the relevant cup for a final.

Cup keys are namespaced calendar identity keys, **not approved URL slugs** or
an implemented international competition catalogue. They do not change the
existing domestic competition model. A shared I marker contains two independent
competition scopes; it is not a match shared by the two cups. National markers
reserve timeline positions, not a guarantee that every division has fixtures
at every postseason marker.

### `projectSeason(season, options = {})`

Adds read-only observational state to `createSeason` without changing its
timeline. Options accept only `source`, `current` and `eventStates`.

```js
const model = require('./assets/world-calendar-model.js');
const calendar = model.projectSeason(1, {
  source: {kind: 'dev', reference: 'explicit fictional snapshot'},
  current: {season: 1, day: 17},
  eventStates: [
    {eventId: 'season:1:I01', competitionId: 'sovereign-cup', status: 'completed'},
    {eventId: 'season:1:I01', competitionId: 'federation-cup', status: 'scheduled'}
  ]
});
```

- `source`: `{kind: "unavailable", reference: null}` by default. `dev` and
  `authoritative` require a nonblank string reference. This is caller-supplied
  provenance, not authentication or certification of an official live source.
  A future adapter must enforce that trust boundary. Unavailable sources cannot
  supply current progress or event states. DEV provenance must remain visible
  in future UI, never relabeled as official simulation.
- `current`: `null` by default, otherwise `{season, day}` with a valid season
  and day 1–56. No epoch, date, timezone, timestamp, percentage or rollover rule
  is inferred. Browsing a different season does not change this observation.
- `eventStates`: an array, default empty. Each record must reference an event
  in the viewed season and one of its competition scopes and supply
  `scheduled`, `live` or `completed`. These are externally supplied aggregate
  event states; this lot neither calculates them from individual fixtures nor
  decides how a future adapter aggregates mixed fixture states.

The output adds `source` and, on each day, `relative`: `past`, `current`,
`future`, or `null` when progress is unavailable. Season comparisons precede
day comparisons. Each event adds `competitions`, an array of
`{competitionId, status}` records; missing lifecycle observations have
`status: null`, not an invented Scheduled or Completed value.

**Day-relative time and lifecycle are independent.** A past day with a supplied
Scheduled event stays Scheduled. Completed does not imply that this library
has a score. No score, fixture, real kickoff or result is generated. Temporal
selection/filter state belongs to later UI lots and is not accepted here.

All output containers are deeply frozen. Input values are validated and copied;
caller mutation after return cannot change an earlier projection. Repeated
calls are deterministic for identical arguments. Invalid options, unavailable
sources with observations, out-of-range time, unknown event/competition keys,
duplicate event/competition observations, unsupported lifecycle values and
extra score fields throw `TypeError`; no partially valid projection is returned.
Historical browsing must reuse supplied snapshots, never resimulate them.

## Implementation and verification plan

1. Write contract tests for all QA-06 placements and counts, identities,
   competition scopes, immutable snapshots, independent states, provenance,
   invalid inputs and browser/Node parity. Observe failure before implementation.
2. Implement the minimal pure model above, following the existing model export
   pattern. Run the focused tests and document the API and blocked decisions.
3. Verify generator consistency, publication isolation, existing regressions,
   the exact three-file scope and unchanged anti-deploy controls; open a Draft
   PR and inspect CI on its exact head. Do not merge or deploy.

Commands: `node --test tests/world-calendar-model.test.mjs`,
`node tools/generate-app-pages.mjs --check`, and the repository CI command
`node --test --test-concurrency=1 tests/*.test.mjs`. Browser regression suites
require an available Chrome executable; report any local environment failures
separately and inspect exact-head CI rather than marking them as local PASS.

## Deferred gates

CAL-IMP-03 owns the inline event details. CAL-IMP-04 must
wait for stabilized ROUTE-02 #235 and use canonical subpages without `/app/`
or `view=`. CAL-IMP-05 owns DEV/Preview and clock adapters; its live behavior is
blocked on WORLD-TIME epoch/timezone/day-boundary, kickoff, transition,
synchronization and authoritative lifecycle-source decisions. The current
contract does not approve those rules. Training and friendlies remain out of
scope, including preseason friendlies.

## CAL-IMP-02 — Season/Week presentation

`tools/render-world-calendar.mjs` uses the frozen model to generate one static
set of 56 day buttons. `templates/app-page.html` delegates its Calendar body to
the generator: only `calendar/index.html` receives the full plan and the two
calendar scripts; other generated documents retain their inactive empty shell.
No duplicate competition-specific calendar implementation is added.

Season displays eight rows of seven days. Week shows the selected seven-day
row as seven vertical cards, with Previous/Next controls bounded to weeks 1–8.
The row number represents seven real days in the cycle, not seven simulated
football days. No real dates or weekdays are invented. Ordinary doubles and
the two special final pairings stack international above national. FC/SC mean
the Federation/Sovereign finals and have full localized accessible labels.

The default is Season on desktop and Week on narrow or coarse-pointer devices,
including landscape iPhone. Valid session state takes precedence. The small
generated head bootstrap resolves the mode/week before CSS; the runtime then
enables controls and binds labels/selection. Without JavaScript, the entire
56-day static plan remains readable with disabled controls.

The session-only key `football-architect:calendar-selection` stores
`{version: 1, day: 1..56, view: "season"|"week"}`. Corrupt or denied storage falls
back safely; in-page interaction works without persistence. Selection survives
mode changes, viewport resize, language changes and reload. Resize never
changes an already selected mode. `window.faWorldCalendar.getSelection()` returns
a frozen `{day, view}` copy for read-only consumers. It exposes no simulation
or time-advancement control.

Native buttons expose pressed state; the selected day is the single tab stop
within the days group. Arrows navigate days (Up/Down moves seven days in Season
and one in Week); Home/End move within the seven-day row; Ctrl+Home/End select
D01/D56; PageUp/PageDown move seven days. Every action is bounded to D01–D56.
The selected-day announcement is a single line, not the CAL-IMP-03 details panel.
No `aria-current`, Past/Current/Future or lifecycle state is fabricated.

The UI is explicitly a season-structure plan with no live fixtures/results.
It does not expose a fake active season, clock, filters, Today, club context or
fixture links. Those remain later-lot work. EN/DE/ES/FR/IT, Dark/Light and
no-horizontal-scroll layouts are tested; the browser suite covers 320/390/844/
1440px, native keyboard, restore/resize, DEV/public parity and denied storage.
Chrome device emulation is not certification on a physical iPhone or Safari.
