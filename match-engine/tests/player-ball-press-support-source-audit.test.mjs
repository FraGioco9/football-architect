// C2.3m — same-world, read-only presser/support handoff + oriented shoe provenance.
// The second mover is an independent witness driven by prior real ball states.
// It never drives Rapier physics, future actions, contact or official scoring.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement,
 observedFixtureAttackSupportRun} from '../src/player-movement.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const TICKS=720;
const CHECKS=new Set([532,533,546,547,567,580,590,592,593,
 599,600,601,605,640,680,690,693,694,700,720]);
const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const r=n=>Number(n.toFixed(3));
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
const readActor=(mover,frame,id)=>{
 const player=mover.players.find(p=>p.id===id);
 const body=frame.physicalPlayerPositions.find(p=>p.engineId===id);
 const duty=frame.contactDecisionObservation.duties.find(p=>p.engineId===id);
 assert.ok(player&&body&&duty);
 assert.equal(body.team,player.team);
 assert.ok(Math.abs(player.x-body.x)<1e-9&&Math.abs(player.y-body.y)<1e-9,
  'the unprivileged witness must equal the actual mover sent to Rapier');
 const oriented=measureOrientedCarryShoeBallGeometry(player,frame.ball.position);
 const shoeStarted=frame.physicalContactFeed.started.some(p=>p.engineId===id);
 const shoeActive=frame.physicalContactFeed.active.some(p=>p.engineId===id);
 if(shoeStarted)assert.ok(shoeActive,'true shoe START must be ACTIVE');
 assert.equal(oriented.actualRapierCollisionInferred,false);
 assert.equal(oriented.officialMatchPossession,false);
 return Object.freeze({
  id,duty:duty.movementDuty,
  bodyBallGapM:r(oriented.bodyBallXYGapM),
  orientedShoeBallGapM:r(oriented.shoeBallCenter3DGapM),
  estimatedStaticSurfaceClearanceM:r(oriented.estimatedStaticSurfaceClearanceM),
  facingRad:r(oriented.actualFacingRad),
  relativeBallForwardM:r(oriented.relativeBallForwardM),
  blockedBy:player.blockedBy??null,
  shoeStarted,shoeActive,
  geometricProximityIsNotContact:true
 });
};
test('C2.3m real HOME/AWAY press/support role arbitration + oriented shoe race',async()=>{
 const R=await initializeRapier(rapier),all=[];
 for(const c of CASES){
  const match=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),{
   autonomousActions:true,autonomousCarry:true,
   autonomousCarrySupport:true
  });
  const mirror=createPlayerMovement({
   experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true
  });
  let lastPass=null,lastCarry=null,priorWasRelay=false,firstRelayDrop=null;
  const checkpoints=[],pressCounters={press:0,support:0},genuineActions=[];
  try{
   assert.equal(match.snapshot().physicsTick,0);
   assert.equal(mirror.snapshot().tick,0);
   for(let t=1;t<=TICKS;t++){
    const physicalBefore=match.snapshot();
    const moverBefore=mirror.snapshot();
    assert.equal(moverBefore.tick,t-1);
    assert.equal(physicalBefore.physicsTick,t-1);
    // Sidecar obtains ONLY the just-prior physically measured ball.
    const moved=mirror.step(physicalBefore.ball.position);
    const frame=match.step();
    assert.equal(moved.tick,t);
    assert.equal(frame.physicsTick,t);
    assert.equal(frame.officialMatchResult,null);
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.productionScoringConnected,false);
    assert.equal(moved.players.length,22);
    assert.equal(frame.physicalPlayerPositions.length,22);
    for(let i=0;i<22;i++){
     assert.equal(moved.players[i].id,INITIAL_PLAYERS[i].id);
     assert.equal(frame.physicalPlayerPositions[i].engineId,INITIAL_PLAYERS[i].id);
     assert.ok(Math.abs(moved.players[i].x-
      frame.physicalPlayerPositions[i].x)<1e-9,
      'witness x must match actual 60Hz Rapier mover');
     assert.ok(Math.abs(moved.players[i].y-
      frame.physicalPlayerPositions[i].y)<1e-9,
      'witness y must match actual 60Hz Rapier mover');
    }
    const observedSupport=frame.contactDecisionObservation.attackSupportRun;
    assert.equal(observedSupport?.playerId??null,
     moved.provisionalAttackSupportRun?.playerId??null);
    const relayNow=observedSupport?.team===c.team&&
     observedSupport.phase==='post-carry-support';
    if(priorWasRelay&&!relayNow&&firstRelayDrop===null)firstRelayDrop=t;
    priorWasRelay=relayNow;
    const playerDuty=frame.contactDecisionObservation.duties.find(p=>
     p.engineId===c.team+'-10')?.movementDuty;
    if(playerDuty==='press')pressCounters.press++;
    if(playerDuty==='attack-support-intent')pressCounters.support++;
    if(CHECKS.has(t)){
     const rival=c.team==='home'?'away':'home';
     // Pure counterfactual reads the exact preceding 60Hz 22-player
     // positions and real pass/carry history. It NEVER updates a mover.
     const elig=lastPass?.team===c.team?{
      players:moverBefore.players,ball:physicalBefore.ball.position,
      pass:lastPass,physicsTick:t,
      incumbentId:moverBefore.provisionalAttackSupportRun?.playerId??null,
      carry:lastCarry?.team===lastPass.team&&
       t-lastPass.tick>240?lastCarry:null
     }:null;
     const withoutExclusions=elig?observedFixtureAttackSupportRun({
      ...elig,excludedIds:[]}):null;
     const withoutCurrentPresser=elig?observedFixtureAttackSupportRun({
      ...elig,excludedIds:[
       moved.pressers.home,moved.pressers.away
      ]}):null;
     const focus=[c.team+'-9',c.team+'-10',rival+'-7']
      .map(id=>readActor(moved,frame,id));
     const action=frame.localAutonomousAction;
     const evidence=Object.freeze({
      tick:t,physicalBallX:r(frame.ball.position.x),
      physicalBallY:r(frame.ball.position.y),
      actualPresser:moved.pressers[c.team],
      attackSupportActor:observedSupport?.team===c.team?
       observedSupport.playerId:null,
      attackSupportPhase:observedSupport?.team===c.team?
       observedSupport.phase:null,
      freeOfExclusionsCandidate:withoutExclusions?.playerId??null,
      afterPresserExclusionCandidate:withoutCurrentPresser?.playerId??null,
      currentPassAge:lastPass?.team===c.team?t-lastPass.tick:null,
      currentCarryAge:lastCarry?.team===c.team?t-lastCarry.tick:null,
      focus:Object.freeze(focus),
      realShoeStarts:Object.freeze(
       frame.physicalContactFeed.started.map(p=>p.engineId)),
      executedRealAction:action?Object.freeze({
       playerId:action.playerId,team:action.team,
       action:action.action}):null,
      counterfactualCannotDrivePhysics:true,
      scoreAndContactNotInferred:true
     });
     checkpoints.push(evidence);
    }
    const action=frame.localAutonomousAction;
    if(action){
     assert.equal(frame.physicalContactFeed.started.length,1);
     assert.equal(frame.physicalContactFeed.active.length,1);
     assert.equal(frame.physicalContactFeed.started[0].engineId,action.playerId);
     assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
     assert.equal(action.appliedByRapier,true);
     assert.equal(action.actualPhysicsImpulseApplied,true);
     if(action.action==='pass'){
      mirror.observeAuthenticFixturePass(action);
      lastPass=action;lastCarry=null;
     }else if(action.action==='carry'){
      mirror.observeAuthenticFixtureCarry(action);
      lastCarry=action;
     }else{
      mirror.clearFixtureCarryOnOtherAction(action);
      lastCarry=null;
     }
     genuineActions.push(Object.freeze({tick:t,team:action.team,
      actor:action.playerId,action:action.action}));
    }
    // This END replay is from the actual previous Rapier step only.
    for(const id of frame.footContact.ended)
     mirror.observeAuthenticFixtureCarryShoeEnd(id,frame.physicsTick);
   }
   assert.deepEqual(checkpoints.map(x=>x.tick),[...CHECKS]);
   assert.ok(genuineActions.some(a=>a.action==='pass'));
   if(c.team==='away'){
    const pre=checkpoints.find(x=>x.tick===599);
    const lost=checkpoints.find(x=>x.tick===600);
    const shot=checkpoints.find(x=>x.tick===693);
    const taken=checkpoints.find(x=>x.tick===694);
    assert.equal(firstRelayDrop,600);
    assert.equal(pre.attackSupportActor,'away-10');
    assert.equal(pre.attackSupportPhase,'post-carry-support');
    assert.equal(lost.attackSupportActor,null);
    assert.equal(lost.actualPresser,'away-10');
    assert.equal(lost.focus[1].duty,'press');
    assert.equal(lost.freeOfExclusionsCandidate,'away-10');
    assert.equal(lost.afterPresserExclusionCandidate,null);
    assert.equal(shot.focus[1].shoeStarted,false);
    assert.equal(taken.focus[2].shoeStarted,true);
    assert.deepEqual(taken.executedRealAction,{
     playerId:'home-7',team:'home',action:'pass'});
    assert.ok(shot.focus[1].bodyBallGapM>2.9);
    assert.ok(shot.focus[2].bodyBallGapM<0.5);
   }else{
    assert.equal(firstRelayDrop,null,'HOME had no physical post-carry relay');
   }
   all.push(Object.freeze({
    team:c.team,firstRelayDrop,pressCounters,
    authenticActionCount:genuineActions.length,
    actualNaturalShots:genuineActions.filter(a=>a.action==='shot'),
    checkpoints:Object.freeze(checkpoints.filter(p=>
     [547,567,590,592,593,599,600,601,605,640,680,693,694].includes(p.tick)))
   }));
  }finally{match.dispose();}
 }
 console.log('C2_3M_REAL_PRESS_SUPPORT_SHOE_ARBITRATION',JSON.stringify(all));
});
