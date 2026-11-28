// #480/#620: closed same-world Rapier source -> physical action impulse.
// Targeted tests are from real 22-actor Rapier shoes, not supplied START arrays.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,BALL_RADIUS,canonicalSnapshot}
 from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement} from '../src/player-movement.mjs';
import {footProxyTransform} from '../src/player-foot-contact.mjs';
import {NATIVE_FUNDAMENTALS,createNativeFundamentalMask,nativeFundamentalAllowed,nativeLabFundamentalMask} from '../src/native-fundamental-mask.mjs';
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
  [{id:'dribble-1v1',directedDribble:true},['carry','tackle','interception','clearance']],
  [{id:'pass-pair',interceptionStart:true},['pass','interception','carry','reception']],
  [{id:'defender-1v1',blockStart:true},['shot','save']],
  [{id:'keeper-1v1',keeperSingleShot:true},['carry','shot','save']],
  [{id:'full-field-native',collective:true},NATIVE_FUNDAMENTALS],
  [{id:'dribble-1v1',collective:true},NATIVE_FUNDAMENTALS],
  [{id:'header-pair',collective:true},NATIVE_FUNDAMENTALS],
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
