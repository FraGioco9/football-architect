# C2.3m — Same-source press/support arbitration and real oriented shoe race

Read-only research for #480, existing Draft/HOLD PR #481. No new
movement policy, artificial ball impulse, collider relocation, heading
change, altered 35m shot range, adjudicated possession or official goal.

**Why:** physical C2.3l four-world A/B proved 53 additional AWAY
post-CARRY support frames, but **zero** attacking advance gain, zero
additional real shoe events, zero shots. HOME unchanged. AWAY support
ends around tick600 even though the genuine source CARRY was at tick567,
far inside the 150-tick carry lifetime, the PASS was tick292 inside
the 480-tick total lifetime, and the forward–ball gap was <12m.

**Method:** in HOME IT and AWAY DE actual canonical 22-player
fixtures, construct a second independent witness mover. Feed it
ONLY the actual prior Rapier ball position and then replay ONLY
authenticated same-tick actual Rapier pass/carry/end event identities
**after** the genuine fixture step. Assert all 22 witness player XY
match the 22 true body positions delivered to Rapier, at all 720
steps, before trusting the witness's facing and active presser IDs.
This witness cannot mutate the fixture or supply real shoe contacts.

At fixed ticks 532–720 log the true assigned `attack-support-intent`
and `press`, current presser, prior verified PASS and CARRY age,
real active START contacts, and the actual oriented shoe proxy
position/facing/estimated static distance from the **post-step**
Rapier ball using the same `footProxyTransform` as the physics
engine. Body-ball proximity, a low computed static shoe clearance
or a pure alternative tactic are **never** Rapier START+ACTIVE.

On the real preceding player frame and ball state, run the existing
*PURE* support selector twice: (1) without excluded presser, and
(2) excluding the real next presser. Do not use either result to
drive physics. If the same forward ceases to be eligible only because
it became the current presser, report that as an assignment priority,
not as a proven contact, a dribble or a tactical solution.

Require a genuine HOME-7 shoe START and actual PASS at AWAY tick694;
no synthetic goal/shot. HOME negative scenario must retain no relay.
The exact current policy and original physics stay unchanged.
Future choice: a **separately approved** on-ball press-vs-support
handoff policy trial, with proper A/B and independent replay; never
force a shoe or re-label body proximity as a collision.

Register new Node test in the explicit match-engine `npm test`
list. Accept only exact-head CI green. Top-level C2 remains open
and #480 stays at 11/20 (55%). No merge, deploy, remote D1.
