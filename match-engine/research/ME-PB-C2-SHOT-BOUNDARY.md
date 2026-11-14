# C2.1 — Provisional 3D shot boundary observations

The same 60Hz Rapier ball and exclusive authentic shoe START that produces a provisional shot also provides an optional read-only 180-tick shot centre trajectory. First crossing of x=±52.5m goal-line planes or y=±34m touchline planes is interpolated from consecutive measured ball centre positions. The 7.32m×2.44m goal opening is a centre-only geometric diagnostic, not a valid goal, not whole-ball-out and not a shot-on-target award.

Synthetic geometric vectors are used only for positive/negative unit tests. Independent 155-tick actual 11v11 Rapier sessions verify fixture integration and deterministic replay. Every official goal, shot outcome, possession and score remains null and temporary-score-v1 stays authoritative. No external commands, additional physics knobs, API, real roster, production deploy or remote D1 changes. Parent C2 is open pending real general shot/boundary acceptance.
 
## C2.2 — Same-world, bounded shot aftermath and genuine follow-up shoe START

For a provisional shot that originated from one exclusive Rapier START+ACTIVE, retain a frozen series of actual 60Hz ball-centre positions (one sample at the shot tick and up to 180 subsequent ticks). Accumulate measured 3D path distance, XY ground-path distance and maximum recorded ball-centre height. Do not estimate a hypothetical ideal trajectory, shot quality, score or match control. Stop when the **first** later shoe START is observed, when a measured pitch plane is crossed or when the 180-tick window expires. If shoe START and pitch-plane crossing share a 60Hz step, the order is **ambiguous**.

Pure unit vectors test geometry, negative provenance, ambiguity, finite 180-tick expiry and immutable projection; they must not be cited as physical successful shots. Integrated real 11v11 Rapier replay checks consistency, bounded samples and unchanged scoring. The local LAB plots historical shot-centre positions only when a genuine shot episode exists, and exposes measured path/height/read-only contact type. C2 still requires further shot-action/goal-line validation and does not make an official goal.
