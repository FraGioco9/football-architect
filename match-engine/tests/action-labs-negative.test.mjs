// #620 CHALLENGE: real mirrored contact/no-contact and pure ambiguous-source
// counterfactuals. No invented shoe START or successful defensive outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {classifyActionLabEvidence,getActionLabScenario}
 from '../src/action-lab-scenarios.mjs';
import {selectUniformAutonomousContactAction,
 inspectPhysicalActionRejection}
 from '../src/player-ball-uniform-autonomous-action.mjs';

test('CHALLENGE original Rapier mirrored contact is physical but never a proven tackle',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'challenge',{challengeSide:side});
  const b=createControlledActionLab(R,'challenge',{challengeSide:side});
  try{
   assert.equal(a.snapshot().challengeSide,side);
   assert.equal(a.snapshot().challengeScene,'contact');
   assert.equal(a.snapshot().eventCount,0);
   let startCount=0;
   for(let tick=1;tick<=75;tick++){
    const f=a.step(),g=b.step();
    assert.equal(f.physicsTick,tick);
    assert.deepEqual(f.ball,g.ball);
    assert.deepEqual(f.starts,g.starts);
    assert.deepEqual(f.evidence,g.evidence);
    assert.deepEqual(f.action,g.action);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.scoreChanged,false);
    assert.equal(f.evidence.tackleConfirmed,null);
    assert.equal(f.evidence.passCompleted,null);
    assert.equal(f.evidence.officialPossession,false);
    startCount+=f.starts.length;
    if(tick===1){
     assert.deepEqual(f.starts,[side+'-10']);
     assert.equal(f.evidence.witnessed,true);
     assert.equal(f.evidence.observedOpponentShoeContact,true);
     assert.equal(f.evidence.verifiedShoeImpulse,false,
      'defensive witness cannot be mistaken for a verified tackle');
     assert.equal(f.action?.action,'pass');
     assert.equal(f.action.appliedByRapier,true);
     assert.equal(f.action.actualPhysicsImpulseApplied,true);
     assert.equal(f.action.officialMatchAction,false);
    }
   }
   assert.equal(a.snapshot().eventCount,1);
   assert.equal(startCount,1);
   process.stdout.write('ME_CHALLENGE_REAL_'+side.toUpperCase()+' '+
    JSON.stringify({shoeTick:1,actor:side+'-10',
     originalAction:'pass',witnesses:1,officialTackle:null})+'\\n');
  }finally{a.dispose();b.dispose();}
  assert.throws(()=>a.step(),/disposed/);
 }
});

test('CHALLENGE mirrored no-contact never invents a Rapier action or witness',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'challenge',{
   challengeSide:side,challengeScene:'no-contact'});
  const b=createControlledActionLab(R,'challenge',{
   challengeSide:side,challengeScene:'no-contact'});
  try{
   const zero=a.snapshot();
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.ball.position.x,0);
   assert.equal(zero.ball.position.y,30);
   assert.equal(zero.eventCount,0);
   for(let tick=1;tick<=90;tick++){
    const f=a.step(),g=b.step();
    assert.deepEqual(f.ball,g.ball);
    assert.deepEqual(f.starts,g.starts);
    assert.deepEqual(f.action,g.action);
    assert.equal(f.physicsTick,tick);
    assert.deepEqual(f.starts,[]);
    assert.equal(f.action,null);
    assert.equal(f.eventCount,0);
    assert.equal(f.evidence.witnessed,false);
    assert.equal(f.evidence.realContactObserved,false);
    assert.equal(f.evidence.observedOpponentShoeContact,false);
    assert.equal(f.evidence.tackleConfirmed,null);
    assert.equal(f.evidence.passCompleted,null);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.scoreChanged,false);
   }
   process.stdout.write('ME_CHALLENGE_NO_CONTACT_'+side.toUpperCase()+' '+
    JSON.stringify({tick:90,starts:0,actions:0,witnesses:0})+'\\n');
  }finally{a.dispose();b.dispose();}
 }
});

