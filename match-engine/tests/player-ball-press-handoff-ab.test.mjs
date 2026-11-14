// C2.3n: isolated genuine-carry presser/support handoff A/B.
// No fake contacts, scripted shoe START, action injection or goal.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_PITCH} from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M} from '../src/player-ball-uniform-autonomous-action.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const CHECKS=new Set([532,533,546,547,567,599,600,601,
 620,640,680,693,694,700,720]);
const fix=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const initial=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
const round=n=>Number(n.toFixed(3));
const opts=Object.freeze({autonomousActions:true,autonomousCarry:true,
 autonomousCarrySupport:true});
const extended=Object.freeze({...opts,autonomousCarrySupportPressHandoff:true});
function collect(summary,frame,c){
 const t=frame.physicsTick;
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 const ball=frame.ball.position;
 const dir=c.team==='home'?1:-1;
 const toGoal=PLAYER_PITCH.lengthM/2-dir*ball.x;
 const shortfall=Math.max(0,toGoal-SHOT_MAX_RANGE_M);
 summary.advance=Math.max(summary.advance,dir*(ball.x-c.x));
 summary.minShortfall=Math.min(summary.minShortfall,shortfall);
 if(shortfall===0&&toGoal>0&&Math.abs(ball.y)<=20)
  summary.inZoneFrames++;
 const action=frame.localAutonomousAction;
 const actualStarts=frame.physicalContactFeed.started;
 summary.shoeStarts+=actualStarts.length;
 for(const v of actualStarts)assert.ok(
  frame.physicalContactFeed.active.some(k=>k.engineId===v.engineId&&
   k.team===v.team),'real START must have ACTIVE shoe');
 if(action){
  assert.equal(actualStarts.length,1);
  assert.equal(frame.physicalContactFeed.active.length,1);
  assert.equal(action.playerId,actualStarts[0].engineId);
  assert.equal(action.team,actualStarts[0].team);
  assert.equal(action.tick,t);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.officialMatchAction,false);
  summary.actions.push(Object.freeze({tick:t,action:action.action,
   playerId:action.playerId,team:action.team}));
  if(action.action==='shot'){
   assert.equal(action.shotTarget.shooterId,action.playerId);
   assert.equal(action.shotTarget.physicsTick,t);
   summary.realShots.push({tick:t,team:action.team,id:action.playerId});
  }
 }
 const support=frame.contactDecisionObservation.attackSupportRun;
 if(support?.team===c.team&&support.phase==='post-carry-support'){
  summary.relayFrames++;
  assert.equal(support.carryContinuation.team,c.team);
  assert.equal(support.possibleShotWindow,false);
  assert.equal(support.shotExecuted,false);
  assert.equal(support.officialMatchResult,null);
  // The 60Hz mover chose this duty from the LAST COMPLETED Rapier
  // shoe event. A new contact generated in THIS frame cannot be
  // the source for its earlier movement assignment.
  const pass=summary.actions.findLast(x=>x.action==='pass'&&
   x.team===c.team&&x.tick<t);
  const carry=summary.actions.findLast(x=>x.action==='carry'&&
   x.team===c.team&&x.tick<t);
  assert.ok(pass&&carry&&carry.tick>pass.tick);
  assert.equal(support.sourcePassTick,pass.tick);
  assert.equal(support.carryContinuation.sourceCarryTick,carry.tick);
  assert.ok(t-pass.tick>240&&t-pass.tick<=480);
  assert.ok(t-carry.tick<=150&&t>carry.tick);
 }
 if(CHECKS.has(t)){
  const relative=frame.physicalPlayerPositions
   .filter(p=>[c.team+'-9',c.team+'-10',
    (c.team==='away'?'home':'away')+'-7'].includes(p.engineId))
   .map(p=>Object.freeze({id:p.engineId,
    gapM:round(Math.hypot(p.x-ball.x,p.y-ball.y)),
    duty:frame.contactDecisionObservation.duties.find(d=>
     d.engineId===p.engineId)?.movementDuty}));
  summary.checkpoints.push(Object.freeze({
   tick:t,ball:Object.freeze({x:round(ball.x),y:round(ball.y)}),
   shotShortfallM:round(shortfall),focus:Object.freeze(relative),
   support:support?.team===c.team?Object.freeze({
    id:support.playerId,phase:support.phase,
    sourceCarryTick:support.carryContinuation?.sourceCarryTick??null
   }):null,
   contactStarts:Object.freeze(actualStarts.map(x=>x.engineId)),
   actualAction:action?.action??null
  }));
 }
}
const empty=()=>({advance:0,minShortfall:Infinity,inZoneFrames:0,
 shoeStarts:0,actions:[],realShots:[],relayFrames:0,checkpoints:[]});
