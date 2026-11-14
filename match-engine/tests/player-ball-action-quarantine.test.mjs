// ME-PB-19 — untrusted command quarantine and exact 60Hz expiry.
// The proposal observer is NOT an actor authentication mechanism. There is
// deliberately NO release/approve/dispatch/force path to Rapier or gameplay.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {BALL_ACTION_PROPOSAL_VERSION,createBallActionProposalObserver}
 from '../src/player-ball-action-proposal.mjs';
import {BALL_ACTION_QUARANTINE_VERSION,createBallActionQuarantine}
 from '../src/player-ball-action-quarantine.mjs';

const RAPIER=await initializeRapier(rapierModule);
const raw=(f,change={})=>({
 version:BALL_ACTION_PROPOSAL_VERSION,declaredOrigin:'human-candidate',
 playerId:'home-10',sequence:1,issuedAtTick:f.tick,
 targetTick:f.tick+1,action:'pass',aim:{x:1,y:0},effort01:0.4,...change
});
const absent=s=>{
 assert.equal(s.version,BALL_ACTION_QUARANTINE_VERSION);
 assert.equal(s.sourceVerification,'not-established');
 assert.equal(s.commandAuthorization,'not-established');
 assert.equal(s.eligibleCommandCount,0);
 assert.equal(s.dispatchedCommandCount,0);
 assert.equal(s.actorIntentEstablished,false);
 assert.equal(s.confirmedTouch,false);
 assert.equal(s.possessionInferred,false);
 assert.ok(Object.isFrozen(s));
 for(const key of ['quarantinedThisTick','expiredUnverifiedThisTick',
  'outstandingQuarantine']){
  assert.ok(Object.isFrozen(s[key]));
  for(const r of s[key]){
   assert.ok(Object.isFrozen(r));
   assert.equal(r.decision,'quarantined-unverified-source');
   assert.equal(r.sourceVerified,false);
   assert.equal(r.commandAuthorized,false);
   assert.equal(r.eligibleForPhysics,false);
   assert.equal(r.physicalActionDispatched,false);
  }
 }
 assert.equal(s.outstandingCount,s.quarantinedCount);
 assert.equal(s.quarantinedCount,s.quarantinedThisTick.length);
 assert.equal(s.expiredCount,s.expiredUnverifiedThisTick.length);
};
const init=()=>({m:createPlayerMovement(),
 o:createBallActionProposalObserver(),q:createBallActionQuarantine()});
function advance(state,items=[]){
 const f=state.m.step({x:-6,y:0});
 const p=state.o.observe(f,items.map(item=>raw(f,item)));
 return state.q.observe(f,p);
}

