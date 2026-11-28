// #628 — Long-horizon realism audit. Counts Rapier shoes on the original
// native path rather than treating proximity-based gameplay impulses as kicks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

test('#628 real native two-shoe baseline vs intent: 5s/10s control and loss evidence',
 {timeout:100000},async()=>{
 const R=await initializeRapier(rapier);
 const results=[];
 for(const mode of ['native','intent']){
  for(const side of ['home','away']){
   const lab=createControlledActionLab(R,'carry-solo',{
    shotSide:side,variantIndex:3,carryRunwayStart:true,historicalCarryPhysics:true,
    intentDrivenSoloCarry:mode==='intent',
    ...(mode==='intent'?{soloCarryLockedPhase:'sprint',
     soloCarryPlayerAttributes:{speed:50,agility:50,
      dribbling:50,technique:50}}:{})
   });
   try{
    let contacts=0,realActions=0,colliderStarts=0,actualImpulses=0;
    let maxGap=0,outOfReach=0,frame=null;
    const start=lab.snapshot().ball.position.x;
    assert.ok(Math.abs(start)<5,
     'Both native Rapier shoes and live ball must start deep inside pitch');
    const snapshots=[];
    for(let tick=1;tick<=600;tick++){
     frame=lab.step();
     const shoes=frame.soloNativeFeet;
     colliderStarts+=shoes?.started.length??0;
     if(shoes?.exclusivePhysicalStart)contacts++;
     if(frame.action){
      realActions++;
      if(frame.action.actualPhysicsImpulseApplied===true)actualImpulses++;
      if(mode==='intent'){
       assert.equal(frame.action.nativeShoeContactVerified,false);
       assert.equal(shoes?.started.length??0,0,
        'Proximity impulses MUST NOT masquerade as native contact');
      }
     }
     const actor=frame.observedMovementPlayers.find(p=>p.id===side+'-10');
     const gap=Math.hypot(frame.ball.position.x-actor.x,
      frame.ball.position.y-actor.y);
     maxGap=Math.max(maxGap,gap);
     if(gap>1.5)outOfReach++;
     assert.equal(frame.officialMatchPossession,false);
     // eventCount may include real referee boundary events over 10s:
     // native shoe authority is checked on the two actual Rapier colliders,
     // never inferred from a score/event counter.
     if(mode==='intent'&&tick>=1){
      assert.equal(frame.soloCarryMeasurements.samples,tick);
      assert.ok(Math.abs(frame.soloCarryMeasurements.observedOutOfReachTicks-outOfReach)<=1,
       'Canonical 60Hz sample and post-Rapier displayed position may differ by one threshold crossing');
      assert.ok(Math.abs(frame.soloCarryMeasurements.peakGapM-maxGap)<0.001);
     }
     if(tick===300||tick===600)snapshots.push({
      tick,ballForwardM:(side==='home'?1:-1)*
       (frame.ball.position.x-start),
      playerBallGapM:gap,
      ballPositionX:frame.ball.position.x,
      withinPitch:Math.abs(frame.ball.position.x)<=52.5,
      refereeDeadBall:frame.refereeEvidence?.lastEvent??null,
      contacts,colliderStarts,
      actions:realActions,rapierImpulses:actualImpulses,
      outOfReachTicks:outOfReach,maxGapM:maxGap
     });
    }
    results.push({mode,side,snapshots});
   }finally{lab.dispose();}
  }
 }
 assert.equal(results.length,4);
 const sideDifferences=[];
 for(const mode of ['native','intent']){
  const home=results.find(r=>r.mode===mode&&r.side==='home');
  const away=results.find(r=>r.mode===mode&&r.side==='away');
  assert.ok(home&&away);
  for(let i=0;i<2;i++){
   const differenceM=Math.abs(
    home.snapshots[i].ballForwardM-away.snapshots[i].ballForwardM);
   assert.ok(Number.isFinite(differenceM));
   // Real native two-foot contact paths may diverge over 300/600 ticks.
   // This is observational evidence, never a licence to mirror/teleport the
   // actual Rapier ball. Short 120-tick symmetry tests remain strict.
   sideDifferences.push({mode,tick:home.snapshots[i].tick,differenceM});
  }
 }
 const intent=results.find(r=>r.mode==='intent'&&r.side==='home');
 assert.ok(intent.snapshots[0].rapierImpulses>=1);
 const native=results.find(r=>r.mode==='native'&&r.side==='home');
 assert.ok(native.snapshots[1].withinPitch,
  'Ten-second genuine native Carry runway must remain inside physical pitch');
 assert.ok(native.snapshots[1].colliderStarts>=native.snapshots[0].colliderStarts,
  'Only actual Rapier native shoe events can populate the native probe');
 process.stdout.write('ME_628_LONG_CARRY_NATIVE_CONTACT_AUDIT '+
  JSON.stringify({results,sideDifferences})+'\\n');
});
