// ME-PB-46 — sensitivity of genuine Rapier distinct-second-shoe flight
// to bounded diagnostic foot restitution and grass roll resistance.
// Existing defaults and official physics untouched. Every result is
// measured with identical 22-player kinematic inputs in A/B/sham worlds.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {
 initializeRapier,createEngine,canonicalSnapshot,GRASS_ROLL_DECELERATION
} from '../src/core.mjs';
import {
 FOOT_CONTACT_RESTITUTION,FOOT_CONTACT_RESTITUTION_RANGE
} from '../src/player-foot-contact.mjs';
import {INITIAL_PLAYERS,createPlayerMovement}
 from '../src/player-movement.mjs';
import {LOOSE_RESPONSE_VERSION,LOOSE_RESPONSE_MAX_TICKS}
 from '../src/player-ball-loose-response.mjs';
import {observeLooseBallControlEvidence}
 from '../src/player-ball-control-evidence.mjs';
import {observePostContactRelease}
 from '../src/player-ball-release-evidence.mjs';
import {observeSecondPhysicalShoeStart}
 from '../src/player-ball-second-contact-evidence.mjs';
import {observeMatchedSecondShoeAblation}
 from '../src/player-ball-second-ablation.mjs';
import {observePostEndMatchedFlight,POST_END_MIN_CONSECUTIVE_TICKS}
 from '../src/player-ball-post-end-persistence.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(rapierModule);
