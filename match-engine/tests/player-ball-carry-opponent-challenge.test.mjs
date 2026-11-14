// C3.3d — research-only post-REAL-carry challenger movement contract.
// Synthetic-shaped action vectors here validate gating/priority only;
// ONLY separate 22-player pinned-Rapier fixtures establish physical contacts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerMovement,observedCarryOpponentFlankWaypoint,
 PLAYER_MIN_SEPARATION_M} from '../src/player-movement.mjs';

// Pure current-to-target segment geometry; never actual Rapier contact.
const segmentGap=(start,end,carrier)=>{
 const dx=end.x-start.x,dy=end.y-start.y,d2=dx*dx+dy*dy;
 const t=d2>1e-12?Math.max(0,Math.min(1,
  ((carrier.x-start.x)*dx+(carrier.y-start.y)*dy)/d2)):0;
 return Math.hypot(start.x+t*dx-carrier.x,start.y+t*dy-carrier.y);
};
const trial=()=>createPlayerMovement({
 experimentalAiKickApproach:true,
 experimentalAutonomousFixtureContactChase:true,
 experimentalAutonomousFixtureCarry:true
});
const genuineShapedCarry=(team,tick)=>Object.freeze({
 action:'carry',tick,playerId:team+'-10',team,
 appliedByRapier:true,actualPhysicsImpulseApplied:true,
 physicalTrigger:'same-tick-real-rapier-shoe-start',
 officialMatchAction:false,
 carryTarget:Object.freeze({
  actorId:team+'-10',team,physicsTick:tick,
  shortGroundTouchOnly:true,physicalRecontactObserved:false,
  dribbleConfirmed:null,officialMatchResult:null
 }),
 impulseNs:Object.freeze({
  x:team==='home'?0.42:-0.42,y:0,z:0
 })
});
test('C3.3d close physical carry challenger is isolated, true-END gated and mirrored',()=>{
 for(const team of ['home','away']){
  const ball={x:team==='home'?-4.96:4.96,y:0};
  const a=trial();
  assert.equal(a.snapshot().provisionalChallengeCarryRunnerId,null);
  assert.equal(a.snapshot().provisionalChallengePassRunnerId,null);
  const first=a.step(ball);
  assert.equal(first.provisionalChallengeCarryRunnerId,null,
   'no real carry shoe action yet');
  assert.throws(()=>a.observeAuthenticFixtureCarry({
   ...genuineShapedCarry(team,1),actualPhysicsImpulseApplied:false
  }),/Only an authentic shoe-gated/);
  a.observeAuthenticFixtureCarry(genuineShapedCarry(team,1));
  const second=a.step(ball);
  assert.equal(second.provisionalChallengeCarryRunnerId,null,
   'an authentic Rapier shoe END must precede close defending intent');
  assert.equal(a.observeAuthenticFixtureCarryShoeEnd(team+'-10',2),true);
  const third=a.step(ball);
  const id=third.provisionalChallengeCarryRunnerId;
  assert.ok(id,'live 30m challenge must pick an existing opponent actor');
  assert.equal(id.startsWith(team==='home'?'away-':'home-'),true);
  assert.equal(third.provisionalChallengePassRunnerId,null);
  assert.ok(third.players.some(p=>p.id===id&&p.team!==team),
   'existing canonical 22-body identity only');
  assert.equal(third.players.length,22);
  // Ordinary movement and opt-in-only selection are not physics shoe events.
  for(let tick=4;tick<=153;tick++)a.step(ball);
  assert.equal(a.snapshot().provisionalChallengeCarryRunnerId,null,
   'a stale physical carry must not create an endless challenger');
  assert.equal(a.snapshot().provisionalChallengePassRunnerId,null);
 }
});

test('C3.3d disabling carry preserves normal non-carry 1.8m plan',()=>{
 const noCarry=createPlayerMovement();
 assert.equal(Object.hasOwn(noCarry.snapshot(),'provisionalChallengeCarryRunnerId'),false);
 for(let t=0;t<4;t++){
  const s=noCarry.step({x:-4.96,y:0});
  assert.equal(Object.hasOwn(s,'provisionalChallengeCarryRunnerId'),false);
  assert.equal(s.players.length,22);
 }
});

