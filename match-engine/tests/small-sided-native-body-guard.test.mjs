// #628 LAB-VAR-02B — one-world native body contact vs a real ball.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_VERSION} from '../src/player-movement.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {SMALL_SIDED_LAB_SCENARIOS} from '../src/small-sided-lab-scenarios.mjs';
import {createSmallSidedNativeBodyGuard,SMALL_SIDED_BODY_VERSION,
 D01_TORSO_RADIUS_M}
 from '../src/small-sided-native-body-guard.mjs';

function oneWorldNativeContact(R,gap,{groundD01=false,ballFar=false}={}){
 const world=new R.World({x:0,y:0,z:-9.81});
 world.timestep=1/60;
 const ballBody=world.createRigidBody(R.RigidBodyDesc.dynamic()
  .setTranslation(40.19,ballFar?8:0,0.11).setCcdEnabled(true));
 const ballCollider=world.createCollider(R.ColliderDesc.ball(.11)
  .setDensity(6).setFriction(.4),ballBody);
 const staged=INITIAL_PLAYERS.map(p=>p.id==='home-10'?
  {...p,x:40,y:0}:p.id==='away-2'?
  {...p,x:40+gap,y:0}:p);
 const bridge=createSmallSidedNativeBodyGuard(R,world,ballCollider,
  staged,['home-10','away-2'],
  groundD01?{dribbleGroundBallCentreZ:.11}:{});
 const frame={version:PLAYER_VERSION,tick:1,players:staged.map(p=>({...p,vx:0,vy:0}))};
 try{
  assert.equal(bridge.snapshot().tick,0);
  bridge.prepare(frame,1);
  world.step();
  const evidence=bridge.observe(1);
  return {evidence,ball:{...ballBody.translation()}};
 }finally{bridge.dispose();world.free();}
}
test('#628 D-01 torso diameter respects the hard canonical physical player gap',()=>{
 assert.equal(D01_TORSO_RADIUS_M*2,0.98);
});

