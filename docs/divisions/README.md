# Football Architect — DIV-ASSET approval archive

**Status (2026-10-10):** A01–A05 design milestones **approved, 5/5 (100%)**; P01–P02 visual samples **approved, 4/16 (25%)**. The authoritative issue is [#60](https://github.com/FraGioco9/football-architect/issues/60).

This directory preserves approved decisions, symbols, color palettes, specifications and production records for the **division identity project only**. It does not contain game-ready logos and does not modify game integration. The current repository mainline contains catalogues and documentation, not an active game build.

## Design documents

- [design-direction.md](design-direction.md) — A01: approved historical-institutional heraldic art direction.
- [concepts.md](concepts.md) — A02: 16 approved division concepts and symbols.
- [palettes-and-type.md](palettes-and-type.md) — A03: 16 original palettes (48 fixed HEX values), typography and monochrome rules.
- [technical-spec.md](technical-spec.md) — A04: SVG requirements, variants, viewBox and naming.
- [design-review.md](design-review.md) — A05: design review, accepted differentiators and deferred production checks.
- [production-log.md](production-log.md) — P01/P02 approvals, image checksums and future phase log.
- [p01-visual-brief.md](p01-visual-brief.md) — Approved Italian image references in descriptive form.
- [p02-visual-brief.md](p02-visual-brief.md) — Approved English image references, including the corrected ENG-2 shield.
- [inventory.json](inventory.json) — Planning inventory of 16 divisions and 64 **expected** SVG variants.

## Original PNG preservation

All four approved P01/P02 PNG originals are preserved in the persistent ChatGPT Library folder `/Football Architect/DIV-ASSET/`. **Their binary contents have not been uploaded to this GitHub branch.** Exact original filenames and SHA-256 digests are recorded in [production-log.md](production-log.md). Original Italian-language PNG filenames are preserved as immutable identifiers, not translated.

**Master SVGs produced: 0/64.** The approved PNGs are visual references, not finalized vector exports.

## Future approval protocol

For each newly approved sample, update this dedicated branch and draft PR #69: preserve the new original image in the Library and update the log/inventory with identifiers, approval status and integrity metadata. Upload actual binaries to GitHub only through a supported transfer method. Never replace an approved image without fresh approval. **All new GitHub prose, commit messages, PR/issue content, code comments and metadata should be written in English**, while official division names retain their native spelling.

No merge, deployment, game-code changes, database changes or automatic runtime integration.