test('ME-PB-19 empty 60Hz quarantine is inert and bounded forever',()=>{
 const s=init();
 absent(s.q.snapshot());
 assert.equal(s.q.snapshot().tick,0);
 for(let i=1;i<=120;i++){
  const q=advance(s);
  absent(q);
  assert.equal(q.tick,i);
  assert.equal(q.outstandingCount,0);
  assert.equal(q.expiredCount,0);
 }
});
test('ME-PB-19 human-claimed proposal is quarantined then expires at its next tick',()=>{
 const s=init();
 const one=advance(s);
 assert.equal(one.quarantinedCount,0);
 const t2=advance(s,[{sequence:1}]);
 assert.equal(t2.tick,2);
 assert.equal(t2.quarantinedCount,1);
 assert.equal(t2.expiredCount,0);
 assert.equal(t2.outstandingQuarantine[0].issuedAtTick,2);
 assert.equal(t2.outstandingQuarantine[0].targetTick,3);
 absent(t2);
 const t3=advance(s);
 assert.equal(t3.quarantinedCount,0);
 assert.equal(t3.expiredCount,1);
 assert.equal(t3.expiredUnverifiedThisTick[0].targetTick,3);
 assert.strictEqual(t3.expiredUnverifiedThisTick[0],t2.outstandingQuarantine[0]);
 absent(t3);
 const t4=advance(s);
 assert.equal(t4.expiredCount,0);
 assert.equal(t4.outstandingCount,0);
});
test('ME-PB-19 AI and human declared source never establish trusted origin',()=>{
 const s=init();
 const t1=advance(s,[{playerId:'home-10',declaredOrigin:'human-candidate'},
  {playerId:'away-10',declaredOrigin:'ai-candidate',action:'shot',
   aim:{x:-1,y:0},effort01:1}]);
 absent(t1);
 assert.equal(t1.quarantinedCount,2);
 assert.deepEqual(t1.outstandingQuarantine.map(p=>p.declaredOrigin),
  ['human-candidate','ai-candidate']);
 assert.equal(t1.outstandingQuarantine[0].actionLabel,'pass');
 assert.equal(t1.outstandingQuarantine[1].actionLabel,'shot');
 const t2=advance(s,[{sequence:2,action:'clearance'}]);
 absent(t2);
 assert.equal(t2.expiredCount,2);
 assert.equal(t2.quarantinedCount,1);
 assert.equal(t2.outstandingQuarantine[0].targetTick,3);
 const t3=advance(s);
 assert.equal(t3.expiredCount,1);
 assert.equal(t3.outstandingCount,0);
 absent(t3);
});
test('ME-PB-19 does not expose any authority, release, dispatch or force method',()=>{
 const q=createBallActionQuarantine();
 assert.deepEqual(Object.keys(q).sort(),['observe','reset','snapshot']);
 assert.equal(q.approve,undefined);
 assert.equal(q.authorize,undefined);
 assert.equal(q.release,undefined);
 assert.equal(q.dispatch,undefined);
 assert.equal(q.applyImpulse,undefined);
});
test('ME-PB-19 rejects forged summary authentication/authority without mutation',()=>{
 const s=init(),f=s.m.step({x:0,y:0});
 const p=s.o.observe(f,[raw(f)]);
 const before=s.q.snapshot();
 const mutations=[
  {authorization:'trusted'},{sourceVerified:true},
  {eligibleForPhysics:true},{intentEstablished:true},
  {confirmedTouch:true},{possessionInferred:true},
  {candidateCount:0},{status:'authorized'},
  {originProvenance:'verified'},
  {requiresExternalAuthority:'none'},{tick:2}
 ];
 for(const update of mutations){
  assert.throws(()=>s.q.observe(f,{...p,...update}));
  assert.strictEqual(s.q.snapshot(),before);
 }
 const valid=s.q.observe(f,p);
 assert.equal(valid.outstandingCount,1);
 absent(valid);
});
test('ME-PB-19 rejects fake per-candidate authority, schema and malformed aim',()=>{
 const s=init(),f=s.m.step({x:0,y:0});
 const snapshot=s.o.observe(f,[raw(f)]);
 const original=snapshot.candidates[0];
 const invalid=[
  {declaredOriginVerified:true},{commandAuthorized:true},
  {eligibleForPhysics:true},{confirmedTouch:true},
  {owner:'home-10'},{action:'possession'},{playerId:'home-999'},
  {declaredOrigin:'trusted-human'},{sequence:0},
  {issuedAtTick:0},{targetTick:1},{effort01:2},
  {aim:{x:2,y:0}},{aim:{x:1,y:0,impulseNs:4}},
  {aim:{x:NaN,y:1}}
 ];
 const before=s.q.snapshot();
 for(const change of invalid){
  const wrong={...original,...change};
  assert.throws(()=>s.q.observe(f,{
   ...snapshot,candidates:[wrong]
  }),undefined,'must reject '+Object.keys(change).join(','));
  assert.strictEqual(s.q.snapshot(),before);
 }
 absent(s.q.observe(f,snapshot));
});
test('ME-PB-19 rejects forged canonical movement and untrusted player action fields',()=>{
 const s=init(),f=s.m.step({x:0,y:0}),proposal=s.o.observe(f,[]);
 const before=s.q.snapshot();
 for(const variant of [
  {...f,tick:2},
  {...f,timeS:900},
  {...f,players:f.players.slice(1)},
  {...f,players:f.players.map((p,i)=>i===0?{...p,id:'away-1'}:p)},
  {...f,players:f.players.map((p,i)=>i===0?{...p,shotCommand:true}:p)},
  {...f,confirmedTouch:true}
 ]){
  assert.throws(()=>s.q.observe(variant,proposal));
  assert.strictEqual(s.q.snapshot(),before);
 }
 absent(s.q.observe(f,proposal));
});
test('ME-PB-19 rejects stale candidate replay; failure does not consume tick or sequence',()=>{
 const s=init(),f1=s.m.step({x:0,y:0});
 const p1=s.o.observe(f1,[raw(f1)]);
 absent(s.q.observe(f1,p1));
 const f2=s.m.step({x:0,y:0});
 const p2=s.o.observe(f2,[]);
 absent(s.q.observe(f2,p2));
 const f3=s.m.step({x:0,y:0}),p3=s.o.observe(f3,[raw(f3,{sequence:2})]);
 const before=s.q.snapshot();
 assert.throws(()=>s.q.observe(f3,{
  ...p3,candidates:[{...p3.candidates[0],sequence:1}]
 }),/Duplicate or stale/);
 assert.strictEqual(s.q.snapshot(),before);
 assert.throws(()=>s.q.observe(f3,p1));
 assert.strictEqual(s.q.snapshot(),before);
 absent(s.q.observe(f3,p3));
});
test('ME-PB-19 mixed batch invalidation is atomic, then valid batch succeeds',()=>{
 const s=init(),f=s.m.step({x:0,y:0});
 const p=s.o.observe(f,[raw(f),raw(f,{
  playerId:'away-10',declaredOrigin:'ai-candidate'
 })]);
 const before=s.q.snapshot();
 for(const bad of [
  {...p,candidates:[p.candidates[1],p.candidates[0]]},
  {...p,candidates:[p.candidates[0],p.candidates[0]]},
  {...p,candidates:[p.candidates[0],{...p.candidates[1],targetTick:3}]},
  {...p,candidates:[p.candidates[0]],candidateCount:2},
  {...p,candidates:[p.candidates[0],{...p.candidates[1],action:'tackle'}]}
 ]){
  assert.throws(()=>s.q.observe(f,bad));
  assert.strictEqual(s.q.snapshot(),before);
 }
 const out=s.q.observe(f,p);
 assert.equal(out.outstandingCount,2);
 absent(out);
});
test('ME-PB-19 maximum 22 distinct canonical candidates stays bounded',()=>{
 const s=init(),f=s.m.step({x:0,y:0});
 const p=s.o.observe(f,INITIAL_PLAYERS.map((player,i)=>raw(f,{
  playerId:player.id,declaredOrigin:i%2?'human-candidate':'ai-candidate',
  aim:{x:0,y:1},action:i%2?'pass':'shot'
 })));
 const first=s.q.observe(f,p);
 assert.equal(first.outstandingCount,22);
 absent(first);
 const second=advance(s);
 assert.equal(second.expiredCount,22);
 assert.equal(second.outstandingCount,0);
 absent(second);
});
test('ME-PB-19 reset yields fresh no-history isolated epoch (not authorization)',()=>{
 const old=init();
 advance(old,[{sequence:1}]);
 const q=old.q.reset();
 assert.equal(q.snapshot().tick,0);
 const fresh=createBallActionQuarantine();
 const m=createPlayerMovement(),o=createBallActionProposalObserver();
 for(let tick=1;tick<=25;tick++){
  const frame=m.step({x:0,y:0});
  const candidates=o.observe(frame,tick===2?[raw(frame)]:[]);
  assert.deepEqual(q.observe(frame,candidates),
   fresh.observe(frame,candidates));
  absent(q.snapshot());
 }
 assert.equal(old.q.snapshot().tick,1,'reset must not mutate old observer');
});
test('ME-PB-19 empty candidates with fabricated target tick or injected snapshot keys fail closed',()=>{
 const s=init(),f=s.m.step({x:0,y:0}),p=s.o.observe(f,[]);
 for(const altered of [
  {...p,commandAuthorized:true},{...p,dispatchedCommandCount:1},
  {...p,originProvenance:'unverified'},{...p,status:'format-valid-only'},
  {...p,candidates:null},{...p,candidates:{}},
  {...p,version:'unknown'}, {...p,tick:-1}
 ]){
  assert.throws(()=>s.q.observe(f,altered));
  assert.equal(s.q.snapshot().tick,0);
 }
 absent(s.q.observe(f,p));
});