const compact=a=>Object.freeze({
 maxAdvanceM:round(a.advance),minShortfallM:round(a.minShortfall),
 inZoneFrames:a.inZoneFrames,realShoeStarts:a.shoeStarts,
 actions:a.actions,realShots:a.realShots,relayFrames:a.relayFrames,
 checkpoints:a.checkpoints.filter(x=>[599,600,601,640,680,693,694,720]
  .includes(x.tick))
});
test('C2.3n opt-in strictly requires authenticated autonomous carry support',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const valid=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),extended);
 try{
  assert.equal(valid.snapshot().autonomousCarrySupportPressHandoffMode,true);
  const reset=valid.reset();
  try{
   assert.equal(reset.snapshot().autonomousCarrySupportPressHandoffMode,true);
   assert.equal(reset.snapshot().physicsTick,0);
   for(let t=1;t<=30;t++)reset.step();
  }finally{reset.dispose();}
 }finally{valid.dispose();}
 for(const bad of [
  {autonomousCarrySupportPressHandoff:true},
  {autonomousActions:true,autonomousCarrySupportPressHandoff:true},
  {autonomousActions:true,autonomousCarry:true,
   autonomousCarrySupportPressHandoff:true},
  {...opts,autonomousCarrySupportPressHandoff:false},
  {...extended,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,fix(c),initial(c),bad));
});
test('C2.3n genuine HOME/AWAY 720-tick Rapier opt-out vs bounded press handoff',async()=>{
 const R=await initializeRapier(rapier),results=[];
 for(const c of CASES){
  const original=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),opts);
  const trial=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),extended);
  const verified=c.team==='away'?
   createPhysicalFixtureStepRuntime(R,fix(c),initial(c),extended):null;
  const a=empty(),b=empty();
  let firstChange=null;
  try{
   const old=original.snapshot(),next=trial.snapshot();
   assert.equal(old.autonomousCarrySupportPressHandoffMode,undefined);
   assert.equal(next.autonomousCarrySupportPressHandoffMode,true);
   assert.deepEqual(old.ball,next.ball);
   assert.deepEqual(old.physicalPlayerPositions,next.physicalPlayerPositions);
   for(let t=1;t<=720;t++){
    const x=original.step(),y=trial.step();
    assert.equal(x.physicsTick,t);
    assert.equal(y.physicsTick,t);
    if(verified){
     const z=verified.step();
     assert.deepEqual(z.ball,y.ball,'independent Rapier ball replay '+t);
     assert.deepEqual(z.physicalPlayerPositions,y.physicalPlayerPositions,
      'independent 22-body replay '+t);
     assert.deepEqual(z.physicalContactFeed,y.physicalContactFeed);
     assert.deepEqual(z.localAutonomousAction,y.localAutonomousAction);
    }
    const same=JSON.stringify(x.physicalPlayerPositions)===
     JSON.stringify(y.physicalPlayerPositions)&&
     JSON.stringify(x.ball)===JSON.stringify(y.ball);
    if(!same&&firstChange===null)firstChange=t;
    if(firstChange===null){
     assert.deepEqual(x.physicalContactFeed,y.physicalContactFeed);
     assert.deepEqual(x.localAutonomousAction,y.localAutonomousAction);
    }
    collect(a,x,c);collect(b,y,c);
   }
   assert.deepEqual(a.checkpoints.map(x=>x.tick),[...CHECKS]);
   assert.deepEqual(b.checkpoints.map(x=>x.tick),[...CHECKS]);
   if(c.team==='home'){
    assert.equal(firstChange,null,'HOME has no eligible carry relay');
    assert.deepEqual(a.actions,b.actions);
    assert.equal(b.relayFrames,0);
   }else{
    const old=a.checkpoints.find(x=>x.tick===600);
    const changed=b.checkpoints.find(x=>x.tick===600);
    assert.ok(firstChange>=600,'no earlier movement/physics divergence');
    assert.equal(old.focus.find(p=>p.id==='away-10').duty,'press');
    assert.equal(changed.focus.find(p=>p.id==='away-10').duty,
     'attack-support-intent');
    assert.equal(changed.support?.id,'away-10');
    assert.equal(changed.support?.phase,'post-carry-support');
    assert.ok(b.relayFrames>a.relayFrames);
    assert.ok(Math.abs(a.minShortfall-0.681)<0.002,
     'old real physical shortfall must remain unchanged');
    assert.deepEqual(a.actions.find(x=>x.tick===694),
     {tick:694,action:'pass',playerId:'home-7',team:'home'});
   }
   results.push(Object.freeze({
    team:c.team,firstPhysicalDivergenceTick:firstChange,
    baseline:compact(a),handoff:compact(b),
    difference:Object.freeze({
     relayFrames:b.relayFrames-a.relayFrames,
     maxAdvanceM:round(b.advance-a.advance),
     bestShotRangeShortfallM:round(b.minShortfall-a.minShortfall),
     actualShoeStarts:b.shoeStarts-a.shoeStarts,
     realShots:b.realShots.length-a.realShots.length,
     shotTerritoryFrames:b.inZoneFrames-a.inZoneFrames
    })
   }));
  }finally{original.dispose();trial.dispose();verified?.dispose();}
 }
 assert.deepEqual(results.map(x=>x.team),['home','away']);
 console.log('C2_3N_REAL_CARRY_PRESS_HANDOFF_AB',
  JSON.stringify(results));
});


