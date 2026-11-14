// ME-PB-09 — ONLY actual Rapier 60Hz collision events can prove a recontact.
// No scripted impulses/player paths, no fabricated repeat, no possession.
// A true same-player recontact requires a physical end THEN a new Rapier start.
// A sustained contact and a ground-only bounce must never be counted as one.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {FOOT_REPEAT_WINDOW_TICKS}
 from '../src/player-foot-contact-qualification.mjs';

const RAPIER=await initializeRapier(rapierModule);
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));
const asIds=rows=>rows.map(x=>x.id);
const round=n=>Math.round(n*1e5)/1e5;
const cases=Object.freeze([
 {name:'stationary-near-shoe',x:-4.78,y:0,vx:0,vy:0,ticks:130,restitution:0.12,target:'home-10'},
 {name:'slow-approach',x:-5.18,y:0,vx:0.8,vy:0,ticks:180,restitution:0.12,target:'home-10'},
 {name:'normal-approach',x:-6,y:0,vx:4,vy:0,ticks:200,restitution:0.12,target:'home-10'},
 {name:'fast-approach',x:-6,y:0,vx:16,vy:0,ticks:140,restitution:0.12,target:'home-10'},
 {name:'lateral-approach',x:-4.78,y:-0.55,vx:0,vy:3.5,ticks:160,restitution:0.12,target:'home-10'},
 {name:'stationary-firm-foot',x:-4.78,y:0,vx:0,vy:0,ticks:160,restitution:0.35,target:'home-10'},
 {name:'slow-firm-foot',x:-5.18,y:0,vx:0.8,vy:0,ticks:210,restitution:0.35,target:'home-10'},
 {name:'normal-firm-foot',x:-6,y:0,vx:4,vy:0,ticks:210,restitution:0.35,target:'home-10'},
 {name:'lateral-firm-foot',x:-4.78,y:-0.55,vx:0,vy:3.5,ticks:200,restitution:0.35,target:'home-10'},
 {name:'slow-soft-foot',x:-5.18,y:0,vx:0.8,vy:0,ticks:210,restitution:0,target:'home-10'},
 {name:'grazing-angle',x:-5.25,y:-0.14,vx:2,vy:0.1,ticks:200,restitution:0.12},
 {name:'near-shoe-low-roll',x:-4.96,y:0,vx:0.3,vy:0,ticks:210,restitution:0.12},
 {name:'mirrored-away-roll',x:6,y:0,vx:-4,vy:0,ticks:200,restitution:0.12,target:'away-10'},
 {name:'floor-only-bounce',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,ticks:140,restitution:0.12,negative:true},
 {name:'high-ball-no-contact',preset:'launch',x:-4.78,y:0,z:3,vx:0,vy:0,vz:0,ticks:35,restitution:0.12,negative:true},
 {name:'distant-stationary',x:0,y:0,vx:0,vy:0,ticks:100,restitution:0.12,negative:true}
].map(c=>Object.freeze(c)));

