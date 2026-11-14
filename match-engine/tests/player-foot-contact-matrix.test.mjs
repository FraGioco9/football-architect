// ME-PB-04 — isolated real-Rapier approach-speed and direction matrix.
// CI evidence only: never a touch classifier, a kick command or an ownership test.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT}
 from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION}
 from '../src/player-foot-contact.mjs';

const RAPIER=await initializeRapier(rapierModule);
const known=new Set(INITIAL_PLAYERS.map(p=>p.id));
const fmt=n=>Math.round(n*10000)/10000;
// Each case has a real ball moving toward the physical shoe proxy, except
// "rest" which is initially next to the shoe and is acted on only by Rapier.
// Values are laboratory scenarios, NOT calibrated football impact benchmarks.
const cases=Object.freeze([
 Object.freeze({name:'stationary',initial:{x:-4.78,y:0,vx:0,vy:0},ticks:36}),
 Object.freeze({name:'slow',initial:{x:-5.18,y:0,vx:0.8,vy:0},ticks:105}),
 Object.freeze({name:'medium',initial:{x:-6,y:0,vx:4,vy:0},ticks:100}),
 Object.freeze({name:'fast',initial:{x:-6,y:0,vx:16,vy:0},ticks:75}),
 Object.freeze({name:'lateral',initial:{x:-4.78,y:-0.55,vx:0,vy:3.5},ticks:75})
]);
const scenario=(name,input)=>Object.freeze({
 preset:'roll',seed:'pb04-'+name,x:input.x,y:input.y,
 z:0,vx:input.vx,vy:input.vy,vz:0
});
function simulate(input,ticks,enableFoot){
 const engine=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:enableFoot});
 const player=enableFoot?createPlayerMovement():null;
 const traces=[],events=[],timeline=[],solver=[],momentum=[],qualification=[];
 let last=null;
 try{
  assert.equal(engine.snapshot().tick,0);
  if(enableFoot){
   const first=engine.footContactSnapshot();
   assert.deepEqual(first.started,[]);
   assert.deepEqual(first.active,[]);
   assert.equal(first.tick,0);
  }else assert.equal(engine.footContactSnapshot,undefined);
  for(let tick=1;tick<=ticks;tick++){
   const current=engine.snapshot();
   const frame=enableFoot?player.step(current.ball.position):null;
   last=enableFoot?engine.step(frame):engine.step();
   assert.equal(last.tick,tick);
   assert.equal(last.time,tick*FIXED_DT);
   traces.push(canonicalSnapshot(last));
   for(const value of [
    ...Object.values(last.ball.position),...Object.values(last.ball.velocity)
   ])assert.ok(Number.isFinite(value),'non-finite Rapier ball at tick '+tick);
   if(enableFoot){
    assert.equal(frame.tick,tick);
    assert.equal(frame.timeS,tick*PLAYER_DT);
    assert.equal(frame.players.length,22);
    const contact=engine.footContactSnapshot();
    assert.equal(contact.version,FOOT_CONTACT_VERSION);
    assert.equal(contact.tick,tick);
    assert.ok(Object.isFrozen(contact));
    for(const key of ['started','ended','active']){
     assert.ok(Object.isFrozen(contact[key]));
     for(const id of contact[key])assert.ok(known.has(id));
     assert.deepEqual(contact[key],
      INITIAL_PLAYERS.filter(p=>contact[key].includes(p.id)).map(p=>p.id));
    }
    assert.equal(contact.started.length>0,
      contact.onsetBallDeltaVelocityMps!==null);
    if(contact.onsetBallDeltaVelocityMps!==null){
     assert.ok(Number.isFinite(contact.onsetBallDeltaVelocityMps));
     assert.ok(contact.onsetBallDeltaVelocityMps>=0);
    }
    assert.equal(Object.hasOwn(contact,'possessor'),false);
    assert.equal(Object.hasOwn(contact,'kickStrength'),false);
    assert.equal(Object.hasOwn(contact,'owner'),false);
    const evidence=engine.footContactTimelineSnapshot();
    assert.equal(evidence.tick,tick);
    assert.deepEqual(evidence.onsets.map(x=>x.id),contact.started);
    assert.deepEqual(evidence.completed.map(x=>x.id),contact.ended);
    assert.deepEqual(evidence.ongoing.map(x=>x.id),contact.active);
    assert.ok(Object.isFrozen(evidence));
    timeline.push(evidence);
    const forceSample=engine.footContactSolverSnapshot();
    assert.equal(forceSample.tick,tick);
    assert.ok(Object.isFrozen(forceSample));
    assert.equal(forceSample.reportedForcePairs,forceSample.pairs.filter(x=>x.rapierForceReported).length);
    solver.push(forceSample);
    const audited=engine.footContactMomentumAuditSnapshot();
    assert.equal(audited.tick,tick);
    assert.equal(audited.reportedFootPairCount,forceSample.reportedForcePairs);
    assert.equal(audited.attribution,'unresolved');
    assert.equal(audited.exclusiveFootMomentumTransferProven,false);
    momentum.push(audited);
    const classified=engine.footContactQualificationSnapshot();
    assert.equal(classified.tick,tick);
    assert.equal(classified.attribution,'unresolved');
    assert.equal(classified.possessionInferred,false);
    assert.deepEqual(classified.activeIds,evidence.ongoing.map(x=>x.id));
    assert.deepEqual(classified.forceReportedIds,forceSample.pairs.filter(x=>x.rapierForceReported).map(x=>x.id));
    assert.ok(Object.isFrozen(classified));
    qualification.push(classified);
    events.push(contact);
   }
  }
  assert.equal(traces.length,ticks);
  return Object.freeze({
   trace:Object.freeze(traces),events:Object.freeze(events),
   timeline:Object.freeze(timeline),solver:Object.freeze(solver),
   momentum:Object.freeze(momentum),qualification:Object.freeze(qualification),
   final:last,initial:input
  });
 }finally{engine.dispose();}
}
const onsets=report=>report.events.flatMap(e=>e.started.map(id=>
 Object.freeze({id,tick:e.tick,ballDeltaV:e.onsetBallDeltaVelocityMps})));