test('C2-b preparation: authentic 22-player post-PASS/CARRY shot-gate timeline',async()=>{
 const R=await initializeRapier(rapier);
 const c=CASES[1];
 const original=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),opts);
 const handoff=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),extended);
 const verified=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),extended);
 const modes=[{name:'baseline',world:original},{name:'handoff',world:handoff}];
 const stats=modes.map(({name})=>({name,passTick:null,carryTick:null,
  postCarrySupportFrames:0,bestShortfallM:Infinity,bestTick:null,
  shotZoneFrames:0,inRangeShoeStartFrames:0,realShoeStarts:0,
  authenticActions:[],naturalShots:[],lastPhysicalStart:null,
  approachCheckpoints:[],nearestForwardGapM:Infinity}));
 try{
  const seen={baseline:{pass:[],carry:[]},handoff:{pass:[],carry:[]}};
  for(let tick=1;tick<=720;tick++){
   const frames=[original.step(),handoff.step(),verified.step()];
   assert.deepEqual(frames[1],frames[2],
    'independent real Rapier handoff replay tick '+tick);
   for(let i=0;i<2;i++){
    const frame=frames[i],audit=stats[i],ball=frame.ball.position;
    // AWAY attacks the negative-X goal. This is the SAME 35 m
    // goal-distance gate as the live policy, not a lane-clearance claim.
    const goalDistance=PLAYER_PITCH.lengthM/2+ball.x;
    const shortfall=Math.max(0,goalDistance-SHOT_MAX_RANGE_M);
    const inRange=Math.abs(goalDistance)<=SHOT_MAX_RANGE_M&&
     Math.abs(ball.y)<=20;
    if(shortfall<audit.bestShortfallM){
     audit.bestShortfallM=shortfall;audit.bestTick=tick;
    }
    if(inRange)audit.shotZoneFrames++;
    // Read-only, live-physics pursuit audit: no inferred contact/action.
    if([567,599,600,620,640,660,680,690,693,694,700,720].includes(tick)){
     const actors=['away-9','away-10','home-7'].map(id=>{
      const player=frame.physicalPlayerPositions.find(p=>p.engineId===id);
      assert.ok(player,'real 22-player fixture must contain '+id);
      const duty=frame.contactDecisionObservation.duties.find(d=>
       d.engineId===id)?.movementDuty??null;
      return {id,duty,x:round(player.x),y:round(player.y),
       ballGapM:round(Math.hypot(player.x-ball.x,player.y-ball.y))};
     });
     const attackers=actors.filter(a=>a.id.startsWith('away-'));
     audit.nearestForwardGapM=Math.min(audit.nearestForwardGapM,
      ...attackers.map(a=>a.ballGapM));
     const carrier=frame.physicalPlayerPositions.find(p=>p.engineId==='away-9');
     const nearestTeammates=frame.physicalPlayerPositions
      .filter(p=>p.team==='away'&&p.engineId!==carrier.engineId)
      .map(p=>({id:p.engineId,gapM:Math.hypot(p.x-carrier.x,
       p.y-carrier.y)}))
      .sort((a,b)=>a.gapM-b.gapM||a.id.localeCompare(b.id))
      .slice(0,3).map(p=>({id:p.id,gapM:round(p.gapM)}));
     const pursuit=frame.contactDecisionObservation.carryPursuit;
     const carrierPursuit=pursuit?.playerId==='away-9'?pursuit:null;
     const pursuitTarget=carrierPursuit?.target??null;
     const targetGapM=pursuitTarget?Math.hypot(
      pursuitTarget.x-carrier.x,pursuitTarget.y-carrier.y):null;
     const targetHeading=pursuitTarget?Math.atan2(
      pursuitTarget.y-carrier.y,pursuitTarget.x-carrier.x):null;
     const blockersAlongTarget=targetHeading===null?[]:
      frame.physicalPlayerPositions.filter(p=>p.engineId!==carrier.engineId)
       .map(p=>{
        const dx=p.x-carrier.x,dy=p.y-carrier.y;
        const alongM=dx*Math.cos(targetHeading)+dy*Math.sin(targetHeading);
        const crossM=Math.abs(dx*Math.sin(targetHeading)-
         dy*Math.cos(targetHeading));
        return {id:p.engineId,alongM,crossM};
       }).filter(p=>p.alongM>=0&&p.alongM<=3&&p.crossM<=1.5)
       .sort((a,b)=>a.alongM-b.alongM||a.id.localeCompare(b.id))
       .slice(0,4).map(p=>({id:p.id,alongM:round(p.alongM),
        crossM:round(p.crossM)}));
     const carrierPrev=audit.approachCheckpoints.at(-1);
     const displacement=carrierPrev?Math.hypot(
      carrier.x-carrierPrev.actors[0].x,
      carrier.y-carrierPrev.actors[0].y):null;
     audit.approachCheckpoints.push({tick,ball:{
      x:round(ball.x),y:round(ball.y),shortfallM:round(shortfall)},
      actors,carrierNearestTeammates:nearestTeammates,
      actualMoverBlockedBy:carrierPursuit?.actualMoverBlockedBy??null,
      carrierPursuitTarget:pursuitTarget?{x:round(pursuitTarget.x),
       y:round(pursuitTarget.y),gapM:round(targetGapM)}:null,
      blockersAlongPursuitTarget:blockersAlongTarget,
      carrierDisplacementSincePriorCheckpointM:displacement===null?
       null:round(displacement)});
    }
    const starts=frame.physicalContactFeed.started;
    for(const start of starts){
     assert.ok(frame.physicalContactFeed.active.some(active=>
      active.engineId===start.engineId&&active.team===start.team));
     audit.realShoeStarts++;
     audit.lastPhysicalStart={tick,playerId:start.engineId,
      team:start.team,shortfallM:round(shortfall),inRange};
     if(inRange)audit.inRangeShoeStartFrames++;
    }
    const action=frame.localAutonomousAction;
    if(action){
     assert.equal(starts.length,1);
     assert.equal(frame.physicalContactFeed.active.length,1);
     assert.equal(starts[0].engineId,action.playerId);
     assert.equal(action.tick,tick);
     assert.equal(action.appliedByRapier,true);
     assert.equal(action.actualPhysicsImpulseApplied,true);
     assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
     const record={tick,team:action.team,kind:action.action,
      playerId:action.playerId,shortfallM:round(shortfall)};
     audit.authenticActions.push(record);
     if(action.team==='away'&&action.action==='pass')
      seen[audit.name].pass.push(action);
     if(action.team==='away'&&action.action==='carry')
      seen[audit.name].carry.push(action);
     if(action.action==='shot'){
      audit.naturalShots.push(record);
      assert.equal(action.decisionContext.shotRange,true);
      assert.equal(frame.physicalShotBoundary.active?.shotTick,tick);
     }
    }
    const support=frame.contactDecisionObservation.attackSupportRun;
    if(support?.team==='away'&&support.phase==='post-carry-support'){
     audit.postCarrySupportFrames++;
     const pass=seen[audit.name].pass.find(x=>
      x.tick===support.sourcePassTick);
     const carry=seen[audit.name].carry.find(x=>
      x.tick===support.carryContinuation.sourceCarryTick);
     assert.ok(pass&&carry&&pass.tick<carry.tick&&carry.tick<tick,
      'support must be authorized by prior real PASS and later CARRY');
     assert.ok(tick-pass.tick>240&&tick-pass.tick<=480);
     assert.ok(tick-carry.tick<=150);
     audit.passTick??=pass.tick;
     audit.carryTick??=carry.tick;
    }
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.officialMatchResult,null);
    assert.equal(frame.productionScoringConnected,false);
   }
  }
  assert.ok(stats[1].postCarrySupportFrames>stats[0].postCarrySupportFrames,
   'C2.3n must retain real-source forward support compared with baseline');
  assert.ok(stats[1].postCarrySupportFrames>0);
  assert.ok(stats[1].realShoeStarts>0);
  // Do not freeze a negative research observation as a permanent
  // expectation: a future genuine physical shot should be reported,
  // never rejected merely because the earlier witness had zero shots.
  console.log('C2_B_REAL_RAPIER_SHOT_GATE_TIMELINE',JSON.stringify(
   stats.map(({bestShortfallM,nearestForwardGapM,...record})=>({
    ...record,bestShortfallM:round(bestShortfallM),
    nearestForwardGapM:round(nearestForwardGapM)
   }))));
 }finally{original.dispose();handoff.dispose();verified.dispose();}
});