const INITIALS=Object.freeze([
 Object.freeze({name:'long-a',x:4.96,y:0,vx:-0.3,vy:0,
  baseline:'sustained'}),
 Object.freeze({name:'long-b',x:5,y:0,vx:-0.3,vy:0,
  baseline:'sustained'}),
 Object.freeze({name:'short-c',x:4.92,y:0,vx:-0.3,vy:0,
  baseline:'short'})
]);
const VARIANTS=Object.freeze([
 Object.freeze({id:'baseline',foot:FOOT_CONTACT_RESTITUTION,
  grass:GRASS_ROLL_DECELERATION}),
 Object.freeze({id:'soft-foot',foot:0.06,grass:GRASS_ROLL_DECELERATION}),
 Object.freeze({id:'firm-foot',foot:0.22,grass:GRASS_ROLL_DECELERATION}),
 Object.freeze({id:'low-grass-resistance',foot:FOOT_CONTACT_RESTITUTION,
  grass:0.60}),
 Object.freeze({id:'high-grass-resistance',foot:FOOT_CONTACT_RESTITUTION,
  grass:1.00})
]);
const flags=v=>({
 diagnosticPlayerFootContactsEnabled:true,
 diagnosticFootRestitution:v.foot,
 diagnosticGrassRollDecelerationMps2:v.grass
});
function gate(firstTick,firstId,tick){
 const count=tick-firstTick+1;
 return Object.freeze({
  version:LOOSE_RESPONSE_VERSION,
  phase:count>=LOOSE_RESPONSE_MAX_TICKS?'completed':'responding',
  contactTick:firstTick,precedingPassTick:firstTick-1,
  initiatedAtMovementTick:firstTick,lastMovementTick:tick,
  responseTicks:count,
  responders:Object.freeze({
   home:firstId.startsWith('home-')?firstId:'home-10',
   away:firstId.startsWith('away-')?firstId:'away-10'
  }),
  officialPossession:false,ballForceApplied:false,
  diagnosticObserverGateOnly:true
 });
}
function run(initial,variant,{ticks=175,withEvidence=true}={}){
 // Use SAME initial seed for all physical variants of a specific
 // scenario: a seed string is never mistaken for independent physics.
 const setup={preset:'roll',seed:'me-pb-46-'+initial.name,
  x:initial.x,y:initial.y,z:0,vx:initial.vx,vy:initial.vy,vz:0};
 const o=flags(variant);
 const A=createEngine(Rapier,setup,o);
 const B=createEngine(Rapier,setup,{...o,diagnosticOmittedFootId:'home-10'});
 const C=createEngine(Rapier,setup,{...o,diagnosticOmittedFootId:'home-1'});
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 let firstTick=null,firstId=null,control=null,release=null,clear=null,
  second=null,matched=null,tail=null,secondEnd=null;
 let shamIdentical=true,preTargetWorldIdentical=true,firstTargetStart=null;
 let firstPhysicalStart=null,afterFirstEndContact=null,firstWorldGap=null;
 const full=[],ablated=[],sham=[],events=[];
 try{
  assert.deepEqual(A.snapshot(),B.snapshot());
  assert.deepEqual(A.snapshot(),C.snapshot());
  for(let tick=1;tick<=ticks;tick++){
   const before=A.snapshot(),beforeFoot=A.footContactSnapshot(),
    beforePlayers=mover.snapshot();
   if(withEvidence&&firstTick!==null&&tick>firstTick&&
      tick<=firstTick+LOOSE_RESPONSE_MAX_TICKS-1){
    control=observeLooseBallControlEvidence({
     previous:control,response:gate(firstTick,firstId,tick),
     contactFrame:beforeFoot,players:beforePlayers.players,
     ball:before.ball,movementTick:tick
    });
    release=observePostContactRelease({
     previous:release,controlEvidence:control,
     contactFrame:beforeFoot,players:beforePlayers.players,
     ball:before.ball
    });
    if(!clear&&release.firstUncontestedPhysicsTick===
       release.observedPhysicsTick&&release.currentlyMeasuredUncontested)
      clear=release;
   }
   const frame=mover.step(before.ball.position);
   assert.equal(frame.tick,tick);
   assert.equal(frame.players.length,INITIAL_PLAYERS.length);
   const a=A.step(frame),b=B.step(frame),c=C.step(frame),
    fa=A.footContactSnapshot(),fb=B.footContactSnapshot(),
    fc=C.footContactSnapshot();
   matched=observeMatchedSecondShoeAblation({
    previous:matched,full:a,withoutSecondShoe:b,
    fullFoot:fa,ablatedFoot:fb,omittedShoeId:'home-10'
   });
   if(firstTick===null&&fa.started.length>0){
    firstTick=tick;firstId=fa.started[0];
    firstPhysicalStart=firstId;
   }
   if(firstTargetStart===null&&fa.started.includes('home-10'))
    firstTargetStart=tick;
   if(withEvidence&&clear&&tick>clear.observedPhysicsTick&&
      !second?.terminal){
    second=observeSecondPhysicalShoeStart({
     previous:second,releaseEvidence:clear,
     contactFrame:fa,players:frame.players,ball:a.ball
    });
   }
   if(withEvidence&&second?.realDistinctSecondShoeStartObserved&&
      !tail&&fa.ended.includes('home-10')&&fa.started.length===0&&
      fa.active.length===0&&fa.ended.length===1&&
      fb.started.length===0&&fb.active.length===0&&
      fc.started.length===0&&fc.active.length===0){
    tail=observePostEndMatchedFlight({
     matched,full:a,ablated:b,sham:c,fullFoot:fa,ablatedFoot:fb,
     shamFoot:fc,secondShoeId:'home-10'
    });
    secondEnd=tick;
   }else if(withEvidence&&tail&&!tail.terminal){
    tail=observePostEndMatchedFlight({
     previous:tail,matched,full:a,ablated:b,sham:c,
     fullFoot:fa,ablatedFoot:fb,shamFoot:fc,secondShoeId:'home-10'
    });
    if(tail.firstContaminatingContactPhysicsTick!==null)
     afterFirstEndContact=tail.firstContaminatingContactPhysicsTick;
   }
   const aa=canonicalSnapshot(a),bb=canonicalSnapshot(b),
    cc=canonicalSnapshot(c);
   if(firstTargetStart===null&&aa!==bb)preTargetWorldIdentical=false;
   if(firstWorldGap===null&&aa!==bb)firstWorldGap=tick;
   if(aa!==cc)shamIdentical=false;
   assert.ok(![fb.started,fb.ended,fb.active].some(xs=>
    xs.includes('home-10')),'removed shoe is physically absent');
   assert.ok(![fc.started,fc.ended,fc.active].some(xs=>
    xs.includes('home-1')),'sham removed shoe is physically absent');
   full.push(aa);ablated.push(bb);sham.push(cc);
   if(fa.started.length||fa.ended.length)
    events.push(Object.freeze({
     tick,started:Object.freeze([...fa.started]),
     ended:Object.freeze([...fa.ended])
    }));
  }
  return Object.freeze({
   initial:initial.name,variant:variant.id,
   footRestitution:variant.foot,grassDecelerationMps2:variant.grass,
   firstTick,firstId:firstPhysicalStart,
   clearTick:clear?.observedPhysicsTick??null,
   secondStart:second?.secondShoePhysicsTick??null,
   secondId:second?.secondShoeId??null,
   secondStatus:second?.status??null,secondEnd,
   cleanTicks:tail?.cleanPostEndTicks??null,
   firstSustainedTick:tail?.firstSustainedPhysicsTick??null,
   sustained:tail?.sustainedDifferenceObserved??false,
   nextContact:afterFirstEndContact,
   minVelocityGapMps:tail?.minimumCleanVelocityDifferenceMps??null,
   lastCleanPositionGapM:tail?.lastCleanPositionDifferenceM??null,
   finalTailStatus:tail?.status??null,
   firstWorldGap,preTargetWorldIdentical,shamIdentical,
   full:Object.freeze(full),ablated:Object.freeze(ablated),
   sham:Object.freeze(sham),events:Object.freeze(events),
   officialPossession:false,individualFootImpulseProven:false
  });
 }finally{A.dispose();B.dispose();C.dispose();}
}
function report(x){return {
 initial:x.initial,variant:x.variant,foot:x.footRestitution,
 grass:x.grassDecelerationMps2,first:x.firstTick,
 clear:x.clearTick,second:x.secondStart,end:x.secondEnd,
 clean:x.cleanTicks,sustained:x.sustained,
 nextContact:x.nextContact,velocityGap:x.minVelocityGapMps,
 positionGap:x.lastCleanPositionGapM,sham:x.shamIdentical,
 status:x.secondStatus,tail:x.finalTailStatus
};}
test('ME-PB-46 bounded actual restitution/grass sensitivity: 3 real starting states x 5 one-axis options',()=>{
 assert.equal(FOOT_CONTACT_RESTITUTION,0.12);
 assert.equal(GRASS_ROLL_DECELERATION,0.8);
 assert.deepEqual(FOOT_CONTACT_RESTITUTION_RANGE,{min:0,max:0.35});
 assert.equal(INITIALS.length*VARIANTS.length,15);
 const results=INITIALS.flatMap(s=>VARIANTS.map(v=>run(s,v)));
 assert.ok(results.every(x=>x.shamIdentical),
  'all 15 real full/sham ball trajectories must match bit-for-bit');
 assert.ok(results.every(x=>x.officialPossession===false&&
  x.individualFootImpulseProven===false));
 const base=results.filter(x=>x.variant==='baseline');
 assert.deepEqual(base.map(x=>[x.initial,x.secondStart,x.secondEnd,
  x.cleanTicks,x.sustained]),[
  ['long-a',127,130,10,true],
  ['long-b',125,128,12,true],
  ['short-c',129,134,5,false]
 ],'physical defaults must preserve ME-PB-45 strong/short classification');
 assert.equal(base.filter(x=>x.sustained).length,2);
 // Preserve all 15 distinct diagnostic physical responses, without
 // assuming these uncalibrated values are approved football physics.
 const expectedByVariant=Object.freeze({
  baseline:['sustained','sustained','short'],
  'soft-foot':['sustained','short','short'],
  'firm-foot':['sustained','short','sustained'],
  'low-grass-resistance':['unfinished','unfinished','unfinished'],
  'high-grass-resistance':['sustained','short','sustained']
 });
 const classify=row=>row.sustained?'sustained':
  row.secondEnd!==null?'short':
  row.secondStart!==null?'unfinished':'ineligible';
 for(const v of VARIANTS){
  const rows=results.filter(row=>row.variant===v.id);
  assert.deepEqual(rows.map(classify),expectedByVariant[v.id],
   'genuine physical START/END and clean-window class for '+v.id);
 }
 assert.deepEqual([
  results.filter(x=>classify(x)==='sustained').length,
  results.filter(x=>classify(x)==='short').length,
  results.filter(x=>classify(x)==='unfinished').length,
  results.filter(x=>classify(x)==='ineligible').length
 ],[7,5,3,0],
 'parameter variation may change real physical evidence classification');
 const unfinished=results.filter(row=>classify(row)==='unfinished');
 assert.ok(unfinished.every(row=>
  row.variant==='low-grass-resistance'&&
  row.secondStart!==null&&row.secondEnd===null&&row.cleanTicks===null),
 'slower grass roll must not fabricate a qualifying shoe END');
 for(const row of results){
  if(row.sustained){
   assert.ok(row.secondStart!==null&&row.secondEnd!==null);
   assert.ok(row.secondEnd>row.secondStart);
   assert.ok(row.cleanTicks>=POST_END_MIN_CONSECUTIVE_TICKS);
   assert.ok(row.minVelocityGapMps>0.1);
   assert.ok(row.lastCleanPositionGapM>0.01);
  }else if(row.cleanTicks!==null){
   assert.ok(row.secondEnd!==null&&
    row.cleanTicks<POST_END_MIN_CONSECUTIVE_TICKS);
  }else{
   assert.equal(row.secondEnd,null,
    'missing END must never manufacture sustained post-END evidence');
  }
  if(row.nextContact!==null){
   assert.ok(row.secondEnd!==null&&
    row.nextContact>row.secondEnd);
   assert.equal(row.finalTailStatus,'censored-by-new-physical-contact');
  }
  assert.ok(row.firstWorldGap===null||
   Number.isSafeInteger(row.firstWorldGap));
 }
 process.stdout.write('ME_PB_46_REAL_PHYSICS_SENSITIVITY '+JSON.stringify({
  trials:results.length,
  baseline:base.map(report),
  sustained:results.filter(x=>x.sustained).map(report),
  short:results.filter(x=>x.secondEnd!==null&&!x.sustained).map(report),
  unfinished:results.filter(x=>x.secondStart!==null&&
    x.secondEnd===null).map(report),
  ineligible:results.filter(x=>x.secondStart===null).map(report),
  all:results.map(report),
  isolatedParameters:true,defaultsUntouched:true,allShamIdentical:true,
  individualFootImpulseProven:false,officialPossession:false
 })+'\n');
});
test('ME-PB-46 exact replay, observer ON/OFF identical actual A/B/sham worlds under varied physics',()=>{
 for(const [s,v] of [
  [INITIALS[0],VARIANTS[0]],
  [INITIALS[1],VARIANTS[2]],
  [INITIALS[2],VARIANTS[4]]
 ]){
  const a=run(s,v),b=run(s,v),no=run(s,v,{withEvidence:false});
  assert.deepEqual(a,b,'physical 3-world replay must be identical');
  assert.deepEqual(a.full,no.full);
  assert.deepEqual(a.ablated,no.ablated);
  assert.deepEqual(a.sham,no.sham);
  assert.deepEqual(a.events,no.events);
  assert.equal(no.sustained,false);
  assert.equal(no.secondStart,null);
 }
});
test('ME-PB-46 diagnostic bounds reject invalid switches, no new runtime physics knobs or gameplay',()=>{
 const c={preset:'roll',seed:'pb46-bounds',x:4.96,y:0,z:0,
  vx:-0.3,vy:0,vz:0};
 for(const foot of [-0.001,0.351,Infinity,NaN]){
  assert.throws(()=>createEngine(Rapier,c,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticFootRestitution:foot
  }),/Uncalibrated experimental foot restitution/);
 }
 for(const grass of [0.299,2.001,Infinity,NaN]){
  assert.throws(()=>createEngine(Rapier,c,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticGrassRollDecelerationMps2:grass
  }),/Invalid diagnostic grass rolling deceleration/);
 }
 assert.throws(()=>createEngine(Rapier,c,{
  diagnosticFootRestitution:0.06
 }),/requires explicit foot-collider opt-in/);
 const noFeet=createEngine(Rapier,c);
 const explicitDefaults=createEngine(Rapier,c,{
  diagnosticFootRestitution:FOOT_CONTACT_RESTITUTION,
  diagnosticGrassRollDecelerationMps2:GRASS_ROLL_DECELERATION
 });
 try{
  for(let tick=1;tick<=30;tick++)
   assert.equal(canonicalSnapshot(noFeet.step()),
    canonicalSnapshot(explicitDefaults.step()),
    'all normal-world default physics must remain identical');
 }finally{noFeet.dispose();explicitDefaults.dispose();}
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8'),
  lab=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(core,/ME-PB-46|player-ball-parameter-sensitivity/);
 assert.doesNotMatch(lab,/me-pb-46|parameter-sensitivity/);
});
