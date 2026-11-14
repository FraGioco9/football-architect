// ME-PB-40 — REAL Rapier contact co-motion, physical END and clearance research.
// Every collision event below is read directly from the same deterministic
// Rapier world. The diagnostic response record ONLY opens the read-only
// observer's test window once Rapier has genuinely reported a shoe START;
// it is not a football decision, pass, interception or new collision event.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT}
 from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION}
 from '../src/player-foot-contact.mjs';
import {LOOSE_RESPONSE_VERSION,LOOSE_RESPONSE_MAX_TICKS}
 from '../src/player-ball-loose-response.mjs';
import {CONTROL_EVIDENCE_MIN_TICKS,observeLooseBallControlEvidence}
 from '../src/player-ball-control-evidence.mjs';
import {RELEASE_CLEAR_TICKS,observePostContactRelease}
 from '../src/player-ball-release-evidence.mjs';

const Rapier=await initializeRapier(RapierModule);
const trialFlags=Object.freeze({diagnosticPlayerFootContactsEnabled:true});
const fixtures=Object.freeze([
 {name:'sustained-0.3',x:-4.96,y:0,vx:0.3,vy:0},
 {name:'sustained-0.6',x:-4.96,y:0,vx:0.6,vy:0},
 {name:'sustained-0.9',x:-4.96,y:0,vx:0.9,vy:0},
 {name:'incoming-0.8',x:-5.18,y:0,vx:0.8,vy:0},
 {name:'incoming-1.0',x:-5.18,y:0,vx:1.0,vy:0},
 {name:'incoming-1.4',x:-5.18,y:0,vx:1.4,vy:0},
 {name:'incoming-2.0',x:-5.18,y:0,vx:2.0,vy:0},
 {name:'contact-0.3',x:-4.88,y:0,vx:0.3,vy:0},
 {name:'contact-0.8',x:-4.88,y:0,vx:0.8,vy:0},
 {name:'contact-1.2',x:-4.88,y:0,vx:1.2,vy:0},
 {name:'grazing-1.0',x:-5.1,y:-0.1,vx:1.0,vy:0.1},
 {name:'grazing-2.0',x:-5.25,y:-0.14,vx:2.0,vy:0.1},
 {name:'lateral-1.0',x:-4.92,y:-0.15,vx:0.7,vy:0.4},
 {name:'lateral-1.8',x:-5.10,y:0.2,vx:1.8,vy:-0.2},
 {name:'mirrored-0.8',x:5.18,y:0,vx:-0.8,vy:0},
 {name:'mirrored-0.3',x:4.96,y:0,vx:-0.3,vy:0}
].map(c=>Object.freeze(c)));
const defaultSeed='me-pb-40-real-contact-release';
// The observer's test-only response gate is bound to a *real* Rapier shoe
// START and is never used to steer a movement or to invent a collision.
function physicalGate(startTick,id,movementTick){
 const responseTicks=movementTick-startTick+1;
 return Object.freeze({
  version:LOOSE_RESPONSE_VERSION,
  phase:responseTicks>=LOOSE_RESPONSE_MAX_TICKS?'completed':'responding',
  contactTick:startTick,
  precedingPassTick:startTick-1,
  initiatedAtMovementTick:startTick,
  lastMovementTick:movementTick,responseTicks,
  responders:Object.freeze({
   home:id.startsWith('home-')?id:'home-10',
   away:id.startsWith('away-')?id:'away-10'
  }),
  officialPossession:false,ballForceApplied:false,
  diagnosticObserverGateOnly:true
 });
}
const targetShoe=id=>['home-10','away-10'].includes(id);
function trial(config,{steps=155,withFeet=true}={}){
 const scenario={
  preset:'roll',seed:defaultSeed,
  x:config.x,y:config.y,z:0,vx:config.vx,vy:config.vy,vz:0
 };
 const engine=createEngine(Rapier,scenario,
  withFeet?trialFlags:{});
 const mover=createPlayerMovement();
 const traces=[],contactStarts=[],contactEnds=[];
 let gateTick=null,gateId=null;
 let coMotion=null,release=null;
 let maximumObservedStreak=0;
 let firstQualifiedEndTick=null,firstMeasuredClearTick=null;
 try{
  for(let n=1;n<=steps;n++){
   const physicsBefore=engine.snapshot();
   const footBefore=engine.footContactSnapshot?.();
   const movementBefore=mover.snapshot();
   assert.equal(physicsBefore.tick,n-1);
   assert.equal(movementBefore.tick,n-1);
   if(gateTick!==null&&n>gateTick&&
      n<=gateTick+LOOSE_RESPONSE_MAX_TICKS-1){
    assert.equal(footBefore.tick,n-1);
    const response=physicalGate(gateTick,gateId,n);
    coMotion=observeLooseBallControlEvidence({
     previous:coMotion,response,contactFrame:footBefore,
     players:movementBefore.players,
     ball:physicsBefore.ball,movementTick:n
    });
    release=observePostContactRelease({
     previous:release,controlEvidence:coMotion,
     contactFrame:footBefore,players:movementBefore.players,
     ball:physicsBefore.ball
    });
    maximumObservedStreak=Math.max(maximumObservedStreak,
     coMotion.maximumConsecutiveTicks);
    if(release.shoeEndPhysicsTick!==null&&
       firstQualifiedEndTick===null)
      firstQualifiedEndTick=release.shoeEndPhysicsTick;
    if(release.firstUncontestedPhysicsTick!==null&&
       firstMeasuredClearTick===null)
      firstMeasuredClearTick=release.firstUncontestedPhysicsTick;
    assert.equal(release.observedPhysicsTick,footBefore.tick);
    assert.deepEqual(release.activeShoes,footBefore.active);
    assert.equal(release.officialPossession,false);
    assert.equal(release.freeBallOfficiallyProven,false);
    assert.equal(release.ballForceApplied,false);
    assert.equal(release.controlConfirmed,false);
    assert.equal(release.interceptionProven,false);
    assert.equal(coMotion.officialPossession,false);
   }
   // The same ordinary ball-position-driven movement (22 canonical players)
   // is stepped regardless of the optional read-only observer.
   const frame=mover.step(physicsBefore.ball.position);
   assert.equal(frame.tick,n);
   assert.equal(frame.timeS,n*PLAYER_DT);
   const after=withFeet?engine.step(frame):engine.step();
   const contact=engine.footContactSnapshot?.();
   if(contact){
    assert.equal(contact.version,FOOT_CONTACT_VERSION);
    assert.equal(contact.tick,n);
    for(const id of contact.started)contactStarts.push(Object.freeze({id,tick:n}));
    for(const id of contact.ended)contactEnds.push(Object.freeze({id,tick:n}));
    if(gateTick===null){
     const selected=contact.started.find(targetShoe);
     if(selected!==undefined){
      gateTick=n;
      gateId=selected;
      assert.ok(contact.started.includes(gateId));
     }
    }
   }
   traces.push(Object.freeze({
    tick:n,physics:canonicalSnapshot(after),
    started:contact?Object.freeze([...contact.started]):null,
    ended:contact?Object.freeze([...contact.ended]):null,
    active:contact?Object.freeze([...contact.active]):null,
    sustained:coMotion?.sustainedCoMotionObserved??false,
    currentUncontested:release?.currentlyMeasuredUncontested??false,
    qualifiedEnd:firstQualifiedEndTick,
    confirmedClear:firstMeasuredClearTick
   }));
  }
  return Object.freeze({
   config:Object.freeze({...config}),hasFootBodies:withFeet,
   gateTick,gateId,
   contactStarts:Object.freeze(contactStarts),
   contactEnds:Object.freeze(contactEnds),
   maximumObservedStreak,firstQualifiedEndTick,
   firstMeasuredClearTick,
   finalResponse:release,
   canonicalTrace:Object.freeze(traces)
  });
 }finally{engine.dispose();}
}
const short=r=>({
 name:r.config.name,rapierStarts:r.contactStarts.length,
 rapierEnds:r.contactEnds.length,gate:r.gateTick,
 target:r.gateId,maximumCoMotion:r.maximumObservedStreak,
 qualifiedShoeEnd:r.firstQualifiedEndTick,
 measuredClear:r.firstMeasuredClearTick
});
test('ME-PB-40 actual Rapier shoe START and END are deterministic; no test creates collision events',()=>{
 const sustained=fixtures[0];
 const a=trial(sustained),b=trial(sustained);
 assert.deepEqual(a,b);
 assert.ok(a.gateTick!==null);
 assert.ok(a.contactStarts.some(e=>e.id===a.gateId&&e.tick===a.gateTick),
  'the experimental observer is activated only after an actual Rapier START');
 const genuine=a.contactEnds.filter(e=>e.id===a.gateId);
 assert.ok(genuine.length>0,
  'the pre-existing real sustained-shoe physical trial must generate a shoe END');
 assert.equal(a.finalResponse?.officialPossession,false);
 assert.equal(a.finalResponse?.freeBallOfficiallyProven,false);
 assert.ok(a.canonicalTrace.every(f=>f.tick>=1));
});
test('ME-PB-40 sample a bounded REAL 60Hz contact-release phase space and fail closed when no qualified witness exists',()=>{
 const reports=fixtures.map(c=>trial(c));
 const qualified=reports.filter(r=>r.firstQualifiedEndTick!==null);
 const cleared=reports.filter(r=>r.firstMeasuredClearTick!==null);
 const witnessed=reports.find(r=>r.firstQualifiedEndTick!==null&&
  r.firstMeasuredClearTick!==null);
 const evidence=reports.map(short);
 process.stdout.write('ME_PB_40_PHYSICAL_RELEASE_SEARCH '+
  JSON.stringify({trials:reports.length,results:evidence,
   qualifiedEndCount:qualified.length,measuredClearCount:cleared.length,
   witness:witnessed?short(witnessed):null,
   officialPossession:false,ballForceApplied:false})+'\n');
 assert.ok(qualified.length>0,
  'at least one REAL shoe END must follow >=6 actual qualifying co-motion frames');
 assert.ok(witnessed,
  'real 3-frame clearance still unobserved: do not simulate fake Rapier events');
 // All evidence must be from a real Rapier END, followed by actual measured
 // uncontested physics frames; the baseline world cannot emit shoe events.
 assert.ok(witnessed.contactEnds.some(e=>
  e.id===witnessed.gateId&&e.tick===witnessed.firstQualifiedEndTick));
 assert.ok(witnessed.firstMeasuredClearTick>=
  witnessed.firstQualifiedEndTick+RELEASE_CLEAR_TICKS-1);
 const twin=trial(witnessed.config);
 assert.deepEqual(twin,witnessed,'same physical world must replay identically');
 const baseline=trial(witnessed.config,{withFeet:false});
 assert.equal(baseline.contactStarts.length,0);
 assert.equal(baseline.contactEnds.length,0);
 assert.equal(baseline.firstQualifiedEndTick,null);
 assert.equal(baseline.firstMeasuredClearTick,null);
 assert.equal(baseline.finalResponse,null);
 assert.equal(witnessed.finalResponse?.officialPossession,false);
 assert.equal(witnessed.finalResponse?.freeBallOfficiallyProven,false);
});