const ballSeparation=(a,b)=>Math.hypot(
 a.final.ball.position.x-b.final.ball.position.x,
 a.final.ball.position.y-b.final.ball.position.y,
 a.final.ball.position.z-b.final.ball.position.z
);

for(const config of cases){
 test('ME-PB-04 '+config.name+' real 60Hz ball/foot impact matrix + exact replay',()=>{
  const input=scenario(config.name,config.initial);
  const without=simulate(input,config.ticks,false);
  const first=simulate(input,config.ticks,true);
  const replay=simulate(input,config.ticks,true);
  assert.deepEqual(first.trace,replay.trace,
   config.name+' must reproduce canonical Rapier ball state every tick');
  assert.deepEqual(first.events,replay.events,
   config.name+' must reproduce the actual collider event stream every tick');
  assert.deepEqual(first.timeline,replay.timeline,
   config.name+' must reproduce measured direction and contact durations');
  assert.deepEqual(first.solver,replay.solver,
   config.name+' must reproduce REAL solver pair forces and normals at each tick');
  assert.deepEqual(first.momentum,replay.momentum,
   config.name+' must reproduce independent measured ball momentum and Rapier-pair impulses');
  assert.deepEqual(first.qualification,replay.qualification,
   config.name+' must reproduce only evidence-backed contact classifications');
  const hits=onsets(first);
  assert.ok(hits.some(e=>e.id==='home-10'),
   config.name+' must include physical Home #10 onset; got '+JSON.stringify(hits));
  const firstHit=hits.find(e=>e.id==='home-10');
  assert.ok(firstHit.tick>=1&&firstHit.tick<=config.ticks);
  assert.ok(firstHit.ballDeltaV!==null&&firstHit.ballDeltaV>=0);
  const firstEvidence=first.timeline[firstHit.tick-1].onsets.find(e=>e.id==='home-10');
  assert.ok(firstEvidence&&Number.isFinite(firstEvidence.relativeSpeedMps));
  const completed=first.timeline.flatMap(e=>e.completed);
  assert.ok(completed.every(e=>e.durationTicks>=0&&e.durationS>=0));
  const separation=ballSeparation(first,without);
  assert.ok(separation>0.001,
   config.name+' colliders must change REAL Rapier trajectory, not proximity labels');
  assert.equal(first.final.tick,config.ticks);
  assert.equal(without.events.length,0);
  process.stdout.write('ME_PB_04_SCENARIO '+JSON.stringify({
   name:config.name,initialSpeedMps:fmt(Math.hypot(input.vx,input.vy)),
   firstHome10ContactTick:firstHit.tick,
   firstHome10ContactTimeS:fmt(firstHit.tick*FIXED_DT),
   onsetTotalBallDeltaVMps:fmt(firstHit.ballDeltaV),
   ballPositionDifferenceVsPhysicsOnlyM:fmt(separation),
   distinctRealContactIds:[...new Set(hits.map(e=>e.id))].length,
   firstContactClosingSpeedMps:firstEvidence.closingSpeedMps===null?null:
     fmt(firstEvidence.closingSpeedMps),
   completedEpisodes:completed.length,
   maximumOngoingContactCount:Math.max(...first.timeline.map(e=>e.ongoing.length)),
   identicalReplay:true
  })+'\n');
 });
}

