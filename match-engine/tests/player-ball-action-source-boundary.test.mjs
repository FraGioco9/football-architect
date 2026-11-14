// ME-PB-20 — structurally consistent source claims are NOT authenticated.
// Replays real Rapier worlds to prove this audit cannot change ball physics.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {BALL_ACTION_PROPOSAL_VERSION,createBallActionProposalObserver}
 from '../src/player-ball-action-proposal.mjs';
import {createBallActionQuarantine} from '../src/player-ball-action-quarantine.mjs';
import {BALL_ACTION_SOURCE_CLAIM_VERSION,BALL_ACTION_SOURCE_BOUNDARY_VERSION,
 BALL_ACTION_TRUST_REQUIREMENTS,createBallActionSourceBoundary}
 from '../src/player-ball-action-source-boundary.mjs';

const RAPIER=await initializeRapier(rapierModule);
const raw=(f,overrides={})=>({
 version:BALL_ACTION_PROPOSAL_VERSION,declaredOrigin:'human-candidate',
 playerId:'home-10',sequence:1,issuedAtTick:f.tick,
 targetTick:f.tick+1,action:'pass',aim:{x:1,y:0},effort01:0.35,
 ...overrides
});
const claim=(r,overrides={})=>({
 version:BALL_ACTION_SOURCE_CLAIM_VERSION,
 playerId:r.playerId,declaredOrigin:r.declaredOrigin,
 sequence:r.sequence,issuedAtTick:r.issuedAtTick,
 targetTick:r.targetTick,claimedSourceRef:'claimed-control-1',
 claimedMatchEpoch:'local-research-epoch',
 ...overrides
});
function setup(){
 return {movement:createPlayerMovement(),proposals:createBallActionProposalObserver(),
  quarantine:createBallActionQuarantine(),boundary:createBallActionSourceBoundary()};
}
function tick(s,items=[],claimed=true){
 const f=s.movement.step({x:-6,y:0});
 const proposed=s.proposals.observe(f,items.map(o=>raw(f,o)));
 const q=s.quarantine.observe(f,proposed);
 const claims=claimed?q.outstandingQuarantine.map(r=>claim(r)):[];
 return s.boundary.observe(q,claims);
}
function denied(s){
 assert.equal(s.version,BALL_ACTION_SOURCE_BOUNDARY_VERSION);
 assert.equal(s.sourceAuthentication,'unavailable');
 assert.equal(s.controllerBinding,'unavailable');
 assert.equal(s.matchEpochAuthority,'unavailable');
 assert.equal(s.scheduler,'not-connected');
 assert.equal(s.sourceVerifiedCount,0);
 assert.equal(s.authorizedCommands,0);
 assert.equal(s.dispatchedCommands,0);
 assert.equal(s.playerIntentEstablished,false);
 assert.equal(s.confirmedTouch,false);
 assert.equal(s.possessionInferred,false);
 assert.deepEqual(s.executableCommands,[]);
 assert.equal(s.trustRequirements,BALL_ACTION_TRUST_REQUIREMENTS);
 assert.equal(BALL_ACTION_TRUST_REQUIREMENTS.length,4);
 assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.quarantinedCandidates)&&
  Object.isFrozen(s.expiredPlayerIds));
 for(const row of s.quarantinedCandidates){
  assert.ok(Object.isFrozen(row));
  assert.equal(row.sourceAuthenticated,false);
  assert.equal(row.controllerPermissionProven,false);
  assert.equal(row.matchEpochAuthoritative,false);
  assert.equal(row.commandAuthorized,false);
  assert.equal(row.eligibleForPhysics,false);
  assert.equal(row.dispatched,false);
 }
}
test('ME-PB-20 source boundary starts closed and stays closed with no candidates',()=>{
 const s=setup();
 denied(s.boundary.snapshot());
 assert.equal(s.boundary.snapshot().tick,0);
 for(let i=1;i<=100;i++){
  const report=tick(s);
  assert.equal(report.tick,i);
  assert.equal(report.claimsMatchedStructurally,0);
  assert.equal(report.unmatchedQuarantinedCandidates,0);
  assert.equal(report.expiredWithoutExecution,0);
  denied(report);
 }
});
test('ME-PB-20 a matching alleged human source never becomes authenticated',()=>{
 const s=setup();
 const first=tick(s,[{action:'pass'}]);
 assert.equal(first.tick,1);
 assert.equal(first.claimsMatchedStructurally,1);
 assert.equal(first.unmatchedQuarantinedCandidates,0);
 assert.equal(first.quarantinedCandidates[0].claimConsistency,
  'matched-untrusted-declaration');
 assert.equal(first.quarantinedCandidates[0].claimedSourceRef,'claimed-control-1');
 assert.equal(first.quarantinedCandidates[0].claimedMatchEpoch,'local-research-epoch');
 denied(first);
 const second=tick(s);
 assert.equal(second.expiredWithoutExecution,1);
 assert.deepEqual(second.expiredPlayerIds,['home-10']);
 assert.equal(second.quarantinedCandidates.length,0);
 denied(second);
 const third=tick(s);
 assert.equal(third.expiredWithoutExecution,0);
 denied(third);
});
test('ME-PB-20 an unclaimed real candidate remains unverified and expires',()=>{
 const s=setup();
 const a=tick(s,[{action:'shot'}],false);
 assert.equal(a.unmatchedQuarantinedCandidates,1);
 assert.equal(a.claimsMatchedStructurally,0);
 assert.equal(a.quarantinedCandidates[0].claimConsistency,'missing-declaration');
 assert.equal(a.quarantinedCandidates[0].claimedSourceRef,null);
 denied(a);
 const b=tick(s);
 assert.equal(b.expiredWithoutExecution,1);
 denied(b);
});
test('ME-PB-20 declared AI origin also cannot grant authority, mixed player claims',()=>{
 const s=setup();
 const r=tick(s,[
  {playerId:'home-10',action:'pass'},
  {playerId:'away-10',declaredOrigin:'ai-candidate',action:'shot',
   aim:{x:-1,y:0},effort01:1}
 ]);
 assert.equal(r.claimsMatchedStructurally,2);
 assert.deepEqual(r.quarantinedCandidates.map(p=>p.declaredOrigin),
  ['human-candidate','ai-candidate']);
 denied(r);
 const next=tick(s,[{sequence:2,action:'clearance'}]);
 assert.equal(next.claimsMatchedStructurally,1);
 assert.equal(next.expiredWithoutExecution,2);
 denied(next);
});
test('ME-PB-20 no ability to mint authority, verify, dispatch or impersonate scheduler',()=>{
 const b=createBallActionSourceBoundary();
 assert.deepEqual(Object.keys(b).sort(),['observe','reset','snapshot']);
 for(const forbidden of ['authenticate','authorize','verify','mint',
  'release','dispatch','applyImpulse','grantPermission','runScheduler']){
  assert.equal(b[forbidden],undefined);
 }
 denied(b.snapshot());
});
test('ME-PB-20 source claim mismatch rejects atomically, then correct retry succeeds',()=>{
 const s=setup(),f=s.movement.step({x:-6,y:0});
 const p=s.proposals.observe(f,[raw(f)]);
 const q=s.quarantine.observe(f,p);
 const good=claim(q.outstandingQuarantine[0]);
 const before=s.boundary.snapshot();
 const bad=[
  {playerId:'away-10'}, {declaredOrigin:'ai-candidate'},
  {sequence:2}, {issuedAtTick:0}, {targetTick:6},
  {claimedMatchEpoch:'NOT-ALLOWED'}, {claimedSourceRef:''},
  {claimedMatchEpoch:'local research epoch'},
  {claimedSourceRef:'x'.repeat(49)}, {claimedSourceRef:'validated'},
  {version:'wrong'}, {commandAuthorized:true},
  {authenticated:true},{trustedSignature:'fake'}, {possessor:'home-10'}
 ];
 for(const changes of bad){
  const forgery={...good,...changes};
  if(changes.claimedSourceRef==='validated')continue;
  assert.throws(()=>s.boundary.observe(q,[forgery]),
   undefined,'bad claim '+JSON.stringify(changes));
  assert.strictEqual(s.boundary.snapshot(),before);
 }
 const a=s.boundary.observe(q,[{...good,claimedSourceRef:'validated'}]);
 // Even the misleading source label "validated" is an unverified string.
 assert.equal(a.quarantinedCandidates[0].claimedSourceRef,'validated');
 denied(a);
});
test('ME-PB-20 rejects fake authority flags and altered quarantine aggregates',()=>{
 const s=setup(),f=s.movement.step({x:-6,y:0});
 const p=s.proposals.observe(f,[raw(f)]);
 const q=s.quarantine.observe(f,p);
 const before=s.boundary.snapshot();
 for(const forged of [
  {sourceVerification:'verified'},
  {commandAuthorization:'yes'},
  {eligibleCommandCount:1},{dispatchedCommandCount:1},
  {actorIntentEstablished:true},{confirmedTouch:true},
  {possessionInferred:true},{authorization:'verified'},
  {sourceVerified:true},{tick:99},{version:'forged'},
  {outstandingCount:0},{quarantinedCount:0},{expiredCount:1},
  {outstandingQuarantine:[]},
  {nextDependency:'already-authorized'}
 ]){
  assert.throws(()=>s.boundary.observe({...q,...forged},[]));
  assert.strictEqual(s.boundary.snapshot(),before);
 }
 denied(s.boundary.observe(q,[]));
});
test('ME-PB-20 rejects fabricated or reordered quarantine rows, including owner',()=>{
 const s=setup(),f=s.movement.step({x:-6,y:0});
 const p=s.proposals.observe(f,[raw(f),
  raw(f,{playerId:'away-10',declaredOrigin:'ai-candidate'})]);
 const q=s.quarantine.observe(f,p);
 const row=q.outstandingQuarantine[0];
 const prior=s.boundary.snapshot();
 const variants=[
  {outstandingQuarantine:[...q.outstandingQuarantine].reverse()},
  {outstandingQuarantine:[row,row]},
  {quarantinedThisTick:[row]},
  {outstandingQuarantine:[{...row,sourceVerified:true},
   q.outstandingQuarantine[1]]},
  {outstandingQuarantine:[{...row,owner:'home-10'},
   q.outstandingQuarantine[1]]},
  {outstandingQuarantine:[{...row,targetTick:99},
   q.outstandingQuarantine[1]]}
 ];
 for(const change of variants){
  assert.throws(()=>s.boundary.observe({...q,...change},[]));
  assert.strictEqual(s.boundary.snapshot(),prior);
 }
 denied(s.boundary.observe(q,[]));
});
test('ME-PB-20 missing or forged expiry from previous tick cannot bypass boundary',()=>{
 const s=setup();
 tick(s,[{playerId:'home-10'}]);
 const f=s.movement.step({x:-6,y:0});
 const p=s.proposals.observe(f,[]);
 const q=s.quarantine.observe(f,p);
 const previous=s.boundary.snapshot();
 const row=q.expiredUnverifiedThisTick[0];
 for(const fake of [
  {...q,expiredUnverifiedThisTick:[],expiredCount:0},
  {...q,expiredUnverifiedThisTick:[{...row,sourceVerified:true}]},
  {...q,expiredUnverifiedThisTick:[{...row,targetTick:99}]},
  {...q,expiredUnverifiedThisTick:[{...row,sequence:99}]},
  {...q,expiredUnverifiedThisTick:[row,row],expiredCount:2}
 ]){
  assert.throws(()=>s.boundary.observe(fake,[]));
  assert.strictEqual(s.boundary.snapshot(),previous);
 }
 const good=s.boundary.observe(q,[]);
 assert.equal(good.expiredWithoutExecution,1);
 denied(good);
});
test('ME-PB-20 extra ghost player, duplicates or noncanonical binding order fail',()=>{
 const s=setup(),f=s.movement.step({x:-6,y:0});
 const p=s.proposals.observe(f,[
  raw(f,{playerId:'home-10'}),
  raw(f,{playerId:'away-10',declaredOrigin:'ai-candidate'})
 ]);
 const q=s.quarantine.observe(f,p);
 const correct=q.outstandingQuarantine.map(r=>claim(r));
 const before=s.boundary.snapshot();
 for(const wrong of [
  [correct[1],correct[0]],
  [correct[0],correct[0]],
  [...correct,claim(q.outstandingQuarantine[0],{playerId:'home-9'})],
  [{...correct[0],sequence:0}],
  [{...correct[0],claimedMatchEpoch:'x',authorization:'trusted'}],
  [{...correct[0],claimedSourceRef:'human-user@example.com'}]
 ]){
  assert.throws(()=>s.boundary.observe(q,wrong));
  assert.strictEqual(s.boundary.snapshot(),before);
 }
 denied(s.boundary.observe(q,correct));
});
test('ME-PB-20 expired candidates cannot be rebound after their target tick',()=>{
 const s=setup();
 tick(s,[{action:'shot'}]);
 const f=s.movement.step({x:-6,y:0});
 const p=s.proposals.observe(f,[]);
 const q=s.quarantine.observe(f,p);
 const old=claim(q.expiredUnverifiedThisTick[0]);
 const before=s.boundary.snapshot();
 assert.throws(()=>s.boundary.observe(q,[old]),/Matching/);
 assert.strictEqual(s.boundary.snapshot(),before);
 denied(s.boundary.observe(q,[]));
});
test('ME-PB-20 source-ref claims have only local sequence tracking, NOT authentication',()=>{
 const s=setup();
 const a=tick(s,[{sequence:1}]);
 assert.equal(a.claimsMatchedStructurally,1);
 const b=tick(s,[{sequence:2}]);
 assert.equal(b.claimsMatchedStructurally,1);
 denied(b);
 const c=tick(s,[{sequence:3}]);
 assert.equal(c.claimsMatchedStructurally,1);
 denied(c);
});
test('ME-PB-20 restart/reset creates isolated untrusted audit epoch',()=>{
 const s=setup();
 tick(s,[{sequence:1}]);
 const reset=s.boundary.reset(),fresh=createBallActionSourceBoundary();
 const movement=createPlayerMovement(),proposals=createBallActionProposalObserver();
 const quarantine=createBallActionQuarantine();
 for(let i=0;i<18;i++){
  const f=movement.step({x:0,y:0});
  const q=quarantine.observe(f,proposals.observe(f,i===1?[raw(f)]:[]));
  const claims=q.outstandingQuarantine.map(r=>claim(r));
  assert.deepEqual(reset.observe(q,claims),fresh.observe(q,claims));
  denied(reset.snapshot());
 }
 assert.equal(s.boundary.snapshot().tick,1);
});
test('ME-PB-20 maximum 22 candidate claims remain bounded, still no executable actions',()=>{
 const s=setup(),f=s.movement.step({x:0,y:0});
 const p=s.proposals.observe(f,INITIAL_PLAYERS.map((player,i)=>raw(f,{
  playerId:player.id,declaredOrigin:i%2?'human-candidate':'ai-candidate',
  action:i%2?'shot':'pass',aim:{x:0,y:1}
 })));
 const q=s.quarantine.observe(f,p);
 const rows=q.outstandingQuarantine.map(r=>claim(r));
 const a=s.boundary.observe(q,rows);
 assert.equal(a.claimsMatchedStructurally,22);
 assert.equal(a.quarantinedCandidates.length,22);
 denied(a);
 const second=tick(s);
 assert.equal(second.expiredWithoutExecution,22);
 assert.equal(second.authorizedCommands,0);
 denied(second);
});

