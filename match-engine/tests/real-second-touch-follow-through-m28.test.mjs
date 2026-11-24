// #628 M28 native follow-through cannot grant automatic possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {createRealSecondTouchFollowThrough,M28_FOLLOW_THROUGH_TICKS}
 from '../src/real-second-touch-follow-through-m28.mjs';
test('M28 refuses missing, duplicate and fabricated shoe-source ticks',()=>{
 const o=createRealSecondTouchFollowThrough();
 assert.throws(()=>o.snapshot(),TypeError);
 assert.throws(()=>o.observe({}),TypeError);
 const physics={tick:0,ball:{position:{x:0,y:0,z:0.12},
  velocity:{x:0,y:0,z:0}}};
 const playerFrame={tick:0,players:INITIAL_PLAYERS.map(p=>({...p,vx:0,vy:0}))};
 const foot={tick:0,started:[],active:[],ended:[]};
 assert.equal(o.observe({physics,playerFrame,foot}).active,null);
 assert.throws(()=>o.observe({physics,playerFrame,foot}),TypeError);
 const choice={tick:1,actorId:'home-9',team:'home',
  decision:'defer-clearance-to-keep-ball-near',physicalImpulseAllowed:false,
  officialPossession:false,matchAuthority:false,
  genuineNativeSecondShoeStart:true,previousRealCushionTick:0};
 const first={tick:0,actorId:'home-9',nativeExclusiveShoeStart:true,
  actualPhysicsImpulseApplied:true,originalRapierBallBody:true};
 assert.throws(()=>o.observe({physics:{...physics,tick:1},
  playerFrame:{...playerFrame,tick:1},foot:{...foot,tick:1},
  physicalReceiverChoice:choice,physicalFirstTouch:first
 }),TypeError);
 assert.equal(o.snapshot().tick,0);
});
test('M28 real HOME/AWAY follow-through after M27 hold: deterministic and read-only',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const adapted=createControlledActionLab(R,'control',{controlSide:side,controlScene:'receive-decide'});
  const replay=createControlledActionLab(R,'control',{controlSide:side,controlScene:'receive-decide'});
  const baseline=createControlledActionLab(R,'control',{controlSide:side,
   controlScene:'receive-decide',controlDecisionEnabled:false});
  try{
   assert.equal(adapted.snapshot().postDeferContinuity.active,null);
   assert.equal(baseline.snapshot().postDeferContinuity,undefined);
   let end=null,started=false;
   for(let t=1;t<=63+M28_FOLLOW_THROUGH_TICKS;t++){
    const a=adapted.step(),b=baseline.step(),c=replay.step();
    assert.deepEqual(a,c,'M28 must not alter original Rapier world');
    assert.equal(a.postDeferContinuity.tick,t);
    assert.equal(a.postDeferContinuity.verifiedPossession,false);
    assert.equal(a.postDeferContinuity.verifiedControl,false);
    assert.equal(a.officialMatchPossession,false);
    assert.equal(b.postDeferContinuity,undefined);
    if(t<63)assert.equal(a.postDeferContinuity.active,null);
    if(t===63){
     assert.equal(a.physicalReceiverChoice.decision,'defer-clearance-to-keep-ball-near');
     assert.equal(a.action,null);assert.ok(a.starts.includes(side+'-9'));
     assert.equal(a.postDeferContinuity.active.sourceDecisionTick,63);
     assert.equal(a.postDeferContinuity.active.observedTicks,1);
     assert.notDeepEqual(a.ball,b.ball);
     started=true;
    }
    end=a.postDeferContinuity.latestCompleted??end;
   }
   assert.ok(started&&end,'physical follow-through must reach real termination');
   assert.equal(end.actorId,side+'-9');
   assert.ok(end.observedTicks>=1&&end.observedTicks<=120);
   assert.ok(end.minimumActualBallGapM>=0);
   assert.ok(end.maximumActualBallGapM>=end.minimumActualBallGapM);
   assert.ok(end.actualBallTravelXYM>=0);
   assert.ok(end.longestContinuousReceiverBallWithin1MTicks<=end.observedTicks);
   assert.equal(end.verifiedControl,false);assert.equal(end.verifiedPossession,false);
   process.stdout.write('ME_628_M28_NATIVE_'+side.toUpperCase()+' '+JSON.stringify(end)+'\\n');
  }finally{adapted.dispose();baseline.dispose();replay.dispose();}
 }
});
test('M28 true close-pressure clearance opens no fictitious follow-through',
 {timeout:90000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const s=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-pressure-decide'
  });
  try{
   for(let t=1;t<=85;t++){
    const a=s.step();
    assert.equal(a.postDeferContinuity.active,null);
    assert.equal(a.postDeferContinuity.latestCompleted,null);
    assert.equal(a.postDeferContinuity.verifiedPossession,false);
   }
   assert.equal(s.snapshot().physicalReceiverChoice.decision,'release-original-clearance');
  }finally{s.dispose();}
 }
});
