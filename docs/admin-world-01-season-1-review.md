> Owner decision update — 28 October 2026: the owner approved this complete review package at immutable commit `8126da13d0f36a1a2087f66f21626d06fe00c873` ("Approvo, procedi con il prossimo blocco"). The separate `backend/catalogues/season-1.approval.json` records the decision, reviewed commit, canonical source and unchanged hashes. The text below is the historical review handoff; its pending-approval statements describe that earlier checkpoint. Runtime loading is now separately reviewed/tested in `backend/src/approved-season-one.ts`. Infrastructure/deployment authorization remains separate.

# Season 1 production manifest review — pending owner decision

PR #316 / issue #315. This is a concrete review package, **not production approval**.

## Exact review target

- Immutable canonical source: `c187d4ebfc0240515e79b4dbd9f3dceea3f293cc`.
- Complete candidate: [`backend/catalogues/season-1.candidate.json`](../backend/catalogues/season-1.candidate.json).
- Candidate state: `pending-owner-review`, `productionApproval:false`, `manifest.approvalReference:null`.
- Includes all 320 canonical identities, all 18 full rule definitions and exact Season 1 bindings. No fixtures, results, simulated standings or DEV seasons are included.
- D1 remains the operational world/immutable season authority; this candidate is initialization review input only.

| Canonical digest | SHA-256 |
| --- | --- |
| participantsHash | `d31b39b48190eed3e165931be573391d17298321fdb3ca71e922346aa3749d1a` |
| rulesHash | `a87d7e02bb8045a4b081ca5b8b7c6d2032736f0efb4238f99032b6f638a8a67a` |

These two canonical hashes are independently reconciled using Python hashlib as well as the Worker-compatible validator. They identify data; they do not certify sporting validity. Raw file hashes below additionally cover club catalogue metadata, source ordering/formatting, the participant-only selection and the 56-day calendar source. The manifest's current two-hash schema does not itself authenticate the world-calendar model; its separately pinned checksum is part of this review and a future approved loader must enforce the reviewed source binding.

## Already approved participant selection

For each of IT / ENG / ES / DE / FR / PT / NL / BR: tier 1 uses IDs 1–16, tier 2 17–32; Sovereign uses 1–3 and Federation 4–6. IDs 33–40 remain inactive. Domestic places: 256. International entries: 48 distinct, 24 in each cup. This applies to initialization only; later selections require certified sporting outcomes.

| Competition | Participant slots in each applicable country | Full rules version |
| --- | --- | --- |
| IT-1 | 1–16 | `domestic-top-v1` |
| IT-2 | 17–32 | `domestic-second-v1` |
| ENG-1 | 1–16 | `domestic-top-v1` |
| ENG-2 | 17–32 | `domestic-second-v1` |
| ES-1 | 1–16 | `domestic-top-v1` |
| ES-2 | 17–32 | `domestic-second-v1` |
| DE-1 | 1–16 | `domestic-top-v1` |
| DE-2 | 17–32 | `domestic-second-v1` |
| FR-1 | 1–16 | `domestic-top-v1` |
| FR-2 | 17–32 | `domestic-second-v1` |
| PT-1 | 1–16 | `domestic-top-v1` |
| PT-2 | 17–32 | `domestic-second-v1` |
| NL-1 | 1–16 | `domestic-top-v1` |
| NL-2 | 17–32 | `domestic-second-v1` |
| BR-1 | 1–16 | `domestic-top-v1` |
| BR-2 | 17–32 | `domestic-second-v1` |
| int-1 | 1–3 (all eight countries) | `international-int24-v1` |
| int-2 | 4–6 (all eight countries) | `international-int24-v1` |

## Canonical rules proposed for this initialization

The following summarizes the existing canonical JSON, without changing its policies or implementing the later season engine. The full per-competition rules in the candidate control the review; a summary is not a substitute for those bytes.

