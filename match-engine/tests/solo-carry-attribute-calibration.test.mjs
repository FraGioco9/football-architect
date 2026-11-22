// #628 — Attribute-linked DEV Carry comparative benchmark. No roster DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {ATTRIBUTES} from '../../backend/src/players-generator-core.mjs';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {advanceSoloCarryPhase} from '../src/solo-carry-phases.mjs';
import {chooseIntentSoloCarryTouch} from '../src/intent-driven-solo-carry.mjs';
import {SOLO_CARRY_ATTRIBUTE_KEYS,SOLO_CARRY_LAB_LEVELS,
 uniformSoloCarryAttributes,validateSoloCarryAttributes,
 calibrateSoloCarryKinematics,calibrateSoloCarryTouch}
 from '../src/solo-carry-attribute-calibration.mjs';

const fullProfile=level=>Object.fromEntries(
 ATTRIBUTES.map(key=>[key,level])
);
test('#628 rating inputs match real 1..99 generator attributes, never fabricate overall',()=>{
 assert.equal(ATTRIBUTES.length,20);
 for(const key of SOLO_CARRY_ATTRIBUTE_KEYS)assert.ok(ATTRIBUTES.includes(key),key);
 for(const rating of SOLO_CARRY_LAB_LEVELS){
  const profile=uniformSoloCarryAttributes(rating);
  assert.equal(Object.keys(profile).length,4);
  assert.deepEqual(validateSoloCarryAttributes(fullProfile(rating)),profile);
  assert.ok(Object.isFrozen(profile));
 }
 for(const level of [0,1.5,100,'50',null,NaN])
  assert.throws(()=>uniformSoloCarryAttributes(level),RangeError);
 for(const input of [null,{},[],{speed:50}])
  assert.throws(()=>validateSoloCarryAttributes(input));
 assert.throws(()=>validateSoloCarryAttributes({...fullProfile(50),agility:100}),RangeError);
 assert.throws(()=>validateSoloCarryAttributes({...fullProfile(50),dribbling:50.2}),RangeError);
 assert.throws(()=>validateSoloCarryAttributes({...fullProfile(50),technique:'50'}),RangeError);
 const baseline=fullProfile(50),weak=fullProfile(25),elite=fullProfile(90);
 const base={maxSpeedMps:6,accelerationMps2:11,brakingMps2:13,
  ballTargetOffsetM:-0.44};
 const low=calibrateSoloCarryKinematics(base,weak),
  mid=calibrateSoloCarryKinematics(base,baseline),
  high=calibrateSoloCarryKinematics(base,elite);
 assert.deepEqual(mid,base,'50 must reproduce the previous accepted movement constants');
 const control90=calibrateSoloCarryKinematics({
  maxSpeedMps:3,accelerationMps2:6,brakingMps2:10,
  ballTargetOffsetM:-0.14
 },elite);
 assert.ok(control90.ballTargetOffsetM<=-0.12,
  'high Control attributes must remain outside the legitimate kick gate');
 assert.ok(low.maxSpeedMps<mid.maxSpeedMps&&mid.maxSpeedMps<high.maxSpeedMps);
 assert.ok(low.accelerationMps2<mid.accelerationMps2&&
  mid.accelerationMps2<high.accelerationMps2);
 const touch={spacingTicks:55,targetSpeedMps:4.2,maxImpulseNs:1.8};
 const tl=calibrateSoloCarryTouch(touch,weak),
  tm=calibrateSoloCarryTouch(touch,baseline),
  th=calibrateSoloCarryTouch(touch,elite);
 assert.deepEqual(tm,touch,'50 must reproduce accepted Rapier intent impulse');
 assert.ok(tl.targetSpeedMps<tm.targetSpeedMps&&
  tm.targetSpeedMps<th.targetSpeedMps);
 assert.ok(tl.spacingTicks<tm.spacingTicks&&tm.spacingTicks<th.spacingTicks,
  'more skill permits longer pushes without inventing extra touches');
 const auto=advanceSoloCarryPhase({tick:1,playerSpeedMps:0,
  ballSpeedMps:0,ballGapM:0});
 assert.equal(Object.hasOwn(auto,'carryPlayerAttributes'),false);
 assert.throws(()=>advanceSoloCarryPhase({tick:1,playerSpeedMps:0,
  ballSpeedMps:0,ballGapM:0,playerAttributes:baseline}),TypeError);
 const cold={tick:1,lastTouchTick:-12,attackingSide:'home',
  phase:'sprint',fixedPhaseLab:true,playerAttributes:elite,
  player:{id:'home-10',team:'home',x:29.45,y:0,vx:0,vy:0},
  ballPosition:{x:30,y:0,z:0.11},ballVelocity:{x:0,y:0,z:0},
  ballRadiusM:0.11};
 const kick=chooseIntentSoloCarryTouch(cold);
 assert.equal(kick.fixedPhaseLab,true);
 assert.ok(kick.impulseNs.x>1.8);
 assert.equal(kick.nativeShoeContactVerified,false);
 assert.throws(()=>chooseIntentSoloCarryTouch({...cold,
  fixedPhaseLab:false}),TypeError);
});

