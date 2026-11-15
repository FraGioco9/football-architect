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

test('mirrored blocked SHOT: real shooter START but original goal lanes reject SHOT',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const open=createControlledActionLab(R,'shot',{shotSide:side});
  const blocked=createControlledActionLab(R,'shot',{shotSide:side,shotLane:'blocked'});
  const replay=createControlledActionLab(R,'shot',{shotSide:side,shotLane:'blocked'});
  try{
   assert.equal(blocked.snapshot().physicsTick,0);
   assert.equal(blocked.snapshot().blockedShotObservation,null);
   assert.deepEqual(blocked.snapshot().starts,[]);
   const opponent=blocked.snapshot().players.find(p=>
    p.id===(side==='home'?'away':'home')+'-2');
   assert.ok(Math.abs(opponent.x-(side==='home'?41:-41))<1e-6);
   assert.ok(Math.abs(opponent.y-(side==='home'?0.5111111111:-0.5111111111))<1e-5);
   assert.equal(open.step().action?.action,'shot','open lane positive control');
   const f=blocked.step(),g=replay.step();
   assert.deepEqual(f.starts,[side+'-10']);
   assert.deepEqual(f.ball,g.ball);
   assert.deepEqual(f.action,g.action);
   assert.notEqual(f.action?.action,'shot');
   assert.equal(f.evidence.witnessed,false);
   assert.equal(f.shotFlight,null);
   assert.equal(f.eventCount,0);
   const witness=f.blockedShotObservation;
   assert.ok(witness,'original same-tick geometry must reject all 3 lanes');
   assert.equal(witness.tick,1);
   assert.equal(witness.playerId,side+'-10');
   assert.equal(witness.policyGeometry.shotRange,true);
   assert.equal(witness.policyGeometry.shotLaneFound,false);
   assert.equal(witness.policyGeometry.physicalActionExecuted,false);
   assert.equal(witness.realShoeStart,true);
   assert.equal(f.officialMatchResult,null);
   for(let t=2;t<=35;t++){
    const x=blocked.step(),y=replay.step();
    assert.deepEqual(x.ball,y.ball);
    assert.deepEqual(x.action,y.action);
    assert.equal(x.shotFlight,null);
    assert.equal(x.blockedShotObservation,witness);
    assert.equal(x.evidence.officialGoal,false);
    assert.equal(x.scoreChanged,false);
    assert.notEqual(x.action?.action,'shot');
   }
   process.stdout.write('ME_SHOT_BLOCKED_'+side.toUpperCase()+
    ' '+JSON.stringify({tick:witness.tick,action:witness.actionType})+'\\n');
  }finally{open.dispose();blocked.dispose();replay.dispose();}
 }
});

test('SHOT cannot be spoofed by ball coordinates or by ordinary engine settings',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 assert.throws(()=>createControlledActionLab(R,'shot',{shotSide:'referee'}),
  /mirrored|supported/);
 assert.throws(()=>createControlledActionLab(R,'pass',{shotSide:'away'}),
  /mirrored|supported/);
 assert.throws(()=>createControlledActionLab(R,'shot',{shotLane:'none'}),
  /blocked setups/);
 assert.throws(()=>createControlledActionLab(R,'pass',{shotLane:'blocked'}),
  /blocked setups/);
 const {createEngine}=await import('../src/core.mjs');
 const {createPlayerMovement}=await import('../src/player-movement.mjs');
 const ball={preset:'roll',seed:'shot-unstaged-counterfactual',
  x:30,y:1,z:0,vx:0,vy:0,vz:0};
 assert.throws(()=>createEngine(R,ball,{
  diagnosticResearchShotAttacker:'home'
 }),/genuine private source/);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticResearchShotBlockedLane:true
 }),/Blocked lane requires/);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticResearchShotBlockedLane:'true'
 }),/Blocked lane requires/);
 assert.throws(()=>createPlayerMovement({researchShotBlockedLane:true}),
  /paired bounded/);
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


test('CONTROL research diagnostic: actual original pass and subsequent shoe timeline',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const lab=createControlledActionLab(R,'pass');
 let pass=null,recipient=null,minGap=Infinity,minTick=null;
 const contacts=[],samples=[];
 try{
  for(let tick=1;tick<=420;tick++){
   const s=lab.step();
   if(s.action?.action==='pass'&&!pass){
    pass={tick,actor:s.action.playerId,
     target:s.action.passTarget,impulse:s.action.impulseNs};
    recipient=s.action.passTarget?.recipientId??null;
   }
   if(recipient){
    const p=s.players.find(x=>x.id===recipient),b=s.ball.position;
    const gap=Math.hypot(p.x-b.x,p.y-b.y);
    if(gap<minGap){minGap=gap;minTick=tick;}
    if(tick===1||tick%30===0)
     samples.push({tick,b:{x:+b.x.toFixed(2),y:+b.y.toFixed(2)},
      receiver:{x:+p.x.toFixed(2),y:+p.y.toFixed(2)},gap:+gap.toFixed(2)});
   }
   if(s.starts.length)contacts.push({tick,starts:s.starts,action:s.action?.action??null});
  }
  process.stdout.write('ME_CONTROL_RESEARCH '+
   JSON.stringify({pass,recipient,minGap,minTick,contacts:contacts.slice(0,25),samples})+'\\n');
 }finally{lab.dispose();}
});


test('CONTROL stage research grid: same Rapier pass impulse followed by real receiver START',
 {timeout:90000},async()=>{
 const R=await initializeRapier(rapier);
 const {createEngine}=await import('../src/core.mjs');
 const {createPlayerMovement}=await import('../src/player-movement.mjs');
 const {CONTROL_RESEARCH_CANDIDATES}=await import('../src/research-control-initial-lineup.mjs');
 const ball={preset:'roll',seed:'me-control-stage-probe',x:-4.96,y:0,z:0,vx:0.3,vy:0,vz:0};
 const outcomes=[];
 for(let slot=0;slot<CONTROL_RESEARCH_CANDIDATES.length;slot++){
  const core=createEngine(R,ball,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,
   diagnosticResearchControlSlot:slot
  });
  const mover=createPlayerMovement({
   researchControlSlot:slot,researchControlBall:ball
  });
  const trace={slot,initial:CONTROL_RESEARCH_CANDIDATES[slot],
   pass:null,starts:[],minimumGap:Infinity,minimumTick:0,
   end:0};
  try{
   for(let tick=1;tick<=170;tick++){
    const frame=mover.step(core.snapshot().ball.position);
    const after=core.step(frame);
    const action=core.uniformAutonomousActionSnapshot();
    const foot=core.footContactSnapshot();
    if(action?.action==='pass'&&!trace.pass)
     trace.pass={tick,playerId:action.playerId,
      recipientId:action.passTarget?.recipientId};
    const player=frame.players.find(p=>p.id==='home-9');
    const p=after.ball.position;
    const gap=Math.hypot(player.x-p.x,player.y-p.y);
    if(gap<trace.minimumGap){trace.minimumGap=+gap.toFixed(3);trace.minimumTick=tick;}
    if(foot.started.length)trace.starts.push({
     tick,ids:foot.started,action:action?.action??null});
   }
   trace.end=core.snapshot().tick;
  }finally{core.dispose();}
  outcomes.push(trace);
 }
 process.stdout.write('ME_CONTROL_GRID '+JSON.stringify(outcomes)+'\\n');
});
