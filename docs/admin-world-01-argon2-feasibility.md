# PR #316 — Argon2id Worker compatibility record

Status: local feasibility **PASS** on GitHub Actions exact HEAD `77282c5171310c61ba9cc8e6e18adbda4fce7788` (Admin World foundation checks); **not** production acceptance.

## Decision and implementation

The earlier `hash-wasm@4.12.0` adapter was incompatible with workerd because it called `WebAssembly.compile()` dynamically. Its failure on `2ad7a75` is retained in GitHub Actions history.

The replacement is `argon2id@1.0.1` (OpenPGP.js project; MIT licensed), with committed `backend/package-lock.json`. Its packaged `dist/simd.wasm` and `dist/no-simd.wasm` are imported statically as compiled `WebAssembly.Module` values. The loader calls `WebAssembly.instantiate(module, imports)`. There is no runtime download, dynamic code compilation or fallback to another algorithm.

Passwords retain the approved PHC format with Argon2id version 19, memory cost **19456 KiB (19 MiB)**, **2 iterations**, **1 lane**, **16-byte random salt**, **32-byte tag**, and strict Unicode/code-point limits. The implementation rejects malformed or weakened PHC parameters; no password normalization or truncation.

The upstream adapter allocates a fixed WebAssembly linear memory of 1040 pages (approximately 65 MiB) when the instance loads, independent of the 19 MiB Argon2 work factor. Its memory is mutable, so the application serializes all hashing/verifying operations through one bounded queue (at most four in flight or waiting) per isolate. Queue saturation is fail-closed. The dedicated Worker tests exercise hashing, wrong-password rejection, fresh random salts, invalid encodings and concurrent calls; the Node 22 / SQLite suites remain separate.

## Remaining acceptance gates

- Independent published Argon2id known-answer vector; verify byte-for-byte rather than relying solely on self-consistency.
- Memory and CPU benchmarks under worst-case login concurrency; confirm suitability for intended Cloudflare Worker plan and isolation policy.
- Persistent rate limiting, generic login errors, auth/session repository, recovery, and commit-time credential revocation.
- Backend D1 integration against official local Worker bindings, transaction isolation and restart durability.
- Static-asset publication audit proving that backend code, binaries and credentials cannot enter the public site.
- Production infrastructure provisioning and topology review require separate authorization.

No real operator credentials, remote database, deployment or merge. Keep the PR Draft/HOLD until the full foundation and exact-head acceptance have been demonstrated.
