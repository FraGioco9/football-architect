// C3.2a — bounded real 0.42 N.s progressive ground shoes, research-only.
// No fabricated collision, forced second kick, received pass, score or dribble.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_VERSION} from '../src/player-movement.mjs';
import {PROVISIONAL_PHYSICAL_CARRY_IMPULSE_NS,
 selectUniformAutonomousContactAction}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const makeFixture=c=>({
 id:'season:1:'+c+'-1:N01:'+c+'-1:'+c+'-2',
 competitionId:c+'-1',marker:'N01',day:1,round:1,
 homeClubId:c+'-1',awayClubId:c+'-2'
});
const frame=(team,tick=1)=>{
 const sign=team==='home'?1:-1,id=team+'-10';
 return {
  version:PLAYER_VERSION,tick,
  players:INITIAL_PLAYERS.map(p=>({
   ...p,x:p.id===id?sign*-10:p.team===team?sign*-42:sign*37,
   y:p.id===id?0:27
  }))
 };
};

test('C3.2a symmetric bounded progressive shoe action needs opt-in and a future REAL Rapier START',()=>{
 assert.equal(PROVISIONAL_PHYSICAL_CARRY_IMPULSE_NS,0.42);
 for(const team of ['home','away']){
  const sign=team==='home'?1:-1;
  const id=team+'-10',ball={x:sign*-10,y:0,z:0.11};
  const args={tick:1,contactStarted:[id],contactActive:[id],
   playerFrame:frame(team),ballPosition:ball,
   ballVelocity:{x:0,y:0,z:0},ballRadiusM:0.11};
  const legacy=selectUniformAutonomousContactAction(args);
  assert.equal(legacy.action,'clearance');
  const carry=selectUniformAutonomousContactAction({
   ...args,allowPhysicalCarry:true});
  assert.equal(carry.action,'carry');
  assert.equal(carry.team,team);
  assert.equal(carry.playerId,id);
  assert.equal(carry.carryTarget.shortGroundTouchOnly,true);
  assert.equal(carry.carryTarget.physicalRecontactObserved,false);
  assert.equal(carry.carryTarget.dribbleConfirmed,null);
  assert.equal(carry.carryTarget.officialMatchResult,null);
  assert.equal(carry.appliedByRapier,false);
  assert.equal(carry.impulseNs.z,0);
  assert.ok(sign*carry.impulseNs.x>0);
  assert.ok(Math.abs(Math.hypot(...Object.values(carry.impulseNs))-0.42)<1e-9);
  assert.equal(carry.officialMatchResult,null);
  assert.equal(selectUniformAutonomousContactAction({
   ...args,contactStarted:[],contactActive:[],allowPhysicalCarry:true}),null);
  assert.equal(selectUniformAutonomousContactAction({
   ...args,lastActionTick:0,allowPhysicalCarry:true}),null);
  assert.throws(()=>selectUniformAutonomousContactAction({
   ...args,allowPhysicalCarry:'true'}),/Verified same-tick/);
  const pressured=frame(team);
  pressured.players.find(p=>p.id===(team==='home'?'away':'home')+'-10').x=
   sign*-8;
  pressured.players.find(p=>p.id===(team==='home'?'away':'home')+'-10').y=0;
  const safe=selectUniformAutonomousContactAction({
   ...args,playerFrame:pressured,allowPhysicalCarry:true});
  assert.equal(safe.action,'carry',
   'an exclusive real shoe may attempt a short touch even under pressure');
  assert.equal(safe.decisionContext.rule,'pressured-short-ground-touch');
 }
});