| Rules family | League | Sporting outcomes / knockout stages |
| --- | --- | --- |
| domestic-top-v1 (8 competitions) | 16 clubs, double round robin, 30 rounds / 240 matches, 3/1/0 points | 1st champion; 2–12 remain; 13–14 two-leg playout; 15–16 relegated. Playout winner remains, loser relegated. |
| domestic-second-v1 (8 competitions) | 16 clubs, double round robin, 30 rounds / 240 matches, 3/1/0 points | 1–2 promoted; 3–6 promotion playoffs (3v6, 4v5, two-leg semifinals; one-leg final); playoff winner promoted, others remain; 7–16 remain. |
| international-int24-v1 (Sovereign/Federation) | 24 clubs, six matches per club / three home and three away, 72 league matches, 3/1/0 points | 1–4 to quarterfinals; 5–12 to two-leg playoffs (5v12, 6v11, 7v10, 8v9); 13–24 eliminated. Quarterfinals/semifinals two legs; neutral one-leg final. 93 total matches per cup. |

Domestic tie breakers, in order: points; head-to-head points, goal difference and goals scored with reapplication; overall goal difference; goals scored; wins; reproducible draw. International tie breakers: points, goal difference, goals scored, wins, away goals, away wins, opponents' points, opponents' goal difference, opponents' goals scored, composite club ID. Two-leg ties use aggregate, extra time and penalties; single-leg ties use extra time and penalties. Domestic and international two-leg `homePolicy` is `higherOriginalTableRank`; domestic playoff final uses the same policy and cup finals are neutral. Domestic `qualificationPolicyId` is `none`; the cups reference `int24ChampionAwareV1` and `int24SixOpponentsV1`. These policy identifiers and their implementation/eligibility prerequisites must not be silently interpreted as completed season/draw functionality.

Calendar source: 56 days / eight weeks, N01–N33, I01–I12, Federation final D53, Sovereign final D54, transition D56. Source is design-only and contains event markers, not generated fixtures, played results or an automatic clock. Immutable source: [world-calendar-model.js](https://github.com/FraGioco9/football-architect/blob/c187d4ebfc0240515e79b4dbd9f3dceea3f293cc/assets/world-calendar-model.js).

## Immutable raw source checksums

| Source file at the above revision | SHA-256 |
| --- | --- |
| `data/clubs.json` | `48a8e2ba8299ef49455630c052ac038b19bebafdab4ba134deb95da23dcf05b7` |
| `data/divisions.json` | `06381dc661f1619b866987a8b9ecbf6b8abc7a7de5398cd6882bffb34a19b6f2` |
| `data/international-competitions.json` | `56ef86848e58010f31aeaba46fe5027dede3af2a33db4b558025cc8490f51f65` |
| `backend/catalogues/season-1.participants.json` | `f09cda2533f4cb8b77eac1fe5c5d96c992238530786ff49c7999715fc3770d93` |
| `assets/world-calendar-model.js` | `946fbc3825cdd3c00d957fd582c0d47d8af5c97124ff963f14dec6c47c44d7eb` |

## Reproduce without network, credentials or database

Using Node 22 from the repository root:

```sh
npm --prefix backend run catalogue:check
node --experimental-strip-types --test backend/tests/season-one-candidate.test.mts
```

Check is read-only and compares all candidate fields with a fresh reconstruction from the independently pinned canonical source bytes. It works with shallow CI/source-only checkouts. Missing/edited sources, altered rule/participant data, extra fields and forged approval metadata are rejected. `node --experimental-strip-types backend/tools/season-one-candidate.mts --write` regenerates only the fixed pending-review file; there is no approve/remote/database option. Source files use explicit LF attributes so Windows checkout conversion cannot invalidate the raw byte pins.

## Decision still required

The owner must accept or correct the complete canonical rule/version/hash set above as the production Season 1 initialization input, with an unambiguous review reference to the candidate's immutable commit. Participant approval is already recorded and does not need to be requested again. If any canonical source changes, reconstruct/review a new candidate and its hashes; never edit the approval reference to bypass validation.

After that sporting-data decision, a separately reviewed code change may pin the accepted immutable manifest and trusted canonical catalogue in the production loader, enforce Season 1-specific selection/source validation, and prove real local Worker/D1 initialize/read with actor/time/revision and rejected drift. Copying the candidate, setting a flag or replacing its null reference is not authorization. The current runtime never imports this candidate or its tool. `loadApprovedSnapshot()` remains null; protected real prepare remains 422 with no sporting writes. Original implementation progress stays 5/20.

HTTPS/source trust, deployed CPU/memory/throughput, stronger compromised-password screening and remote D1 safety remain separate infrastructure/release gates. This review authorizes no merge, deployment, provisioning, real credentials or remote database work. PR #316 remains Draft/HOLD.