const physics=Object.freeze([
 Object.freeze({name:'medium',x:-6,y:0,vx:4,vy:0,ticks:100,
  requestAt:13,contact:true}),
 Object.freeze({name:'fast-ccd',x:-6,y:0,vx:16,vy:0,ticks:65,
  requestAt:4,contact:true,startTick:5}),
 Object.freeze({name:'grazing-force-gap',x:-5.25,y:-0.14,vx:2,vy:0.1,
  ticks:180,requestAt:31,contact:true,unforcedStartTick:32}),
 Object.freeze({name:'sustained',x:-4.96,y:0,vx:0.3,vy:0,ticks:90,
  requestAt:5,contact:true}),
 Object.freeze({name:'turf-only',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,
  ticks:95,requestAt:20,negative:true}),
 Object.freeze({name:'distant',x:0,y:0,vx:0,vy:0,
  ticks:70,requestAt:10,negative:true})
]);
function realReplay(c){
 const input={preset:c.preset??'roll',seed:'pb20-'+c.name,
  x:c.x,y:c.y,z:c.z??0,vx:c.vx,vy:c.vy,vz:0};
 const withAudit=createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:true});
 const control=createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:true});
 const movement=createPlayerMovement(),proposals=createBallActionProposalObserver();
 const quarantine=createBallActionQuarantine();
 const boundary=createBallActionSourceBoundary(),rows=[];
 try{
  for(let i=1;i<=c.ticks;i++){
   const frame=movement.step(control.snapshot().ball.position);
   const p=proposals.observe(frame,i===c.requestAt?[raw(frame,{
    action:'shot',declaredOrigin:'ai-candidate',sequence:1
   })]:[]);
   const q=quarantine.observe(frame,p);
   const claimed=q.outstandingQuarantine.map(r=>claim(r,{
    claimedSourceRef:'claimed-ai-controller',claimedMatchEpoch:'claimed-epoch'
   }));
   const deniedReport=boundary.observe(q,claimed);
   denied(deniedReport);
   const a=withAudit.step(frame),b=control.step(frame);
   assert.equal(canonicalSnapshot(a),canonicalSnapshot(b));
   assert.deepEqual(withAudit.footContactSnapshot(),
    control.footContactSnapshot());
   assert.deepEqual(withAudit.footContactSolverSnapshot(),
    control.footContactSolverSnapshot());
   assert.deepEqual(withAudit.footContactQualificationSnapshot(),
    control.footContactQualificationSnapshot());
   const contact=withAudit.footContactSnapshot();
   const solver=withAudit.footContactSolverSnapshot();
   if(i===c.requestAt){
    assert.equal(deniedReport.claimsMatchedStructurally,1);
    assert.equal(deniedReport.authorizedCommands,0);
   }
   if(i===c.requestAt+1)
    assert.equal(deniedReport.expiredWithoutExecution,1);
   rows.push(Object.freeze({
    tick:i,ball:canonicalSnapshot(a),
    starts:Object.freeze([...contact.started]),
    reports:Object.freeze(solver.pairs.filter(p=>p.rapierForceReported)
     .map(p=>p.id)),
    matched:deniedReport.claimsMatchedStructurally,
    expired:deniedReport.expiredWithoutExecution
   }));
  }
  return Object.freeze(rows);
 }finally{withAudit.dispose();control.dispose();}
}
for(const c of physics){
 test('ME-PB-20 untrusted binding never executes a real Rapier kick: '+c.name,()=>{
  const first=realReplay(c),second=realReplay(c);
  assert.deepEqual(first,second,'independent real 60Hz Rapier replay');
  const starts=first.reduce((n,e)=>n+e.starts.length,0);
  const forces=first.reduce((n,e)=>n+e.reports.length,0);
  if(c.contact)assert.ok(starts>0&&forces>0);
  if(c.negative){assert.equal(starts,0);assert.equal(forces,0);}
  if(c.startTick)
   assert.equal(first.find(e=>e.starts.length)?.tick,c.startTick);
  if(c.unforcedStartTick){
   const gap=first[c.unforcedStartTick-1];
   assert.ok(gap.starts.includes('home-10'));
   assert.ok(!gap.reports.includes('home-10'));
   assert.equal(gap.expired,1);
  }
  process.stdout.write('ME_PB_20_SOURCE '+JSON.stringify({
   scenario:c.name,physicalStarts:starts,realPairForceSamples:forces,
   consistentButUntrustedSourceClaims:1,
   expiredUnconsumedTick:c.requestAt+1,
   authenticatedSources:0,authorizedActions:0,
   dispatchedBallCommands:0,confirmedTouches:0,
   inferredPossessions:0,repeatable:true
  })+'\n');
 });
}