test('CHALLENGE rejects stale, absent, ambiguous START/ACTIVE and cooldown; pure counterfactuals never authenticate contact',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const challenge=getActionLabScenario('challenge');
 const physical=createControlledActionLab(R,'challenge');
 try{
  const first=physical.step();
  assert.deepEqual(first.starts,['away-10']);
  assert.equal(first.action?.appliedByRapier,true);
  const old=first.action;
  for(const [tick,starts,action] of [
   [2,['away-10'],old],
   [1,['away-10','home-10'],old],
   [1,[],old],
   [1,['away-10'],{...old,appliedByRapier:false}]
  ])assert.throws(()=>classifyActionLabEvidence(challenge,{
   tick,starts,action
  }),/single same-tick real shoe START/);
 }finally{physical.dispose();}
 const ball={x:4.96,y:0,z:0.11};
 const vel={x:0,y:0,z:0};
 const frame=createPlayerMovement().step(ball);
 const observe=(started,active,tick=1,lastActionTick=-12)=>({
  tick,contactStarted:started,contactActive:active,playerFrame:frame,
  ballPosition:ball,ballVelocity:vel,ballRadiusM:0.11,lastActionTick
 });
 // These are pure tests for hypothetical input patterns. They are NOT
 // physical simultaneous Rapier collision witnesses.
 for(const [name,starts,active] of [
  ['no-shoe',[],[]],
  ['two-shoes',['home-10','away-10'],['home-10','away-10']],
  ['another-active',['away-10'],['home-10','away-10']],
  ['active-ambiguity',['home-10'],['home-10','away-10']]
 ]){
  const input=observe(starts,active);
  const rejection=inspectPhysicalActionRejection(input);
  assert.equal(rejection.firstFailedGate,'no-exclusive-shoe-start',name);
  assert.equal(rejection.authorizesPhysicalAction,false);
  assert.equal(rejection.sourceAuthenticatedByShape,false);
  assert.equal(selectUniformAutonomousContactAction(input),null);
 }
 const cooldown=observe(['away-10'],['away-10'],1,0);
 assert.equal(inspectPhysicalActionRejection(cooldown).firstFailedGate,'cooldown');
 assert.equal(selectUniformAutonomousContactAction(cooldown),null);
 assert.throws(()=>selectUniformAutonomousContactAction(
  observe(['away-10'],['away-10'],2)),/same-tick/);
 assert.throws(()=>selectUniformAutonomousContactAction(
  observe(['away-10','away-10'],['away-10'])),/same-tick/);
 for(const bad of [
  {challengeSide:'unknown'},{challengeScene:'fabricated'}
 ])assert.throws(()=>createControlledActionLab(R,'challenge',bad),/bounded/);
 assert.throws(()=>createControlledActionLab(R,'pass',{
  challengeScene:'no-contact'
 }),/bounded/);
 assert.throws(()=>createControlledActionLab(R,'pass',{
  challengeSide:'home'
 }),/bounded/);
 // Actual private world with remote grounded ball: never observe a START,
 // not even if the same action opt-in has been enabled explicitly.
 const world=createEngine(R,{
  preset:'roll',seed:'me-challenge-no-contact',x:0,y:30,z:0,
  vx:0,vy:0,vz:0
 },{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true
 });
 try{
  const frame=createPlayerMovement().step(world.snapshot().ball.position);
  const state=world.step(frame);
  assert.equal(state.tick,1);
  assert.deepEqual(world.footContactSnapshot().started,[]);
  assert.equal(world.uniformAutonomousActionSnapshot(),null);
 }finally{world.dispose();}
});

test('all five Action LAB modes preserve canonical 22 players, 60Hz and 0.98m separation',
 {timeout:80000},async()=>{
 const R=await initializeRapier(rapier);
 const {PLAYER_MIN_SEPARATION_M}=await import('../src/player-movement.mjs');
 const cases=[
  ['pass',{}],
  ['shot',{shotSide:'home'}],
  ['shot',{shotSide:'away'}],
  ['shot',{shotSide:'home',shotLane:'blocked'}],
  ['shot',{shotSide:'away',shotLane:'blocked'}],
  ['challenge',{challengeSide:'home'}],
  ['challenge',{challengeSide:'away'}],
  ['challenge',{challengeSide:'home',challengeScene:'no-contact'}],
  ['challenge',{challengeSide:'away',challengeScene:'no-contact'}],
  ['control',{}],
  ['control',{controlScene:'opponent-first'}],
  ['carry',{carrySide:'home'}],
  ['carry',{carrySide:'away'}]
 ];
 let minimum=Infinity;
 for(const [id,options] of cases){
  const lab=createControlledActionLab(R,id,options);
  try{
   const initial=lab.snapshot();
   const names=initial.players.map(p=>p.id);
   assert.equal(names.length,22);
   assert.equal(new Set(names).size,22);
   for(let tick=0;tick<=60;tick++){
    const snap=tick===0?initial:lab.step();
    assert.equal(snap.physicsTick,tick);
    assert.ok(Math.abs(snap.timeS-tick/60)<1e-9);
    assert.equal(snap.players.length,22);
    assert.deepEqual(snap.players.map(p=>p.id),names);
    assert.equal(snap.officialMatchResult,null);
    assert.equal(snap.officialMatchPossession,false);
    assert.equal(snap.scoreChanged,false);
    assert.equal(snap.readOnlyEvidence,true);
    for(let j=0;j<snap.players.length;j++){
     const p=snap.players[j];
     assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
     for(let k=0;k<j;k++){
      const q=snap.players[k],gap=Math.hypot(p.x-q.x,p.y-q.y);
      minimum=Math.min(minimum,gap);
      assert.ok(gap>=PLAYER_MIN_SEPARATION_M-1e-7,
       id+' '+JSON.stringify(options)+' tick '+tick+
       ' overlap '+p.id+'/'+q.id+' gap='+gap.toFixed(7));
     }
    }
   }
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_ACTION_LABS_SEPARATION_60HZ '+
  JSON.stringify({variants:cases.length,checkedTicksPerVariant:61,
   minimumM:+minimum.toFixed(5),canonicalLimitM:PLAYER_MIN_SEPARATION_M,
   officialStateMutations:0})+'\\n');
});
