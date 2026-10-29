# Season-aware sporting engine and approved Season2 authority

Goal: remove Season1 identities from pure result/knockout/draw generation before enabling the still-incomplete persistent next-season transition. Keep #315 at18/22 (81.8%) until that full transition is implemented.

- [x] Author regression coverage for Season1 draw compatibility, nonconsecutive Season2 pot qualifiers, season-scoped match/tie/result IDs, independent1→56 simulation, invalid season IDs/authority/schedule bindings and missing durable Season2 approval. Do not execute tests per owner.
- [x] Extract the server-owned canonical catalogue builder without altering Season1 approval/hash checks. Extend the existing read-only Season2 loader to return a fully validated/frozen sporting snapshot only after reconstructing the closed source season and matching immutable approval JSON/hash/generation/archive.
- [x] Make deterministic score generation, calendar ownership in the knockout engine and persisted draw payloads season-aware. Reuse the same approved formats and qualification-pot ordering; keep Season1 bytes stable.
- [x] Require a deep-frozen generator-registered schedule at progression entry, bound to the exact snapshot; reject raw/cloned/mismatched schedule fields while retaining the synchronous entry contract.
- [x] Inspect syntax/types and independently review. Record unexecuted coverage and leave activation/routes/D1 lifecycle commands closed until they are generalized atomically.

No new sporting policy, implicit owner snapshot approval, DB migration/deployment, merge, CI/test execution or Season2 world activation is authorized by this preparatory engine refactor. Existing future activation approval remains an explicit durable Admin action.

Independent source review: no blocking defects. Season1 compatibility coverage compares prior pot logic and literal draw JSON but reuses current fixture generation; independent archived fixture baseline remains part of final acceptance. No test execution. TypeScript reports only the same9pre-existing errors; no activation/checklist credit beyond18/22.
