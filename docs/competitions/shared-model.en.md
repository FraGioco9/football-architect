# Shared competition model

All sixteen domestic divisions use one page renderer and one competition model.
Country, tier, name, badge and club identities remain catalogue data. No page
owns a separate sporting implementation.

## Contract

- One immutable profile defines 16 places, provisional participant allocation,
  a double round-robin preview (30 rounds, 8 games per round, 240 games), and
  one league phase. The format is a preview contract, not approved gameplay.
- Official scoring, tie-breakers, promotion and relegation remain explicitly
  undefined. Existing fictional preview scoring and ordering stay isolated in
  the development data module.
- The generated manifest includes the shared profile once. All consumers
  validate it against the same model, including participant identity and order.
- One view catalogue supplies markup, initial view selection and URL routing.
- A direct renderer emits shared and route HTML without rewriting already
  rendered fragments. Full route documents retain their initial SVG badges,
  flags and canonical deep links. History has its own runtime module.
- Public output keeps its fail-closed allowlist. Development results never
  become public data. Existing History, Stats, fixtures and mobile behavior
  must be preserved.

## Implementation and verification

1. Add model tests for all sixteen divisions, profile tampering, duplicate or
   incorrect participants and immutable configuration. Observe failure first.
2. Add the shared model, consume it in generation, runtime and preview data,
   and derive schedule limits from the profile instead of repeating literals.
3. Extract the detail renderer and History runtime; update asset loading and
   publication checks. Keep DOM identifiers, accessibility and translations.
4. Regenerate all pages and the manifest. Run generation checks, targeted
   runtime tests and the complete sequential site suite. Review the diff and
   open a draft pull request; no merge or deployment.

Review focus: direct refresh in each of six views; unavailable seasons;
completed seasons without a current matchday; incomplete/unapproved manifests;
initial SVG rendering and mobile/desktop identity parity.
