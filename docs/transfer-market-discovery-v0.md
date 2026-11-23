# Transfer Market — discovery V0 boundary

Status: **implementation in Draft/HOLD** under [#587](https://github.com/FraGioco9/football-architect/issues/587), coordinated with [#755](https://github.com/FraGioco9/football-architect/issues/755). This is the **read model only**, not a functional transfer or asset marketplace.

## Delivered in this first slice

- `assets/transfer-market-discovery.mjs` contains pure query and projection helpers around the already-approved public `GET /api/players` contract.
- Server-side name and primary-position search, validated 50-record offsets, stable player detail links and current-club roster links.
- A V1 affiliation with `clubKey=null` is presented as `free-agent`, while **all** players have `marketAvailability=not-published`. Unaffiliated does not imply listed or purchasable.
- Explicit allowlist of output fields. No private generator data, user identity, contract financial terms, synthetic prices or agent-mandate information.
- Automated unit tests for query encoding, invalid parameters, forged club IDs, duplicate players, response pagination and non-disclosure.

## Not delivered / not authorized here

- No Transfer Market page, navigation entry or new public endpoint in this slice.
- No transfers, agent bids, club concessions, mandate listings, negotiations, approvals, auction, sale, escrow, wallet, ARC/EUR exchange, fees, salaries, payroll, ledger, migration, data backfill, purchases, production enablement or deployment.
- No V1 player–club affiliation semantics are changed. In particular, this module does not alter `player_club_affiliations`, current club authority, or world-reset persistence.
- `#755` remains **DRAFT** and cannot be promoted to economic implementation by merging this independent read-model slice.

## Next bounded development sequence (requires separate review)

1. **Discovery page**: create `/transfer-market` from the canonical generator, using the existing shell, filters, stable skeleton sizes, 5 locales and dark/light; add canonical routing, DEV/hosting and browser checks. Continue using only public player records. Do not label a player as for sale.
2. **Offer availability**: specify authoritative listing/eligibility data and permissions. Do not infer it from club affiliation. Add read-only listing projection only after its rules and source are approved.
3. **Transfers**: implement offer/negotiation, conflicts and audit only once the owner approves the contracts V2 and the financial settlement interfaces, liquidity checks and ledger from #755.
4. **Agent/concession marketplace**: keep separate from footballer club-to-club transfers. Mandates/concessions are rights to manage/represent, **not ownership of players or club treasuries**. EUR/ARC settlement needs legal/payment review and separate explicit authorization.

## QA before promoting this PR

- `node --test tests/transfer-market-discovery.test.mjs`
- Confirm public `/api/players` payload still has `clubKey`, `clubName`, `primary_position`, `display_name`; no private fields.
- Ensure only the scoped new files differ from current `main`.
- Exact-head required CI where applicable. Do not label hosted/mobile checks PASS without running them.

Rollback: remove the two V0 files and this design boundary document; no data migration or user state is involved.