test('#628 four player attribute profiles drive real source 60Hz Carry benchmarks on both sides',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const matrix=[];
 for(const phase of ['control','moderate','sprint']){
  for(const rating of SOLO_CARRY_LAB_LEVELS){
   for(const side of ['home','away']){
    const attrs=fullProfile(rating);
    const lab=createControlledActionLab(R,'carry-solo',{
     shotSide:side,variantIndex:3,intentDrivenSoloCarry:true,
     soloCarryLockedPhase:phase,soloCarryPlayerAttributes:attrs
    });
    try{
     const start=lab.snapshot().ball.position.x,forward=side==='home'?1:-1;
     let touchCount=0,firstTouch=null;
     let frame,at120,late=null;
     for(let tick=1;tick<=180;tick++){
      frame=lab.step();
      if(frame.action?.action==='carry'){
       assert.equal(frame.action.appliedByRapier,true);
       assert.equal(frame.action.nativeShoeContactVerified,false);
       firstTouch??=tick;
       touchCount++;
      }
      assert.equal(frame.soloCarryPhase.phase,phase);
      assert.equal(frame.soloCarryLockedPhase,phase);
      assert.deepEqual(frame.soloCarryPlayerAttributes,
       validateSoloCarryAttributes(attrs));
      assert.equal(frame.intentCarryImpulseCount,touchCount);
      assert.equal(frame.soloCarryMeasurements.appliedCarryImpulses,touchCount);
      assert.equal(frame.soloCarryMeasurements.samples,tick);
      assert.equal(frame.eventCount,0);
      assert.equal(frame.officialMatchPossession,false);
      assert.equal(frame.soloNativeFeet?.started.length??0,0);
      assert.ok(Number.isFinite(frame.soloCarryMeasurements.meanGapM));
      assert.ok(Number.isFinite(frame.soloCarryMeasurements.peakPlayerSpeedMps));
      assert.ok(Number.isFinite(frame.soloCarryMeasurements.peakAccelerationMps2));
      if(tick===120)at120=frame.soloCarryMeasurements;
     }
     late=frame.soloCarryMeasurements;
     assert.equal(late.lateSpeedSampleTicks,60);
     assert.ok(late.lateMeanSpeedMps>=0);
     assert.ok(Math.abs(late.ballForwardM-
      forward*(frame.ball.position.x-start))<1e-8);
     assert.ok(late.ballPathM>=Math.abs(late.ballForwardM)-1e-6);
     assert.ok(touchCount>=1,
      'Every rated Carry phase must produce an actual Rapier impulse');
     assert.ok(at120.ballForwardM>1,
      'Every rated Carry phase must move the original Rapier ball forward');
     if(phase!=='control'){
      assert.ok(firstTouch!==null&&firstTouch<=6);
      assert.ok(at120.ballForwardM>1.5,
       'Ball must physically move in all fixed phase/rating combinations');
     }
     matrix.push({
      phase,rating,side,touches120:at120.appliedCarryImpulses,
      distance120:at120.ballForwardM,
      peakPlayer120:at120.peakPlayerSpeedMps,
      peakBall120:at120.peakBallSpeedMps,
      meanGap120:at120.meanGapM,
      lateSpeed:late.lateMeanSpeedMps,
      touches180:late.appliedCarryImpulses,
      distance180:late.ballForwardM
     });
    }finally{lab.dispose();}
   }
  }
 }
 process.stdout.write('ME_628_CARRY_ATTRIBUTE_MATRIX '+
  JSON.stringify(matrix.filter(x=>x.side==='home'))+'\n');
 for(const row of matrix.filter(x=>x.side==='home')){
  const mirrored=matrix.find(x=>x.phase===row.phase&&
   x.rating===row.rating&&x.side==='away');
  assert.ok(mirrored);
  for(const key of ['distance120','peakPlayer120','peakBall120',
   'meanGap120','lateSpeed','distance180'])
   assert.ok(Math.abs(row[key]-mirrored[key])<0.001,
    'mirror '+row.phase+' '+row.rating+' '+key);
 }
 // The owner's visual QA criterion is not just higher numbers: at the same
 // player rating, Sprint must deliver a clearly different ball/run/touch
 // pattern from Moderate on the identical original Rapier field.
 for(const rating of SOLO_CARRY_LAB_LEVELS){
  const m=matrix.find(x=>x.side==='home'&&x.phase==='moderate'&&x.rating===rating);
  const s=matrix.find(x=>x.side==='home'&&x.phase==='sprint'&&x.rating===rating);
  assert.ok(s.distance120>=m.distance120+1.35,
   'Sprint must visibly outpace Moderate over the same 2s physical window');
  assert.ok(s.peakBall120>=m.peakBall120+1.1,
   'Sprint pushes must be genuinely longer and stronger than Moderate');
  assert.ok(s.peakPlayer120>=m.peakPlayer120+0.7,
   'Sprint runner must physically accelerate faster than Moderate');
  assert.ok(s.meanGap120>=m.meanGap120+0.1,
   'Sprint must have greater open-space ball/runner separation');
 }
 const moderate50=matrix.find(x=>x.side==='home'&&x.phase==='moderate'&&x.rating===50);
 const sprint50=matrix.find(x=>x.side==='home'&&x.phase==='sprint'&&x.rating===50);
 assert.ok(sprint50.touches120<moderate50.touches120,
  'At 50/99 sprint needs fewer, longer spaced real touches over 2s');
 for(const phase of ['moderate','sprint']){
  const low=matrix.find(x=>x.side==='home'&&x.phase===phase&&x.rating===25);
  const high=matrix.find(x=>x.side==='home'&&x.phase===phase&&x.rating===90);
  assert.ok(high.peakBall120>low.peakBall120,
   phase+' stronger skill/speed should drive the genuine ball faster');
  assert.ok(high.peakPlayer120>low.peakPlayer120,
   phase+' higher speed/agility must increase real peak player pace');
 }
});