test('C2 post-cleanup: ordinary HOME/AWAY still rejects retired C2-a flag and preserves physical handoff',async()=>{
 const R=await initializeRapier(rapier);
 for(const c of CASES){
  const ordinary=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),extended);
  try{
   const first=ordinary.snapshot();
   assert.equal(Object.hasOwn(first,'autonomousCarryAttackContinuityMode'),false);
   assert.equal(Object.hasOwn(first,'continuityAudit'),false);
   for(let tick=1;tick<=720;tick++){
    const frame=ordinary.step();
    assert.equal(Object.hasOwn(frame,'autonomousCarryAttackContinuityMode'),false);
    assert.equal(Object.hasOwn(frame,'continuityAudit'),false);
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.officialMatchResult,null);
    const action=frame.localAutonomousAction;
    if(action){
     assert.equal(frame.physicalContactFeed.started.length,1);
     assert.equal(frame.physicalContactFeed.active.length,1);
     assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
     assert.equal(action.actualPhysicsImpulseApplied,true);
    }
   }
  }finally{ordinary.dispose();}
  for(const bad of [
   {...extended,autonomousCarryAttackContinuity:true},
   {...extended,autonomousCarryAttackContinuity:false}
  ])assert.throws(()=>createPhysicalFixtureStepRuntime(
   R,fix(c),initial(c),bad),TypeError);
 }
});