function play(config,optIn=true){
 const input={preset:config.preset??'roll',seed:'pb09-'+config.name,
  x:config.x,y:config.y,z:config.z??0,
  vx:config.vx,vy:config.vy,vz:config.vz??0};
 const engine=createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:optIn,
  ...(optIn?{diagnosticFootRestitution:config.restitution}:{})
 });
 const mover=optIn?createPlayerMovement():null;
 const trace=[],contact=[],qualified=[],solver=[];
 const startPerId=new Map(),lastEnd=new Map();
 let newSamePlayerContactAfterEnd=0,shortGapRepeat=0,longGapRecontact=0,
  sustainedSamples=0,groundBouncesWithoutFoot=0,planarReversalsAtOnset=0,
  activePairMax=0;
 const episodes=[],realRecontacts=[];
 try{
  if(!optIn)assert.equal(engine.footContactQualificationSnapshot,undefined);
  for(let tick=1;tick<=config.ticks;tick++){
   const before=engine.snapshot();
   const step=optIn?engine.step(mover.step(before.ball.position)):engine.step();
   trace.push(canonicalSnapshot(step));
   if(!optIn)continue;
   const events=engine.footContactSnapshot();
   const timeline=engine.footContactTimelineSnapshot();
   const label=engine.footContactQualificationSnapshot();
   const forces=engine.footContactSolverSnapshot();
   assert.equal(events.tick,tick);
   assert.equal(timeline.tick,tick);
   assert.equal(label.tick,tick);
   assert.equal(forces.tick,tick);
   assert.deepEqual(events.started,asIds(timeline.onsets));
   assert.deepEqual(events.ended,asIds(timeline.completed));
   assert.deepEqual(events.active,asIds(timeline.ongoing));
   assert.deepEqual(label.activeIds,events.active);
   assert.deepEqual(label.onsets.map(x=>x.id),events.started);
   assert.deepEqual(label.completions.map(x=>x.id),events.ended);
   assert.deepEqual(label.forceReportedIds,
    forces.pairs.filter(p=>p.rapierForceReported).map(p=>p.id));
   assert.equal(label.attribution,'unresolved');
   assert.equal(label.possessionInferred,false);
   assert.ok(Object.isFrozen(label));
   activePairMax=Math.max(activePairMax,events.active.length);
   // Track genuine previous Rapier EXIT, not the presence of consecutive
   // active ticks or a force spike within the SAME physical episode.
   for(const row of timeline.onsets){
    assert.ok(!startPerId.has(row.id),'a new start requires a prior end');
    const completedEndTick=lastEnd.get(row.id);
    const proof=label.onsets.find(x=>x.id===row.id);
    assert.ok(proof);
    if(completedEndTick===undefined){
     assert.equal(proof.occurrence,'isolated');
     assert.equal(proof.previousEndTick,null);
    }else{
     newSamePlayerContactAfterEnd++;
     const gap=tick-completedEndTick;
     assert.ok(gap>=1);
     const short=gap<=FOOT_REPEAT_WINDOW_TICKS;
     assert.equal(proof.occurrence,short?'repeat-within-window':'isolated');
     assert.equal(proof.previousEndTick,short?completedEndTick:null);
     if(short)shortGapRepeat++;else longGapRecontact++;
     realRecontacts.push(Object.freeze({
      id:row.id,atTick:tick,previousEndTick:completedEndTick,
      gapTicks:gap,shortWithinWindow:short
     }));
    }
    startPerId.set(row.id,tick);
    // Velocity sign reversal is just an A/B observation, not proof the
    // specific foot caused the reversal or that the ball was controlled.
    const incoming=before.ball.velocity,outgoing=step.ball.velocity;
    const planarDot=incoming.x*outgoing.x+incoming.y*outgoing.y;
    if(planarDot< -1e-5)planarReversalsAtOnset++;
   }
   for(const row of timeline.ongoing){
    assert.equal(startPerId.get(row.id),row.startTick);
    assert.equal(row.observedTicks,tick-row.startTick+1);
    if(row.observedTicks>1){
     sustainedSamples++;
     assert.ok(!events.started.includes(row.id),
      'continuously active Rapier pair is NOT a repeated onset');
    }
   }
   for(const row of timeline.completed){
    assert.equal(startPerId.get(row.id),row.startTick);
    assert.equal(row.durationTicks,tick-row.startTick);
    assert.ok(row.durationTicks>=0);
    episodes.push(Object.freeze({
     id:row.id,startTick:row.startTick,endTick:tick,
     durationTicks:row.durationTicks,kind:row.kind
    }));
    lastEnd.set(row.id,tick);startPerId.delete(row.id);
   }
   if(before.ball.velocity.z< -0.05&&step.ball.velocity.z>0.05&&
      events.started.length===0&&events.active.length===0&&
      forces.reportedForcePairs===0)groundBouncesWithoutFoot++;
   assert.deepEqual(label.ambiguityReasons.length>0,
    label.category==='multi-pair-ambiguous');
   contact.push(events);qualified.push(label);solver.push(forces);
  }
  return Object.freeze({
   trace:Object.freeze(trace),contact:Object.freeze(contact),
   qualified:Object.freeze(qualified),solver:Object.freeze(solver),
   episodes:Object.freeze(episodes),realRecontacts:Object.freeze(realRecontacts),
   metrics:Object.freeze({
    physicalOnsets:contact.reduce((n,s)=>n+s.started.length,0),
    physicalEnds:episodes.length,newSamePlayerContactAfterEnd,
    shortGapRepeat,longGapRecontact,sustainedSamples,groundBouncesWithoutFoot,
    planarReversalsAtOnset,activePairMax
   })
  });
 }finally{engine.dispose();}
}

