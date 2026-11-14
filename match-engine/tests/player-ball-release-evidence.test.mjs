// ME-PB-39: strict physical END evidence and bounded measured ball separation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION} from '../src/player-foot-contact.mjs';
import {observeLooseBallControlEvidence}
 from '../src/player-ball-control-evidence.mjs';
import {LOOSE_RESPONSE_VERSION,LOOSE_RESPONSE_MAX_TICKS}
 from '../src/player-ball-loose-response.mjs';
import {RELEASE_EVIDENCE_VERSION,RELEASE_CLEAR_TICKS,
 observePostContactRelease} from '../src/player-ball-release-evidence.mjs';
import {readFileSync} from 'node:fs';
const Rapier=await initializeRapier(RapierModule);
const players=INITIAL_PLAYERS.map(p=>Object.freeze({...p,
 x:p.id==='home-10'?0:p.x,y:p.id==='home-10'?0:p.y,
 vx:p.id==='home-10'?0.7:p.vx,vy:p.id==='home-10'?0:p.vy,
 facingRad:p.id==='home-10'?0:p.facingRad
}));
const responseAt=m=>Object.freeze({
 version:LOOSE_RESPONSE_VERSION,phase:m===289?'completed':'responding',
 contactTick:196,precedingPassTick:153,
 initiatedAtMovementTick:200,lastMovementTick:m,responseTicks:m-199,
 responders:Object.freeze({home:'home-10',away:'away-10'}),
 officialPossession:false,ballForceApplied:false
});
const ball=(x=0.22,vx=0.74,z=0.11)=>({
 position:{x,y:0,z},velocity:{x:vx,y:0,z:0}
});
const foot=(tick,active=['home-10'],started=[],ended=[])=>({
 version:FOOT_CONTACT_VERSION,tick,started,ended,active
});
function runSequence(frames){
 let control=null,release=null;
 const out=[];
 for(const {footFrame,measuredBall} of frames){
  const movementTick=footFrame.tick+1;
  control=observeLooseBallControlEvidence({
   previous:control,response:responseAt(movementTick),
   contactFrame:footFrame,players,ball:measuredBall,movementTick
  });
  release=observePostContactRelease({
   previous:release,controlEvidence:control,
   contactFrame:footFrame,players,ball:measuredBall
  });
  out.push(release);
 }
 return out;
}
const contactFrames=(n=6)=>Array.from({length:n},(_,i)=>({
 footFrame:foot(200+i,['home-10'],i===0?['home-10']:[],[]),
 measuredBall:ball()
}));
const endFrame=(tick,x=3,vx=5,z=0.11)=>({
 footFrame:foot(tick,[],[],['home-10']),
 measuredBall:ball(x,vx,z)
});
const freeFrame=(tick,x=3,vx=5,z=0.11)=>({
 footFrame:foot(tick,[],[],[]),measuredBall:ball(x,vx,z)
});
test('ME-PB-39 actual END and three measured clear frames, not game possession',()=>{
 const frames=[...contactFrames(),endFrame(206),freeFrame(207),freeFrame(208)];
 const out=runSequence(frames),last=out.at(-1);
 assert.equal(last.version,RELEASE_EVIDENCE_VERSION);
 assert.equal(out[5].lastSustainedShoeId,'home-10');
 assert.equal(out[5].trueShoeEndObserved,false);
 assert.equal(out[6].trueShoeEndObserved,true);
 assert.equal(out[6].shoeEndPhysicsTick,206);
 assert.equal(out[6].endedShoeId,'home-10');
 assert.equal(out[6].clearTicks,1);
 assert.equal(out[7].clearTicks,2);
 assert.equal(last.clearTicks,RELEASE_CLEAR_TICKS);
 assert.equal(last.firstUncontestedPhysicsTick,208);
 assert.equal(last.status,'measured-uncontested-ball');
 assert.equal(last.currentlyMeasuredUncontested,true);
 assert.equal(last.provisionalUncontestedObserved,true);
 assert.ok(Object.isFrozen(last)&&Object.isFrozen(last.activeShoes));
 assert.equal(last.officialPossession,false);
 assert.equal(last.freeBallOfficiallyProven,false);
 assert.equal(last.controlConfirmed,false);
 assert.equal(last.interceptionProven,false);
 assert.equal(last.ballForceApplied,false);
 assert.equal(last.passCreated,false);
 assert.deepEqual(runSequence(frames),out);
});
test('ME-PB-39 short contact, no END, rebound, airborne and ambiguous shoes cannot establish freedom',()=>{
 const short=runSequence([...contactFrames(2),endFrame(202),
  freeFrame(203),freeFrame(204),freeFrame(205)]);
 assert.equal(short.at(-1).lastSustainedShoeId,null);
 assert.equal(short.at(-1).trueShoeEndObserved,false);
 assert.equal(short.at(-1).firstUncontestedPhysicsTick,null);
 const noEnd=runSequence([...contactFrames(),{
  footFrame:foot(206,['home-10']),measuredBall:ball(3,5)
 }]);
 assert.equal(noEnd.at(-1).trueShoeEndObserved,false);
 assert.equal(noEnd.at(-1).currentlyMeasuredUncontested,false);
 const stopped=runSequence([...contactFrames(),endFrame(206,3,0),
  freeFrame(207,3,0),freeFrame(208,3,0)]);
 assert.equal(stopped.at(-1).firstUncontestedPhysicsTick,null);
 const near=runSequence([...contactFrames(),endFrame(206,0.22,5),
  freeFrame(207,0.22,5),freeFrame(208,0.22,5)]);
 assert.equal(near.at(-1).firstUncontestedPhysicsTick,null);
 const airborne=runSequence([...contactFrames(),endFrame(206,3,5,0.6),
  freeFrame(207,3,5,0.6),freeFrame(208,3,5,0.6)]);
 assert.equal(airborne.at(-1).firstUncontestedPhysicsTick,null);
 const incoming=runSequence([...contactFrames(),endFrame(206,3,-5),
  freeFrame(207,3,-5),freeFrame(208,3,-5)]);
 assert.equal(incoming.at(-1).firstUncontestedPhysicsTick,null);
 const ambiguous=runSequence([...contactFrames(),{
  footFrame:foot(206,['away-10'],['away-10'],['home-10']),
  measuredBall:ball(3,5)
 },{
  footFrame:foot(207,['away-10']),measuredBall:ball(3,5)
 }]);
 assert.equal(ambiguous.at(-1).clearTicks,0);
 assert.equal(ambiguous.at(-1).firstUncontestedPhysicsTick,null);
});
test('ME-PB-39 recontact revokes CURRENT measured clearance; prior observation remains historical',()=>{
 const frames=[...contactFrames(),endFrame(206),
  freeFrame(207),freeFrame(208),{
   footFrame:foot(209,['away-10'],['away-10'],[]),
   measuredBall:ball(3,5)
  },{
   footFrame:foot(210,[],[],['away-10']),measuredBall:ball(3,5)
  },freeFrame(211),freeFrame(212),freeFrame(213)];
 const out=runSequence(frames);
 assert.equal(out[8].firstUncontestedPhysicsTick,208);
 assert.equal(out[9].clearTicks,0);
 assert.equal(out[9].currentlyMeasuredUncontested,false);
 assert.equal(out[9].recontactAfterEndObserved,true);
 assert.equal(out.at(-1).clearTicks,3);
 assert.equal(out.at(-1).firstUncontestedPhysicsTick,208);
 assert.equal(out.at(-1).currentlyMeasuredUncontested,true);
 assert.equal(out.at(-1).freeBallOfficiallyProven,false);
});
test('ME-PB-39 invalid/stale/forged Rapier END and 22-player frames reject atomically',()=>{
 let control=null,release=null;
 for(const item of contactFrames()){
  const movementTick=item.footFrame.tick+1;
  control=observeLooseBallControlEvidence({
   previous:control,response:responseAt(movementTick),
   contactFrame:item.footFrame,players,ball:item.measuredBall,movementTick
  });
  release=observePostContactRelease({
   previous:release,controlEvidence:control,
   contactFrame:item.footFrame,players,ball:item.measuredBall
  });
 }
 const item=endFrame(206),movementTick=207;
 const nextControl=observeLooseBallControlEvidence({
  previous:control,response:responseAt(movementTick),
  contactFrame:item.footFrame,players,ball:item.measuredBall,movementTick
 });
 const sample={previous:release,controlEvidence:nextControl,
  contactFrame:item.footFrame,players,ball:item.measuredBall};
 const corrupt=[
  {...sample,contactFrame:foot(205,[],[],['home-10'])},
  {...sample,contactFrame:foot(206,[],[],[])},
  {...sample,contactFrame:foot(206,['away-10'],[],['home-10'])},
  {...sample,contactFrame:foot(206,[],[],['away-10'])},
  {...sample,contactFrame:foot(206,[],[],['fake'])},
  {...sample,contactFrame:foot(206,[],['away-10'],['home-10'])},
  {...sample,players:players.slice(1)},
  {...sample,players:players.map((p,i)=>i===1?{...p,vx:100}:p)},
  {...sample,ball:{...item.measuredBall,position:{x:NaN,y:0,z:0.11}}},
  {...sample,controlEvidence:{...nextControl,controlConfirmed:true}},
  {...sample,controlEvidence:{...nextControl,observedPhysicsTick:205}},
  {...sample,previous:{...release,officialPossession:true}},
  {...sample,previous:{...release,observedPhysicsTick:204}},
  {...sample,previous:{...release,samplesObserved:99}}
 ];
 for(const value of corrupt)
  assert.throws(()=>observePostContactRelease(value),
   /Consecutive genuine Rapier/);
 const ambiguous=observePostContactRelease({...sample,
  contactFrame:foot(206,[],['away-10'],['home-10','away-10'])
 });
 assert.equal(ambiguous.trueShoeEndObserved,true);
 assert.equal(ambiguous.clearTicks,0,
  'a physically valid same-tick second shoe START+END is not clearance');
 const ok=observePostContactRelease(sample);
 assert.equal(ok.shoeEndPhysicsTick,206);
 assert.equal(release.shoeEndPhysicsTick,null,'invalid samples never mutate');
});
test('ME-PB-39 90-tick expiration without shoe END never manufactures ball freedom',()=>{
 const frames=[];
 for(let n=0;n<LOOSE_RESPONSE_MAX_TICKS-1;n++){
  const tick=200+n;
  frames.push({
   footFrame:foot(tick,['home-10'],n===0?['home-10']:[],[]),
   measuredBall:ball()
  });
 }
 const last=runSequence(frames).at(-1);
 assert.equal(last.terminal,true);
 assert.equal(last.trueShoeEndObserved,false);
 assert.equal(last.firstUncontestedPhysicsTick,null);
 assert.equal(last.freeBallOfficiallyProven,false);
 assert.equal(last.status,'observation-window-complete');
 assert.throws(()=>observePostContactRelease({
  previous:last,controlEvidence:null,contactFrame:null,
  players,ball:ball()
 }),/Consecutive genuine Rapier/);
});
const scenario={preset:'roll',seed:'local-ai-exchange',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0};
const flags={diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiExchangeEnabled:true,
 diagnosticLocalAiAutonomousDefenseEnabled:true};
