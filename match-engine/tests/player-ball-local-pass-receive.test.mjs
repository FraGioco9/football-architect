// ME-PB-23 — two local players, genuine 60Hz Rapier pass and reception.
// No claim of official possession, calibrated technique or successful match play.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RAPIER_MODULE from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT,BALL_MASS_KG}
 from '../src/core.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';
import {decideLocalAiPass,decideLocalAiReception,LOCAL_PASS_SENDER_ID,
 LOCAL_PASS_RECEIVER_ID,LOCAL_PASS_IMPULSE_NS,LOCAL_RECEIVE_TARGET_SPEED_MPS,
 LOCAL_PASS_RECEIVE_VERSION} from '../src/player-ball-local-pass-receive.mjs';
import {readFileSync} from 'node:fs';
const RAPIER=await initializeRapier(RAPIER_MODULE);
const demo=Object.freeze({preset:'roll',seed:'pb23-real-ai-pass-receive',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0});
const opts=Object.freeze({diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiPassReceiveEnabled:true});
const plain=Object.freeze({diagnosticPlayerFootContactsEnabled:true});
function run(limit=420,{requireFull=true}={}){
 const engine=createEngine(RAPIER,demo,opts);
 const control=createEngine(RAPIER,demo,plain);
 const movement=createPlayerMovement({experimentalAiPassReceiveApproach:true});
 const records=[];let pass=null,receive=null,maxX=-Infinity,minReceiverGap=Infinity;
 try{
  assert.equal(engine.localAiKickSnapshot,undefined);
  assert.equal(engine.localAiPassReceiveSnapshot().events.length,0);
  for(let tick=1;tick<=limit;tick++){
   const before=engine.snapshot();
   const frame=movement.step(before.ball.position);
   const plainBefore=control.snapshot();
   if(!pass)assert.equal(canonicalSnapshot(before),canonicalSnapshot(plainBefore));
   const actual=engine.step(frame),reference=control.step(frame);
   const state=engine.localAiPassReceiveSnapshot();
   const starts=engine.footContactSnapshot().started;
   const receiver=frame.players.find(p=>p.id===LOCAL_PASS_RECEIVER_ID);
   const gap=Math.hypot(receiver.x-actual.ball.position.x,
      receiver.y-actual.ball.position.y);
   if(state.pass)minReceiverGap=Math.min(minReceiverGap,gap);
   maxX=Math.max(maxX,actual.ball.position.x);
   if(state.pass&&!pass){
    pass=state.pass;
    assert.equal(pass.tick,tick);
    assert.equal(pass.playerId,LOCAL_PASS_SENDER_ID);
    assert.equal(pass.stage,'pass');
    assert.equal(pass.targetPlayerId,LOCAL_PASS_RECEIVER_ID);
    assert.ok(starts.includes(LOCAL_PASS_SENDER_ID),'true sender START required');
    assert.equal(pass.appliedByRealRapier,true);
    assert.equal(pass.physicalTrigger,'real-rapier-foot-contact-start');
    assert.equal(pass.officialMatchAction,false);
    assert.equal(pass.inferredPossession,false);
    assert.equal(pass.passCompletionInferred,false);
    assert.ok(Math.abs(Math.hypot(pass.impulseNs.x,
       pass.impulseNs.y)-LOCAL_PASS_IMPULSE_NS)<1e-10);
    const dv=Math.hypot(actual.ball.velocity.x-reference.ball.velocity.x,
      actual.ball.velocity.y-reference.ball.velocity.y);
    assert.ok(dv>LOCAL_PASS_IMPULSE_NS/BALL_MASS_KG*0.98,
     'Rapier must apply an actual ground-pass impulse');
    assert.deepEqual(actual.ball.position,reference.ball.position,
     'Rapier impulse does not teleport the ball');
   }
   if(!pass)assert.equal(canonicalSnapshot(actual),canonicalSnapshot(reference));
   if(state.control&&!receive){
    receive=state.control;
    assert.equal(receive.tick,tick);
    assert.equal(receive.playerId,LOCAL_PASS_RECEIVER_ID);
    assert.equal(receive.stage,'control');
    assert.ok(starts.includes(LOCAL_PASS_RECEIVER_ID),
      'separate real receiver shoe-ball START is mandatory');
    assert.ok(receive.tick>pass.tick+2);
    assert.equal(receive.passTick,pass.tick);
    assert.equal(receive.fromPlayerId,LOCAL_PASS_SENDER_ID);
    assert.equal(receive.appliedByRealRapier,true);
    assert.equal(receive.officialMatchAction,false);
    assert.equal(receive.inferredPossession,false);
    assert.ok(Math.abs(Math.hypot(actual.ball.velocity.x,
       actual.ball.velocity.y)-LOCAL_RECEIVE_TARGET_SPEED_MPS)<0.005,
       'real Rapier control impulse should slow physical ball to target speed');
   }
   assert.equal(state.events.length,(pass?1:0)+(receive?1:0));
   assert.ok(Object.isFrozen(state.events));
   records.push(Object.freeze({
    tick,ball:canonicalSnapshot(actual),starts:Object.freeze([...starts]),
    events:Object.freeze(state.events.map(e=>e.stage)),
    receiverGap:Math.round(gap*1000)/1000
   }));
  }
  const result={pass,control:receive,records,maxX,minReceiverGap};
  if(requireFull){
   if(!pass||!receive){
     process.stdout.write('ME_PB_23_INCOMPLETE '+JSON.stringify({
       passTick:pass?.tick??null,controlTick:receive?.tick??null,
       maxBallX:maxX,minReceiverGap,
       lastBall:records.at(-1)?.ball,
       recipientStarts:records.filter(x=>x.starts.includes(LOCAL_PASS_RECEIVER_ID))
         .slice(0,10)
     })+'\n');
   }
   assert.ok(pass,'first player must kick the real Rapier ball');
   assert.ok(receive,'second player must physically receive on a distinct real shoe START');
   assert.ok(receive.tick>pass.tick+2);
  }
  return result;
 }finally{engine.dispose();control.dispose();}
}
test('ME-PB-23 flag is local-only, strict and mutually exclusive with first kick',()=>{
 const baseline=createEngine(RAPIER,demo);
 const optFeet=createEngine(RAPIER,demo,plain);
 try{
  assert.equal(baseline.localAiPassReceiveSnapshot,undefined);
  assert.equal(optFeet.localAiPassReceiveSnapshot,undefined);
 }finally{baseline.dispose();optFeet.dispose();}
 for(const option of [
  {diagnosticLocalAiPassReceiveEnabled:true},
  {diagnosticLocalAiPassReceiveEnabled:'true',diagnosticPlayerFootContactsEnabled:true},
  {...opts,diagnosticLocalAiKickEnabled:true},
  {...opts,diagnosticOmittedFootId:'home-7'}
 ]){
  assert.throws(()=>createEngine(RAPIER,demo,option),/pass\/receive|boolean/);
 }
 for(const scenario of [{preset:'drop'},{preset:'launch'},
  {...demo,z:0.5},{...demo,vz:2}]){
  assert.throws(()=>createEngine(RAPIER,scenario,opts),/pass\/receive/);
 }
 assert.throws(()=>createPlayerMovement({
  experimentalAiPassReceiveApproach:true,experimentalAiKickApproach:true
 }),/Exclusive boolean/);
});
test('ME-PB-23 decisions require genuine separate two-player shoe START events',()=>{
 const sender={id:LOCAL_PASS_SENDER_ID,team:'home',role:'midfielder',
   x:-20,y:0,facingRad:0};
 const receiver={id:LOCAL_PASS_RECEIVER_ID,team:'home',role:'forward',
   x:-5,y:0,facingRad:0};
 const ball={x:-19.35,y:0,z:0.11};
 const passInput={tick:12,contactStarted:['home-7'],passer:sender,
   receiver,ballPosition:ball,ballRadiusM:0.11};
 const pass=decideLocalAiPass(passInput);
 assert.ok(pass&&pass.stage==='pass');
 assert.equal(pass.targetPlayerId,'home-10');
 assert.equal(pass.version,LOCAL_PASS_RECEIVE_VERSION);
 assert.equal(decideLocalAiPass({...passInput,contactStarted:[]}),null);
 assert.equal(decideLocalAiPass({...passInput,ballPosition:{...ball,z:1}}),null);
 assert.equal(decideLocalAiPass({...passInput,passer:{...sender,facingRad:Math.PI}}),null);
 const controlInput={tick:100,contactStarted:['home-10'],passEvent:pass,
   receiver,ballPosition:{x:-5.25,y:0,z:0.11},
   ballVelocity:{x:3,y:0,z:0},ballRadiusM:0.11,ballMassKg:BALL_MASS_KG};
 const controlled=decideLocalAiReception(controlInput);
 assert.ok(controlled&&controlled.stage==='control');
 assert.equal(controlled.passTick,pass.tick);
 assert.equal(controlled.inferredPossession,false);
 assert.equal(decideLocalAiReception({...controlInput,contactStarted:[]}),null);
 assert.equal(decideLocalAiReception({...controlInput,tick:pass.tick+2}),null);
 assert.equal(decideLocalAiReception({...controlInput,passEvent:null}),null);
 assert.equal(decideLocalAiReception({...controlInput,
    ballVelocity:{x:30,y:0,z:0}}),null);
 assert.equal(decideLocalAiReception({...controlInput,
    receiver:{...receiver,id:'away-10'}}),null);
 assert.throws(()=>decideLocalAiPass({...passInput,tick:0}),/Valid 60Hz/);
});
test('ME-PB-23 real sender pass and receiver trap are separate actual Rapier actions',()=>{
 const result=run();
 assert.ok(result.pass.tick<result.control.tick);
 assert.equal(result.pass.playerId,'home-7');
 assert.equal(result.control.playerId,'home-10');
 assert.ok(result.control.observedPreControlGroundSpeedMps>0.2);
 process.stdout.write('ME_PB_23_REAL_PASS_RECEIVE '+JSON.stringify({
  passTick:result.pass.tick,controlTick:result.control.tick,
  durationS:(result.control.tick-result.pass.tick)*FIXED_DT,
  sender:result.pass.playerId,receiver:result.control.playerId,
  impulseNs:LOCAL_PASS_IMPULSE_NS,receivedOnRealContactStart:true,
  controlledBallSpeedMps:LOCAL_RECEIVE_TARGET_SPEED_MPS,
  inferredPossession:false,officialMatchAction:false
 })+'\n');
});
test('ME-PB-23 two independent 22-player worlds replay identical pass and control',()=>{
 assert.deepEqual(run(360),run(360));
});
test('ME-PB-23 reset recreates original scoreless/no-possession local sequence',()=>{
 const engine=createEngine(RAPIER,demo,opts);
 let restored;
 try{
  const movement=createPlayerMovement({experimentalAiPassReceiveApproach:true});
  for(let i=0;i<360;i++)engine.step(movement.step(engine.snapshot().ball.position));
  assert.ok(engine.localAiPassReceiveSnapshot().pass);
  restored=engine.reset();
  assert.equal(restored.localAiPassReceiveSnapshot().events.length,0);
  const frames=createPlayerMovement({experimentalAiPassReceiveApproach:true});
  const check=createEngine(RAPIER,demo,opts);
  try{
    for(let i=0;i<360;i++){
      const f=frames.step(restored.snapshot().ball.position);
      assert.equal(canonicalSnapshot(restored.step(f)),
       canonicalSnapshot(check.step(f)));
    }
    assert.deepEqual(restored.localAiPassReceiveSnapshot(),
      check.localAiPassReceiveSnapshot());
  }finally{check.dispose();}
 }finally{engine.dispose();restored?.dispose();}
});
test('ME-PB-23 real LAB scenario remains opt-in and isolated',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-pass" data-value="ai-pass"/);
 assert.doesNotMatch(html,/id="ai-pass-demo"/);
 assert.match(lab,/diagnosticLocalAiPassReceiveEnabled:passDemoActive/);
 assert.match(lab,/experimentalAiPassReceiveApproach:passDemoActive/);
 assert.match(lab,/passDemoActive=choice==='ai-pass'/);
});
