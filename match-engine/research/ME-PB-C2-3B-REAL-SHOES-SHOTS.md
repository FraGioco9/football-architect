# C2.3b — Real Rapier shot witnesses from prepared attacking situations

**Status:** new exact-HEAD QA required; **C2 parent remains open**. Local 22-player research setup, not scored gameplay.

## Why a prepared situation is needed

The first 8 × 480-tick unmodified default-formation matrix generated **zero genuine shots** despite some real shoe contacts and passes. Pure decision tests were not physical evidence. Ordinary starting positions do not place an attacking forward inside an opponent's third.

## Closed, local opt-in

The researchShotAttacker option (only "home" or "away") is accepted only with autonomousActions true in a sealed local fixture with grounded roll scene. Ball XY must be within the attacking third (25–40m toward the intended goal, |Y| <= 10). At physical initialization, **one existing forward, player #10** is positioned 0.28m behind the ball. BOTH the actual autonomous mover and its Rapier shoe collider receive the identical initial transform BEFORE tick zero. The same 22 canonical IDs, teams, roles, 60 Hz movement limits, gravity, single match ball and global response apply. No contact is claimed at tick zero, and no player or ball is moved artificially after physical execution begins.

The option is not connected to the browser, production calendar, rosters, remote data, or official match action command. The user's primary LAB still chooses a ball drop point and presses Play, with diagnostics collapsed.

## Shot policy

The uniformly shared policy checks the centre goal lane and two ±3.1m goal-mouth aims against the current positions of all 22 players. It accepts only a 2.4m-clear path and a physically plausible <=35m shot range. A frozen provisional shotTarget represents INTENT only. To produce a true kick, the SAME real Rapier shoe must produce exclusive START+ACTIVE on the exact action tick, satisfy existing gap and height/speed limits and the shared cooldown. Rapier applies the same bounded <=3 Ns impulse to the single real ball. No shot bypasses ordinary physics.

## QA and limits

Independent mirrored HOME/AWAY starting worlds must produce real exclusive-contact policy shots and measured following 3D ball-centre samples, checked against live foot IDs/teams and closed action metadata. Repeatable replay and reset verify physical evidence is not a prerecorded action. Unchanged initial formation and no-contact negatives cannot invent a shot. The suite fails if either team has no genuine physical shot. Four short fixture scenarios replace the earlier long zero-witness diagnostic matrix.

No goal, shot-on-target, save, possession, official field event or match result is inferred. This does not prove that an ordinary default-formation match will produce shots by itself; that requires later tactical integration.
