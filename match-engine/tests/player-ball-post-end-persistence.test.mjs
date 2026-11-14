// ME-PB-44 — independently measured genuine Rapier post-END persistence.
// The first next physical contact at 141 CENSORS the clean 131..140 tail.
// World-level marginal divergence is neither a unique kick nor possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {observeMatchedSecondShoeAblation}
 from '../src/player-ball-second-ablation.mjs';
import {observePostEndMatchedFlight,POST_END_PERSISTENCE_VERSION,
 POST_END_MIN_CONSECUTIVE_TICKS,POST_END_MAX_WINDOW_TICKS}
 from '../src/player-ball-post-end-persistence.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(RapierModule);
const WITNESS=Object.freeze({
 preset:'roll',seed:'me-pb-41-second-real',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0
});
function actualMatchedWorlds({observer=true,ticks=175,scenario=WITNESS}={}){
 const flags={diagnosticPlayerFootContactsEnabled:true};
 const full=createEngine(Rapier,scenario,flags);
 const ablated=createEngine(Rapier,scenario,{
  ...flags,diagnosticOmittedFootId:'home-10'
 });
 const sham=createEngine(Rapier,scenario,{
  ...flags,diagnosticOmittedFootId:'home-1'
 });
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 let match=null,tail=null,firstShoeStart=null,firstShoeEnd=null;
 const samples=[],episodes=[],sources={},fullBall=[],ablationBall=[],shamBall=[];
 try{
  assert.deepEqual(full.snapshot(),ablated.snapshot());
  assert.deepEqual(full.snapshot(),sham.snapshot());
  for(let tick=1;tick<=ticks;tick++){
   // One real canonical 22-player frame, derived only from the complete
   // world's PREVIOUS real ball, drives all 3 physical worlds unchanged.
   const frame=mover.step(full.snapshot().ball.position);
   assert.equal(frame.tick,tick);
   assert.equal(frame.players.length,INITIAL_PLAYERS.length);
   const f=full.step(frame),a=ablated.step(frame),s=sham.step(frame);
   const ff=full.footContactSnapshot(),
    af=ablated.footContactSnapshot(),sf=sham.footContactSnapshot();
   match=observeMatchedSecondShoeAblation({
    previous:match,full:f,withoutSecondShoe:a,
    fullFoot:ff,ablatedFoot:af,omittedShoeId:'home-10'
   });
   if(ff.started.includes('home-10')&&firstShoeStart===null)
    firstShoeStart=tick;
   if(ff.ended.includes('home-10')&&firstShoeEnd===null)
    firstShoeEnd=tick;
   if(observer&&((tick===130&&ff.ended.includes('home-10'))||
      (tail!==null&&!tail.terminal))){
    const args=Object.freeze({
     previous:tail,matched:match,full:f,ablated:a,sham:s,
     fullFoot:ff,ablatedFoot:af,shamFoot:sf,
     secondShoeId:'home-10'
    });
    tail=observePostEndMatchedFlight(args);
    if([130,131,138,140,141].includes(tick))sources[tick]=args;
   }
   if([26,119,125,126,127,130,131,138,140,141,150,175].includes(tick))
    samples.push(Object.freeze({
     tick,positionDifferenceM:match.ballPositionDifferenceM,
     velocityDifferenceMps:match.ballVelocityDifferenceMps,
     shamCanonical:canonicalSnapshot(s),
     fullCanonical:canonicalSnapshot(f),
     ablatedCanonical:canonicalSnapshot(a),
     shoeStarts:Object.freeze([...ff.started]),
     shoeEnds:Object.freeze([...ff.ended]),
     observerStatus:tail?.status??null,
     observerCleanTicks:tail?.cleanPostEndTicks??null
    }));
   if(ff.started.length||ff.ended.length)
    episodes.push(Object.freeze({
     tick,starts:Object.freeze([...ff.started]),
     ends:Object.freeze([...ff.ended])
    }));
   assert.ok(![af.started,af.ended,af.active].some(v=>
    v.includes('home-10')),'Home #10 omitted world must not create its contact');
   assert.ok(![sf.started,sf.ended,sf.active].some(v=>
    v.includes('home-1')),'unused sham omitted foot must not create contact');
   fullBall.push(canonicalSnapshot(f));
   ablationBall.push(canonicalSnapshot(a));
   shamBall.push(canonicalSnapshot(s));
  }
  return Object.freeze({
   firstShoeStart,firstShoeEnd,
   tail,sources:Object.freeze(sources),
   samples:Object.freeze(samples),episodes:Object.freeze(episodes),
   fullBall:Object.freeze(fullBall),ablationBall:Object.freeze(ablationBall),
   shamBall:Object.freeze(shamBall)
  });
 }finally{full.dispose();ablated.dispose();sham.dispose();}
}
const get=(a,tick)=>a.samples.find(s=>s.tick===tick);
test('ME-PB-44 REAL physical END at 130 yields >=8 clean post-END divergent ticks, censored at real 141 recontact',()=>{
 const a=actualMatchedWorlds();
 assert.equal(a.firstShoeStart,127);
 assert.equal(a.firstShoeEnd,130);
 assert.equal(a.tail?.version,POST_END_PERSISTENCE_VERSION);
 assert.equal(a.tail?.secondShoeId,'home-10');
 assert.equal(a.tail?.secondStartPhysicsTick,127);
 assert.equal(a.tail?.secondEndPhysicsTick,130);
 assert.equal(a.tail?.lastCleanPhysicsTick,140);
 assert.equal(a.tail?.firstContaminatingContactPhysicsTick,141);
 assert.equal(a.tail?.cleanPostEndTicks,10);
 assert.equal(a.tail?.cleanPostEndSeconds,10*FIXED_DT);
 assert.equal(a.tail?.maxPersistenceStreakTicks,10);
 assert.equal(a.tail?.firstSustainedPhysicsTick,137+1);
 assert.equal(a.tail?.sustainedDifferenceObserved,true);
 assert.equal(a.tail?.terminal,true);
 assert.equal(a.tail?.status,'censored-by-new-physical-contact');
 assert.ok(a.tail?.lastCleanPositionDifferenceM>0.1);
 assert.ok(a.tail?.lastCleanVelocityDifferenceMps>0.1);
 assert.ok(a.tail?.minimumCleanVelocityDifferenceMps>0.1);
 assert.ok(a.tail?.fullPlanarTravelSinceEndM>0.1);
 assert.equal(a.tail?.ablatedPlanarTravelSinceEndM,0);
 assert.deepEqual(a.episodes.filter(p=>p.tick>=131&&p.tick<=140),[],
  'all ten post-END frames must be genuine event-free Rapier physics');
 assert.ok(a.episodes.some(e=>e.tick===141&&
  e.starts.includes('home-10')),'new genuine START must CENSOR the next frame');
 assert.ok(a.episodes.some(e=>e.tick===130&&
  e.ends.includes('home-10')),'the initial END must be from Rapier, not inferred');
 for(let t=1;t<=175;t++)
  assert.equal(a.fullBall[t-1],a.shamBall[t-1],
   'sham world must reproduce the full Rapier ball to the end');
 for(const t of [119,125,126])
  assert.equal(a.fullBall[t-1],a.ablationBall[t-1],
   'worlds cannot diverge before the target collision');
 for(const t of [127,130,131,138,140])
  assert.notEqual(a.fullBall[t-1],a.ablationBall[t-1]);
 const at140=get(a,140),at175=get(a,175);
 assert.ok(at140.velocityDifferenceMps>0.1);
 assert.ok(at175.positionDifferenceM>at140.positionDifferenceM);
 assert.equal(at175.observerCleanTicks,10,
  'post-141 difference is confounded by another touch, never counted as clean');
 for(const k of ['individualFootImpulseProven','officialPossession',
  'controlConfirmed','interceptionProven','freeBallOfficiallyProven',
  'passCreated','ballForceApplied'])assert.equal(a.tail[k],false);
 assert.ok(Object.isFrozen(a.tail)&&Object.isFrozen(a.tail.lastFullBallPosition));
 process.stdout.write('ME_PB_44_REAL_POST_END_PERSISTENCE '+
  JSON.stringify({
   secondRealStartTick:127,secondRealEndTick:130,
   firstSustainedTick:a.tail.firstSustainedPhysicsTick,
   firstRecontactTick:141,uncontaminatedTicks:a.tail.cleanPostEndTicks,
   uncontaminatedSeconds:a.tail.cleanPostEndSeconds,
   persistenceVelocityMinMps:a.tail.minimumCleanVelocityDifferenceMps,
   atEnd:get(a,130),lastClean:at140,postContactConfounded:at175,
   fullPostEndPlanarTravelM:a.tail.fullPlanarTravelSinceEndM,
   ablatedPostEndPlanarTravelM:a.tail.ablatedPlanarTravelSinceEndM,
   cappedAtNewRealContact:true,individualFootImpulseProven:false,
   officialPossession:false
  })+'\n');
});
test('ME-PB-44 independent Rapier replay, observer on/off, and physical sham remain identical',()=>{
 const a=actualMatchedWorlds(),b=actualMatchedWorlds(),
  noObserver=actualMatchedWorlds({observer:false});
 assert.deepEqual(a,b,'all three independent real Rapier worlds replay identically');
 assert.equal(noObserver.tail,null);
 assert.deepEqual(a.fullBall,noObserver.fullBall);
 assert.deepEqual(a.ablationBall,noObserver.ablationBall);
 assert.deepEqual(a.shamBall,noObserver.shamBall);
 assert.deepEqual(a.episodes,noObserver.episodes);
 assert.ok(a.tail?.sustainedDifferenceObserved);
});
test('ME-PB-44 fail closed on absent physical END, reordered or corrupted source frames and sham mismatch',()=>{
 const a=actualMatchedWorlds();
 const at130=a.sources[130],at131=a.sources[131],at141=a.sources[141];
 assert.ok(at130&&at131&&at141);
 assert.equal(observePostEndMatchedFlight(at130).secondEndPhysicsTick,130);
 assert.equal(observePostEndMatchedFlight(at131).status,
  'persistent-world-separation');
 assert.equal(observePostEndMatchedFlight(at141).status,
  'censored-by-new-physical-contact');
 const fake=[
  {...at130,fullFoot:{...at130.fullFoot,ended:[]}},
  {...at130,secondShoeId:'home-1'},
  {...at130,sham:{...at130.sham,ball:{
   ...at130.sham.ball,position:{
    ...at130.sham.ball.position,x:at130.sham.ball.position.x+0.01
   }}}},
  {...at130,matched:{...at130.matched,officialPossession:true}},
  {...at130,matched:{...at130.matched,fullShoeLastEndPhysicsTick:129}},
  {...at131,fullFoot:{...at131.fullFoot,tick:132}},
  {...at131,previous:{...at131.previous,officialPossession:true}},
  {...at131,previous:{...at131.previous,observedPhysicsTick:129}},
  {...at131,matched:{...at131.matched,
   positionDeltaWorldM:{x:0,y:0,z:0}}},
  {...at131,ablated:{...at131.ablated,
   ball:{...at131.ablated.ball,velocity:{x:Infinity,y:0,z:0}}}},
  {...at141,fullFoot:{...at141.fullFoot,started:['fake']}},
  {...at141,previous:{...at141.previous,cleanPostEndTicks:3}},
  {...at141,previous:{...at141.previous,terminal:true}}
 ];
 for(const v of fake)
  assert.throws(()=>observePostEndMatchedFlight(v),
   /Consecutive authentic Rapier/, 'invalid evidence must fail atomically');
 assert.throws(()=>observePostEndMatchedFlight({
  ...at141,previous:a.tail
 }),/Consecutive authentic Rapier/,
 'post-recontact tails may never be extended or reclassified as clean');
 assert.equal(POST_END_MIN_CONSECUTIVE_TICKS,8);
 assert.equal(POST_END_MAX_WINDOW_TICKS,60);
});
test('ME-PB-44 negative physical world with distant ball cannot fabricate a second shoe END or a tail',()=>{
 const away={preset:'roll',seed:'pb44-distant-negative',
  x:30,y:20,z:0,vx:0,vy:0,vz:0};
 const trial=actualMatchedWorlds({scenario:away,ticks:70});
 assert.equal(trial.firstShoeStart,null);
 assert.equal(trial.firstShoeEnd,null);
 assert.equal(trial.tail,null);
 assert.deepEqual(trial.fullBall,trial.ablationBall);
 assert.deepEqual(trial.fullBall,trial.shamBall);
 assert.deepEqual(trial.episodes,[]);
});
test('ME-PB-44 separate DEV-only evidence, no gameplay, LAB scene, physics coefficient or external data writes',()=>{
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.match(core,/diagnosticOmittedFootId/);
 assert.doesNotMatch(core,/observePostEndMatchedFlight/);
 assert.doesNotMatch(lab,/me-pb-44|post-end-persistence/);
});
