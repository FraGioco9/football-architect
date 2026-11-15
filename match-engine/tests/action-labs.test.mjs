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
 const priorPass={tick:1,playerId:'home-10',recipientId:'home-9',team:'home'};
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['away-10'],priorPass
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-10'],priorPass
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-9'],priorPass
 }).verifiedReceivingShoeContact,true);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-8'],priorPass
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-9'],priorPass,opponentEarlier:true
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-9','away-10'],priorPass
 }).witnessed,false);
 assert.throws(()=>classifyActionLabEvidence(control,{
  tick:1,starts:['home-9'],priorPass
 }),/prior genuine physical pass/);
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
  /bounded/);
 assert.throws(()=>createControlledActionLab(R,'pass',{shotSide:'away'}),
  /bounded/);
 assert.throws(()=>createControlledActionLab(R,'shot',{shotLane:'none'}),
  /bounded/);
 assert.throws(()=>createControlledActionLab(R,'pass',{shotLane:'blocked'}),
  /bounded/);
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


test('CONTROL: genuine HOME #10 pass then intended HOME #9 shoe START at tick 30, deterministic',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const a=createControlledActionLab(R,'control');
 const b=createControlledActionLab(R,'control');
 let pass=null,receive=null;
 try{
  const zero=a.snapshot();
  assert.equal(zero.physicsTick,0);
  assert.equal(zero.priorRealPass,null);
  assert.deepEqual(zero.starts,[]);
  const receiver=zero.players.find(p=>p.id==='home-9');
  assert.ok(receiver);
  assert.equal(receiver.x,-5);
  assert.equal(receiver.y,-3.2);
  for(let tick=1;tick<=90;tick++){
   const f=a.step(),g=b.step();
   assert.equal(f.physicsTick,tick);
   assert.deepEqual(f.ball,g.ball);
   assert.deepEqual(f.starts,g.starts);
   assert.deepEqual(f.action,g.action);
   assert.deepEqual(f.evidence,g.evidence);
   assert.equal(f.officialMatchResult,null);
   assert.equal(f.officialMatchPossession,false);
   assert.equal(f.scoreChanged,false);
   assert.equal(f.evidence.passCompleted,null);
   assert.equal(f.evidence.officialGoal,false);
   if(tick>=30){
    assert.equal(f.receivingContact?.tick,30);
    assert.equal(f.receivingContact?.recipientId,'home-9');
    assert.equal(f.receivingContact?.officialPossession,false);
    assert.equal(f.receivingContact?.passCompleted,false);
   }
   if(tick===1){
    assert.deepEqual(f.starts,['home-10']);
    assert.equal(f.action?.action,'pass');
    assert.equal(f.action.appliedByRapier,true);
    assert.equal(f.action.actualPhysicsImpulseApplied,true);
    assert.equal(f.action.passTarget?.recipientId,'home-9');
    assert.equal(f.evidence.witnessed,false);
    assert.equal(f.priorRealPass?.tick,1);
    assert.equal(f.priorRealPass?.recipientId,'home-9');
    pass=f.action;
   }
   if(f.evidence.verifiedReceivingShoeContact){
    if(!receive)receive={tick,contact:f.starts[0],action:f.action};
    assert.equal(f.starts.length,1);
    assert.equal(f.starts[0],'home-9');
    assert.ok(tick>pass.tick);
    assert.equal(f.evidence.verifiedShoeImpulse,false,
     'receiving contact is not a separate CONTROL impulse');
    assert.equal(f.eventCount,1);
   }
  }
  assert.equal(receive?.tick,30);
  assert.equal(receive.contact,pass.passTarget.recipientId);
  process.stdout.write('ME_CONTROL_REAL_RECEIVING_SHOE '+
   JSON.stringify({passTick:pass.tick,receiverTick:receive.tick,
    receiver:receive.contact,secondaryOriginalAction:receive.action?.action??null})+'\\n');
 }finally{a.dispose();b.dispose();}
 assert.throws(()=>a.step(),/disposed/);
});

