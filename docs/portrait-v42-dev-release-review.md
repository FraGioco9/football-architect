# #733 — V4.2 DEV evidence candidate (review only)

This read-only evidence bundle is at `docs/portrait-v42-dev-evidence-candidate.json`.
It is **NOT a release manifest, approval registry, per-image owner approval
receipt, external manifest digest pin, or authorization to deploy**.

## Audited inputs

- Cloudflare `football-architect-dev` D1 (read-only SELECT), 150 V4.2 rows:
  **26 approved with exact canonical asset keys, 124 pending with NULL**.
- Only the 26 owner-accepted DEV IDs: 44–63, 93, 98, 141, 145, 148, 190.
  Relevant owner final visual QA and prior DEV deployment: [issue #722](https://github.com/FraGioco9/football-architect/issues/722).
- Frozen V4.2 fingerprint and SHA-256 of each exact UTF-8 `snapshot_json`
  D1 value. Aggregate sorted tuple digest:
  `29029a993424f920f41056f0d37e71c1b806695d8c335eb873cc47460ba3d409`. It agrees with the previous read-only #733 audit.
- All 26 WebP paths retain the identical Git blob identities from the approved,
  merged [PR #730](https://github.com/FraGioco9/football-architect/pull/730)
  baseline `0cb49c25c70298f673fb82db7acf88d53cd99a59`. Each image is 320×362 VP8X with alpha and a
  distinct SHA-256 and Git SHA-1; `tests/portrait-dev-evidence-candidate.test.mjs`
  verifies current bytes.

## Independent release-review prerequisites

1. Human reviewer verifies each tuple against its approved frozen player
   identity, exact image bytes and DEV visual acceptance. A DEV D1
   `approved` status or a merged Git file **cannot replace** this review.
2. Capture individually reviewed, immutable, versioned *DEV-specific*
   approval receipts and approval registry with source evidence.
   Their `approvalReceiptSha256` and `approvalRegistrySha256` must
   be independently justified; do not fabricate them from this candidate.
3. Only after that review, construct the exact target-specific release manifest
   `release-manifests/player-portraits-v42-dev-preview.json` under
   `tools/portrait-release-gate.mjs`. Approve the **exact manifest bytes**
   and pin its SHA-256 in trusted release configuration **outside the repo**.
   The digest of this candidate is **not** an external release pin.
4. Migrate static portrait consumers and `portraitAssetKey` atomically,
   proving the 26 visible DEV portraits remain visible and the other 124
   continue to show silhouettes. A Draft #739 build with no release pin
   currently contains **zero** portraits and must not replace live DEV.
5. Run targeted tests, exact-head CI and Chrome/Safari mobile/desktop
   fallback/cache/network QA. Require separate owner approval for
   merge/deploy; Production needs an entirely separate review and pin.

**HOLD:** No new portrait approval, generation, Cloudflare writes, deployment,
remote D1 change, workflow dispatch or PR merge is performed by this packet.
