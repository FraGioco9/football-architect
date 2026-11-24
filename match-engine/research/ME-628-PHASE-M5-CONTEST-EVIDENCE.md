#628 — Phase M5: observed opposition motion and genuine opposing shoe contact

## Accepted physical source, no new action policy

The existing **HOME opponent-first CONTROL** fixture already provides three independent facts from one Rapier world and one canonical 22-player mover: HOME #10 actual exclusive shoe START and executed PASS at tick 1; observed movement of canonical AWAY #7 in the intervening ticks; real AWAY #7 shoe-ball START at tick 91 (original selector chooses an opposing clearance). The later HOME #9 shoe-ball START does NOT verify reception and neither side receives possession or a confirmed tackle.

## Controlled Movement LAB M-08

- New **Opposing shoe contest (HOME)** is a read-only adapter to the ORIGINAL `createControlledActionLab(RAPIER,'control',{controlScene:'opponent-first',controlSide:'home'})`. The source remains the original `footContactSnapshot()`, original uniform action and original 22-player kinematics; no duplicated executor, secondary football authority or simulated contact.
- Highlight HOME #9 and actual AWAY #7 on the same field. Measure AWAY #7 cumulative path only from consecutive 60 Hz canonical XY samples **after** the authentic PASS until its authentic opposing shoe START, plus minimum real sampled XY distance between the two players and minimum separation across all 22.
- A positive contest witness requires all three independent conditions: true prior original Rapier PASS, **actual later original opponent shoe-ball START**, and measured opponent motion over 0.25 m. Geometry, assigned target, pressing decision, near-ball distance or selected menu entry are never contact evidence.
- Strictly bound to HOME. AWAY opponent-first was never independently source-accepted and remains blocked; the prior M4 HOME/AWAY **unopposed** CONTROL pass remains available.
- Reset deletes the contact witness and accumulated path; it cannot fabricate an event. The unopposed post-PASS case remains a negative comparison, as do the earlier no-opponent and no-contact cases.

## Physical boundaries

- The mover enforces **0.98 m canonical planar separation**; this is a *kinematic collision-rejection guard*, not proof of a physical Rapier player-body collision. The M5 readout explicitly reports `verifiedRapierPlayerBodyContact: false`. The only new positive contact attested is **actual opponent shoe–ball START** at the original recorded tick.
- Do not credit tackle, interception, pass completion, official match action, possession or goal. No extra real Rapier body colliders were created and the original football selector was not changed.

## Acceptance

- Node: deterministic two-session replay to tick 220; original source PASS tick 1 and genuine opposition START tick 91; actual measured AWAY #7 path, min 22-player spacing, absence of verified body contact, no unearned receiving witness, read-only no-contact comparison and illegal AWAY/invalid side guards.
- Desktop Chrome: original five Action LABs plus Movement LAB M-08 positive witness after 110 steps, opponent marker and metrics, reset/no-event negative and selector state. Existing browser viewport/security tests must pass on **exact PR HEAD**.
- Keep #633 **Draft/HOLD**, no merge, production/cloud deployment or D1 changes. Next accepted gate: source-authenticated **player-body physics** (not only kinematic spacing) and real support-lane behavior, before Phase M closure; Phase I/T/F and C2–C5/D1–D5 remain OPEN.
