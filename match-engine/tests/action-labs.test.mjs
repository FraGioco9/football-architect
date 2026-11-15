// #620 clean-stack action scenes: real same-world Rapier source only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {ACTION_LAB_SCENARIOS,getActionLabScenario,
 classifyActionLabEvidence} from '../src/action-lab-scenarios.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

test('five clean Action LABs retain negative authorization boundaries',()=>{
 assert.deepEqual(ACTION_LAB_SCENARIOS.map(s=>s.id),
  ['pass','shot','challenge','control','carry']);
 assert.equal(new Set(ACTION_LAB_SCENARIOS.map(s=>s.initial.seed)).size,5);
 for(const spec of ACTION_LAB_SCENARIOS){
  assert.ok(Object.isFrozen(spec)&&Object.isFrozen(spec.initial));
  assert.equal(spec.officialResult,false);
  assert.equal(getActionLabScenario(spec.id),spec);
  const zero=classifyActionLabEvidence(spec,{tick:0,starts:[]});
  assert.equal(zero.witnessed,false);
  assert.equal(zero.officialMatchAction,false);
  assert.equal(zero.officialPossession,false);
  assert.equal(zero.officialGoal,false);
  assert.equal(zero.tackleConfirmed,null);
  assert.equal(zero.dribbleConfirmed,null);
  assert.equal(zero.passCompleted,null);
 }
 assert.throws(()=>getActionLabScenario('official-goal'),RangeError);
 const pass=getActionLabScenario('pass'),action={
  action:'pass',tick:1,playerId:'home-10',
  appliedByRapier:true,actualPhysicsImpulseApplied:true,
  officialMatchAction:false
 };
 assert.equal(classifyActionLabEvidence(pass,{
  tick:1,starts:['home-10'],action
 }).verifiedShoeImpulse,true);
 for(const bad of [
  {tick:1,starts:[],action},
  {tick:1,starts:['home-10','away-10'],action},
  {tick:1,starts:['home-10'],action:{...action,appliedByRapier:false}},
  {tick:1,starts:['home-10'],action:{...action,tick:0}},
  {tick:1,starts:['home-10'],action:{...action,officialMatchAction:true}}
 ])assert.throws(()=>classifyActionLabEvidence(pass,bad),TypeError);
 const control=getActionLabScenario('control');
 const priorPass={tick:1,playerId:'home-10',team:'home'};
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['away-10'],priorPass
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-10'],priorPass
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-9'],priorPass
 }).verifiedReceivingShoeContact,true);
 const challenge=getActionLabScenario('challenge');
 assert.equal(classifyActionLabEvidence(challenge,{
  tick:1,starts:['home-10']
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(challenge,{
  tick:1,starts:['away-10']
 }).observedOpponentShoeContact,true);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const dev=readFileSync(new URL('../../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../src/action-labs.mjs',import.meta.url),'utf8');
 for(const spec of ACTION_LAB_SCENARIOS)
  assert.match(html,new RegExp('<option value="'+spec.id+'">'));
 assert.match(html,/id="action-labs-dialog"/);
 assert.match(dev,/__fa_match_engine__\/action-labs\.mjs/);
 assert.match(dev,/__fa_match_engine__\/action-lab-scenarios\.mjs/);
 assert.doesNotMatch(client,/player-ball-universal-world|LocalAiPassReceive|LocalAiExchange/);
});

test('same-world clean Action LAB 22-player actual physics, PASS positive, no unearned outcomes',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const results={};
 for(const spec of ACTION_LAB_SCENARIOS){
  const lab=createControlledActionLab(R,spec.id);
  try{
   const zero=lab.snapshot();
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.players.length,22);
   assert.equal(zero.officialMatchPossession,false);
   assert.equal(zero.eventCount,0);
   let first=null,shoeStartCount=0;
   const horizon=spec.id==='pass'?1:spec.id==='challenge'?45:80;
   for(let tick=1;tick<=horizon;tick++){
    const f=lab.step();
    assert.equal(f.physicsTick,tick);
    assert.equal(f.players.length,22);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.scoreChanged,false);
    assert.equal(f.evidence.officialGoal,false);
    assert.equal(f.evidence.tackleConfirmed,null);
    assert.equal(f.evidence.dribbleConfirmed,null);
    assert.equal(f.evidence.passCompleted,null);
    shoeStartCount+=f.starts.length;
    if(f.evidence.witnessed&&!first)
     first={tick,actor:f.action?.playerId??f.starts[0],kind:f.action?.action??spec.goal};
   }
   results[spec.id]={first,shoeStartCount};
   if(spec.id==='pass'){
    assert.deepEqual(first,{tick:1,actor:'home-10',kind:'pass'});
    assert.equal(shoeStartCount>=1,true);
   }
  }finally{lab.dispose();}
  assert.throws(()=>lab.step(),/disposed/);
 }
 process.stdout.write('ME_CLEAN_ACTION_LABS '+JSON.stringify(results)+'\n');
});