const physics=Object.freeze([
 Object.freeze({name:'medium',x:-6,y:0,vx:4,vy:0,ticks:105,
  requestedAt:13,positive:true,target:'home-10'}),
 Object.freeze({name:'fast-ccd',x:-6,y:0,vx:16,vy:0,ticks:70,
  requestedAt:4,positive:true,target:'home-10',firstStart:5}),
 Object.freeze({name:'grazing-force-gap',x:-5.25,y:-0.14,vx:2,vy:0.1,
  ticks:185,requestedAt:31,positive:true,target:'home-10',gapTick:32}),
 Object.freeze({name:'sustained',x:-4.96,y:0,vx:0.3,vy:0,
  ticks:110,requestedAt:5,positive:true,target:'home-10'}),
 Object.freeze({name:'turf-only',preset:'bounce',x:0,y:0,z:2,
  vx:0,vy:0,ticks:100,requestedAt:20,negative:true}),
 Object.freeze({name:'distant',x:0,y:0,vx:0,vy:0,
  ticks:80,requestedAt:10,negative:true})
]);
function physicalReplay(c){
 const input={preset:c.preset??'roll',seed:'pb19-'+c.name,
  x:c.x,y:c.y,z:c.z??0,vx:c.vx,vy:c.vy,vz:0};
 const a=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:true});
 const b=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement(),observer=createBallActionProposalObserver();
 const quarantine=createBallActionQuarantine(),rows=[];
 try{
  for(let tick=1;tick<=c.ticks;tick++){
   const frame=mover.step(b.snapshot().ball.position);
   const commands=tick===c.requestedAt?[raw(frame,{
    declaredOrigin:tick%2?'human-candidate':'ai-candidate',
    action:tick%2?'pass':'shot',aim:{x:1,y:0}
   })]:[];
   const proposals=observer.observe(frame,commands);
   const q=quarantine.observe(frame,proposals);
   absent(q);
   const changed=a.step(frame),control=b.step(frame);
   assert.equal(canonicalSnapshot(changed),canonicalSnapshot(control),
    'quarantined unverified proposals cannot alter real Rapier physics');
   assert.deepEqual(a.footContactSnapshot(),b.footContactSnapshot());
   assert.deepEqual(a.footContactSolverSnapshot(),b.footContactSolverSnapshot());
   assert.deepEqual(a.footContactQualificationSnapshot(),
    b.footContactQualificationSnapshot());
   const events=a.footContactSnapshot(),solver=a.footContactSolverSnapshot();
   if(tick===c.requestedAt)assert.equal(q.outstandingCount,1);
   if(tick===c.requestedAt+1){
    assert.equal(q.expiredCount,1);
    assert.equal(q.outstandingCount,0);
   }
   rows.push(Object.freeze({
    tick,canonical:canonicalSnapshot(changed),
    starts:Object.freeze([...events.started]),
    reports:Object.freeze(solver.pairs.filter(p=>p.rapierForceReported).map(p=>p.id)),
    quarantined:q.quarantinedCount,expired:q.expiredCount
   }));
  }
  return Object.freeze(rows);
 }finally{a.dispose();b.dispose();}
}
for(const c of physics){
 test('ME-PB-19 exact 60Hz unverified expiry cannot cause a kick: '+c.name,()=>{
  const a=physicalReplay(c),b=physicalReplay(c);
  assert.deepEqual(a,b,'two independent real Rapier replay sets match exactly');
  const starts=a.reduce((n,r)=>n+r.starts.length,0);
  const forceReports=a.reduce((n,r)=>n+r.reports.length,0);
  if(c.positive){
   assert.ok(starts>0&&forceReports>0);
   assert.ok(a.some(r=>r.starts.includes(c.target)));
  }
  if(c.negative){
   assert.equal(starts,0);assert.equal(forceReports,0);
  }
  if(c.firstStart)
   assert.equal(a.find(r=>r.starts.length)?.tick,c.firstStart);
  if(c.gapTick){
   const gap=a[c.gapTick-1];
   assert.ok(gap.starts.includes(c.target),
    'genuine Rapier START after previous unverified proposal');
   assert.ok(!gap.reports.includes(c.target),
    'missing force event may not turn into a manufactured kick');
   assert.equal(gap.expired,1);
  }
  process.stdout.write('ME_PB_19_QUARANTINE '+JSON.stringify({
   scenario:c.name,physicalStarts:starts,physicalForceReports:forceReports,
   candidateIssuedTick:c.requestedAt,unverifiedExpiredTick:c.requestedAt+1,
   authenticatedOrigins:0,authorizedActions:0,dispatchedImpulses:0,
   confirmedTouches:0,possessionInferred:false,
   independentReplaysMatch:true
  })+'\n');
 });
}