test('CONTROL: authentic no-reception baseline and forbidden setup never award possession',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const {createEngine}=await import('../src/core.mjs');
 const {createPlayerMovement}=await import('../src/player-movement.mjs');
 const {INITIAL_PLAYERS}=await import('../src/player-movement.mjs');
 const {initialResearchControlLineup}=await import('../src/research-control-initial-lineup.mjs');
 const ball={preset:'roll',seed:'me-control-negative',x:-4.96,y:0,z:0,vx:0.3,vy:0,vz:0};
 assert.throws(()=>createEngine(R,ball,{
  diagnosticResearchControlReceiver:true
 }),/sole private current-tick/);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticResearchControlReceiver:true,
  diagnosticAutonomousCarryEnabled:true
 }),/sole private current-tick/);
 assert.throws(()=>createPlayerMovement({
  researchControlReceiver:true,researchControlBall:{...ball,x:0}
 }),/Closed deterministic/);
 assert.throws(()=>initialResearchControlLineup(INITIAL_PLAYERS,{
  ...ball,x:30
 }),/Closed deterministic/);
 const engine=createEngine(R,ball,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true
 });
 const mover=createPlayerMovement();
 let initialPass=null,otherContacts=0;
 try{
  for(let tick=1;tick<=170;tick++){
   const frame=mover.step(engine.snapshot().ball.position);
   engine.step(frame);
   const action=engine.uniformAutonomousActionSnapshot();
   const starts=engine.footContactSnapshot().started;
   if(tick===1){
    assert.deepEqual(starts,['home-10']);
    assert.equal(action?.action,'pass');
    initialPass=action;
   }
   if(tick>1)otherContacts+=starts.length;
  }
  assert.equal(otherContacts,0,
   'without staged physical receiver, no reception can be claimed');
  assert.equal(initialPass.passTarget.recipientId,'home-9');
 }finally{engine.dispose();}
});


test('CARRY original selector: mirrored genuine Rapier shoe START, 0.42 Ns touch and ground motion',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const {PROVISIONAL_PHYSICAL_CARRY_IMPULSE_NS}=await import(
  '../src/player-ball-uniform-autonomous-action.mjs');
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'carry',{carrySide:side});
  const b=createControlledActionLab(R,'carry',{carrySide:side});
  try{
   const zero=a.snapshot();
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.players.length,22);
   assert.equal(zero.carryTrace,null);
   assert.deepEqual(zero.starts,[]);
   assert.equal(zero.carrySide,side);
   for(const no of [9,11]){
    const attacker=zero.players.find(p=>p.id===side+'-'+no);
    const marker=zero.players.find(p=>p.id===(side==='home'?'away':'home')+'-'+no);
    assert.ok(Math.abs(Math.hypot(
     marker.x-attacker.x,marker.y-attacker.y)-1.15)<1e-8,
     'actual opponent physically marks original possible pass receiver');
   }
   let first=null,moved=false;
   for(let tick=1;tick<=70;tick++){
    const x=a.step(),y=b.step();
    assert.equal(x.physicsTick,tick);
    assert.deepEqual(x.ball,y.ball);
    assert.deepEqual(x.starts,y.starts);
    assert.deepEqual(x.action,y.action);
    assert.deepEqual(x.carryTrace,y.carryTrace);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.officialMatchPossession,false);
    assert.equal(x.scoreChanged,false);
    assert.equal(x.evidence.dribbleConfirmed,null);
    assert.equal(x.evidence.passCompleted,null);
    assert.equal(x.evidence.officialGoal,false);
    if(x.action?.action==='carry'){
     assert.equal(tick,1,'original exclusive Rapier shoe must touch at tick 1');
     assert.deepEqual(x.starts,[side+'-10']);
     assert.equal(x.action.playerId,side+'-10');
     assert.equal(x.action.team,side);
     assert.equal(x.action.appliedByRapier,true);
     assert.equal(x.action.actualPhysicsImpulseApplied,true);
     assert.equal(x.evidence.verifiedShoeImpulse,true);
     assert.equal(x.action.carryTarget?.physicsTick,tick);
     assert.equal(x.action.carryTarget?.dribbleConfirmed,null);
     assert.equal(x.action.carryTarget?.shortGroundTouchOnly,true);
     const imp=x.action.impulseNs;
     assert.ok(Math.abs(Math.hypot(imp.x,imp.y,imp.z)-
      PROVISIONAL_PHYSICAL_CARRY_IMPULSE_NS)<1e-8);
     assert.ok(imp.x*(side==='home'?1:-1)>0);
     if(!first)first=x.action;
    }
    if(x.carryTrace?.observedGroundMotion){
     moved=true;
     assert.ok(x.carryTrace.path2DM>0.15);
     assert.ok(x.carryTrace.groundedSamples>=2);
     assert.equal(x.carryTrace.actorId,side+'-10');
     assert.equal(x.carryTrace.team,side);
     assert.equal(x.carryTrace.dribbleConfirmed,null);
     assert.equal(x.carryTrace.officialPossession,false);
    }
   }
   assert.ok(first,'genuine original physical CARRY impulse not observed');
   assert.equal(first.tick,1);
   assert.equal(a.snapshot().eventCount,1);
   assert.ok(moved,'post impulse same-world ground displacement not observed');
   const snap=a.snapshot();
   process.stdout.write('ME_CARRY_REAL_'+side.toUpperCase()+' '+
    JSON.stringify({tick:first.tick,actor:first.playerId,
     impulse:first.impulseNs,
     path2DM:+snap.carryTrace.path2DM.toFixed(3),
     grounded:snap.carryTrace.groundedSamples,
     endedByOtherAction:snap.carryTrace.endedByOtherAction})+'\\n');
  }finally{a.dispose();b.dispose();}
  assert.throws(()=>a.step(),/disposed/);
 }
});