test('clean SHOT LAB: real mirrored HOME/AWAY shoe impulses and measured 3D flight',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'shot',{shotSide:side});
  const b=createControlledActionLab(R,'shot',{shotSide:side});
  try{
   assert.equal(a.snapshot().physicsTick,0);
   assert.equal(a.snapshot().action,null);
   assert.deepEqual(a.snapshot().starts,[]);
   const actor=a.snapshot().players.find(p=>p.id===side+'-10');
   assert.ok(Math.abs(actor.x-(side==='home'?29.72:-29.72))<1e-6);
   let shot=null,flight=false,shotTick=null;
   for(let tick=1;tick<=90;tick++){
    const x=a.step(),y=b.step();
    assert.deepEqual(x.ball,y.ball,'deterministic same-world replay');
    assert.deepEqual(x.starts,y.starts);
    assert.deepEqual(x.action,y.action);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.evidence.officialGoal,false);
    if(x.action?.action==='shot'){
     assert.equal(x.action.playerId,side+'-10');
     assert.equal(x.action.team,side);
     assert.deepEqual(x.starts,[side+'-10']);
     assert.equal(x.evidence.verifiedShoeImpulse,true);
     assert.equal(x.action.shotTarget.physicsTick,tick);
     assert.ok(x.action.shotTarget.laneClearanceM>=2.4);
     assert.equal(x.action.shotTarget.targetX,side==='home'?52.5:-52.5);
     assert.ok(x.action.impulseNs.x*(side==='home'?1:-1)>0);
     assert.ok(x.action.impulseNs.z>0);
     if(!shot){shot=x.action;shotTick=tick;}
    }
    if(x.shotFlight?.observed3DFlight){
     flight=true;
     assert.ok(x.shotFlight.path3DM>0);
     assert.ok(x.shotFlight.maxCenterZM>x.shotFlight.origin.z+0.02);
     assert.equal(x.shotFlight.shooterId,side+'-10');
     assert.equal(x.shotFlight.team,side);
    }
   }
   assert.ok(shot,'original selector requires real SHOT for '+side);
   assert.ok(shotTick>=1&&shotTick<=90);
   assert.equal(flight,true,'physical post-impulse 3D flight must be observed');
   process.stdout.write('ME_SHOT_REAL_'+side.toUpperCase()+
    ' '+JSON.stringify({tick:shotTick,actor:shot.playerId,
     observedFlight:flight})+'\\n');
  }finally{a.dispose();b.dispose();}
 }
});

test('SHOT cannot be spoofed by ball coordinates or by ordinary engine settings',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 assert.throws(()=>createControlledActionLab(R,'shot',{shotSide:'referee'}),
  /mirrored|supported/);
 assert.throws(()=>createControlledActionLab(R,'pass',{shotSide:'away'}),
  /mirrored|supported/);
 const {createEngine}=await import('../src/core.mjs');
 const {createPlayerMovement}=await import('../src/player-movement.mjs');
 const ball={preset:'roll',seed:'shot-unstaged-counterfactual',
  x:30,y:1,z:0,vx:0,vy:0,vz:0};
 assert.throws(()=>createEngine(R,ball,{
  diagnosticResearchShotAttacker:'home'
 }),/genuine private source/);
 assert.throws(()=>createPlayerMovement({
  researchShotAttacker:'home',researchShotBall:{...ball,x:0}
 }),/attacking-third/);
 const engine=createEngine(R,ball,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true
 });
 const mover=createPlayerMovement();
 try{
  let starts=0,shots=0;
  for(let i=0;i<80;i++){
   const frame=mover.step(engine.snapshot().ball.position);
   const after=engine.step(frame);
   starts+=engine.footContactSnapshot().started.length;
   if(engine.uniformAutonomousActionSnapshot()?.action==='shot')shots++;
   assert.equal(after.tick,i+1);
  }
  assert.equal(starts,0,'ball alone cannot manufacture shoe START');
  assert.equal(shots,0,'attacking third does not automatically create SHOT');
 }finally{engine.dispose();}
});
