// ME-PB-18 — candidate format can be structurally valid yet unauthorized.
// Research-only boundary: no physical kick, validated source, owner, score,
// human command injection into tactical frames or official match integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {BALL_ACTION_PROPOSAL_VERSION,createBallActionProposalObserver}
 from '../src/player-ball-action-proposal.mjs';

const RAPIER=await initializeRapier(rapierModule);
const proposal=(frame,overrides={})=>({
 version:BALL_ACTION_PROPOSAL_VERSION,
 declaredOrigin:'human-candidate',playerId:'home-10',
 sequence:1,issuedAtTick:frame.tick,targetTick:frame.tick+1,
 action:'pass',aim:{x:1,y:0},effort01:0.45,...overrides
});
const frame=()=>createPlayerMovement().step({x:-6,y:0});
const absent=report=>{
 assert.equal(report.authorization,'not-established');
 assert.equal(report.eligibleForPhysics,false);
 assert.equal(report.intentEstablished,false);
 assert.equal(report.confirmedTouch,false);
 assert.equal(report.possessionInferred,false);
 assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.candidates));
 assert.ok(report.candidates.every(p=>Object.isFrozen(p)&&
  Object.isFrozen(p.aim)&&p.commandAuthorized===false&&
  p.declaredOriginVerified===false&&p.eligibleForPhysics===false));
};
test('ME-PB-18 starts with no candidate and stays inert on empty consecutive frames',()=>{
 const o=createBallActionProposalObserver();
 absent(o.snapshot());
 assert.equal(o.snapshot().tick,0);
 const m=createPlayerMovement();
 for(let tick=1;tick<=20;tick++){
  const s=o.observe(m.step({x:0,y:0}));
  assert.equal(s.tick,tick);
  assert.equal(s.status,'no-candidate');
  assert.equal(s.originProvenance,'absent');
  assert.equal(s.candidateCount,0);
  absent(s);
 }
});
test('ME-PB-18 accepts exact canonical sorted declared proposals, never authority',()=>{
 const m=createPlayerMovement(),o=createBallActionProposalObserver();
 const f=m.step({x:-6,y:0});
 const human=proposal(f);
 const ai=proposal(f,{declaredOrigin:'ai-candidate',playerId:'away-10',
  action:'shot',aim:{x:-1,y:0},effort01:1});
 const out=o.observe(f,[human,ai]);
 assert.equal(out.status,'format-valid-only');
 assert.equal(out.candidateCount,2);
 assert.equal(out.originProvenance,'unverified');
 assert.equal(out.candidates[0].action,'pass');
 assert.equal(out.candidates[1].action,'shot');
 assert.equal(out.candidates[0].targetTick,2);
 absent(out);
 assert.equal(Object.hasOwn(human,'commandAuthorized'),false);
 const second=m.step({x:-6,y:0});
 const clearance=o.observe(second,[proposal(second,{
  sequence:2,action:'clearance',aim:{x:0,y:1},effort01:0
 })]);
 assert.equal(clearance.candidateCount,1);
 assert.equal(clearance.candidates[0].action,'clearance');
 absent(clearance);
});
test('ME-PB-18 pure proposal format rejects unknown fields and forged authorization',()=>{
 const f=frame();
 const invalid=[
  {authorization:'trusted'}, {commandAuthorized:true},{confirmedTouch:true},
  {ballOwner:'home-10'},{intentEstablished:true},{impulseNs:10},
  {sourceSignature:'fake'}, {playerId:'home-999'},
  {declaredOrigin:'trusted-human'},{declaredOrigin:'Rapier'},
  {action:'tackle'}, {action:'possess'}, {action:'kick'},
  {version:'bad'}, {sequence:0},{sequence:1.5},
  {issuedAtTick:0},{targetTick:99},{effort01:-0.1},
  {effort01:1.1},{effort01:NaN},{effort01:Infinity},
  {aim:{x:0,y:0}},{aim:{x:5,y:0}},{aim:{x:NaN,y:1}},
  {aim:{x:Infinity,y:0}},{aim:{x:1,y:0,z:0}},
  {aim:{x:0.7,y:0.7}}, {aim:{x:0,y:1,authorized:true}}
 ];
 for(const overrides of invalid){
  const obs=createBallActionProposalObserver();
  assert.throws(()=>obs.observe(f,[proposal(f,overrides)]),
   undefined,'must reject '+JSON.stringify(overrides));
  assert.equal(obs.snapshot().tick,0);
 }
});
test('ME-PB-18 rejects null, strange prototypes, missing fields and unbounded lists',()=>{
 const f=frame();
 for(const raw of [null,false,[],Object.create({version:BALL_ACTION_PROPOSAL_VERSION}),
  {version:BALL_ACTION_PROPOSAL_VERSION}, {...proposal(f),aim:null}]){
  const o=createBallActionProposalObserver();
  assert.throws(()=>o.observe(f,[raw]));
 }
 for(const candidates of [null,{},'invalid',new Array(23).fill(proposal(f))]){
  const o=createBallActionProposalObserver();
  assert.throws(()=>o.observe(f,candidates));
 }
});
test('ME-PB-18 catches same-tick duplicate, out-of-order, and duplicate player sources',()=>{
 const f=frame();
 const home=proposal(f),away=proposal(f,{playerId:'away-10'});
 const bad=[
  [away,home], [home,home], [home,proposal(f,{declaredOrigin:'ai-candidate'})],
  [away,away]
 ];
 for(const rows of bad){
  const o=createBallActionProposalObserver();
  assert.throws(()=>o.observe(f,rows),/Unique canonical player order/);
  assert.equal(o.snapshot().candidateCount,0);
 }
});
test('ME-PB-18 sequence replay across ticks rejected, and atomic failures do not consume state',()=>{
 const m=createPlayerMovement(),o=createBallActionProposalObserver();
 const f1=m.step({x:0,y:0});
 const r1=o.observe(f1,[proposal(f1)]);
 assert.equal(r1.candidateCount,1);
 o.observe(m.step({x:0,y:0}));
 const f3=m.step({x:0,y:0}),prior=o.snapshot();
 assert.throws(()=>o.observe(f3,[proposal(f3)]),/Duplicate or stale/);
 assert.strictEqual(o.snapshot(),prior);
 assert.throws(()=>o.observe(f3,[proposal(f3,{sequence:2}),
  proposal(f3,{playerId:'away-10',aim:{x:0,y:0}})]));
 assert.strictEqual(o.snapshot(),prior);
 const r3=o.observe(f3,[proposal(f3,{sequence:2})]);
 assert.equal(r3.candidates[0].sequence,2);
 absent(r3);
});
test('ME-PB-18 consecutive movement source, identity and tick cannot be forged',()=>{
 const f=frame();
 const variants=[
  {...f,tick:2},
  {...f,timeS:999},
  {...f,players:f.players.slice(1)},
  {...f,players:f.players.map((p,i)=>i===0?{...p,id:'away-1'}:p)},
  {...f,players:f.players.map((p,i)=>i===0?{...p,ballAction:'shot'}:p)},
  {...f,ballActionCommand:'fake'}
 ];
 for(const bogus of variants){
  const o=createBallActionProposalObserver();
  assert.throws(()=>o.observe(bogus,[]));
  assert.equal(o.snapshot().tick,0);
 }
 const o=createBallActionProposalObserver();
 assert.throws(()=>o.observe(f,[proposal(f,{targetTick:3})]));
 assert.equal(o.snapshot().tick,0);
 o.observe(f,[]);
 assert.throws(()=>o.observe(f,[]),/Consecutive/);
});
test('ME-PB-18 sorted canonical player names are bounded by actual 22-man roster',()=>{
 assert.equal(INITIAL_PLAYERS.length,22);
 const m=createPlayerMovement(),o=createBallActionProposalObserver();
 const f=m.step({x:0,y:0});
 const all=INITIAL_PLAYERS.map((p,i)=>proposal(f,{
  playerId:p.id,sequence:1,
  declaredOrigin:i%2?'ai-candidate':'human-candidate',
  action:i%3===0?'pass':i%3===1?'shot':'clearance',
  aim:{x:0,y:1}
 }));
 const report=o.observe(f,all);
 assert.equal(report.candidateCount,22);
 absent(report);
 assert.deepEqual(report.candidates.map(p=>p.playerId),
  INITIAL_PLAYERS.map(p=>p.id));
});

