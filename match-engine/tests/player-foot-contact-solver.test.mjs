// ME-PB-06: pair-wise Rapier contact force evidence and manifold normals.
// All asserted forces below are *solver event values*, never inferred from ball Δv.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {FIXED_DT,createEngine,canonicalSnapshot,initializeRapier}
 from '../src/core.mjs';
import {createPlayerMovement,PLAYER_DT} from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION} from '../src/player-foot-contact.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION,summarizeFootSolverEvidence}
 from '../src/player-foot-contact-solver.mjs';

const collision=(tick=1,active=['home-10'],started=active,ended=[])=>({
 version:FOOT_CONTACT_VERSION,tick,active,started,ended
});
const row=(id='home-10')=>({
 id,totalForceWorldN:{x:12,y:-5,z:0},
 totalForceMagnitudeN:15,maxContactForceMagnitudeN:14,
 maxContactForceDirectionWorld:{x:1,y:0,z:0}
});
const manifold=(id='home-10',normalWorld={x:1,y:0,z:0})=>({
 id,normalWorld,flipped:false,geometricContacts:2,solverContacts:1
});

test('ME-PB-06 immutable pair event force converts exactly one 60Hz tick into N·s, distinct from Δv',()=>{
 const ev=summarizeFootSolverEvidence(collision(),[row()],[manifold()]);
 assert.equal(ev.version,FOOT_SOLVER_EVIDENCE_VERSION);
 assert.equal(ev.tick,1);
 assert.equal(ev.reportedForcePairs,1);
 assert.equal(ev.simultaneousSolverPairs,false);
 assert.equal(ev.pairs.length,1);
 const p=ev.pairs[0];
 assert.equal(p.id,'home-10');
 assert.equal(p.collisionActive,true);
 assert.equal(p.beganThisTick,true);
 assert.equal(p.rapierForceReported,true);
 assert.deepEqual(p.totalForceWorldN,{x:12,y:-5,z:0});
 assert.equal(p.totalForceMagnitudeN,15);
 assert.equal(p.derivedNetImpulseWorldNs.x,12*PLAYER_DT);
 assert.equal(p.derivedNetImpulseWorldNs.y,-5*PLAYER_DT);
 assert.equal(p.derivedNetImpulseMagnitudeNs,13*FIXED_DT);
 assert.equal(p.derivedSumOfForceMagnitudesNs,15*FIXED_DT);
 assert.ok(p.derivedSumOfForceMagnitudesNs>p.derivedNetImpulseMagnitudeNs);
 assert.deepEqual(p.manifolds,[{normalWorld:{x:1,y:0,z:0},flipped:false,
  geometricContacts:2,solverContacts:1}]);
 assert.equal(Object.hasOwn(p,'possessor'),false);
 assert.equal(Object.hasOwn(p,'ballKickForce'),false);
 assert.equal(Object.hasOwn(p,'onsetBallDeltaVelocityMps'),false);
 assert.ok(Object.isFrozen(ev)&&Object.isFrozen(ev.pairs)&&
  Object.isFrozen(p)&&Object.isFrozen(p.manifolds)&&
  Object.isFrozen(p.manifolds[0])&&Object.isFrozen(p.totalForceWorldN));
});

test('ME-PB-06 collision without solver force reports NULL impulse, never a guessed zero',()=>{
 const empty=summarizeFootSolverEvidence(collision(1,[],[],[]),[],[]);
 assert.deepEqual(empty.pairs,[]);
 assert.equal(empty.reportedForcePairs,0);
 const contact=summarizeFootSolverEvidence(collision(),[],[manifold()]);
 assert.equal(contact.pairs.length,1);
 assert.equal(contact.pairs[0].rapierForceReported,false);
 assert.equal(contact.pairs[0].totalForceWorldN,null);
 assert.equal(contact.pairs[0].derivedNetImpulseWorldNs,null);
 assert.equal(contact.pairs[0].derivedNetImpulseMagnitudeNs,null);
 assert.equal(contact.pairs[0].manifolds.length,1);
 const ended=summarizeFootSolverEvidence(collision(2,[],[],['home-10']),[],[]);
 assert.equal(ended.pairs[0].endedThisTick,true);
 assert.equal(ended.pairs[0].rapierForceReported,false);
});