test('CARRY unavailable by original rules: genuine PASS takes priority, not fictitious CARRY',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const {createEngine}=await import('../src/core.mjs');
 const {createPlayerMovement}=await import('../src/player-movement.mjs');
 const {CARRY_LAB_STARTS}=await import('../src/action-lab-scenarios.mjs');
 const {initialResearchCarryLineup}=await import('../src/research-carry-initial-lineup.mjs');
 const {INITIAL_PLAYERS}=await import('../src/player-movement.mjs');
 for(const side of ['home','away']){
  const ball=CARRY_LAB_STARTS[side];
  assert.throws(()=>createEngine(R,ball,{
   diagnosticResearchCarrySide:side
  }),/genuine private shoe source/);
  assert.throws(()=>createEngine(R,ball,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,
   diagnosticResearchCarrySide:'unknown'
  }),/genuine private shoe source/);
  assert.throws(()=>createPlayerMovement({
   researchCarrySide:side,researchCarryBall:{...ball,x:0}
  }),/original central-ground ball/);
  assert.throws(()=>initialResearchCarryLineup(INITIAL_PLAYERS,side,
   {...ball,y:4}),/original central-ground ball/);
  const engine=createEngine(R,ball,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,
   diagnosticAutonomousCarryEnabled:true
  });
  const mover=createPlayerMovement();
  try{
   const frame=mover.step(engine.snapshot().ball.position);
   const post=engine.step(frame);
   const action=engine.uniformAutonomousActionSnapshot();
   assert.equal(post.tick,1);
   assert.deepEqual(engine.footContactSnapshot().started,[side+'-10']);
   assert.equal(action?.playerId,side+'-10');
   assert.equal(action?.action,'pass',
    'original open recipient lanes must remain higher priority');
   assert.equal(action.appliedByRapier,true);
   assert.equal(action.carryTarget,null);
   assert.equal(action.passTarget.physicalPassAttemptOnly,true);
   assert.equal(action.passTarget.passCompleted,false);
   assert.equal(action.officialMatchPossession,false);
  }finally{engine.dispose();}
 }
 assert.throws(()=>createControlledActionLab(R,'carry',{carrySide:'neither'}),
  /bounded/);
 assert.throws(()=>createControlledActionLab(R,'pass',{carrySide:'away'}),
  /bounded/);
});


test('CONTROL 2b research: real opponent-first vs intended receiver across bounded initial cases',
 {timeout:100000},async()=>{
 const R=await initializeRapier(rapier);
 const {createEngine}=await import('../src/core.mjs');
 const {createPlayerMovement}=await import('../src/player-movement.mjs');
 const {RESEARCH_CONTROL_OPPONENT_CANDIDATES:candidates}=await import(
  '../src/research-control-initial-lineup.mjs');
 const ball={preset:'roll',seed:'me-action-pass-receive',
  x:-4.96,y:0,z:0,vx:0.3,vy:0,vz:0};
 const results=[];
 for(let slot=0;slot<candidates.length;slot++){
  const engine=createEngine(R,ball,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,
   diagnosticResearchControlReceiver:true,
   diagnosticResearchControlOppositionSlot:slot
  });
  const mover=createPlayerMovement({
   researchControlReceiver:true,researchControlBall:ball,
   researchControlOppositionSlot:slot
  });
  let priorPass=null;
  const trace={slot,p:candidates[slot],pass:null,
   starts:[],firstOpponent:null,firstReceiver:null,errors:[]};
  try{
   for(let tick=1;tick<=145;tick++){
    const frame=mover.step(engine.snapshot().ball.position,priorPass);
    engine.step(frame);
    const action=engine.uniformAutonomousActionSnapshot();
    const starts=engine.footContactSnapshot().started;
    if(tick===1){
     trace.pass=action?.action+' '+action?.passTarget?.recipientId;
     if(action?.action==='pass'&&
        action?.passTarget?.recipientId==='home-9')
      priorPass=action;
    }
    if(starts.length){
     trace.starts.push({tick,ids:starts,action:action?.action??null});
     if(!trace.firstOpponent&&starts.some(x=>x.startsWith('away-')))
      trace.firstOpponent=tick;
     if(!trace.firstReceiver&&starts.includes('home-9'))
      trace.firstReceiver=tick;
    }
   }
  }catch(e){trace.errors.push(e.message);}
  finally{engine.dispose();}
  results.push(trace);
 }
 process.stdout.write('ME_CONTROL_OPPONENT_GRID '+JSON.stringify(results)+'\\n');
});