test('C2-b opt-in: authentic carry blocker detour A/B and physical safety',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const experimental={...extended,autonomousCarryBlockedDetour:true};
 for(const bad of [
  {autonomousCarryBlockedDetour:true},
  {...opts,autonomousCarryBlockedDetour:false},
  {...extended,autonomousCarryBlockedDetour:false},
  {...extended,autonomousCarryBlockedDetour:true,
   researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(
  R,fix(c),initial(c),bad),TypeError);
 const ordinary=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),extended);
 const trial=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),experimental);
 const replay=createPhysicalFixtureStepRuntime(R,fix(c),initial(c),experimental);
 const checkpoints=new Set([567,599,600,620,640,660,680,693,694,700,720]);
 const rows=[];
 let firstDivergence=null,firstShoeDifference=null;
 let ordinaryStarts=0,trialStarts=0,ordinarySupport=0,trialSupport=0;
 let minimumClearance=Infinity;
 try{
  const reset=trial.reset();
  try{assert.deepEqual(reset.snapshot().ball,trial.snapshot().ball);}
  finally{reset.dispose();}
  for(let tick=1;tick<=720;tick++){
   const a=ordinary.step(),b=trial.step(),z=replay.step();
   assert.deepEqual(b.ball,z.ball,'detour deterministic ball tick '+tick);
   assert.deepEqual(b.physicalPlayerPositions,z.physicalPlayerPositions,
    'detour deterministic players tick '+tick);
   assert.deepEqual(b.physicalContactFeed,z.physicalContactFeed);
   assert.deepEqual(b.localAutonomousAction,z.localAutonomousAction);
   if(firstDivergence===null&&(
    JSON.stringify(a.ball)!==JSON.stringify(b.ball)||
    JSON.stringify(a.physicalPlayerPositions)!==
     JSON.stringify(b.physicalPlayerPositions)))firstDivergence=tick;
   if(firstShoeDifference===null&&JSON.stringify(a.physicalContactFeed.started)!==
     JSON.stringify(b.physicalContactFeed.started))
    firstShoeDifference=tick;
   ordinaryStarts+=a.physicalContactFeed.started.length;
   trialStarts+=b.physicalContactFeed.started.length;
   if(a.contactDecisionObservation.attackSupportRun?.phase==='post-carry-support')
    ordinarySupport++;
   if(b.contactDecisionObservation.attackSupportRun?.phase==='post-carry-support')
    trialSupport++;
   for(const frame of [a,b]){
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.officialMatchResult,null);
    const start=frame.physicalContactFeed.started;
    if(frame.localAutonomousAction){
     assert.equal(start.length,1);
     assert.equal(frame.localAutonomousAction.physicalTrigger,
      'same-tick-real-rapier-shoe-start');
     assert.equal(frame.localAutonomousAction.actualPhysicsImpulseApplied,true);
    }
   }
   const carrier=b.physicalPlayerPositions.find(p=>p.engineId==='away-9');
   const clearance=Math.min(...b.physicalPlayerPositions.filter(
    p=>p.engineId!=='away-9').map(p=>Math.hypot(
     carrier.x-p.x,carrier.y-p.y)));
   minimumClearance=Math.min(minimumClearance,clearance);
   if(checkpoints.has(tick)){
    const base=a.physicalPlayerPositions.find(p=>p.engineId==='away-9');
    const pursuit=b.contactDecisionObservation.carryPursuit;
    rows.push({tick,baseline:{x:round(base.x),y:round(base.y)},
     detour:{x:round(carrier.x),y:round(carrier.y)},
     displacementFromBaselineM:round(Math.hypot(
      carrier.x-base.x,carrier.y-base.y)),
     ballGapM:round(Math.hypot(carrier.x-b.ball.position.x,
      carrier.y-b.ball.position.y)),
     blocker:pursuit?.playerId==='away-9'?
      pursuit.actualMoverBlockedBy:null,
     minimumCarrierClearanceM:round(clearance)});
   }
  }
  // No movement/physics difference before a real source-authenticated
  // carry can exist; the previous experiment failed this invariant.
  assert.ok(firstDivergence===null||firstDivergence>=143,
   'detour must not affect movement before the first genuine carry');
  assert.ok(minimumClearance>=0.98-1e-6,
   'experimental carrier must preserve 0.98m hard separation');
  console.log('C2_B_OPT_IN_BLOCKED_DETOUR_AB',JSON.stringify({
   firstDivergenceTick:firstDivergence,
   firstShoeDifferenceTick:firstShoeDifference,
   minimumCarrierClearanceM:round(minimumClearance),
   realShoeStarts:{ordinary:ordinaryStarts,detour:trialStarts},
   postCarrySupportFrames:{ordinary:ordinarySupport,detour:trialSupport},
   checkpoints:rows
  }));
 }finally{ordinary.dispose();trial.dispose();replay.dispose();}
});