test('ME-PB-06 independent simultaneous Home/Away pairs remain ambiguous; force reports deterministic canonical',()=>{
 const c=collision(7,['home-10','away-10'],['home-10','away-10']);
 const f=[row('away-10'),row('home-10')]; // intentionally reversed input order
 const m=[manifold('away-10',{x:-1,y:0,z:0}),manifold('home-10')];
 const ev=summarizeFootSolverEvidence(c,f,m);
 assert.equal(ev.simultaneousSolverPairs,true);
 assert.deepEqual(ev.pairs.map(x=>x.id),['home-10','away-10']);
 assert.equal(ev.reportedForcePairs,2);
 assert.ok(ev.pairs.every(p=>p.rapierForceReported&&p.beganThisTick));
 assert.equal(Object.hasOwn(ev,'owner'),false);
 assert.equal(Object.hasOwn(ev,'possessor'),false);
 assert.equal(Object.hasOwn(ev,'touch'),false);
});

test('ME-PB-06 impossible/duplicate/nonfinite pair reports and nonunit normals rejected',()=>{
 const c=collision(),f=[row()],m=[manifold()];
 for(const invalid of [
  {...row(),id:'invented'}, {...row(),totalForceWorldN:{x:NaN,y:0,z:0}},
  {...row(),totalForceWorldN:{x:100,y:0,z:0}},
  {...row(),totalForceMagnitudeN:-1},
  {...row(),totalForceMagnitudeN:5},
  {...row(),maxContactForceMagnitudeN:16},
  {...row(),maxContactForceDirectionWorld:{x:0.4,y:0,z:0}}
 ])assert.throws(()=>summarizeFootSolverEvidence(c,[invalid],m));
 assert.throws(()=>summarizeFootSolverEvidence(c,[...f,...f],m),/Unique/);
 assert.throws(()=>summarizeFootSolverEvidence(c,f,[{...manifold(),normalWorld:{x:0,y:0,z:0}}]),/Unit/);
 assert.throws(()=>summarizeFootSolverEvidence(c,f,[{...manifold(),normalWorld:{x:Infinity,y:0,z:0}}]),/Finite/);
 assert.throws(()=>summarizeFootSolverEvidence(c,f,[{...manifold(),solverContacts:-1}]),/canonical/i);
 assert.throws(()=>summarizeFootSolverEvidence(c,f,[{...manifold(),flipped:1}]),/canonical/i);
 assert.throws(()=>summarizeFootSolverEvidence({...c,tick:1.5},f,m),/60Hz/);
 assert.throws(()=>summarizeFootSolverEvidence({...c,active:['home-10','home-10']},f,m),/ordered/);
 assert.throws(()=>summarizeFootSolverEvidence(c,[],null),/arrays/);
 // Accept f32-scale numeric aggregation differences, NOT force contradictions.
 const rounded={...row(),totalForceWorldN:{x:15.0001,y:0,z:0}};
 const evidence=summarizeFootSolverEvidence(c,[rounded],m);
 assert.equal(evidence.pairs[0].totalForceMagnitudeN,15);
 assert.ok(evidence.pairs[0].derivedNetImpulseMagnitudeNs>15*PLAYER_DT);
 assert.throws(()=>summarizeFootSolverEvidence(c,[{
  ...rounded,totalForceWorldN:{x:15.1,y:0,z:0}
 }],m),/Consistent/);
});

const RAPIER=await initializeRapier(rapierModule);
function run(input,ticks,experimental){
 const e=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:experimental});
 const mover=experimental?createPlayerMovement():null;
 const trace=[],events=[],solver=[],timeline=[];
 try{
  assert.equal(e.footContactSolverSnapshot===undefined,!experimental);
  if(experimental){
   assert.deepEqual(e.footContactSolverSnapshot(),{
    version:FOOT_SOLVER_EVIDENCE_VERSION,tick:0,pairs:[],
    reportedForcePairs:0,simultaneousSolverPairs:false
   });
  }
  for(let tick=1;tick<=ticks;tick++){
   const ballBefore=e.snapshot();
   const frame=experimental?mover.step(ballBefore.ball.position):null;
   const result=experimental?e.step(frame):e.step();
   trace.push(canonicalSnapshot(result));
   if(experimental){
    const hit=e.footContactSnapshot();
    const evidence=e.footContactSolverSnapshot();
    const episode=e.footContactTimelineSnapshot();
    assert.equal(evidence.tick,tick);
    assert.equal(evidence.version,FOOT_SOLVER_EVIDENCE_VERSION);
    assert.equal(episode.tick,tick);
    assert.ok(Object.isFrozen(evidence)&&Object.isFrozen(evidence.pairs));
    assert.equal(evidence.reportedForcePairs,
      evidence.pairs.filter(x=>x.rapierForceReported).length);
    assert.equal(evidence.simultaneousSolverPairs,evidence.reportedForcePairs>=2);
    for(const pair of evidence.pairs){
     assert.ok(Object.isFrozen(pair));
     assert.equal(pair.collisionActive,hit.active.includes(pair.id));
     assert.equal(pair.beganThisTick,hit.started.includes(pair.id));
     assert.equal(pair.endedThisTick,hit.ended.includes(pair.id));
     if(pair.rapierForceReported){
      assert.ok(pair.totalForceMagnitudeN>=0);
      assert.ok(Number.isFinite(pair.derivedNetImpulseMagnitudeNs));
      assert.ok(pair.derivedNetImpulseMagnitudeNs>=0);
      assert.ok(pair.derivedSumOfForceMagnitudesNs>=0);
     }else{
      assert.equal(pair.derivedNetImpulseMagnitudeNs,null);
      assert.equal(pair.totalForceWorldN,null);
     }
     for(const m of pair.manifolds){
      const n=m.normalWorld;
      assert.ok(Math.abs(Math.hypot(n.x,n.y,n.z)-1)<0.005);
      assert.ok(m.geometricContacts>=0&&m.solverContacts>=0);
     }
    }
    assert.equal(Object.hasOwn(evidence,'possessor'),false);
    assert.equal(Object.hasOwn(evidence,'kickStrength'),false);
    events.push(hit);solver.push(evidence);timeline.push(episode);
   }
  }
  return {trace,events,solver,timeline,final:e.snapshot()};
 }finally{e.dispose();}
}

