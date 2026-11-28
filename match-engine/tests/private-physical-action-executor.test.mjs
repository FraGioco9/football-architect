// #480/#620: closed same-world Rapier source -> physical action impulse.
// Targeted tests are from real 22-actor Rapier shoes, not supplied START arrays.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,BALL_RADIUS,canonicalSnapshot}
 from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement} from '../src/player-movement.mjs';
import {footProxyTransform} from '../src/player-foot-contact.mjs';
import {NATIVE_FUNDAMENTALS,createNativeFundamentalMask,nativeFundamentalAllowed,nativeLabFundamentalMask,nativeAerialSurfaceAllowed,createNativeDuelFundamentalMask,nativeDefensiveInterventionAllowed,nativePhysicalActionAllowed,nativeLabAerialSequence,nativeSequenceDeliveryAllowed,nativeSequenceAerialAllowed,nativeSequenceGroundMask,nativeKeeperSequenceDeliveryAllowed,nativeKeeperSequenceClaimAllowed,nativeKeeperSequenceInterrupted} from '../src/native-fundamental-mask.mjs';
import {selectDefensiveIntervention} from '../src/defensive-intervention-selection.mjs';
import {createNativeActionRestriction,evaluateNativeActionRestriction} from '../src/private-physical-action-executor.mjs';