test('C3.2a bounded carry research is sealed from ordinary action, research shooters and malformed toggles',async()=>{
 const R=await initializeRapier(rapier);
 const fixture=makeFixture('IT'),scene={
  preset:'roll',seed:'c3-2a-scope',x:-4.96,y:0,z:0,
  vx:0.3,vy:0,vz:0
 };
 for(const opt of [
  {autonomousCarry:true},
  {autonomousActions:true,autonomousCarry:false},
  {autonomousActions:true,autonomousCarry:'yes'},
  {autonomousActions:true,autonomousCarry:true,researchShotAttacker:'home'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,fixture,scene,opt),
  /canonical-shaped fixture|never accepts injected|Universal ball session accepts/);
 const ordinary=createPhysicalFixtureStepRuntime(R,fixture,scene,{
  autonomousActions:true});
 try{
  assert.equal(ordinary.snapshot().autonomousCarryMode,false);
  for(let n=0;n<2;n++)
   assert.equal(ordinary.step().physicalCarryContactSequence.authenticatedCarryImpulses,0);
 }finally{ordinary.dispose();}
});

test('C3.2a true 60Hz normal-formation Rapier ground touches and same-player pursuit on both teams',async()=>{
 const R=await initializeRapier(rapier),out=[];
 for(const c of [
  {team:'home',country:'IT',x:-4.96,vx:0.3},
  {team:'away',country:'DE',x:4.96,vx:-0.3}
 ]){
  const fixture=makeFixture(c.country),scene={
   preset:'roll',seed:'c3-2a-real-'+c.team,
   x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
  };
  const options={autonomousActions:true,autonomousCarry:true};
  const a=createPhysicalFixtureStepRuntime(R,fixture,scene,options);
  const b=createPhysicalFixtureStepRuntime(R,fixture,scene,options);
  let firstPass=null,carry=null,pursuitFrames=0,maxPursuitTravelM=0,
   observedRecontacts=0,carryShoeStarts=0,allCarryTouches=0,lastActor=null,
   realFirstCarrierEndTick=null,recontactIntentFrames=0,teamVerifiedRecontact=null,
   minPostReleaseActorBallGapM=Infinity;
  const teamDirection=c.team==='home'?1:-1;
  try{
   assert.equal(a.snapshot().autonomousCarryMode,true);
   for(let i=0;i<22;i++){
    const actor=a.snapshot().physicalPlayerPositions[i];
    assert.equal(actor.x,INITIAL_PLAYERS[i].x);
    assert.equal(actor.y,INITIAL_PLAYERS[i].y);
   }
   for(let tick=1;tick<=600;tick++){
    const f=a.step(),independent=b.step();
    assert.deepEqual(f,independent,'identical independent Rapier+movement worlds');
    assert.equal(f.physicsTick,tick);
    assert.ok(Math.abs(f.elapsedSeconds-tick*FIXED_DT)<1e-8);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.productionScoringConnected,false);
    assert.equal(f.contactDecisionObservation.officialMatchPossession,false);
    const action=f.localAutonomousAction;
    if(action?.action==='carry')allCarryTouches++;
    assert.equal(f.physicalCarryContactSequence.authenticatedCarryImpulses,
      allCarryTouches);
    if(action?.team===c.team&&action.action==='pass'&&
       firstPass===null)firstPass=tick;
    if(action?.team===c.team&&action.action==='carry'){
     assert.equal(f.physicalContactFeed.started.length,1);
     assert.equal(f.physicalContactFeed.active.length,1);
     assert.equal(f.physicalContactFeed.started[0].engineId,action.playerId);
     assert.equal(action.carryTarget.physicsTick,tick);
     assert.equal(action.carryTarget.dribbleConfirmed,null);
     assert.equal(action.appliedByRapier,true);
     assert.equal(action.actualPhysicsImpulseApplied,true);
     assert.ok(teamDirection*action.impulseNs.x>0);
     assert.ok(Math.abs(Math.hypot(...Object.values(action.impulseNs))-0.42)<1e-7);
     carryShoeStarts++;
     if(!carry){
      carry={tick,player:action.playerId,
       ballX:f.ball.position.x,
       ballY:f.ball.position.y};
     }
    }
    if(carry&&tick>carry.tick&&realFirstCarrierEndTick===null&&
       f.physicalContactFeed.ended.some(shoe=>
        shoe.engineId===carry.player))
     realFirstCarrierEndTick=tick;
    const intent=f.contactDecisionObservation.carryPursuit;
    if(intent&&carry&&intent.sourceCarryTick===carry.tick){
     assert.equal(intent.approachPhase,
      intent.physicalShoeEndTick===null?
       'shoe-release-spacing':'live-ball-recontact');
     const previouslyObservedEndTick=realFirstCarrierEndTick!==null&&
      realFirstCarrierEndTick<tick?realFirstCarrierEndTick:null;
     assert.equal(intent.physicalShoeEndTick,previouslyObservedEndTick,
      'Rapier END in the current frame may affect the mover only from the NEXT tick');
     if(intent.physicalShoeEndTick!==null){
      assert.ok(intent.physicalShoeEndTick>carry.tick);
      assert.ok(intent.physicalShoeEndTick<tick);
      recontactIntentFrames++;
     }
     assert.equal(intent.team,c.team);
     assert.equal(intent.playerId,carry.player);
     assert.equal(intent.movementIntentOnly,true);
     assert.equal(intent.newShoeStartObserved,false);
     assert.equal(intent.dribbleConfirmed,null);
     assert.equal(intent.officialMatchResult,null);
     const duty=f.contactDecisionObservation.duties.find(x=>
      x.engineId===intent.playerId);
     assert.equal(duty.movementDuty,'carry-follow-intent');
     pursuitFrames++;
     const actor=f.physicalPlayerPositions.find(p=>p.engineId===carry.player);
     if(lastActor)maxPursuitTravelM+=Math.hypot(actor.x-lastActor.x,
      actor.y-lastActor.y);
     lastActor=actor;
     if(intent.physicalShoeEndTick!==null)
      minPostReleaseActorBallGapM=Math.min(minPostReleaseActorBallGapM,
       Math.hypot(actor.x-f.ball.position.x,actor.y-f.ball.position.y));
    }
    const pair=f.physicalCarryContactSequence.latestPair;
    const proven=f.physicalCarryContactSequence.latestVerifiedGroundCarryRecontact;
    // The actual same-player second touch can belong to ANY actor whose
    // earlier short carry and physical END are authenticated. The first
    // carrier is independently checked for authentic pursuit only.
    if(proven?.team===c.team&&proven.secondShoeTick===tick){
     assert.equal(pair?.to.physicsTick,tick);
     assert.equal(pair.from.physicsTick,proven.firstShoeTick);
     assert.equal(pair.samePlayerPhysicalRecontact,true);
     assert.equal(pair.to.engineId,proven.engineId);
     assert.equal(f.physicalContactFeed.started.length,1);
     assert.equal(f.physicalContactFeed.started[0].engineId,proven.engineId);
     assert.equal(action?.action,'carry');
     assert.equal(action.playerId,proven.engineId);
     assert.ok(pair.ballNetAttackingDirectionM>=0.2);
     teamVerifiedRecontact=proven;
     observedRecontacts++;
    }
   }
   const verified=a.snapshot().physicalCarryContactSequence;
   out.push({team:c.team,firstPass,carry,
    pursuitFrames,pursuitTravelM:Number(maxPursuitTravelM.toFixed(3)),
    observedRecontacts,carryShoeStarts,realFirstCarrierEndTick,
    recontactIntentFrames,
    minPostReleaseActorBallGapM:Number(minPostReleaseActorBallGapM.toFixed(3)),
    physicallyVerifiedRecontacts:verified.verifiedGroundCarryRecontacts,
    provenContact:teamVerifiedRecontact});
   console.log('C3_2B_REAL_RAPIER_SECOND_SHOE_DIAGNOSTIC',JSON.stringify(out.at(-1)));
   assert.ok(firstPass,'normal formation must produce a genuine first pass');
   assert.ok(carry,'subsequent unpressured natural shoe must make a real tiny carry touch');
   assert.ok(carry.tick>firstPass,'no invented carry before the genuine first pass');
   assert.ok(pursuitFrames>=1,'the same physical actor must pursue the measured live ball');
   assert.ok(maxPursuitTravelM>0.01,'the actual actor must physically move after real carry');
   // C3.2b requires a SECOND real Rapier START following a real END.
   assert.ok(verified.verifiedGroundCarryRecontacts>=1,
    'no authentic same-player END and second START with >=0.2m ball progress');
   assert.ok(observedRecontacts>=1,
    'independent real shoe observer did not record same-player recontact');
   const proof=teamVerifiedRecontact;
   assert.ok(proof,'no same-team second genuine Rapier shoe + bounded carry proof');
   assert.equal(proof.realFirstAndSecondRapierStarts,true);
   assert.equal(proof.secondRealBoundedCarryImpulseApplied,true);
   assert.ok(Math.abs(Math.hypot(...Object.values(proof.secondCarryImpulseNs))-0.42)<1e-7);
   assert.ok(realFirstCarrierEndTick!==null,
    'a real shoe END must precede the second physical contact');
   assert.equal(proof.physicalShoeEndBetween,true);
   assert.ok(proof.firstShoeTick<proof.shoeEndTick);
   assert.ok(proof.shoeEndTick<proof.secondShoeTick);
   assert.ok(proof.measuredAttackingProgressM>=0.2);
   assert.equal(proof.team,c.team);
   assert.equal(proof.dribbleConfirmed,null);
   assert.equal(proof.officialMatchResult,null);
   const reset=a.reset();
   try{
    for(let tick=1;tick<=Math.min(180,carry.tick+3);tick++){
     const frame=reset.step();
     if(tick===carry.tick)
      assert.equal(frame.localAutonomousAction?.action,'carry',
       'reset must reproduce the identical real shoe carry');
    }
   }finally{reset.dispose();}
  }finally{a.dispose();b.dispose();}
 }
 console.log('C3_2A_REAL_RAPIER_SHORT_TOUCH_PURSUIT',JSON.stringify(out));
 // A next shoe touch is NOT automatic and remains C3.2b acceptance.
});

test('C3.2a no foot START means no progressive touch or dribbling',async()=>{
 const R=await initializeRapier(rapier);
 const f=makeFixture('FR');
 const s={preset:'drop',seed:'c3-2a-no-contact',
  x:0,y:28,z:4,vx:0,vy:0,vz:0};
 const x=createPhysicalFixtureStepRuntime(R,f,s,{
  autonomousActions:true,autonomousCarry:true});
 try{
  for(let tick=1;tick<=75;tick++){
   const a=x.step();
   assert.equal(a.physicalCarryContactSequence.authenticatedCarryImpulses,0);
   assert.equal(a.contactDecisionObservation.carryPursuit,null);
   assert.equal(a.localAutonomousAction,null);
   assert.equal(a.officialMatchResult,null);
  }
 }finally{x.dispose();}
});
