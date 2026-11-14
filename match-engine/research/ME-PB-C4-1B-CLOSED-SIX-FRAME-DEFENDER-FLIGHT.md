# C4.1b — Closed six-frame real defender flight

Issue #480 / Draft PR #481. The physical action-outcome observer consumes
the existing authenticated real PASS and later opposite-team Rapier shoe
START+ACTIVE. It now retains precisely six subsequent consecutive 60Hz
Rapier ball positions, velocities, and actual shoe START IDs, plus frozen
cumulative 3D displacement and velocity differences.

The existing C1.2c independently replayed eight-scenario 22-player
fixture checks these closed records against a separate six-frame
measurement for both HOME and AWAY; no-contact runs cannot fabricate
an event. Nonconsecutive or untrusted physical feed is rejected.

**Physical evidence only:** a measured change of velocity is not an
isolated defender impulse, confirmed interception, tackle, recovery,
possession, pass completion or goal. All football outcomes remain null
and official possession false. The simulation, player movement, ball,
colliders and canonical world are unchanged. C4 remains open pending
explicitly approved gameplay adjudication rules.

No merge, deployment, remote D1, or public release is authorized.