test('UME-05E isolated technical constraints filter the same native decision without creating actions',()=>{
 for(const [actor,receiver] of [['home-10','home-9'],['away-4','away-7'],['home-2','home-6']]){
  for(const [action,vertical,z] of [['pass','ground',0],['cross','lofted',1],['shot','any',0.4]]){
   const recipientId=action==='shot'?null:receiver;
   const limit=createNativeActionRestriction({action,actorId:actor,recipientId,vertical});
   const target=action==='pass'?{passTarget:{recipientId}}:action==='cross'?{crossTarget:{recipientId}}:{};
   const choice={action,playerId:actor,impulseNs:{x:1,y:0,z},...target};
   assert.equal(evaluateNativeActionRestriction(limit,choice,0),true);
   assert.equal(evaluateNativeActionRestriction(limit,null,0),false);
   assert.equal(evaluateNativeActionRestriction(limit,choice,1),false);
   assert.equal(evaluateNativeActionRestriction(limit,{...choice,action:'carry'},0),false);
   assert.equal(evaluateNativeActionRestriction(limit,{...choice,playerId:receiver},0),false);
   if(action!=='shot'){
    assert.equal(evaluateNativeActionRestriction(limit,{...choice,passTarget:{recipientId:actor},crossTarget:{recipientId:actor}},0),false);
    assert.equal(evaluateNativeActionRestriction(limit,{...choice,impulseNs:{x:1,y:0,z:action==='pass'?1:0}},0),false);
   }
   assert.equal(evaluateNativeActionRestriction(null,choice,1),true);
  }
 }
 assert.throws(()=>createNativeActionRestriction({action:'pass',actorId:'home-10'}),/Bounded/);
 assert.throws(()=>createNativeActionRestriction({action:'shot',actorId:'home-10',maxActions:2}),/Bounded/);
});
const mirrorScenario=team=>{
 const actor=INITIAL_PLAYERS.find(p=>p.id===team+'-10');
 const pose=footProxyTransform(actor);
 const x=pose.x+0.20*Math.cos(actor.facingRad);
 const y=pose.y+0.20*Math.sin(actor.facingRad);
 return Object.freeze({preset:'roll',seed:'action-source-'+team,
  x,y,z:0,vx:0,vy:0,vz:0});
};
const d3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('closed original selector kicks real Rapier ball only after an exclusive HOME/AWAY shoe START', {timeout:30000},async()=>{
 const R=await initializeRapier(rapier);
 for(const team of ['home','away']){
  const scenario=mirrorScenario(team);
  const physical=createEngine(R,scenario,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true
  });
  const physicsOnly=createEngine(R,scenario,{
   diagnosticPlayerFootContactsEnabled:true
  });
  const replay=createEngine(R,scenario,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true
  });
  try{
   const playerFrame=createPlayerMovement().step(scenario);
   const peerFrame=createPlayerMovement().step(scenario);
   const duplicateFrame=createPlayerMovement().step(scenario);
   assert.equal(physical.uniformAutonomousActionSnapshot(),null);
   assert.equal(physical.physicalRejectionAuditSnapshot(),null);
   const after=physical.step(playerFrame);
   const noImpulse=physicsOnly.step(peerFrame);
   const again=replay.step(duplicateFrame);
   const contacts=physical.footContactSnapshot();
   const a=physical.uniformAutonomousActionSnapshot();
   const audit=physical.physicalRejectionAuditSnapshot();
   assert.deepEqual(contacts.started,[team+'-10'],
    'the real current Rapier collider, never supplied geometry, must fire START');
   assert.deepEqual(contacts.active,[team+'-10']);
   assert.equal(a?.tick,1);
   assert.equal(a?.playerId,team+'-10');
   assert.equal(a?.action,'pass','existing uniform original policy chose a real pass');
   assert.equal(a?.physicalTrigger,'same-tick-real-rapier-shoe-start');
   assert.equal(a?.actionSource,'internal-uniform-22-player-ai');
   assert.equal(a?.actualPhysicsImpulseApplied,true);
   assert.equal(a?.appliedByRapier,true);
   assert.equal(a?.officialMatchAction,false);
   assert.equal(a?.officialMatchPossession,false);
   assert.equal(a?.officialMatchResult,null);
   assert.equal(a?.passTarget?.physicalPassAttemptOnly,true);
   assert.equal(a?.passTarget?.passCompleted,false);
   assert.equal(a?.physicalPrerequisites?.exclusiveShoeStart,true);
   assert.equal(a?.physicalPrerequisites?.originalPhysicalGuardsPassed,true);
   assert.equal(audit.actionSelected,true);
   assert.equal(audit.passedInputGates,true);
   assert.equal(audit.actorId,team+'-10');
   assert.ok(Object.isFrozen(a)&&Object.isFrozen(audit));
   assert.ok(d3(after.ball.velocity,noImpulse.ball.velocity)>1,
    'a real 2.4 Ns post-collision impulse must change genuine Rapier ball velocity');
   assert.equal(canonicalSnapshot(after),canonicalSnapshot(again));
   assert.deepEqual(a,replay.uniformAutonomousActionSnapshot());
   assert.equal(physicsOnly.uniformAutonomousActionSnapshot,undefined);
   assert.equal(noImpulse.tick,1);
   assert.throws(()=>physical.step({...playerFrame,tick:3}),TypeError);
   assert.equal(physical.snapshot().tick,1,
    'rejected stale frame must not mutate the original real physical state');
   const reset=physical.reset();
   try{
    assert.equal(reset.uniformAutonomousActionSnapshot(),null);
    assert.equal(reset.footContactSnapshot().tick,0);
   }finally{reset.dispose();}
  }finally{
   physical.dispose();physicsOnly.dispose();replay.dispose();
  }
 }
});