test('ME-PB-06 180 real 60Hz Rapier ticks produce actual per-pair force, manifold normals and exact replay',()=>{
 const scenario={preset:'roll',seed:'pb06-real-rapier',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const a=run(scenario,180,true),b=run(scenario,180,true);
 assert.deepEqual(a.trace,b.trace);
 assert.deepEqual(a.events,b.events);
 assert.deepEqual(a.timeline,b.timeline);
 assert.deepEqual(a.solver,b.solver);
 const forces=a.solver.flatMap(x=>x.pairs.filter(p=>p.rapierForceReported));
 assert.ok(forces.some(p=>p.id==='home-10'&&
   p.derivedNetImpulseMagnitudeNs>0));
 const withNormal=forces.find(p=>p.id==='home-10'&&p.manifolds.length>0);
 assert.ok(withNormal,'actual Rapier ball-to-shoe contact manifold must be available');
 assert.ok(withNormal.manifolds.some(m=>m.solverContacts>0));
 const first=a.solver.find(e=>e.pairs.some(p=>p.id==='home-10'&&p.rapierForceReported));
 const pair=first.pairs.find(p=>p.id==='home-10');
 process.stdout.write('ME_PB_06_REAL '+JSON.stringify({
  tick:first.tick,pair:pair.id,netPairImpulseNs:pair.derivedNetImpulseMagnitudeNs,
  summedForceMagnitudeN:pair.totalForceMagnitudeN,
  worldNormal:pair.manifolds[0].normalWorld,
  countWithReportedForce:forces.length,identicalReplay:true
 })+'\n');
});

test('ME-PB-06 no force events for high airborne or distant ball; normal physics has no observation',()=>{
 const high={preset:'launch',seed:'pb06-air',x:-4.8,y:0,z:4,vx:0,vy:0,vz:0};
 const far={preset:'roll',seed:'pb06-far',x:0,y:0,z:0,vx:0,vy:0,vz:0};
 for(const [scenario,ticks] of [[high,30],[far,60]]){
  const sample=run(scenario,ticks,true);
  assert.ok(sample.solver.every(x=>x.reportedForcePairs===0&&x.pairs.length===0));
  assert.ok(sample.events.every(x=>x.started.length===0&&x.active.length===0));
 }
 const scenario={preset:'roll',seed:'pb06-no-physics-delta',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const normal=run(scenario,130,false),noTelemetry=run(scenario,130,false);
 assert.deepEqual(normal.trace,noTelemetry.trace);
 assert.deepEqual(normal.final,noTelemetry.final);
});

test('ME-PB-06 mirrored Home/Away actual Rapier pair-force evidence remains symmetric and replayable',()=>{
 const cases=[
  {side:'home',x:-6,vx:4,id:'home-10'},
  {side:'away',x:6,vx:-4,id:'away-10'}
 ];
 for(const c of cases){
  const input={preset:'roll',seed:'pb06-'+c.side,x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0};
  const a=run(input,120,true),b=run(input,120,true);
  assert.deepEqual(a.solver,b.solver);
  assert.ok(a.solver.some(x=>x.pairs.some(p=>p.id===c.id&&
   p.rapierForceReported&&p.derivedNetImpulseMagnitudeNs>0)),
   'expected actual solver force for '+c.side);
 }
});