test('ME-PB-04 Home/Away opposing directions use mirrored autonomous feet and actual Rapier contacts',()=>{
 for(const config of [
  {name:'slow',x:5.18,y:0,vx:-0.8,vy:0,ticks:105},
  {name:'medium',x:6,y:0,vx:-4,vy:0,ticks:100},
  {name:'lateral',x:4.78,y:-0.55,vx:0,vy:3.5,ticks:75}
 ]){
  const away=simulate(scenario('away-'+config.name,config),config.ticks,true);
  const hits=onsets(away);
  assert.ok(hits.some(e=>e.id==='away-10'),
   config.name+' must collide with the mirrored Away #10 shoe: '+JSON.stringify(hits));
  const copy=simulate(scenario('away-'+config.name,config),config.ticks,true);
  assert.deepEqual(away.trace,copy.trace);
  assert.deepEqual(away.events,copy.events);
  assert.deepEqual(away.timeline,copy.timeline);
  assert.deepEqual(away.solver,copy.solver);
  assert.deepEqual(away.momentum,copy.momentum);
  assert.deepEqual(away.qualification,copy.qualification);
 }
});

test('ME-PB-04 high flight over shoe and far-away resting ball do not fabricate contacts',()=>{
 const high={preset:'launch',seed:'pb04-air-negative',
  x:-4.78,y:0,z:3,vx:0,vy:0,vz:0};
 const airborne=simulate(high,30,true);
 assert.deepEqual(onsets(airborne),[]);
 assert.ok(airborne.timeline.every(e=>!e.simultaneous&&e.ongoing.length===0));
 assert.ok(airborne.solver.every(e=>e.reportedForcePairs===0));
 assert.ok(airborne.momentum.every(e=>e.reportedFootPairCount===0));
 assert.ok(airborne.qualification.every(e=>e.category==='none'));
 assert.ok(airborne.final.ball.position.z>0.7);
 const far=scenario('no-contact',{x:0,y:0,vx:0,vy:0});
 const untouched=simulate(far,60,true);
 assert.deepEqual(onsets(untouched),[]);
 assert.ok(untouched.timeline.every(e=>e.onsets.length===0));
 assert.ok(untouched.solver.every(e=>e.reportedForcePairs===0));
 assert.ok(untouched.momentum.every(e=>e.reportedFootPairCount===0));
 assert.ok(untouched.qualification.every(e=>e.category==='none'));
 assert.ok(untouched.events.every(e=>e.active.length===0));
});