function replay(){
 const engine=createEngine(Rapier,scenario,flags);
 const move=createPlayerMovement({
  experimentalAiExchangeApproach:true,
  experimentalAiAutonomousDefense:true,
  experimentalAiMultiPassDefense:true
 });
 const frames=[];
 try{
  for(let i=0;i<320;i++){
   const before=engine.snapshot(),ex=engine.localAiExchangeSnapshot();
   const previousContact=engine.footContactSnapshot();
   const nextPlayers=move.step(before.ball.position,{
    velocity:before.ball.velocity,
    footContact:previousContact,
    passEvent:ex.events.filter(e=>e.stage==='pass'||
     e.stage==='return-pass').at(-1)??null,
    oppositionFlightAudit:ex.oppositionFlightAudit
   });
   const after=engine.step(nextPlayers);
   frames.push(Object.freeze({
    physics:canonicalSnapshot(after),physicsTick:after.tick,
    genuineEnded:Object.freeze([...previousContact.ended]),
    genuineActive:Object.freeze([...previousContact.active]),
    release:nextPlayers.observedReleaseEvidence
   }));
  }
  return Object.freeze(frames);
 }finally{engine.dispose();}
}
test('ME-PB-39 real 60Hz Rapier LAB-11 reports only observed END/clearance and replays exactly',()=>{
 const frames=replay(),copy=replay();
 assert.deepEqual(frames,copy,'actual Rapier and observer deterministic');
 const samples=frames.filter(f=>f.release);
 assert.ok(samples.length>0);
 const last=samples.at(-1).release;
 assert.equal(last.terminal,true);
 assert.equal(last.controlConfirmed,false);
 assert.equal(last.officialPossession,false);
 assert.equal(last.interceptionProven,false);
 assert.equal(last.freeBallOfficiallyProven,false);
 assert.equal(last.ballForceApplied,false);
 const end=frames.find(f=>f.release?.shoeEndPhysicsTick===
  f.physicsTick-1&&f.release?.trueShoeEndObserved);
 if(end)assert.ok(end.genuineEnded.includes(end.release.endedShoeId),
  'a release always needs an actual previous-step Rapier shoe END');
 for(const frame of frames){
  if(!frame.release)continue;
  if(frame.release.observedPhysicsTick===frame.physicsTick-1)
   assert.deepEqual(frame.release.activeShoes,frame.genuineActive);
 }
 process.stdout.write('ME_PB_39_REAL_RAPIER_RELEASE '+JSON.stringify({
  actualEndTick:last.shoeEndPhysicsTick,
  measuredUncontestedTick:last.firstUncontestedPhysicsTick,
  currentUncontested:last.currentlyMeasuredUncontested,
  maintainedContactIfNoEnd:!last.trueShoeEndObserved,
  officialPossession:false,freeBallOfficiallyProven:false,replay:true
 })+'\n');
});
test('ME-PB-39 uses existing LAB-11 row; no new scene/buttons/routes',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/preset-opt-ai-defend-release/);
 assert.match(lab,/observedReleaseEvidence/);
 assert.match(lab,/shoe release evidence:/);
});
