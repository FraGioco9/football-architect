# Temporary automatic match outcomes — #315 / PR326

Owner decision: automatically simulate matches now; implement the full game engine later. Build on the validated canonical Season1 calendars. No manual score-entry workflow. Preserve immutable past results when a future engine replaces this temporary policy.

Use a versioned SHA-256-derived integer score policy with no team/player strength data. Regulatory fixtures may draw; single-leg knockout and second-leg aggregate ties use extra time then a decisive penalty shootout. Store separate regulation/extra-time/penalty scores, resolution,fixture identity,algorithm version and source seed binding; do not invent player events/statistics. Policy distribution is a technical provisional choice, explicitly separate from approved sporting rules.

Choose seeded deterministic score generation over fresh random scoring on each request: existing calendar seed plus immutable fixture identity and context reproduce an outcome across restarts/retries. The full game engine remains future work. No new dependency or external API.

Protected start/day advancement accepts only concurrency metadata. Server reconstructs canonical calendar and draw evidence against independent approval; it cannot trust saved status flags or a client-provided calendar/score/readiness flag. Start activates day1. Advance processes the destination day's due fixtures before the resulting day is visible. Save an immutable season/day receipt, finalized score results,world revision and actor audit atomically with live-session/world/source guards. Replays return stored outcomes; concurrent keys have one winner; failed writes leave time and outcomes unchanged.

Supported first slice: initial league-phase fixtures, preseason and pauses, through day35. On day36 the first knockout participant prerequisites are not yet implemented: reject without advancing or writing. Do not skip an unimplemented scheduled activity. This explicit limit is temporary integration scope, not a complete lifecycle acceptance. Full knockout generation, derived standings/history/next-season qualification and reset remain subsequent tasks in #326/PR3.

One immutable daily receipt JSON (including all due fixture results) avoids hundreds of insert statements on a double matchday. Bind it to generation,season,day,calendar hash and simulation version. Derive completion from validated receipts rather than a caller flag. No remote D1,deploy,merge or workflow dispatch. Existing20-node checklist unchanged.