test('C3.3f actual-carrier lateral waypoints stay OUTSIDE hard player separation, mirrored and bounded',()=>{
 for(const carrierTeam of ['home','away']){
  const attack=carrierTeam==='home'?1:-1;
  const carrier={id:carrierTeam+'-9',team:carrierTeam,x:0,y:0};
  const challenger={id:(carrierTeam==='home'?'away':'home')+'-9',
   team:carrierTeam==='home'?'away':'home',role:'forward',
   x:-attack*1.20,y:0};
  const ball={x:attack*0.3,y:0};
  for(const side of [-1,1]){
   const initial=observedCarryOpponentFlankWaypoint(
    challenger,carrier,ball,side);
   assert.equal(initial.phase,'lateral-bypass');
   assert.equal(initial.side,side);
   assert.equal(initial.movementIntentOnly,true);
   assert.equal(initial.physicalShoeContactObserved,false);
   assert.ok(initial.waypointCarrierClearanceM>
    PLAYER_MIN_SEPARATION_M+0.12-1e-9);
   assert.ok(Math.hypot(initial.target.x-carrier.x,
    initial.target.y-carrier.y)>=PLAYER_MIN_SEPARATION_M+0.12);
   assert.ok(initial.target.y*side*attack>0,
    'both attack directions must use actual lateral geometry');
   assert.equal(initial.bodySafeShortArc,false,
    'accepted near-ball baseline retains its earlier movement');
   assert.ok(Number.isFinite(initial.segmentCarrierClearanceM));
   const displaced={...challenger,x:-attack*0.35,y:attack*side*1.0};
   const ahead=observedCarryOpponentFlankWaypoint(
    displaced,carrier,ball,side);
   assert.equal(ahead.phase,'ball-side-shoe-approach');
   assert.ok(attack*ahead.target.x>0,
    'a real reached flank enters the outside-body arc before forward gate');
   assert.ok(ahead.waypointCarrierClearanceM>=
    PLAYER_MIN_SEPARATION_M+0.12);
   assert.equal(ahead.bodySafeShortArc,false);
   const released=observedCarryOpponentFlankWaypoint({
    ...displaced,x:attack*0.6
   },carrier,{x:attack*1.35,y:0},side);
   assert.equal(released,null,
    'only a REAL already-separated ball frees normal chase');
   // C3.3h synthetic mirrored contract; NOT a real Rapier shoe witness.
   const nearBall={x:attack*0.30,y:0};
   const farSide=observedCarryOpponentFlankWaypoint({
    ...displaced,x:attack*0.6
   },carrier,nearBall,side);
   assert.equal(farSide.phase,'ball-side-shoe-approach');
   assert.ok(Math.hypot(farSide.target.x-carrier.x,
    farSide.target.y-carrier.y)>=PLAYER_MIN_SEPARATION_M+0.12-1e-9);
   assert.ok(attack*(farSide.target.x-displaced.x)>0,
    'short polar arc advances the actor toward the real ball');
   assert.ok(Math.abs(farSide.target.y)<Math.abs(displaced.y),
    'lateral body offset shrinks without touching the carrier');
   assert.ok(farSide.carrierBallGapM<=1.10);
   assert.ok(Math.hypot(farSide.target.x-nearBall.x,
    farSide.target.y-nearBall.y)>0,
    'real Rapier shoe movement and contact remain mandatory');
   assert.equal(farSide.physicalShoeContactObserved,false);
   assert.equal(farSide.bodySafeShortArc,false);
   assert.equal(farSide.movementIntentOnly,true);
  }
  assert.throws(()=>observedCarryOpponentFlankWaypoint(
   {...challenger,team:carrierTeam},carrier,ball,1),
   /opposite-team/);
  assert.throws(()=>observedCarryOpponentFlankWaypoint(
   challenger,carrier,ball,0),/opposite-team/);
 }
});

test('C3.3m only far-separated AWAY carry uses guarded incremental bypass',()=>{
 const carrier={id:'away-9',team:'away',x:0,y:0};
 const challenger={id:'home-10',team:'home',role:'forward',
  x:1.02,y:0};
 for(const side of [-1,1]){
  const previousTarget={x:0.55,y:-side*1.16};
  assert.ok(segmentGap(challenger,previousTarget,carrier)<
   PLAYER_MIN_SEPARATION_M,'old distant lateral chord crossed guard');
  const next=observedCarryOpponentFlankWaypoint(
   challenger,carrier,{x:-1.35,y:0},side);
  assert.equal(next.phase,'lateral-bypass');
  assert.equal(next.bodySafeShortArc,true);
  assert.ok(next.segmentCarrierClearanceM>=PLAYER_MIN_SEPARATION_M-1e-9);
  assert.ok(segmentGap(challenger,next.target,carrier)>=
   PLAYER_MIN_SEPARATION_M-1e-9);
  assert.ok(Math.abs(next.target.y)>0);
  assert.ok(Math.abs(next.target.y)<Math.abs(previousTarget.y));
  assert.ok(Math.hypot(next.target.x-challenger.x,
   next.target.y-challenger.y)<0.40);
  assert.equal(next.physicalShoeContactObserved,false);
  const oldBallGap=observedCarryOpponentFlankWaypoint(
   challenger,carrier,{x:-0.30,y:0},side);
  assert.equal(oldBallGap.bodySafeShortArc,false,
   'real near-ball legacy recontact must remain unchanged');
  const homeCarrier={...carrier,id:'home-9',team:'home'};
  const awayChallenger={...challenger,id:'away-10',team:'away',x:-1.02};
  const mirror=observedCarryOpponentFlankWaypoint(
   awayChallenger,homeCarrier,{x:1.35,y:0},side);
  assert.equal(mirror.bodySafeShortArc,false,
   'accepted HOME motion must be unaffected by AWAY-only research');
 }
});
