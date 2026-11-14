// ME-PB-45 — independent INITIAL-PHYSICS variation, genuine second shoe
// and sustained matched-world post-END flight. No randomized seed-only proof.
// Every witness comes from actual Rapier START/END, ME-PB-38/39/41/44
// guards, and an unchanged canonical 22-player movement in three worlds.
// All deltas are WHOLE-WORLD counterfactuals, never ownership or intent.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
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
import {observePostEndMatchedFlight,
 POST_END_MIN_CONSECUTIVE_TICKS}
 from '../src/player-ball-post-end-persistence.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(rapierModule);
const observedFlags=Object.freeze({diagnosticPlayerFootContactsEnabled:true});
const approach=Object.freeze({experimentalAiKickApproach:true});
const ordinary=Object.freeze({});
const scenarios=Object.freeze([
 ...[4.92,4.94,4.96,4.98,5.00].flatMap(x=>
  [-0.2,-0.3,-0.4].map(vx=>Object.freeze({
   name:'mirrored-'+x.toFixed(2)+'-'+vx.toFixed(2),
   x,y:0,vx,vy:0,movement:approach
  }))),
 Object.freeze({name:'mirrored-y-plus',x:4.96,y:0.035,vx:-0.3,vy:0,movement:approach}),
 Object.freeze({name:'mirrored-y-minus',x:4.96,y:-0.035,vx:-0.3,vy:0,movement:approach}),
 Object.freeze({name:'mirrored-ordinary-negative',x:4.96,y:0,vx:-0.3,vy:0,movement:ordinary}),
 Object.freeze({name:'grazing-original-shoe-recontact',x:-5.25,y:-0.14,vx:2.0,vy:0.1,movement:ordinary}),
 Object.freeze({name:'distant-no-physical-contact',x:30,y:20,vx:0,vy:0,movement:ordinary})
]);
function trialGate(start,id,movementTick){
 const n=movementTick-start+1;
 return Object.freeze({
  version:LOOSE_RESPONSE_VERSION,
  phase:n>=LOOSE_RESPONSE_MAX_TICKS?'completed':'responding',
  contactTick:start,precedingPassTick:start-1,
  initiatedAtMovementTick:start,lastMovementTick:movementTick,
  responseTicks:n,
  responders:Object.freeze({
   home:id.startsWith('home-')?id:'home-10',
   away:id.startsWith('away-')?id:'away-10'
  }),
  officialPossession:false,ballForceApplied:false,
  diagnosticObserverGateOnly:true
 });
}
function planarHeading(from,to){
 const a=Math.hypot(from.x,from.y),b=Math.hypot(to.x,to.y);
 if(a<0.2||b<0.2)return null; // no meaningful flight direction
 const ratio=(from.x*to.x+from.y*to.y)/(a*b);
 return Math.acos(Math.max(-1,Math.min(1,ratio)))*180/Math.PI;
}
function sample(c,{ticks=180,observe=true}={}){
 const initial={preset:'roll',seed:'me-pb-45-'+c.name,
  x:c.x,y:c.y,z:0,vx:c.vx,vy:c.vy,vz:0};
 const A=createEngine(Rapier,initial,observedFlags);
 const B=createEngine(Rapier,initial,{
  ...observedFlags,diagnosticOmittedFootId:'home-10'
 });
 const C=createEngine(Rapier,initial,{
  ...observedFlags,diagnosticOmittedFootId:'home-1'
 });
 const movement=createPlayerMovement(c.movement);
 let firstTick=null,firstId=null,control=null,release=null,
  clear=null,second=null,match=null,tail=null,secondEndTick=null,
  newContactTick=null,endVel=null,cleanLastVel=null;
 let allShamEqual=true,identicalPreStart=true;
 const aTrace=[],bTrace=[],cTrace=[],frames=[],lastClean=[];
 let firstFullTargetStart=null;
 try{
  assert.deepEqual(A.snapshot(),B.snapshot());
  assert.deepEqual(A.snapshot(),C.snapshot());
  for(let tick=1;tick<=ticks;tick++){
   const before=A.snapshot(),footBefore=A.footContactSnapshot();
   const moverBefore=movement.snapshot();
   if(observe&&firstTick!==null&&tick>firstTick&&
     tick<=firstTick+LOOSE_RESPONSE_MAX_TICKS-1){
    control=observeLooseBallControlEvidence({
     previous:control,response:trialGate(firstTick,firstId,tick),
     contactFrame:footBefore,players:moverBefore.players,
     ball:before.ball,movementTick:tick
    });
    release=observePostContactRelease({
     previous:release,controlEvidence:control,
     contactFrame:footBefore,players:moverBefore.players,
     ball:before.ball
    });
    if(!clear&&release.firstUncontestedPhysicsTick===
       release.observedPhysicsTick&&release.currentlyMeasuredUncontested)
      clear=release;
   }
   // Same genuine physical A-world previous ball drives the ONE shared
   // bounded canonical movement frame applied unchanged to A/B/C.
   const frame=movement.step(before.ball.position);
   assert.equal(frame.tick,tick);
   assert.equal(frame.players.length,INITIAL_PLAYERS.length);
   const a=A.step(frame),b=B.step(frame),sham=C.step(frame);
   const af=A.footContactSnapshot(),bf=B.footContactSnapshot(),
    cf=C.footContactSnapshot();
   match=observeMatchedSecondShoeAblation({
    previous:match,full:a,withoutSecondShoe:b,
    fullFoot:af,ablatedFoot:bf,omittedShoeId:'home-10'
   });
   if(firstTick===null){
    const start=af.started[0];
    if(start){firstTick=tick;firstId=start;}
   }
   if(firstFullTargetStart===null&&af.started.includes('home-10'))
    firstFullTargetStart=tick;
   if(observe&&clear&&tick>clear.observedPhysicsTick&&
      !second?.terminal){
    second=observeSecondPhysicalShoeStart({
     previous:second,releaseEvidence:clear,
     contactFrame:af,players:frame.players,ball:a.ball
    });
   }
   if(observe&&second?.realDistinctSecondShoeStartObserved&&
      !tail&&af.ended.includes('home-10')){
    // ME-PB-44 requires this completed frame to be exclusively the
    // physically observed Home #10 END with no concurrent shoes.
    // A simultaneous competitor disqualifies the clean episode.
    if(af.started.length===0&&af.active.length===0&&
      bf.started.length===0&&bf.active.length===0&&
      cf.started.length===0&&cf.active.length===0&&
      af.ended.length===1&&af.ended[0]==='home-10'){
     tail=observePostEndMatchedFlight({
      matched:match,full:a,ablated:b,sham,
      fullFoot:af,ablatedFoot:bf,shamFoot:cf,
      secondShoeId:'home-10'
     });
     secondEndTick=tick;
     endVel=Object.freeze({...a.ball.velocity});
    }
   }else if(observe&&tail&&!tail.terminal){
    tail=observePostEndMatchedFlight({
     previous:tail,matched:match,full:a,ablated:b,sham,
     fullFoot:af,ablatedFoot:bf,shamFoot:cf,
     secondShoeId:'home-10'
    });
    if(tail.firstContaminatingContactPhysicsTick!==null)
     newContactTick=tail.firstContaminatingContactPhysicsTick;
    else{
     cleanLastVel=Object.freeze({...a.ball.velocity});
     if(tick%3===0)
      lastClean.push(Object.freeze({
       tick,positionDifferenceM:match.ballPositionDifferenceM,
       velocityDifferenceMps:match.ballVelocityDifferenceMps
      }));
    }
   }
   if(firstFullTargetStart===null&&canonicalSnapshot(a)!==canonicalSnapshot(b))
    identicalPreStart=false; // CCD may diverge before a real START
   if(canonicalSnapshot(a)!==canonicalSnapshot(sham))allShamEqual=false;
   aTrace.push(canonicalSnapshot(a));
   bTrace.push(canonicalSnapshot(b));
   cTrace.push(canonicalSnapshot(sham));
   if(af.started.length||af.ended.length)
    frames.push(Object.freeze({
     tick,started:Object.freeze([...af.started]),
     ended:Object.freeze([...af.ended])
    }));
   assert.ok(![bf.started,bf.ended,bf.active].some(rows=>
    rows.includes('home-10')));
  }
  return Object.freeze({
   name:c.name,initial:Object.freeze({
    x:c.x,y:c.y,vx:c.vx,vy:c.vy,
    movement:c.movement===ordinary?'ordinary':'approach'
   }),
   originalStartTick:firstTick,originalShoeId:firstId,
   originalReleaseTick:clear?.shoeEndPhysicsTick??null,
   firstUncontestedTick:clear?.observedPhysicsTick??null,
   secondEvidenceStatus:second?.status??null,
   secondStartTick:second?.secondShoePhysicsTick??null,
   secondShoeId:second?.secondShoeId??null,
   secondEndTick,firstFullTargetStart,newContactTick,
   cleanTicks:tail?.cleanPostEndTicks??null,
   sustained:tail?.sustainedDifferenceObserved??false,
   firstSustainedTick:tail?.firstSustainedPhysicsTick??null,
   minCleanSpeedDifferenceMps:tail?.minimumCleanVelocityDifferenceMps??null,
   lastCleanPositionDifferenceM:tail?.lastCleanPositionDifferenceM??null,
   lastCleanVelocityDifferenceMps:tail?.lastCleanVelocityDifferenceMps??null,
   fullHeadingChangeDeg:endVel&&cleanLastVel?
    planarHeading(endVel,cleanLastVel):null,
   allShamEqual,identicalPreStart,
   fullTrace:Object.freeze(aTrace),ablatedTrace:Object.freeze(bTrace),
   shamTrace:Object.freeze(cTrace),
   events:Object.freeze(frames),cleanSamples:Object.freeze(lastClean),
   terminalStatus:tail?.status??null,
   officialPossession:false,individualFootImpulseProven:false
  });
 }finally{A.dispose();B.dispose();C.dispose();}
}
function compact(r){
 return Object.freeze({
  name:r.name,first:r.originalStartTick,
  release:r.firstUncontestedTick,
  second:r.secondStartTick,end:r.secondEndTick,
  clean:r.cleanTicks,firstSustained:r.firstSustainedTick,
  nextContact:r.newContactTick,status:r.secondEvidenceStatus,
  endStatus:r.terminalStatus,
  minSpeedDelta:r.minCleanSpeedDifferenceMps,
  posDelta:r.lastCleanPositionDifferenceM,
  heading:r.fullHeadingChangeDeg,
  sham:r.allShamEqual,preStartEqual:r.identicalPreStart
 });
}
test('ME-PB-45 exploratory independent initial-condition matrix and true shoe END/censor',()=>{
 const trials=scenarios.map(c=>sample(c));
 const positive=trials.filter(x=>x.sustained);
 const completed=trials.filter(x=>x.secondEndTick!==null);
 const unqualified=trials.filter(x=>x.secondStartTick===null);
 assert.equal(trials.length,20);
 // These are independent initial ball coordinates/speeds, not just new
 // labels or random seeds. Preserve *all* observed physical categories.
 const certified=Object.freeze([
  'mirrored-4.96--0.20','mirrored-4.96--0.30',
  'mirrored-5.00--0.30','mirrored-5.00--0.40'
 ]);
 assert.deepEqual(positive.map(t=>t.name),certified,
  'four independently changed real initial states must still sustain');
 assert.equal(completed.length,15,'15 genuine second shoe END witnesses');
 assert.equal(unqualified.length,3,
  'three cases never establish a qualified second player START');
 const interrupted=trials.filter(t=>t.secondEndTick!==null&&!t.sustained);
 assert.equal(interrupted.length,11,
  'an observed velocity delta cannot override too-short contact-free flight');
 for(const t of interrupted){
  assert.ok(t.cleanTicks>=1&&t.cleanTicks<POST_END_MIN_CONSECUTIVE_TICKS);
  assert.equal(t.terminalStatus,'censored-by-new-physical-contact');
  assert.ok(t.newContactTick>t.secondEndTick);
  assert.equal(t.firstSustainedTick,null);
  assert.ok(t.minCleanSpeedDifferenceMps>0.1,
   'some real velocity difference exists but still is not sustained');
 }
 const unfinished=trials.filter(t=>
  t.secondStartTick!==null&&t.secondEndTick===null);
 assert.deepEqual(unfinished.map(t=>t.name),[
  'mirrored-4.94--0.20','mirrored-y-plus'
 ],'a genuine START without a valid END must never manufacture a clean tail');
 assert.ok(unfinished.every(t=>t.cleanTicks===null&&!t.sustained));
 assert.deepEqual(unqualified.map(t=>t.name),[
  'mirrored-ordinary-negative',
  'grazing-original-shoe-recontact',
  'distant-no-physical-contact'
 ]);
 for(const t of positive){
  assert.equal(t.originalShoeId,'away-10');
  assert.equal(t.secondShoeId,'home-10');
  assert.equal(t.firstUncontestedTick,26);
  assert.equal(t.newContactTick,141,
   'all positives must censor the clean tail at a new real shoe START');
  assert.ok(t.fullHeadingChangeDeg!==null&&
   t.fullHeadingChangeDeg>=0&&t.fullHeadingChangeDeg<2,
   'full-world post-END angle measured only at two nonzero ground speeds');
 }

 const base=trials.find(x=>x.name==='mirrored-4.96--0.30');
 assert.ok(base);
 assert.equal(base.secondStartTick,127);
 assert.equal(base.secondEndTick,130);
 assert.equal(base.cleanTicks,10);
 assert.equal(base.newContactTick,141);
 assert.equal(base.sustained,true);
 assert.ok(trials.every(t=>t.allShamEqual),
  'sham ablation must remain identical in all real Rapier worlds');
 assert.ok(trials.every(t=>t.officialPossession===false&&
  t.individualFootImpulseProven===false));
 assert.ok(trials.filter(t=>t.secondEndTick!==null).every(t=>
  t.secondStartTick!==null&&t.secondEndTick>t.secondStartTick));
 for(const t of positive){
  assert.ok(t.cleanTicks>=POST_END_MIN_CONSECUTIVE_TICKS);
  assert.ok(t.minCleanSpeedDifferenceMps>0.1);
  assert.ok(t.lastCleanPositionDifferenceM>0.01);
 }
 const distant=trials.find(t=>t.name==='distant-no-physical-contact');
 assert.equal(distant.originalStartTick,null);
 assert.equal(distant.secondStartTick,null);
 assert.equal(distant.sustained,false);
 assert.deepEqual(distant.fullTrace,distant.ablatedTrace);
 assert.deepEqual(distant.fullTrace,distant.shamTrace);
 const ordinaryNegative=trials.find(t=>
  t.name==='mirrored-ordinary-negative');
 assert.equal(ordinaryNegative.secondStartTick,null);
 assert.equal(ordinaryNegative.sustained,false);
 const grazingNegative=trials.find(t=>
  t.name==='grazing-original-shoe-recontact');
 assert.equal(grazingNegative.secondStartTick,null);
 assert.equal(grazingNegative.secondEvidenceStatus,
  'original-shoe-recontact-before-new-player');
 assert.equal(grazingNegative.sustained,false);
 process.stdout.write('ME_PB_45_PHYSICAL_MULTICASE_MATRIX '+
  JSON.stringify({
   trials:trials.length,completed:completed.length,
   sustained:positive.length,unqualified:unqualified.length,
   genuineDistinctPhysicalConditions:positive.map(t=>t.initial),
   witnesses:positive.map(compact),
   all:trials.map(compact)
  })+'\n');
});
test('ME-PB-45 deterministic replay and observer-disable do not change the three matched real worlds',()=>{
 const selected=[
  scenarios.find(c=>c.name==='mirrored-4.96--0.30'),
  scenarios.find(c=>c.name==='mirrored-4.94--0.30'),
  scenarios.find(c=>c.name==='mirrored-5.00--0.40'),
  scenarios.find(c=>c.name==='mirrored-ordinary-negative')
 ];
 for(const c of selected){
  assert.ok(c);
  const a=sample(c),b=sample(c),no=sample(c,{observe:false});
  assert.deepEqual(a,b,'same actual Rapier triple-world inputs must replay');
  assert.deepEqual(a.fullTrace,no.fullTrace);
  assert.deepEqual(a.ablatedTrace,no.ablatedTrace);
  assert.deepEqual(a.shamTrace,no.shamTrace);
  assert.deepEqual(a.events,no.events);
  assert.equal(no.sustained,false);
  assert.equal(no.secondStartTick,null);
 }
});
test('ME-PB-45 no new physics, no LAB scenes, no possession or data writes',()=>{
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(core,/ME-PB-45|player-ball-physical-matrix/);
 assert.doesNotMatch(html,/me-pb-45|physical-matrix/);
});
