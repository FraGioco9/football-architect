// ME-PB-15 — real-physics falsification of naive foot-touch gates.
// Node/CI-only research; no controls, owner, kick command or game integration.
// Collision START, reported pair force, velocity response, and intentional
// touch are different concepts. This test does not infer the last one.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from '../src/player-movement.mjs';

const RAPIER=await initializeRapier(rapierModule);
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const canonical=arr=>ids.filter(id=>arr.includes(id));
const cases=Object.freeze([
 Object.freeze({name:'grazing-recontacts',x:-5.25,y:-0.14,
  vx:2,vy:0.1,ticks:200}),
 Object.freeze({name:'sustained-near-shoe',x:-4.96,y:0,
  vx:0.3,vy:0,ticks:210}),
 Object.freeze({name:'medium-positive',x:-6,y:0,vx:4,vy:0,ticks:180,
  target:'home-10'}),
 Object.freeze({name:'mirrored-away',x:6,y:0,vx:-4,vy:0,ticks:180,
  target:'away-10'}),
 Object.freeze({name:'turf-only',preset:'bounce',x:0,y:0,z:2,
  vx:0,vy:0,ticks:140,negative:true}),
 Object.freeze({name:'airborne',preset:'launch',x:-4.78,y:0,z:3,
  vx:0,vy:0,ticks:35,negative:true}),
 Object.freeze({name:'distant',x:0,y:0,vx:0,vy:0,
  ticks:100,negative:true})
]);
const noIntent=Object.freeze({
 attribution:'unresolved',intentInferred:false,
 confirmedTouch:false,possessionInferred:false
});
function simulate(config){
 const engine=createEngine(RAPIER,{
  preset:config.preset??'roll',seed:'pb15-'+config.name,
  x:config.x,y:config.y,z:config.z??0,
  vx:config.vx,vy:config.vy,vz:0
 },{diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement();
 const open=new Map(),lastCompleted=new Map();
 const trace=[],completed=[];
 let realStarts=0,realEnds=0,reportedPairSamples=0;
 let unforcedStarts=0,continuedForceSamples=0,realRecontacts=0;
 let forceOutsideKnownEpisode=0,shoeFreeTurfBounces=0;
 try{
  assert.equal(engine.footContactSnapshot().tick,0);
  for(let tick=1;tick<=config.ticks;tick++){
   const before=engine.snapshot();
   const movement=mover.step(before.ball.position);
   const after=engine.step(movement);
   const events=engine.footContactSnapshot();
   const solver=engine.footContactSolverSnapshot();
   const qualification=engine.footContactQualificationSnapshot();
   assert.equal(after.tick,tick);
   assert.equal(events.tick,tick);
   assert.equal(solver.tick,tick);
   assert.equal(qualification.tick,tick);
   assert.equal(qualification.attribution,'unresolved');
   assert.equal(qualification.possessionInferred,false);
   assert.deepEqual(events.started,canonical(events.started));
   assert.deepEqual(events.ended,canonical(events.ended));
   assert.deepEqual(events.active,canonical(events.active));
   assert.deepEqual(qualification.onsets.map(r=>r.id),events.started);
   assert.deepEqual(qualification.completions.map(r=>r.id),events.ended);
   const reports=new Map();
   const rawPairs=[];
   for(const pair of solver.pairs){
    assert.equal(pair.beganThisTick,events.started.includes(pair.id));
    assert.equal(pair.endedThisTick,events.ended.includes(pair.id));
    assert.equal(pair.collisionActive,events.active.includes(pair.id));
    const impulse=pair.derivedNetImpulseMagnitudeNs;
    if(pair.rapierForceReported){
     assert.ok(typeof impulse==='number'&&Number.isFinite(impulse)&&
      impulse>=0);
     assert.ok(pair.derivedNetImpulseWorldNs!==null);
     reports.set(pair.id,impulse);
     reportedPairSamples++;
    }else{
     assert.equal(impulse,null,'missing force evidence stays UNKNOWN');
     assert.equal(pair.derivedNetImpulseWorldNs,null);
    }
    rawPairs.push(Object.freeze({
     id:pair.id,forceReport:pair.rapierForceReported,
     reportedImpulseMagnitudeNs:impulse,
     began:pair.beganThisTick,active:pair.collisionActive,
     ended:pair.endedThisTick
    }));
   }
   assert.equal(reports.size,solver.reportedForcePairs);
   assert.deepEqual(qualification.forceReportedIds,canonical([...reports.keys()]));
   const repeatAtTick=[];
   for(const id of events.started){
    assert.equal(open.has(id),false,'new START requires completed prior END');
    const priorEnd=lastCompleted.get(id);
    if(priorEnd!==undefined){
     assert.ok(priorEnd<tick);
     realRecontacts++;
     repeatAtTick.push(Object.freeze({id,previousEndTick:priorEnd,
      gapTicks:tick-priorEnd}));
    }
    open.set(id,{startTick:tick,forceTicks:0,noForceTicks:0});
    realStarts++;
   }
   for(const id of reports.keys()){
    if(!open.has(id))forceOutsideKnownEpisode++;
    if(!events.started.includes(id))continuedForceSamples++;
   }
   // Force is sampled separately for each real open episode; a missing
   // sample is NOT asserted to be a true zero-impulse solver step.
   for(const [id,episode] of open){
    if(reports.has(id))episode.forceTicks++;
    else episode.noForceTicks++;
   }
   const startWithoutForce=events.started.filter(id=>!reports.has(id));
   unforcedStarts+=startWithoutForce.length;
   for(const id of events.ended){
    const episode=open.get(id);
    assert.ok(episode,'Rapier END requires an actual prior START');
    completed.push(Object.freeze({
     id,startTick:episode.startTick,endTick:tick,
     durationTicks:tick-episode.startTick,
     reportedForceTickCount:episode.forceTicks,
     missingForceReportTicks:episode.noForceTicks,
     reportedCoverageComplete:episode.noForceTicks===0,
     ...noIntent
    }));
    lastCompleted.set(id,tick);
    open.delete(id);
    realEnds++;
   }
   assert.deepEqual(events.active,canonical([...open.keys()]),
    'one Rapier START-to-END episode, not one per solver tick');
   if(before.ball.velocity.z< -0.05&&after.ball.velocity.z>0.05&&
     events.started.length===0&&events.active.length===0&&
     events.ended.length===0&&reports.size===0)
    shoeFreeTurfBounces++;
   trace.push(Object.freeze({
    tick,ball:canonicalSnapshot(after),
    started:Object.freeze([...events.started]),
    active:Object.freeze([...events.active]),
    ended:Object.freeze([...events.ended]),
    pairs:Object.freeze(rawPairs),
    startWithoutForce:Object.freeze(startWithoutForce),
    repeatedAfterRealEnd:Object.freeze(repeatAtTick),
    reportsWithoutNewStart:Object.freeze([...reports.keys()].filter(id=>
     !events.started.includes(id))),
    // These are reports of observed physical signals, never touch labels.
    ...noIntent
   }));
  }
  return Object.freeze({
   name:config.name,trace:Object.freeze(trace),
   completed:Object.freeze(completed),
   totals:Object.freeze({
    realStarts,realEnds,reportedPairSamples,unforcedStarts,
    continuedForceSamples,realRecontacts,forceOutsideKnownEpisode,
    shoeFreeTurfBounces
   }),
   ...noIntent
  });
 }finally{engine.dispose();}
}

test('ME-PB-15 default world has no foot evidence pipeline or ownership',()=>{
 const config={preset:'roll',seed:'pb15-default',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const a=createEngine(RAPIER,config),b=createEngine(RAPIER,config);
 try{
  assert.equal(a.footContactSnapshot,undefined);
  assert.equal(a.footContactSolverSnapshot,undefined);
  assert.equal(a.footContactQualificationSnapshot,undefined);
  for(let tick=1;tick<=60;tick++)
   assert.equal(canonicalSnapshot(a.step()),canonicalSnapshot(b.step()));
 }finally{a.dispose();b.dispose();}
});
for(const c of cases){
 test('ME-PB-15 evidence sufficiency real Rapier '+c.name,()=>{
  const a=simulate(c),b=simulate(c);
  assert.deepEqual(a,b,'real Rapier + autonomous player replay must match');
  assert.equal(a.confirmedTouch,false);
  assert.equal(a.possessionInferred,false);
  assert.equal(a.intentInferred,false);
  assert.equal(a.attribution,'unresolved');
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.trace)&&
   a.trace.every(e=>Object.isFrozen(e)&&Object.isFrozen(e.pairs)));
  assert.equal(a.totals.realStarts,
   a.trace.reduce((n,e)=>n+e.started.length,0));
  assert.equal(a.totals.reportedPairSamples,
   a.trace.reduce((n,e)=>n+e.pairs.filter(p=>p.forceReport).length,0));
  assert.equal(a.totals.realEnds,a.completed.length);
  for(const episode of a.completed){
   assert.equal(episode.confirmedTouch,false);
   assert.equal(episode.reportedForceTickCount+episode.missingForceReportTicks,
    episode.durationTicks+1);
   assert.equal(episode.reportedCoverageComplete,
    episode.missingForceReportTicks===0);
  }
  if(c.target){
   assert.ok(a.trace.some(e=>e.started.includes(c.target)));
   assert.ok(a.totals.reportedPairSamples>0);
  }
  if(c.name==='grazing-recontacts'){
   const tick32=a.trace[31];
   assert.ok(tick32.started.includes('home-10'),
    'real Rapier grazing restart must be recorded');
   assert.ok(tick32.startWithoutForce.includes('home-10'),
    'real Rapier restart at tick 32 MUST NOT fabricate pair impulse');
   const pair=tick32.pairs.find(p=>p.id==='home-10');
   assert.equal(pair?.forceReport,false);
   assert.equal(pair?.reportedImpulseMagnitudeNs,null);
   assert.ok(a.totals.realRecontacts>=3);
   assert.ok(a.totals.unforcedStarts>=1);
   assert.ok(a.trace.some(e=>e.repeatedAfterRealEnd.some(r=>
    r.id==='home-10'&&r.gapTicks<=12)));
   assert.ok(a.trace.some(e=>e.repeatedAfterRealEnd.some(r=>
    r.id==='home-10'&&r.gapTicks>12)));
  }
  if(c.name==='sustained-near-shoe'){
   assert.equal(a.totals.realStarts,1,
    'one sustained episode must not multiply into fake new touches');
   assert.equal(a.totals.realRecontacts,0);
   assert.ok(a.completed.some(e=>e.durationTicks>=10));
   assert.ok(a.totals.continuedForceSamples>0,
    'real continuing solver-force samples must be distinguished from START');
  }
  if(c.negative){
   assert.equal(a.totals.realStarts,0);
   assert.equal(a.totals.realEnds,0);
   assert.equal(a.totals.reportedPairSamples,0);
   assert.equal(a.totals.unforcedStarts,0);
   assert.equal(a.totals.realRecontacts,0);
   assert.equal(a.totals.forceOutsideKnownEpisode,0);
   assert.ok(a.trace.every(e=>e.started.length===0&&
    e.active.length===0&&e.ended.length===0));
  }
  if(c.name==='turf-only')
   assert.ok(a.totals.shoeFreeTurfBounces>=1);
  process.stdout.write('ME_PB_15_GATE '+JSON.stringify({
   scenario:c.name,...a.totals,
   unforcedStartTicks:a.trace.filter(x=>x.startWithoutForce.length)
    .map(x=>x.tick).slice(0,8),
   longestEpisodeTicks:a.completed.reduce((n,e)=>Math.max(n,e.durationTicks),0),
   confirmedTouch:false,playerIntentObserved:false,
   possessionInferred:false,identicalReplay:true
  })+'\n');
 });
}
