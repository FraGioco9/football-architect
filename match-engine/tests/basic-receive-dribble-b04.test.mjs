// #628 ACTIONS-B04 — authentic prior PASS → first receiver TRAP
// → second original Rapier shoe ball push → physical release/recontact.
// No automatic reception, dribble success, goal, or possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab as createCurrentActionLab} from '../src/action-labs.mjs';
 // Historical M/B evidence comparator only. Current gameplay uses the default.
 const createControlledActionLab=(R,id,options={})=>createCurrentActionLab(R,id,{
  ...options,historicalEvidenceBaseline:!['pass-pair','cross-pair','carry-solo','dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3'].includes(id)
 });

import {ACTION_LAB_SCENARIOS} from '../src/action-lab-scenarios.mjs';
import {createBasicReceiveDribbleObserverB04,
 B04_BASIC_RECEIVE_DRIBBLE_VERSION}
 from '../src/basic-receive-dribble-b04.mjs';
import {PLAYER_MAX_SPEED_MPS} from '../src/player-movement.mjs';

test('B04 never certifies control, dribble or possession from a synthetic source',()=>{
 assert.deepEqual(ACTION_LAB_SCENARIOS.filter(s=>
  ['trap','dribble'].includes(s.id)).map(s=>s.id),['trap','dribble']);
 for(const f of [
  {side:'none',kind:'trap'},{side:'home',kind:'possession'},
  {side:'home',kind:'dribble-win'}
 ])assert.throws(()=>createBasicReceiveDribbleObserverB04(f),TypeError);
 const audit=createBasicReceiveDribbleObserverB04({
  side:'home',kind:'dribble'
 });
 assert.throws(()=>audit.observe({physics:{tick:1}}),TypeError);
});
test('B04 HOME/AWAY original pass, real TRAP shoe-cushion, subsequent live DRIBBLE push and independent recontact',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const kind of ['trap','dribble'])
  for(const side of ['home','away']){
   const a=createControlledActionLab(R,kind,{shotSide:side});
   const b=createControlledActionLab(R,kind,{shotSide:side});
   try{
    const initial=a.snapshot();
    assert.equal(initial.physicsTick,0);
    assert.equal(initial.players.length,22);
    assert.equal(new Set(initial.players.map(p=>p.id)).size,22);
    assert.equal(initial.controlSide,side);
    assert.equal(initial.baseFootworkAudit.version,
     B04_BASIC_RECEIVE_DRIBBLE_VERSION);
    assert.equal(initial.baseFootworkAudit.trap,null);
    assert.equal(initial.baseFootworkAudit.dribbleAttempt,null);
    assert.equal(initial.baseFootworkAudit.release,null);
    let firstPass=null,trapTick=null,pushTick=null,recontactTick=null;
    const horizon=kind==='trap'?75:160;
    let trueFootStarts=0,totalBallTravel=0,lastBall=null;
    for(let t=1;t<=horizon;t++){
     const x=a.step(),y=b.step();
     assert.deepEqual(x.ball,y.ball);
     assert.deepEqual(x.action,y.action);
     assert.deepEqual(x.starts,y.starts);
     assert.deepEqual(x.baseFootworkAudit,y.baseFootworkAudit);
     assert.equal(x.officialMatchResult,null);
     assert.equal(x.officialMatchPossession,false);
     assert.equal(x.scoreChanged,false);
     assert.equal(x.baseFootworkAudit.officialPossession,false);
     assert.equal(x.baseFootworkAudit.verifiedReception,false);
     assert.equal(x.baseFootworkAudit.verifiedControl,false);
     assert.equal(x.baseFootworkAudit.verifiedDribble,false);
     assert.equal(x.baseFootworkAudit.officialMatchAction,false);
     trueFootStarts+=x.starts.length;
     if(lastBall)totalBallTravel+=Math.hypot(
      x.ball.position.x-lastBall.x,x.ball.position.y-lastBall.y);
     lastBall=x.ball.position;
     for(const player of x.observedMovementPlayers)
      assert.ok(Math.hypot(player.vx,player.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
     if(x.priorRealPass&&!firstPass)
      firstPass=x.priorRealPass.tick;
     const e=x.baseFootworkAudit;
     if(e.trap&&trapTick===null){
      trapTick=e.trap.tick;
      assert.equal(t,trapTick);
      assert.deepEqual(x.starts,[side+'-9']);
      assert.equal(e.trap.passTick,firstPass);
      assert.equal(e.trap.nativeExclusiveStart,true);
      assert.equal(e.trap.originalRapierBallImpulse,true);
      assert.equal(e.trap.trapConfirmed,false);
      assert.ok(Math.hypot(
       e.trap.boundedCushionImpulseNs.x,
       e.trap.boundedCushionImpulseNs.y)>0);
     }
     if(e.dribbleAttempt&&pushTick===null){
      pushTick=e.dribbleAttempt.tick;
      assert.equal(t,pushTick);
      assert.deepEqual(x.starts,[side+'-9']);
      assert.equal(e.dribbleAttempt.firstTrapTick,trapTick);
      assert.equal(e.dribbleAttempt.genuineSecondShoeStart,true);
      assert.equal(e.dribbleAttempt.dribbleConfirmed,false);
      assert.ok(Math.hypot(
       e.dribbleAttempt.physicalTapImpulseNs.x,
       e.dribbleAttempt.physicalTapImpulseNs.y)>0);
     }
     if(e.release&&recontactTick===null){
      recontactTick=e.release.actualShoeRecontactTick;
      assert.equal(t,recontactTick);
      assert.equal(e.release.actualShoeEndTick>pushTick,true);
      assert.equal(e.release.realReleaseAndRecontact,true);
      assert.equal(e.release.dribbleConfirmed,false);
      assert.equal(e.release.officialPossession,false);
      assert.deepEqual(x.starts,[side+'-9']);
     }
    }
    assert.equal(firstPass,1,'only original Rapier #10 pass can seed B04');
    assert.equal(trapTick,30,'native physical first-touch cushion');
    assert.ok(trueFootStarts>=2);
    assert.ok(totalBallTravel>1.5,'original ball must really move');
    assert.ok(a.snapshot().eventCount>=1,
     'one real B04 witness must be visible in LAB events');
    if(kind==='dribble'){
     assert.equal(pushTick,63,'second independent shoe START with Rapier impulse');
     assert.equal(recontactTick,136,'shoe END then physically new START');
     assert.equal(a.snapshot().baseFootworkAudit.release.originalActionAtRecontact.action,
      'clearance','original subsequent action must remain the original policy');
    }else{
     assert.equal(pushTick,null,'TRAP scene must not inject a dribble push');
     assert.equal(recontactTick,null);
    }
    process.stdout.write('ME_628_B04_'+kind.toUpperCase()+'_'+side.toUpperCase()+' '+
     JSON.stringify({originalPassTick:firstPass,firstPhysicalTrapTick:trapTick,
      secondShoePushTick:pushTick,genuineShoeRecontactTick:recontactTick,
      realBallTravelM:Number(totalBallTravel.toFixed(4)),officialPossession:false,
      dribbleConfirmed:false})+'\\n');
   }finally{a.dispose();b.dispose();}
  }
});
test('B04 no alternate or non-research settings can create fake source',async()=>{
 const R=await initializeRapier(rapier);
 for(const kind of ['trap','dribble']){
  for(const bad of [
   {shotSide:'invalid'},
   {controlSide:'away'},
   {controlScene:'receive-release'},
   {controlDecisionEnabled:false}
  ])assert.throws(()=>createControlledActionLab(R,kind,bad),TypeError);
 }
});