test('#628 native lower-leg ball and opponent torso response are genuine Rapier solver manifolds',
 {timeout:30000},async()=>{
 const R=await initializeRapier(rapier);
 const sample=oneWorldNativeContact(R,0.99);
 assert.equal(sample.evidence.version,SMALL_SIDED_BODY_VERSION);
 assert.ok(sample.evidence.lowerLegBallStarts.includes('home-10'));
 assert.ok(sample.evidence.nativeOpposingTorsoPairs.includes('away-2|home-10'));
 assert.equal(sample.evidence.evidenceSource,'native-rapier-solver-manifold');
 assert.equal(sample.evidence.ballProtectionProven,false);
 assert.equal(sample.evidence.successfulPossession,false);
 assert.equal(sample.evidence.officialMatchResult,null);
 assert.ok(sample.ball.x>40.19,'body/ball must permit real solver motion');
 assert.deepEqual(sample,oneWorldNativeContact(R,0.99),
  'identical native physics input must replay exactly');
 assert.deepEqual(oneWorldNativeContact(R,2.2).evidence.nativeOpposingTorsoPairs,[],
  'an absent opponent cannot manufacture a native torso collision');
 const ground=oneWorldNativeContact(R,0.98,{groundD01:true});
 assert.equal(ground.evidence.lowerLegBallStarts.includes('home-10'),true,
  'D-01 real grounded leg-ball contact remains enabled');
 // A real leg-ball solver impulse CAN move the common dynamic body and
 // create a subsequent genuine torso contact; that must not be suppressed.
 // To test only *initial* torso geometry, keep the ball safely out of reach.
 // Rapier's speculative/predictive contacts may legitimately appear
 // BEFORE penetration at 0.99m; do not misclassify an authentic native
 // solver contact as a fake. Exact geometric no-overlap is asserted above.
 const isolated=oneWorldNativeContact(R,1.15,
  {groundD01:true,ballFar:true});
 assert.deepEqual(isolated.evidence.nativeOpposingTorsoPairs,[],
  'a well-separated 1.15m original pair must not collide');
 assert.deepEqual(isolated.evidence.lowerLegBallContacts,[],
  'the remote original ball cannot make a fictitious lower-leg contact');
});
test('#628 body guard remains selected-only, exact-tick and deterministic in all 5 native LAB situations',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const spec of SMALL_SIDED_LAB_SCENARIOS.filter(s=>!['pass-pair','cross-pair'].includes(s.id)))
 for(const side of ['home','away']){
  const baseline=createControlledActionLab(R,spec.id,{shotSide:side});
  try{assert.equal(baseline.snapshot().smallSidedNativeBodyGuard,null);}
  finally{baseline.dispose();}
  const enabledV01=createControlledActionLab(R,spec.id,{
   shotSide:side,variantIndex:0,bodyGuardEnabled:true});
  try{
   const zero=enabledV01.snapshot();
   assert.equal(zero.smallSidedVariantIndex,0);
   assert.equal(zero.smallSidedNativeBodyGuard.tick,0);
   assert.equal(zero.smallSidedPhysicalFeedback.tick,0);
   assert.deepEqual(zero.smallSidedNativeBodyGuard.selectedColliderIds,
    zero.smallSidedParticipants);
   for(let expectedTick=1;expectedTick<=12;expectedTick++){
    let next;
    try{next=enabledV01.step();}
    catch(error){throw new Error(
     'V01 Bodies ON '+spec.id+' '+side+' tick '+expectedTick+
     ' failed: '+error.message,{cause:error});}
    assert.equal(next.smallSidedNativeBodyGuard.tick,expectedTick);
    assert.equal(next.smallSidedPhysicalFeedback.tick,expectedTick);
    assert.equal(typeof next.smallSidedPhysicalFeedback.accepted,'boolean');
    assert.equal(next.smallSidedPhysicalFeedback.ballProtectionProven,false);
    assert.equal(next.officialMatchResult,null);
    if(next.refereeEvidence?.lastEvent){
     process.stdout.write('ME_628_V01_BODIES_EARLY_EVENT '+
      JSON.stringify({scene:spec.id,side,expectedTick,ball:next.ball,
       referee:next.refereeEvidence.lastEvent,
       guard:next.smallSidedNativeBodyGuard})+'\\n');
     assert.fail('V01 native-body source must not force a dead ball within 12 ticks');
    }
   }
  }finally{enabledV01.dispose();}
  const ungated=createControlledActionLab(R,spec.id,{shotSide:side,variantIndex:1});
  try{assert.equal(ungated.snapshot().smallSidedNativeBodyGuard,null,
   'ordinary V02 must retain pre-existing Rapier physics');}
  finally{ungated.dispose();}
  for(const variantIndex of [1,9,21]){
   const a=createControlledActionLab(R,spec.id,{shotSide:side,variantIndex,bodyGuardEnabled:true});
   const b=createControlledActionLab(R,spec.id,{shotSide:side,variantIndex,bodyGuardEnabled:true});
   try{
    assert.equal(a.snapshot().smallSidedNativeBodyGuard.tick,0);
    for(let tick=1;tick<=65;tick++){
     const x=a.step(),y=b.step(),g=x.smallSidedNativeBodyGuard;
     assert.equal(g.tick,tick);
     assert.equal(x.smallSidedPhysicalFeedback.tick,tick);
     assert.deepEqual(x.smallSidedPhysicalFeedback,
      y.smallSidedPhysicalFeedback);
     assert.deepEqual(g,y.smallSidedNativeBodyGuard);
     assert.deepEqual(x.ball,y.ball);
     assert.deepEqual(g.selectedColliderIds,x.smallSidedParticipants);
     assert.equal(g.selectedColliderIds.length,spec.focus.length);
     for(const id of [...g.lowerLegBallContacts,...g.lowerLegBallStarts,
      ...g.lowerLegBallEnds])assert.ok(g.selectedColliderIds.includes(id));
     if(g.lowerLegBallContacts.length)assert.equal(x.action,null,
      'no autonomous extra kick while native player lower leg contacts the ball');
     assert.equal(g.ballProtectionProven,false);
     assert.equal(g.successfulPossession,false);
     assert.equal(g.tackleWon,false);
     assert.equal(x.officialMatchResult,null);
     const live=x.observedMovementPlayers;
     for(let i=0;i<live.length;i++){
      assert.ok(Math.hypot(live[i].vx,live[i].vy)<=7+1e-7);
      for(let j=i+1;j<live.length;j++)
       assert.ok(Math.hypot(live[i].x-live[j].x,
        live[i].y-live[j].y)>=.98-1e-7);
     }
     if(x.refereeEvidence?.lastEvent)break;
    }
   }finally{a.dispose();b.dispose();}
  }
 }
});
test('#628 body collision requires a real small-sided shoe source; V01 supports explicit opt-in',
 {timeout:30000},async()=>{
 const R=await initializeRapier(rapier);
 const ball={preset:'roll',seed:'guard-off',x:0,y:0,z:0,vx:0,vy:0,vz:0};
 assert.throws(()=>createEngine(R,ball,{
  diagnosticSmallSidedBodyGuardEnabled:true}),TypeError);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticSmallSidedSituation:'keeper-1v1',
  diagnosticSmallSidedSide:'home',
  diagnosticSmallSidedVariantIndex:0,
  diagnosticPlayerFootContactsEnabled:false,
  diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticSmallSidedBodyGuardEnabled:true
 }),TypeError);
 assert.throws(()=>createControlledActionLab(R,'keeper-1v1',{
  shotSide:'home',variantIndex:0,bodyGuardEnabled:'yes'}),TypeError);
 assert.throws(()=>createControlledActionLab(R,'shot',{
  bodyGuardEnabled:true}),TypeError);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticSmallSidedBodyFeedbackEnabled:true
 }),TypeError);
 const routes=readFileSync(new URL('../../tools/dev-standings-preview.mjs',
  import.meta.url),'utf8');
 assert.ok(routes.includes("'/__fa_match_engine__/small-sided-native-body-guard.mjs':"));
});
