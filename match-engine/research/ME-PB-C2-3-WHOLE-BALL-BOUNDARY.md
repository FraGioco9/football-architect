# ME-PB C2.3a — Real 60Hz whole-ball line exit (geometry only)

**Status:** implementation; exact-head CI required. C2.3 genuine physical SHOT witness for both teams is still not accepted.

One ball radius is exactly `0.11m` from the canonical physics core; there is no separate stadium, pitch, shoe, or tuning setting. A sphere is geometrically completely past a field line only after its actual centre moves at least one radius outward beyond x = +/-52.5m or y = +/-34m. We measure consecutive authoritative 60Hz Rapier ball centres in the same physical fixture, interpolate only a geometric time fraction between recorded states, and retain the first outward whole-ball event as immutable evidence.

The full sphere fitting between the uprights and below the crossbar is a **geometry candidate**, not an awarded goal, on-target shot or official out-of-play event. Simultaneous corner-line crossings remain distinguishable; there is no inferred on-field ordering, officiating, goal frame collision, kickoff or score.

The real-Rapier positive regression uses two independent temporary 22-player match fixtures: a ball initially inside x=+47 or x=-47 at y=+30 (outside the goal opening) rolling outward through the real world. It must actually travel past the whole-ball threshold in consecutive physical ticks and reproduce identical frames after reset. This is deliberately **not a physical shot attempt**: football autonomous actions are disabled, so such an exit never upgrades C2.3's still-pending real home/away shot requirement. Synthetic unit vectors check four line directions, near-post/crossbar exclusions, diagonal corner ambiguity, inbound non-events, invalid inputs and clock anti-forgery.

Only internal fixture frames call this observer on the actual Rapier ball. The observer itself is a pure mathematical lens and must not be used with synthetic data to claim a real match action. `officialOutOfPlay`, `shotOnTarget`, `goalScored` and `officialMatchResult` are always null. No changes to canonical physics, 22-player motion, ball impulses, score authority, public site, D1, or Preview.

Main local DEV LAB: `/dev/match-engine`. Only under collapsed **More physics** does the UI show `whole ball` boundary evidence. No new section or extra messages.
