// ME-PB-22 — first REAL experimental autonomous shoe-contact-triggered kick.
// Not a game pass, shot, possession, owner or remotely authorized command.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RAPIER_MODULE from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT,BALL_MASS_KG}
 from '../src/core.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';
import {decideFirstLocalAiKick,FIRST_LOCAL_KICK_IMPULSE_NS,
 FIRST_LOCAL_KICK_PLAYER_ID,FIRST_LOCAL_KICK_VERSION}
 from '../src/player-ball-first-local-kick.mjs';
import {readFileSync} from 'node:fs';
const RAPIER=await initializeRapier(RAPIER_MODULE);
const demo=Object.freeze({
 preset:'roll',seed:'pb22-real-shoe-first-kick',
 x:-4.35,y:0,z:0,vx:0,vy:0,vz:0
});
const trialOptions={diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiKickEnabled:true};
const plainOptions={diagnosticPlayerFootContactsEnabled:true};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function replay(limit=330){
 const e=createEngine(RAPIER,demo,trialOptions);
 const control=createEngine(RAPIER,demo,plainOptions);
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 const records=[];let first=null;
 try{
  assert.equal(e.localAiKickSnapshot(),null);
  assert.equal(control.localAiKickSnapshot,undefined);
  for(let i=1;i<=limit;i++){
   const frame=mover.step(e.snapshot().ball.position);
   const controlBefore=control.snapshot();
   const mainBefore=e.snapshot();
   if(!first)assert.equal(canonicalSnapshot(controlBefore),
     canonicalSnapshot(mainBefore));
   const actual=e.step(frame),reference=control.step(frame);
   const start=e.footContactSnapshot().started;
   const kick=e.localAiKickSnapshot();
   if(kick&&!first){
    first=kick;
    assert.equal(kick.tick,i);
    assert.equal(kick.playerId,FIRST_LOCAL_KICK_PLAYER_ID);
    assert.equal(kick.version,FIRST_LOCAL_KICK_VERSION);
    assert.equal(kick.physicalTrigger,'real-rapier-foot-contact-start');
    assert.ok(start.includes(kick.playerId),
     'the AI MUST wait for the physical Rapier shoe collision START');
    assert.equal(kick.actionSource,'built-in-deterministic-local-ai');
    assert.equal(kick.appliedByRealRapier,true);
    assert.equal(kick.officialMatchAction,false);
    assert.equal(kick.inferredPossession,false);
    assert.ok(Object.isFrozen(kick)&&Object.isFrozen(kick.impulseNs));
    assert.ok(Math.abs(Math.hypot(kick.impulseNs.x,
      kick.impulseNs.y)-FIRST_LOCAL_KICK_IMPULSE_NS)<1e-10);
    assert.equal(actual.tick,reference.tick);
    assert.ok(distance(actual.ball.velocity,reference.ball.velocity)>
      FIRST_LOCAL_KICK_IMPULSE_NS/BALL_MASS_KG*0.95,
      'Rapier must really apply the AI impulse to the measured 430g ball');
    assert.equal(distance(actual.ball.position,reference.ball.position),0,
      'impulse is applied after the contact solver, without teleporting');
   }
   if(!first){
    assert.equal(canonicalSnapshot(actual),canonicalSnapshot(reference));
   }
   if(first)assert.strictEqual(e.localAiKickSnapshot(),first,
     'only one physical kick may be applied in this disposable world');
   records.push(Object.freeze({
    tick:i,ball:canonicalSnapshot(actual),
    contactStarted:Object.freeze([...start]),
    actionTick:kick?.tick??null,
    referenceBall:canonicalSnapshot(reference)
   }));
  }
  return Object.freeze({
    firstKick:first,observations:Object.freeze(records),
    totalLocalActions:first?1:0
  });
 }finally{e.dispose();control.dispose();}
}
test('ME-PB-22 strict isolation: never kick in normal physics or no-foot LAB',()=>{
 const e=createEngine(RAPIER,demo);
 const withFeet=createEngine(RAPIER,demo,plainOptions);
 const frames=createPlayerMovement();
 try{
  assert.equal(e.localAiKickSnapshot,undefined);
  assert.equal(withFeet.localAiKickSnapshot,undefined);
  for(let i=0;i<45;i++)e.step();
  for(let i=0;i<45;i++)
    withFeet.step(frames.step(withFeet.snapshot().ball.position));
 }finally{e.dispose();withFeet.dispose();}
 for(const options of [
  {diagnosticLocalAiKickEnabled:true},
  {diagnosticLocalAiKickEnabled:'true',
   diagnosticPlayerFootContactsEnabled:true},
  {diagnosticLocalAiKickEnabled:true,diagnosticPlayerFootContactsEnabled:true,
   diagnosticOmittedFootId:'home-10'}
 ]){
  assert.throws(()=>createEngine(RAPIER,demo,options),/AI kick|boolean/);
 }
 for(const scenario of [{preset:'drop'},{preset:'bounce'},
  {preset:'launch'},{...demo,z:0.4},{...demo,vz:1}]){
  assert.throws(()=>createEngine(RAPIER,scenario,trialOptions),
   /Local AI kick requires/);
 }
});
test('ME-PB-22 pure local AI decision requires real START, ground and direction',()=>{
 const actor={id:'home-10',team:'home',role:'forward',
  x:-4.7,y:0,facingRad:0};
 const ball={x:-4.35,y:0,z:0.11};
 const data={tick:12,contactStarted:['home-10'],player:actor,
  ballPosition:ball,ballRadiusM:0.11};
 const valid=decideFirstLocalAiKick(data);
 assert.ok(valid);
 assert.equal(valid.impulseNs.x,FIRST_LOCAL_KICK_IMPULSE_NS);
 assert.equal(valid.impulseNs.z,0);
 assert.equal(decideFirstLocalAiKick({...data,alreadyApplied:true}),null);
 assert.equal(decideFirstLocalAiKick({...data,contactStarted:[]}),null);
 assert.equal(decideFirstLocalAiKick({...data,contactStarted:['away-10']}),null);
 assert.equal(decideFirstLocalAiKick({...data,ballPosition:{...ball,z:0.8}}),null);
 assert.equal(decideFirstLocalAiKick({...data,ballPosition:{...ball,x:1}}),null);
 assert.equal(decideFirstLocalAiKick({...data,player:{...actor,facingRad:Math.PI}}),null);
 assert.equal(decideFirstLocalAiKick({...data,player:{...actor,id:'away-10'}}),null);
 assert.throws(()=>decideFirstLocalAiKick({...data,tick:0}),/Canonical/);
 assert.throws(()=>decideFirstLocalAiKick({...data,ballRadiusM:0}),/Canonical/);
});
test('ME-PB-22 real shoe START triggers one true 60Hz Rapier impulse and no teleport',()=>{
 const trial=replay();
 assert.ok(trial.firstKick,
  'the local Home #10 must actually reach the demo ball and kick');
 assert.ok(trial.firstKick.tick>0&&trial.firstKick.tick<=330);
 assert.equal(trial.totalLocalActions,1);
 const kickRow=trial.observations[trial.firstKick.tick-1];
 assert.ok(kickRow.contactStarted.includes('home-10'));
 assert.ok(kickRow.ball!==kickRow.referenceBall);
 assert.ok(trial.observations.every(row=>row.actionTick===null||
    row.actionTick===trial.firstKick.tick));
 process.stdout.write('ME_PB_22_FIRST_REAL_KICK '+JSON.stringify({
  kickTick:trial.firstKick.tick,
  kickTimeSeconds:trial.firstKick.tick*FIXED_DT,
  player:trial.firstKick.playerId,
  impulseNewtonSeconds:FIRST_LOCAL_KICK_IMPULSE_NS,
  realContactStart:true,physicalRapierImpulse:true,
  totalIntentionalDemoActions:1,possessionsInferred:0
 })+'\n');
});
test('ME-PB-22 two fully independent physics+22-player simulations replay identically',()=>{
 assert.deepEqual(replay(),replay());
});
test('ME-PB-22 reset clears kick and reproduces same one-shot 60Hz physics',()=>{
 const e=createEngine(RAPIER,demo,trialOptions);
 let fresh;
 try{
  const movement=createPlayerMovement({experimentalAiKickApproach:true});
  for(let i=0;i<350;i++){
   const f=movement.step(e.snapshot().ball.position);
   e.step(f);
  }
  assert.ok(e.localAiKickSnapshot());
  fresh=e.reset();
  assert.equal(fresh.localAiKickSnapshot(),null);
  const target=replay(120);
  const m=createPlayerMovement({experimentalAiKickApproach:true});
  const ref=createEngine(RAPIER,demo,trialOptions);
  try{
   for(let i=0;i<120;i++){
    const frame=m.step(fresh.snapshot().ball.position);
    assert.equal(canonicalSnapshot(fresh.step(frame)),
     canonicalSnapshot(ref.step(frame)));
   }
   assert.equal(fresh.localAiKickSnapshot()?.tick,target.firstKick?.tick);
  }finally{ref.dispose();}
 }finally{e.dispose();fresh?.dispose();}
});
test('ME-PB-22 demo is an opt-in LAB scenario selected from the dropdown',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-kick" data-value="ai-kick"/);
 assert.doesNotMatch(html,/id="ai-kick-demo"/);
 assert.match(html,/id="ai-kick-outcome"/);
 assert.match(lab,/diagnosticLocalAiKickEnabled:kickDemoActive/);
 assert.match(lab,/experimentalAiKickApproach:kickDemoActive/);
 assert.ok(lab.includes("byId('preset').addEventListener('change'"));
 assert.match(lab,/kickDemoActive=choice==='ai-kick'/);
});
