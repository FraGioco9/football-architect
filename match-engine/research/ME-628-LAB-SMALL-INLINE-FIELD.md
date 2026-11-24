# #628 — LAB-SMALL-UI-01: one in-page field, no popup for visible scenes

## User-requested behavior
The Scenario dropdown is the sole entry point for all visible situations. A 1v1, 2v1, 2v2, 3v3 or advanced movement selection must **immediately replace the physics shown on the pre-existing 105 × 68 m field**, its ball-height graph and time/ball readouts. It must NOT open a separate pop-up pitch, controls or 11v11 panel.

## Implementation
- The original `match-engine/src/lab.mjs` owns a mutually exclusive active source: ordinary ball-only Rapier `createEngine`, original `createControlledActionLab`, or original `createControlledMovementLab`.
- Existing global Play, Pause, Step, Reset, 0.25×–4× Speed, field canvas, height graph and displayed ball information operate on the selected original physics session. The scene displays real native events and provisional score only as evidence, not a validated official match.
- Original menu shows **4 ball physics + 5 small-sided + 6 advanced movement situations**, and now actually runs them inline. Side HOME/AWAY is a compact native site-style dropdown beside the existing controls, displayed only for situation/movement. Bounce/physics advanced settings and 22-player observer controls are hidden for a small-sided scene and restored for a ball physics preset; the main field dimensions/slot do not change.
- The physical mover's 22 ordered *identities* remain for correctness, but small-sided shoes stay limited to 2–7 **real native Rapier collider participants**. The original B05 full-ball crossing stops an action exercise at dead ball: no virtual kickoff. Reset restages the source only before tick zero. Switching scenes disposes the previous source.
- The old diagnostic `<dialog>` code paths for all archived isolated action/movement regression scenes remain callable exclusively by **internal hidden QA launchers**, not from any user-facing Scenario menu. Metrics is an unrelated explicitly requested diagnostics feature; its modal remains as before.
- The historical `#actions` and `#movement` page deep links now select in-page S-01 / advanced post-pass instead of opening their old modal.
- The first-paint pitch, main toolbar location and ball physics functionality remain intact.

## QA gates
- Static guard: the visible Scenario launcher never calls the legacy modal open buttons; original main scene creates sessions directly, and uses one existing field/height/transport. 
- True Chrome: every five visible small-sided scenes × HOME/AWAY is selected from the **main** dropdown and advanced Side control; the old Action and Movement dialog remain closed. Same main field, 10 genuine original ticks and source events. Play/Pause/Step/Reset must advance/freeze/rebuild **the main** source, not a hidden modal. Advanced movement opens inline and ball presets restore their prior page structure.
- All original 17 Action LAB and 30 Movement DEV regression sessions remain testable by their internal hidden launchers.
- No merge, Ready, deploy, D1 writes, or promotion to complete 11v11. This is still a Draft/HOLD staged refinement.
