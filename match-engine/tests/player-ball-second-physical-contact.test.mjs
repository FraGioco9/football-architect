// ME-PB-41 — actual opponent shoe START after a same-world Rapier
// co-motion, real shoe END and three measured uncontested ball frames.
// No extra shoe motion, scripted contact, official possession or ball impulse.
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
import {observePostContactRelease} from '../src/player-ball-release-evidence.mjs';
import {observeSecondPhysicalShoeStart,SECOND_CONTACT_EVIDENCE_VERSION,
 SECOND_CONTACT_MAX_POST_CLEAR_TICKS}
 from '../src/player-ball-second-contact-evidence.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(rapierModule);
const cases=Object.freeze({
 mirrored:Object.freeze({name:'mirrored-ground-0.3',
  x:4.96,y:0,vx:-0.3,vy:0}),
 grazing:Object.freeze({name:'grazing-repeat-2.0',
  x:-5.25,y:-0.14,vx:2.0,vy:0.1}),
 stable:Object.freeze({name:'stable-ground-0.3',
  x:-4.96,y:0,vx:0.3,vy:0}),
 short:Object.freeze({name:'short-incoming-1.4',
  x:-5.18,y:0,vx:1.4,vy:0})
});
const modes=Object.freeze({
 normal:Object.freeze({}),
 approach:Object.freeze({experimentalAiKickApproach:true}),
 exchange:Object.freeze({experimentalAiExchangeApproach:true}),
 defense:Object.freeze({experimentalAiExchangeApproach:true,
  experimentalAiAutonomousDefense:true})
});
function physicalGate(contactTick,id,movementTick){
 const ticks=movementTick-contactTick+1;
 return Object.freeze({
  version:LOOSE_RESPONSE_VERSION,
  phase:ticks>=LOOSE_RESPONSE_MAX_TICKS?'completed':'responding',
  contactTick,precedingPassTick:contactTick-1,
  initiatedAtMovementTick:contactTick,lastMovementTick:movementTick,
  responseTicks:ticks,
  responders:Object.freeze({
   home:id.startsWith('home-')?id:'home-10',
   away:id.startsWith('away-')?id:'away-10'
  }),
  officialPossession:false,ballForceApplied:false,
  diagnosticObserverGateOnly:true
 });
}
function trial(config,mode,{steps=250,withFeet=true,observe=true}={}){
 const scenario={preset:'roll',seed:'me-pb-41-second-real',
  x:config.x,y:config.y,z:0,vx:config.vx,vy:config.vy,vz:0};
 // diagnosticLocalAiKickEnabled is never true: the "approach" flag
 // only uses ordinary bounded tactical movement, not an AI kick impulse.
 const engine=createEngine(Rapier,scenario,
  withFeet?{diagnosticPlayerFootContactsEnabled:true}:{});
 const mover=createPlayerMovement(mode);
 let originalTick=null,originalId=null,control=null,release=null;
 let clearWitness=null,second=null,sourceAtSecond=null,maxCoMotion=0;
 let endTick=null,clearTick=null;
 const physicalStarts=[],physicalEnds=[],physicsFrames=[],footFrames=[];
 try{
  for(let n=1;n<=steps;n++){
   const before=engine.snapshot();
   const contactBefore=engine.footContactSnapshot?.();
   const moversBefore=mover.snapshot();
   assert.equal(before.tick,n-1);
   if(observe&&originalTick!==null&&n>originalTick&&
      n<=originalTick+LOOSE_RESPONSE_MAX_TICKS-1){
    assert.equal(contactBefore.tick,n-1);
    control=observeLooseBallControlEvidence({
     previous:control,
     response:physicalGate(originalTick,originalId,n),
     contactFrame:contactBefore,
     players:moversBefore.players,ball:before.ball,movementTick:n
    });
    release=observePostContactRelease({
     previous:release,controlEvidence:control,
     contactFrame:contactBefore,players:moversBefore.players,
     ball:before.ball
    });
    maxCoMotion=Math.max(maxCoMotion,control.maximumConsecutiveTicks);
    if(endTick===null)endTick=release.shoeEndPhysicsTick;
    if(clearTick===null)clearTick=release.firstUncontestedPhysicsTick;
    if(!clearWitness&&release.firstUncontestedPhysicsTick===
      release.observedPhysicsTick&&release.currentlyMeasuredUncontested)
      clearWitness=release;
   }
   const motion=mover.step(before.ball.position);
   const after=withFeet?engine.step(motion):engine.step();
   const physicalContact=engine.footContactSnapshot?.();
   physicsFrames.push(canonicalSnapshot(after));
   if(physicalContact){
    assert.equal(physicalContact.tick,n);
    footFrames.push(Object.freeze({
     started:Object.freeze([...physicalContact.started]),
     ended:Object.freeze([...physicalContact.ended]),
     active:Object.freeze([...physicalContact.active])
    }));
    for(const id of physicalContact.started)
     physicalStarts.push(Object.freeze({tick:n,id}));
    for(const id of physicalContact.ended)
     physicalEnds.push(Object.freeze({tick:n,id}));
    if(originalTick===null){
     const source=physicalContact.started.find(id=>
      id==='home-10'||id==='away-10');
     if(source){originalTick=n;originalId=source;}
    }
    if(observe&&clearWitness&&
       n>clearWitness.observedPhysicsTick&&
       !second?.terminal){
     const previous=second;
     const next=observeSecondPhysicalShoeStart({
      previous,releaseEvidence:clearWitness,
      contactFrame:physicalContact,players:motion.players,
      ball:after.ball
     });
     if(next.realDistinctSecondShoeStartObserved)
      sourceAtSecond=Object.freeze({
       previous,releaseEvidence:clearWitness,
       contactFrame:physicalContact,players:motion.players,
       ball:after.ball
      });
     second=next;
    }
   }
  }
  return Object.freeze({
   name:config.name,originalTick,originalId,
   endTick,clearTick,maxCoMotion,clearWitness,second,sourceAtSecond,
   physicalStarts:Object.freeze(physicalStarts),
   physicalEnds:Object.freeze(physicalEnds),
   physicsFrames:Object.freeze(physicsFrames),
   footFrames:Object.freeze(footFrames)
  });
 }finally{engine.dispose();}
}
const outline=x=>({
 source:x.originalId,firstContact:x.originalTick,
 sustainedTicks:x.maxCoMotion,shoeEnd:x.endTick,
 measuredClear:x.clearTick,secondId:x.second?.secondShoeId??null,
 secondStart:x.second?.secondShoePhysicsTick??null,
 observerStatus:x.second?.status??'no-measured-clearance',
 physicalStarts:x.physicalStarts.slice(0,6)
});
test('ME-PB-41 REAL second different Rapier shoe START after uncontested clearance, replay, no forces',()=>{
 const primary=trial(cases.mirrored,modes.approach);
 const mirror=trial(cases.mirrored,modes.exchange);
 assert.equal(primary.originalId,'away-10');
 assert.equal(primary.originalTick,1);
 assert.equal(primary.endTick,19);
 assert.equal(primary.clearTick,26);
 assert.ok(primary.maxCoMotion>=6);
 assert.equal(primary.second?.version,SECOND_CONTACT_EVIDENCE_VERSION);
 assert.equal(primary.second?.secondShoeId,'home-10');
 assert.equal(primary.second?.secondShoePhysicsTick,127);
 assert.equal(primary.second?.status,'distinct-physical-shoe-start-observed');
 assert.equal(primary.second?.realDistinctSecondShoeStartObserved,true);
 assert.equal(primary.second?.noInterveningShoeStartObserved,true);
 assert.ok(primary.second?.ballShoeXYDistanceM<=0.85);
 assert.equal(primary.second?.releaseClearPhysicsTick,26);
 assert.equal(primary.second?.releaseEndPhysicsTick,19);
 assert.ok(primary.physicalEnds.some(x=>x.tick===19&&x.id==='away-10'));
 const between=primary.physicalStarts.filter(x=>
  x.tick>primary.clearTick&&x.tick<127);
 assert.deepEqual(between,[],
  'not even a return contact by the original shoe before new actor START');
 assert.ok(primary.physicalStarts.some(x=>x.tick===127&&x.id==='home-10'));
 assert.equal(primary.sourceAtSecond.contactFrame.active.includes('home-10'),true);
 assert.deepEqual(primary,trial(cases.mirrored,modes.approach),
  'complete real Rapier state, shoe events and immutable observer deterministic');
 assert.deepEqual(primary.second,mirror.second,
  'existing alternative movement intent gives the same real witness');
 const control=trial(cases.mirrored,modes.approach,{observe:false});
 assert.deepEqual(primary.physicsFrames,control.physicsFrames,
  'ME-PB-38/39/41 observers never alter the actual physics');
 assert.deepEqual(primary.footFrames,control.footFrames,
  'read-only observers never create or suppress Rapier contacts');
 const withoutFeet=trial(cases.mirrored,modes.approach,{withFeet:false});
 assert.deepEqual(withoutFeet.physicalStarts,[]);
 assert.deepEqual(withoutFeet.physicalEnds,[]);
 assert.equal(withoutFeet.second,null);
 for(const key of ['controlConfirmed','officialPossession','interceptionProven',
  'freeBallOfficiallyProven','passCreated','ballForceApplied'])
  assert.equal(primary.second[key],false);
 process.stdout.write('ME_PB_41_REAL_DISTINCT_SECOND_SHOE '+
  JSON.stringify({...outline(primary),unmodifiedPhysics:true,
   identicalReplay:true,noFootNegative:true,
   officialPossession:false,ballForceApplied:false})+'\n');
});
test('ME-PB-41 clean handoff rejects early original recontact, no second START and short touches',()=>{
 const casesOut={
  normal:trial(cases.mirrored,modes.normal),
  defense:trial(cases.mirrored,modes.defense),
  repeat:trial(cases.grazing,modes.normal),
  premature:trial(cases.grazing,modes.exchange),
  near:trial(cases.stable,modes.normal),
  short:trial(cases.short,modes.normal)
 };
 assert.equal(casesOut.normal.endTick,19);
 assert.equal(casesOut.normal.clearTick,26);
 assert.equal(casesOut.normal.second.status,'bounded-window-complete');
 assert.equal(casesOut.normal.second.secondShoeId,null);
 assert.equal(casesOut.defense.second.secondShoeId,null);
 assert.equal(casesOut.repeat.clearTick,71);
 assert.ok(casesOut.repeat.physicalStarts.some(x=>
  x.tick===167&&x.id==='home-10'));
 assert.ok(casesOut.repeat.physicalStarts.some(x=>
  x.tick===203&&x.id==='away-10'),
  'the opposite shoe really does touch later, but AFTER a first-shoe recontact');
 assert.equal(casesOut.repeat.second.status,
  'original-shoe-recontact-before-new-player');
 assert.equal(casesOut.repeat.second.realDistinctSecondShoeStartObserved,false);
 assert.equal(casesOut.repeat.second.secondShoeId,null);
 assert.equal(casesOut.premature.clearTick,null);
 assert.equal(casesOut.premature.second,null,
  'physical other-shoe touches before a qualified release never prove handoff');
 assert.equal(casesOut.near.second.secondShoeId,null);
 assert.equal(casesOut.short.clearTick,null);
 assert.equal(casesOut.short.second,null);
 process.stdout.write('ME_PB_41_NEGATIVE_PHYSICAL_HANDOFFS '+JSON.stringify(
  Object.fromEntries(Object.entries(casesOut).map(([name,r])=>[name,outline(r)]))
 )+'\n');
});
test('ME-PB-41 rejects stale forged source frames and impossible ball/roster identity atomically',()=>{
 const a=trial(cases.mirrored,modes.approach);
 const source=a.sourceAtSecond;
 assert.ok(source&&source.previous&&source.releaseEvidence);
 const examples=[
  {...source,contactFrame:{...source.contactFrame,tick:126}},
  {...source,contactFrame:{...source.contactFrame,started:['fake']}},
  {...source,contactFrame:{...source.contactFrame,started:[]}},
  {...source,contactFrame:{...source.contactFrame,active:[]}},
  {...source,contactFrame:{...source.contactFrame,started:['away-10']}},
  {...source,contactFrame:{...source.contactFrame,ended:['away-10']}},
  {...source,previous:{...source.previous,observedPhysicsTick:125}},
  {...source,previous:{...source.previous,officialPossession:true}},
  {...source,releaseEvidence:{...source.releaseEvidence,
   officialPossession:true}},
  {...source,releaseEvidence:{...source.releaseEvidence,
   firstUncontestedPhysicsTick:null}},
  {...source,players:source.players.slice(1)},
  {...source,players:source.players.map((p,i)=>i===0?{...p,vx:99}:p)},
  {...source,ball:{...source.ball,
   position:{...source.ball.position,x:Infinity}}}
 ];
 for(const fake of examples)
  assert.throws(()=>observeSecondPhysicalShoeStart(fake),
   /Consecutive real Rapier/);
 const ok=observeSecondPhysicalShoeStart(source);
 assert.deepEqual(ok,a.second,'validation never mutates the source');
 assert.ok(Object.isFrozen(ok)&&Object.isFrozen(ok.activeShoes));
 assert.equal(SECOND_CONTACT_MAX_POST_CLEAR_TICKS,180);
});
test('ME-PB-41 only isolated physical research; no LAB-15 or new button/route',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/preset-opt-ai-defend-second-contact/);
 assert.doesNotMatch(lab,/observedSecondShoeControl/);
});
