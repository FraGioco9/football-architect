#628 Phase M2 — controlled movement-only DEV scenes

## Scenarios
1. **Approach**: measured 22-player motion toward the current stationary Rapier ball, not a touch.
2. **Brake**: measured positive speed followed by reduction; a hard blocked-body stop is never counted as free-space braking.
3. **Turn**: gradual observed heading change using post-collision velocity, not a target-angle shortcut.
4. **Recovery**: reports only an actual canonical screen and coordinated response to a currently tracked opposing player's XY; it may honestly show no witness.

All four can be mirrored HOME/AWAY before tick zero. Each uses ONE accepted Rapier ball world (standard physics, no shoe colliders) plus the SAME canonical 22-player kinematic mover. Player positions cannot affect the ball here. No artificial mid-run ball/player teleport, scenario-specific action policy, fake contact, interception, possession or score. A claimed motion witness requires measured player frames; no movement target can grant a football event.

## Browser and QA
A compact desktop-only Movement LAB dialog alongside the existing Action LABs reuses the field scale and Play/Pause/Step/Reset transport. It shows all 22 positional markers, focus player orientation, observed speed/path/turn/deceleration and minimum 22-player separation. The unchanged Action LAB dialog still owns the five genuine shoe-based football actions. Explicit localhost DEV-only module routes with public negative security tests.

Exact-HEAD Node / Chrome / FULL acceptance remains distinct. Phase M further requires post-pass support, recovery under real opposition, contact separation and realistic player dynamics; Phase I decisions, tactics and ordinary 11v11 remain out of scope. Safari/iPhone N/A by user decision. HOLD: no merge/deploy/remote DB.