test('actions are explicit opt-in, cannot be enabled without genuine shoe source or official result',async()=>{
 const R=await initializeRapier(rapier);
 const s=mirrorScenario('home');
 assert.throws(()=>createEngine(R,s,{
  diagnosticAutonomousFixtureActionEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,s,{
  diagnosticAutonomousCarryEnabled:true,
  diagnosticPlayerFootContactsEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,s,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticAutonomousCarryEnabled:'true'
 }),TypeError);
 const normal=createEngine(R,s);
 try{
  assert.equal(normal.footContactSnapshot,undefined);
  assert.equal(normal.uniformAutonomousActionSnapshot,undefined);
  assert.equal(normal.physicalRejectionAuditSnapshot,undefined);
  assert.equal(normal.step().tick,1);
 }finally{normal.dispose();}
});

test('ME-01-QA U-01F1: explicit fundamental masks never grant an action or mutate capabilities',()=>{
 const cases=[
  [{id:'pass-pair'},['pass','reception']],
  [{id:'cross-pair'},['cross','reception']],
  [{id:'shot-solo'},['shot']],
  [{id:'carry-solo'},['carry']],
  [{id:'dribble-1v1'},['carry']],
  [{id:'dribble-1v1',directedDribble:true},['carry','tackle','interception','clearance','standing-tackle','sliding-tackle','shoulder-challenge']],
  [{id:'pass-pair',interceptionStart:true},['pass','interception','carry','reception']],
  [{id:'defender-1v1',blockStart:true},['shot','save','block']],
  [{id:'keeper-1v1',keeperSingleShot:true},['carry','shot','save']],
  [{id:'full-field-native',collective:true},NATIVE_FUNDAMENTALS],
  [{id:'dribble-1v1',collective:true},NATIVE_FUNDAMENTALS],
  [{id:'header-pair',collective:true},['cross','header','header-shot','header-pass','header-clearance']],
  [{id:'chest-control',collective:true},['cross','aerial-control']],
  [{id:'aerial-foot-control',collective:true},['aerial-control']],
  [{id:'aerial-duel',collective:true},['header','header-shot','header-pass','header-clearance']],
  [{id:'volley-solo',collective:true},['cross','volley']],
  ...['lofted-pass','lofted-short','lofted-switch'].map(id=>[{id,collective:true},['pass','reception','aerial-control']]),
  ...['keeper-high-cross','keeper-high-intercept'].map(id=>[{id,collective:true},['cross','save','pass','clearance']]),
  [{},NATIVE_FUNDAMENTALS]
 ];
 for(const [config,expected] of cases){
  const mask=nativeLabFundamentalMask(config);
  assert.ok(Object.isFrozen(mask));
  assert.deepEqual(mask,NATIVE_FUNDAMENTALS.filter(a=>expected.includes(a)));
  for(const kind of NATIVE_FUNDAMENTALS)assert.equal(nativeFundamentalAllowed(mask,kind),expected.includes(kind));
  assert.equal(nativeFundamentalAllowed(mask,'invented-contact'),false);
  assert.equal(nativeFundamentalAllowed(mask,null),false);
 }
 const empty=createNativeFundamentalMask([]);
 for(const kind of NATIVE_FUNDAMENTALS)assert.equal(nativeFundamentalAllowed(empty,kind),false);
 const input=['pass'];const mask=createNativeFundamentalMask(input);input.push('shot');
 assert.deepEqual(mask,['pass']);
 assert.throws(()=>createNativeFundamentalMask(['pass','pass']),/Unique/);
 assert.throws(()=>createNativeFundamentalMask(['unknown']),/Unique/);
 assert.throws(()=>createNativeFundamentalMask('pass'),/Unique/);
});

test('ME-01-QA U-01F3a: aerial surface capabilities are independent from ground shot',()=>{
 for(let bits=0;bits<16;bits++){
  const kinds=['header','volley','shot','aerial-control'];
  const mask=createNativeFundamentalMask(kinds.filter((_,i)=>bits&(1<<i)));
  assert.equal(nativeAerialSurfaceAllowed(mask,'head'),!!(bits&1));
  assert.equal(nativeAerialSurfaceAllowed(mask,'chest'),!!(bits&8));
  assert.equal(nativeAerialSurfaceAllowed(mask,'foot'),!!(bits&8)||!!(bits&2));
  assert.equal(nativeAerialSurfaceAllowed(mask,'unknown'),false);
 }
});

test('ME-01-QA U-01F3b: defense permissions precede selection, never grant evidence',()=>{
 const kinds=['standing-tackle','sliding-tackle','shoulder-challenge','interception','block'];
 for(const [profile,allowed] of [['standing',['standing-tackle']],['sliding',['sliding-tackle']],['shoulder',['shoulder-challenge']],['interception',['interception']],['mixed',kinds.slice(0,4)]]){
  const mask=createNativeDuelFundamentalMask(profile);
  for(const kind of kinds)assert.equal(nativeDefensiveInterventionAllowed(mask,kind),allowed.includes(kind));
  for(const kind of kinds.slice(0,2))assert.equal(nativePhysicalActionAllowed(mask,{action:'tackle',defensiveTarget:{intervention:kind}}),allowed.includes(kind));
  const input={actorId:'home-2',shoulder:{sideOn:true,parallel:true},standing:{kind:'tackle'},sliding:{},interception:{reachable:true},ballGapM:.5,allowedFundamentals:mask};
  const picked=selectDefensiveIntervention(input);
  assert.ok(allowed.includes(picked.kind));assert.equal(picked.physicalContactProven,false);
  assert.equal(selectDefensiveIntervention({...input,unavailable:true}).kind,'none');
  assert.equal(selectDefensiveIntervention({...input,activeSlide:true}).kind,allowed.includes('sliding-tackle')?'sliding-tackle':'none');
  assert.equal(selectDefensiveIntervention({...input,context:'pass'}).kind,allowed.includes('interception')?'interception':'none');
  assert.equal(selectDefensiveIntervention({...input,context:'shot',block:{}}).kind,'none');
 }
 const blockMask=nativeLabFundamentalMask({id:'defender-1v1',blockStart:true});
 assert.equal(selectDefensiveIntervention({actorId:'away-2',context:'shot',block:{},allowedFundamentals:blockMask}).kind,'block');
 assert.equal(selectDefensiveIntervention({actorId:'away-2',context:'shot',allowedFundamentals:blockMask}).kind,'none');
 assert.equal(nativePhysicalActionAllowed(createNativeFundamentalMask(['tackle']),{action:'tackle'}),false);
 assert.throws(()=>createNativeDuelFundamentalMask('invalid'),/Known/);
});

test('ME-01-QA U-01F4: aerial sequence permissions require real delivery provenance',()=>{
 for(const side of ['home','away'])for(const id of ['header-pair','chest-control','volley-solo','lofted-pass','lofted-short','lofted-switch']){
  const seq=nativeLabAerialSequence({id,side}),mask=nativeLabFundamentalMask({id,collective:true});
  const choice={playerId:seq.actorId,team:side,action:seq.kind,[seq.kind==='pass'?'passTarget':'crossTarget']:{recipientId:seq.recipientId,deliveryProfile:'lofted',loftedProfile:seq.profile}};
  const delivery={kind:seq.kind,actorId:seq.actorId,recipientId:seq.recipientId,team:side,profile:seq.profile,tick:3,airborne:true,actualPhysicsImpulseApplied:true};
  const contact={actorId:seq.recipientId,team:side,surface:seq.surface,contactStarted:true,actualNativeSolverContact:true,sameOriginalRapierWorld:true,incomingVelocity:{z:-1}};
  assert.equal(nativeSequenceDeliveryAllowed(seq,choice),true);
  assert.equal(nativeSequenceDeliveryAllowed(seq,{...choice,playerId:seq.recipientId}),false);
  assert.equal(nativeSequenceAerialAllowed(seq,delivery,contact,12),true);
  for(const patch of [{actualPhysicsImpulseApplied:false},{airborne:false},{actorId:seq.recipientId},{recipientId:seq.actorId},{tick:12},{tick:-200}])
   assert.equal(nativeSequenceAerialAllowed(seq,{...delivery,...patch},contact,12),false);
  for(const patch of [{actorId:seq.actorId},{contactStarted:false},{actualNativeSolverContact:false},{sameOriginalRapierWorld:false},{surface:'other'},{incomingVelocity:{z:1}}])
   assert.equal(nativeSequenceAerialAllowed(seq,delivery,{...contact,...patch},12),false);
  assert.equal(nativeSequenceAerialAllowed(seq,null,contact,12),false);
  assert.deepEqual(nativeSequenceGroundMask(mask,seq,seq.actorId,false),[seq.kind]);
  assert.deepEqual(nativeSequenceGroundMask(mask,seq,seq.recipientId,false),[]);
  assert.deepEqual(nativeSequenceGroundMask(mask,seq,seq.actorId,true),[]);
  if(seq.profile)assert.equal(nativeSequenceDeliveryAllowed(seq,{...choice,passTarget:{...choice.passTarget,loftedProfile:'wrong'}}),false);
  assert.equal(nativeFundamentalAllowed(mask,'shot'),false);
 }
 assert.equal(nativeLabAerialSequence({id:'aerial-duel'}),null);
 assert.equal(nativeSequenceAerialAllowed(null,null,null,0),true);
});

test('ME-01-QA U-01F4b: high hand sequence requires the authorized actual cross',()=>{
 for(const side of ['home','away'])for(const id of ['keeper-high-cross','keeper-high-intercept']){
  const seq=nativeLabAerialSequence({id,side}),mask=nativeLabFundamentalMask({id,collective:true});
  const cross={tick:3,action:'cross',team:side,playerId:seq.actorId,crossTarget:{recipientId:seq.recipientId},appliedByRapier:true,actualPhysicsImpulseApplied:true};
  const delivery={tick:3,airborne:true};
  assert.equal(seq.keeperId,(side==='home'?'away':'home')+'-1');
  assert.deepEqual(nativeSequenceGroundMask(mask,seq,seq.actorId,false),['cross']);
  assert.deepEqual(nativeSequenceGroundMask(mask,seq,seq.recipientId,false),[]);
  assert.deepEqual(nativeSequenceGroundMask(mask,seq,seq.actorId,true),[]);
  assert.equal(nativeKeeperSequenceDeliveryAllowed(seq,cross,4),true);
  for(const patch of [{tick:2},{playerId:seq.recipientId},{team:'other'},{actualPhysicsImpulseApplied:false},{appliedByRapier:false},{crossTarget:{recipientId:seq.actorId}}])
   assert.equal(nativeKeeperSequenceDeliveryAllowed(seq,{...cross,...patch},4),false);
  assert.equal(nativeKeeperSequenceClaimAllowed(seq,seq.keeperId,delivery,5),true);
  assert.equal(nativeKeeperSequenceClaimAllowed(seq,seq.actorId,delivery,5),false);
  assert.equal(nativeKeeperSequenceClaimAllowed(seq,seq.keeperId,{...delivery,airborne:false},5),false);
  assert.equal(nativeKeeperSequenceClaimAllowed(seq,seq.keeperId,null,5),false);
  assert.equal(nativeKeeperSequenceClaimAllowed(seq,seq.keeperId,delivery,3),false);
  assert.equal(nativeKeeperSequenceClaimAllowed(seq,seq.keeperId,delivery,184),false);
  assert.equal(nativeKeeperSequenceClaimAllowed(seq,seq.keeperId,delivery,5,{conflict:true}),false);
  assert.equal(nativeKeeperSequenceInterrupted(seq,[],[seq.actorId],[]),false);
  assert.equal(nativeKeeperSequenceInterrupted(seq,[seq.actorId],[seq.actorId],[]),true);
  assert.equal(nativeKeeperSequenceInterrupted(seq,[],[seq.recipientId],[]),true);
  assert.equal(nativeKeeperSequenceInterrupted(seq,[],[],[seq.recipientId]),true);
 }
 assert.equal(nativeKeeperSequenceClaimAllowed(null,'home-1',null,0),true);
 assert.equal(nativeKeeperSequenceInterrupted(null,['home-2'],['home-2'],['home-2']),false);
});
