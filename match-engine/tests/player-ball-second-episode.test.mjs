// ME-PB-42: read-only same-world Rapier after second independent shoe START.
// Only whole-ball kinematics/actual physical shoe END; never causal kick proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement}
 from '../src/player-movement.mjs';
import {LOOSE_RESPONSE_VERSION,LOOSE_RESPONSE_MAX_TICKS}
 from '../src/player-ball-loose-response.mjs';
import {observeLooseBallControlEvidence}
 from '../src/player-ball-control-evidence.mjs';
import {observePostContactRelease}
 from '../src/player-ball-release-evidence.mjs';
import {observeSecondPhysicalShoeStart}
 from '../src/player-ball-second-contact-evidence.mjs';
import {observeSecondPhysicalShoeEpisode,SECOND_EPISODE_VERSION,
 SECOND_EPISODE_MAX_TICKS}
 from '../src/player-ball-second-episode.mjs';
import {readFileSync} from 'node:fs';
const Rapier=await initializeRapier(rapierModule);
const ballCases=Object.freeze({
 mirrored:{x:4.96,y:0,vx:-0.3,vy:0},
 firstShoeRecontact:{x:-5.25,y:-0.14,vx:2.0,vy:0.1},
 noSecond:{x:-4.96,y:0,vx:0.3,vy:0}
});
const approach=Object.freeze({experimentalAiKickApproach:true});
const exchange=Object.freeze({experimentalAiExchangeApproach:true});
const ordinary=Object.freeze({});
function trialResponse(startTick,shoeId,movementTick){
 const count=movementTick-startTick+1;
 return Object.freeze({
  version:LOOSE_RESPONSE_VERSION,
  phase:count>=LOOSE_RESPONSE_MAX_TICKS?'completed':'responding',
  contactTick:startTick,precedingPassTick:startTick-1,
  initiatedAtMovementTick:startTick,lastMovementTick:movementTick,
  responseTicks:count,responders:Object.freeze({
   home:shoeId.startsWith('home-')?shoeId:'home-10',
   away:shoeId.startsWith('away-')?shoeId:'away-10'
  }),officialPossession:false,ballForceApplied:false,
  diagnosticObserverGateOnly:true
 });
}
function replay(initial,mode,{enableEpisode=true,withFeet=true,steps=250}={}){
 const engine=createEngine(Rapier,{
  preset:'roll',seed:'me-pb-41-second-real',z:0,vz:0,
  ...initial
 },withFeet?{diagnosticPlayerFootContactsEnabled:true}:{});
 const mover=createPlayerMovement(mode);
 let firstTick=null,firstId=null,control=null,release=null;
 let clear=null,second=null,episode=null;
 let startSource=null,endSource=null;
 const physics=[],contacts=[],previousSnapshots=[];
 try{
  for(let t=1;t<=steps;t++){
   const before=engine.snapshot();
   const moversBefore=mover.snapshot();
   const footBefore=engine.footContactSnapshot?.();
   if(withFeet&&firstTick!==null&&t>firstTick&&
      t<=firstTick+LOOSE_RESPONSE_MAX_TICKS-1){
    control=observeLooseBallControlEvidence({
     previous:control,response:trialResponse(firstTick,firstId,t),
     contactFrame:footBefore,players:moversBefore.players,
     ball:before.ball,movementTick:t
    });
    release=observePostContactRelease({
     previous:release,controlEvidence:control,contactFrame:footBefore,
     players:moversBefore.players,ball:before.ball
    });
    if(!clear&&release.firstUncontestedPhysicsTick===
      release.observedPhysicsTick&&release.currentlyMeasuredUncontested)
      clear=release;
   }
   const movement=mover.step(before.ball.position);
   const after=withFeet?engine.step(movement):engine.step();
   const foot=engine.footContactSnapshot?.();
   physics.push(canonicalSnapshot(after));
   previousSnapshots.push(canonicalSnapshot(before));
   if(foot){
    contacts.push(Object.freeze({
     tick:foot.tick,
     started:Object.freeze([...foot.started]),
     ended:Object.freeze([...foot.ended]),
     active:Object.freeze([...foot.active])
    }));
    if(firstTick===null){
     const id=foot.started.find(id=>id==='home-10'||id==='away-10');
     if(id){firstTick=t;firstId=id;}
    }
    if(clear&&t>clear.observedPhysicsTick&&!second?.terminal){
     second=observeSecondPhysicalShoeStart({
      previous:second,releaseEvidence:clear,contactFrame:foot,
      players:movement.players,ball:after.ball
     });
    }
    if(enableEpisode&&second?.realDistinctSecondShoeStartObserved&&
       !episode?.terminal){
     const prior=episode;
     episode=observeSecondPhysicalShoeEpisode({
      previous:prior,secondContactEvidence:second,
      before,after,contactFrame:foot
     });
     if(!prior)startSource=Object.freeze({
      previous:prior,secondContactEvidence:second,
      before,after,contactFrame:foot
     });
     if(episode.realSecondShoeEndObserved)
      endSource=Object.freeze({
       previous:prior,secondContactEvidence:second,
       before,after,contactFrame:foot
      });
    }
   }
  }
  return Object.freeze({
   firstTick,firstId,clearTick:clear?.observedPhysicsTick??null,
   secondTick:second?.secondShoePhysicsTick??null,
   secondId:second?.secondShoeId??null,
   second,episode,startSource,endSource,
   physics:Object.freeze(physics),contacts:Object.freeze(contacts),
   previousSnapshots:Object.freeze(previousSnapshots)
  });
 }finally{engine.dispose();}
}
test('ME-PB-42 real Rapier second contact trajectory + genuine END, deterministic world and no attribution',()=>{
 const a=replay(ballCases.mirrored,approach);
 assert.equal(a.firstId,'away-10');
 assert.equal(a.firstTick,1);
 assert.equal(a.clearTick,26);
 assert.equal(a.secondTick,127);
 assert.equal(a.secondId,'home-10');
 assert.equal(a.episode?.version,SECOND_EPISODE_VERSION);
 assert.equal(a.episode?.contactStartPhysicsTick,127);
 assert.equal(a.episode?.firstShoeId,'away-10');
 assert.equal(a.episode?.secondShoeId,'home-10');
 assert.equal(a.episode?.status,'real-second-shoe-end',
  'only a physical Rapier END completes the second contact episode');
 assert.equal(a.episode?.realSecondShoeEndObserved,true);
 const end=a.episode.contactEndPhysicsTick;
 assert.ok(Number.isSafeInteger(end)&&end>127&&end<141,
  'the second shoe must END before the later genuine shoe recontact');
 assert.equal(a.episode.contactDurationTicks,end-127);
 assert.ok(a.episode.activeContactSampleTicks>=1);
 assert.ok(a.contacts.some(c=>c.tick===end&&c.ended.includes('home-10')));
 assert.ok(a.contacts.some(c=>c.tick===127&&c.started.includes('home-10')));
 assert.equal(a.episode.observedPhysicsTick,end);
 assert.ok(a.episode.accumulatedPlanarTravelM>0);
 assert.ok(a.episode.planarDisplacementFromStartM>=0);
 assert.ok(Number.isFinite(a.episode.groundSpeedChangeMps));
 assert.ok(Number.isFinite(a.episode.currentGroundSpeedMps));
 assert.ok(a.episode.observedHeadingDifferenceDeg===null||
  a.episode.observedHeadingDifferenceDeg>=0&&
   a.episode.observedHeadingDifferenceDeg<=180);
 assert.equal(a.episode.physicalCauseExclusivelyProven,false);
 for(const k of ['controlConfirmed','officialPossession','interceptionProven',
  'freeBallOfficiallyProven','passCreated','ballForceApplied'])
  assert.equal(a.episode[k],false);
 assert.deepEqual(a,replay(ballCases.mirrored,approach),
  'all full-world Rapier frames and evidence must replay identically');
 const independent=replay(ballCases.mirrored,exchange);
 assert.deepEqual(a.episode,independent.episode,
  'existing alternative approach matches identical physical episode');
 const noObserver=replay(ballCases.mirrored,approach,{enableEpisode:false});
 assert.deepEqual(a.physics,noObserver.physics,
  'observer must never write to Rapier ball');
 assert.deepEqual(a.contacts,noObserver.contacts,
  'observer must never create shoe START/END');
 const withoutFeet=replay(ballCases.mirrored,approach,{withFeet:false});
 assert.equal(withoutFeet.second,null);
 assert.equal(withoutFeet.episode,null);
 assert.equal(withoutFeet.contacts.length,0);
 assert.ok(Object.isFrozen(a.episode)&&Object.isFrozen(a.episode.lastBallVelocity));
 process.stdout.write('ME_PB_42_REAL_RAPIER_SECOND_EPISODE '+
  JSON.stringify({
   previousRealReleaseTick:a.clearTick,
   secondRealStartTick:a.secondTick,
   secondRealEndTick:end,
   durationTicks:a.episode.contactDurationTicks,
   activeContactSamples:a.episode.activeContactSampleTicks,
   observedStepDeltaVelocityMps:a.episode.startStepDeltaVelocityWorldMps,
   observedOverallBallDeltaVelocityMps:a.episode.netBallDeltaVelocityWorldMps,
   observedGroundSpeedChangeMps:a.episode.groundSpeedChangeMps,
   observedHeadingDifferenceDeg:a.episode.observedHeadingDifferenceDeg,
   observedPlanarPathM:a.episode.accumulatedPlanarTravelM,
   physicalCauseExclusivelyProven:false,officialPossession:false,
   identicalReplay:true,observerUnchangedPhysics:true
  })+'\n');
});
test('ME-PB-42 never creates an episode without a legitimate second-player START',()=>{
 const noSecond=replay(ballCases.noSecond,ordinary);
 assert.equal(noSecond.second?.secondShoeId??null,null);
 assert.equal(noSecond.episode,null);
 const contaminated=replay(ballCases.firstShoeRecontact,ordinary);
 assert.equal(contaminated.second?.status,
  'original-shoe-recontact-before-new-player');
 assert.equal(contaminated.episode,null,
  'later real opponent START cannot override earlier original-shoe recontact');
 const withoutFeet=replay(ballCases.mirrored,approach,{withFeet:false});
 assert.equal(withoutFeet.episode,null);
});
test('ME-PB-42 rejects forged START, previous-tick gap, impossible velocity and invalid foot END',()=>{
 const observed=replay(ballCases.mirrored,approach);
 const initial=observed.startSource,ending=observed.endSource;
 assert.ok(initial&&ending&&ending.previous);
 const forged=[
  {...initial,contactFrame:{...initial.contactFrame,started:[]}},
  {...initial,contactFrame:{...initial.contactFrame,active:[]}},
  {...initial,secondContactEvidence:{...initial.secondContactEvidence,
   officialPossession:true}},
  {...initial,secondContactEvidence:{...initial.secondContactEvidence,
   realDistinctSecondShoeStartObserved:false}},
  {...initial,after:{...initial.after,tick:126}},
  {...initial,before:{...initial.before,ball:{
   ...initial.before.ball,velocity:{x:NaN,y:0,z:0}}}},
  {...ending,previous:{...ending.previous,officialPossession:true}},
  {...ending,previous:{...ending.previous,observedPhysicsTick:124}},
  {...ending,contactFrame:{...ending.contactFrame,ended:[]}},
  {...ending,contactFrame:{...ending.contactFrame,
   started:['away-10'],active:[]}},
  {...ending,before:{...ending.before,tick:ending.before.tick-1}},
  {...ending,after:{...ending.after,ball:{
   ...ending.after.ball,position:{x:Infinity,y:0,z:0.1}}}}
 ];
 for(const value of forged)
  assert.throws(()=>observeSecondPhysicalShoeEpisode(value),
   /Consecutive actual Rapier/);
 assert.equal(observeSecondPhysicalShoeEpisode(initial).status,
  'active-second-shoe-contact');
 assert.deepEqual(observeSecondPhysicalShoeEpisode(ending),
  observed.episode);
 assert.throws(()=>observeSecondPhysicalShoeEpisode({
  ...ending,previous:observed.episode
 }),/Consecutive actual Rapier/,
 'completed physical contact cannot be advanced or counted twice');
 assert.equal(SECOND_EPISODE_MAX_TICKS,60);
});
test('ME-PB-42 only separate read-only DEV module; no official UI, route, or new impulse',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/preset-opt-ai-defend-episode/);
 assert.doesNotMatch(core,/observeSecondPhysicalShoeEpisode/);
});