for(const c of cases){
 test('ME-PB-09 real 60Hz '+c.name+': distinguish collision episode/recontact/floor bounce with exact replay',()=>{
  const one=play(c),again=play(c);
  assert.deepEqual(one.trace,again.trace);
  assert.deepEqual(one.contact,again.contact);
  assert.deepEqual(one.qualified,again.qualified);
  assert.deepEqual(one.solver,again.solver);
  assert.deepEqual(one.metrics,again.metrics);
  assert.deepEqual(one.realRecontacts,again.realRecontacts);
  assert.equal(one.metrics.newSamePlayerContactAfterEnd,
   one.metrics.shortGapRepeat+one.metrics.longGapRecontact);
  assert.equal(one.metrics.physicalEnds,one.episodes.length);
  if(c.negative){
   assert.equal(one.metrics.physicalOnsets,0,
    'no fabricated player contact from ground-only bounce or distant/high ball');
   assert.equal(one.metrics.shortGapRepeat,0);
   assert.ok(one.qualified.every(s=>s.category==='none'));
  }
  if(c.target){
   assert.ok(one.contact.some(s=>s.started.includes(c.target)),
    'real Rapier target onset must be verified: '+c.name);
  }
  if(c.name==='grazing-angle'){
   // POSITIVE real-world regression: Rapier itself produced new same-player
   // start/end episodes on this deterministic, autonomous 3D trajectory.
   // This must never be satisfied by uninterrupted solver-force samples.
   const physical=one.realRecontacts.filter(e=>e.id==='home-10');
   const close=physical.filter(e=>e.shortWithinWindow);
   const distant=physical.filter(e=>!e.shortWithinWindow);
   assert.ok(close.length>=2,
    'must observe TWO genuine same-player restarts within 12 ticks');
   assert.ok(distant.length>=1,
    'must also observe a genuine late restart beyond the repeat window');
   assert.ok(one.metrics.sustainedSamples>0,
    'consecutive active ticks must remain one collision episode');
   for(const e of close){
    const q=one.qualified[e.atTick-1];
    assert.equal(q.category,'repeated-event');
    const onset=q.onsets.find(x=>x.id===e.id);
    assert.ok(onset);
    assert.equal(onset.occurrence,'repeat-within-window');
    assert.equal(onset.previousEndTick,e.previousEndTick);
   }
   for(const e of distant){
    const q=one.qualified[e.atTick-1];
    assert.equal(q.onsets.find(x=>x.id===e.id)?.occurrence,'isolated');
   }
  }
  if(c.name==='near-shoe-low-roll'){
   assert.equal(one.metrics.physicalOnsets,1,
    'a sustained foot collision cannot create artificial repeated contacts');
   assert.equal(one.metrics.newSamePlayerContactAfterEnd,0);
   assert.ok(one.episodes[0].durationTicks>=10);
  }
  if(c.name==='floor-only-bounce'){
   assert.ok(one.metrics.groundBouncesWithoutFoot>=1,
    'actual Rapier turf bounce must reverse vertical velocity with no foot contact');
   assert.equal(one.metrics.physicalOnsets,0);
  }
  process.stdout.write('ME_PB_09_REAL '+JSON.stringify({
   scenario:c.name,
   restitution:c.restitution,
   ...one.metrics,
   recontacts:one.realRecontacts.slice(0,4),
   firstEpisode:one.episodes[0]??null,
   identicalReplay:true,
   attribution:'unresolved'
  })+'\n');
 });
}

test('ME-PB-09 normal Rapier world has no foot event or qualification observer',()=>{
 const c=cases.find(x=>x.name==='normal-approach');
 const original=play(c,false),again=play(c,false);
 assert.deepEqual(original.trace,again.trace);
 assert.equal(original.contact.length,0);
 assert.equal(original.qualified.length,0);
 assert.equal(original.metrics.physicalOnsets,0);
 assert.equal(original.metrics.shortGapRepeat,0);
});