const physical=Object.freeze([
 Object.freeze({name:'medium-home',x:-6,y:0,vx:4,vy:0,ticks:105,
  commandAt:13,action:'pass',positive:true}),
 Object.freeze({name:'fast-ccd',x:-6,y:0,vx:16,vy:0,ticks:65,
  commandAt:4,action:'shot',positive:true,firstStart:5}),
 Object.freeze({name:'grazing-recontact',x:-5.25,y:-0.14,vx:2,vy:0.1,
  ticks:185,commandAt:32,action:'clearance',positive:true}),
 Object.freeze({name:'sustained-low-roll',x:-4.96,y:0,vx:0.3,vy:0,
  ticks:100,commandAt:5,action:'shot',positive:true}),
 Object.freeze({name:'turf-only',preset:'bounce',x:0,y:0,z:2,
  vx:0,vy:0,ticks:90,commandAt:20,action:'pass',negative:true}),
 Object.freeze({name:'distant',x:0,y:0,vx:0,vy:0,
  ticks:75,commandAt:10,action:'pass',negative:true})
]);
function realRapierReplay(c){
 const input={preset:c.preset??'roll',seed:'pb18-'+c.name,
  x:c.x,y:c.y,z:c.z??0,vx:c.vx,vy:c.vy,vz:0};
 const experiment=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:true});
 const physicalControl=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement(),observer=createBallActionProposalObserver();
 const snapshots=[],observations=[];
 try{
  for(let tick=1;tick<=c.ticks;tick++){
   const frame=mover.step(physicalControl.snapshot().ball.position);
   const raw=tick===c.commandAt?[proposal(frame,{
    action:c.action,aim:{x:1,y:0},
    declaredOrigin:'ai-candidate',sequence:1,effort01:0.7
   })]:[];
   const record=observer.observe(frame,raw);
   absent(record);
   assert.equal(record.candidateCount,raw.length);
   if(tick===c.commandAt){
    assert.equal(record.status,'format-valid-only');
    assert.equal(record.candidates[0].targetTick,tick+1);
    assert.equal(record.candidates[0].eligibleForPhysics,false);
   }
   const a=experiment.step(frame),b=physicalControl.step(frame);
   assert.equal(canonicalSnapshot(a),canonicalSnapshot(b),
    'a well-formed but unverified candidate MUST NOT affect Rapier state');
   assert.deepEqual(experiment.footContactSnapshot(),
    physicalControl.footContactSnapshot());
   assert.deepEqual(experiment.footContactSolverSnapshot(),
    physicalControl.footContactSolverSnapshot());
   const events=experiment.footContactSnapshot();
   const forces=experiment.footContactSolverSnapshot();
   observations.push(Object.freeze({
    tick,starts:Object.freeze([...events.started]),
    forceIds:Object.freeze(forces.pairs.filter(p=>p.rapierForceReported).map(p=>p.id)),
    status:record.status,candidates:record.candidateCount
   }));
   snapshots.push(canonicalSnapshot(a));
  }
  return Object.freeze({
   canonical:Object.freeze(snapshots),
   observations:Object.freeze(observations),
   actionCommandsActuallyApplied:0,confirmedTouches:0,
   inferredPossessions:0
  });
 }finally{experiment.dispose();physicalControl.dispose();}
}
for(const c of physical){
 test('ME-PB-18 actual Rapier unaffected by candidate action '+c.name,()=>{
  const a=realRapierReplay(c),b=realRapierReplay(c);
  assert.deepEqual(a,b,'two independently initialized real Rapier pairs match');
  assert.equal(a.actionCommandsActuallyApplied,0);
  const starts=a.observations.reduce((n,s)=>n+s.starts.length,0);
  const forces=a.observations.reduce((n,s)=>n+s.forceIds.length,0);
  if(c.positive){
   assert.ok(starts>0);
   assert.ok(forces>0);
  }
  if(c.negative){
   assert.equal(starts,0);
   assert.equal(forces,0);
  }
  if(c.firstStart)
   assert.equal(a.observations.find(x=>x.starts.length)?.tick,c.firstStart);
  if(c.name==='grazing-recontact'){
   const tick32=a.observations[31];
   assert.ok(tick32.starts.includes('home-10'));
   assert.ok(!tick32.forceIds.includes('home-10'));
   assert.equal(tick32.status,'format-valid-only');
  }
  process.stdout.write('ME_PB_18_CANDIDATE '+JSON.stringify({
   scenario:c.name,declaredCandidateTick:c.commandAt,
   actualRapierStarts:starts,actualPairForceSamples:forces,
   authorizedActionCommands:0,appliedBallImpulsesFromCandidates:0,
   confirmedTouches:0,inferredPossessions:0,exactReplay:true
  })+'\n');
 });
}
