// ME-PB-21 — immutable proposed controller intervals are NOT session authority.
// The proposed plan is caller data, not a signed grant or input executor.
// Node-only research with real Rapier negative actuation controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {BALL_ACTION_PROPOSAL_VERSION,createBallActionProposalObserver}
 from '../src/player-ball-action-proposal.mjs';
import {createBallActionQuarantine}
 from '../src/player-ball-action-quarantine.mjs';
import {BALL_ACTION_SOURCE_CLAIM_VERSION,createBallActionSourceBoundary}
 from '../src/player-ball-action-source-boundary.mjs';
import {BALL_CONTROLLER_PLAN_VERSION,BALL_CONTROLLER_AUDIT_VERSION,
 createBallControllerBindingAudit}
 from '../src/player-ball-controller-binding-audit.mjs';

const RAPIER=await initializeRapier(rapierModule);
const planRow=(overrides={})=>({
 playerId:'home-10',declaredOrigin:'human-candidate',
 claimedSourceRef:'source-a',proposedControllerRef:'controller-a',
 validFromTick:1,validThroughTick:12,...overrides
});
const plan=(bindings=[planRow()])=>({
 version:BALL_CONTROLLER_PLAN_VERSION,
 declaredMatchEpoch:'trial-epoch',bindings
});
const raw=(f,overrides={})=>({
 version:BALL_ACTION_PROPOSAL_VERSION,declaredOrigin:'human-candidate',
 playerId:'home-10',sequence:1,issuedAtTick:f.tick,
 targetTick:f.tick+1,action:'pass',aim:{x:1,y:0},effort01:0.4,
 ...overrides
});
const claim=(q,overrides={})=>({
 version:BALL_ACTION_SOURCE_CLAIM_VERSION,
 playerId:q.playerId,declaredOrigin:q.declaredOrigin,
 sequence:q.sequence,issuedAtTick:q.issuedAtTick,
 targetTick:q.targetTick,claimedSourceRef:'source-a',
 claimedMatchEpoch:'trial-epoch',...overrides
});
function state(bindingPlan=plan()){
 return {
  mover:createPlayerMovement(),
  proposals:createBallActionProposalObserver(),
  quarantine:createBallActionQuarantine(),
  boundary:createBallActionSourceBoundary(),
  audit:createBallControllerBindingAudit(bindingPlan)
 };
}
function next(s,proposals=[],claims){
 const f=s.mover.step({x:-6,y:0});
 const envelope=s.proposals.observe(f,proposals.map(o=>raw(f,o)));
 const q=s.quarantine.observe(f,envelope);
 const declared=claims===undefined?q.outstandingQuarantine.map(r=>claim(r)):claims;
 const source=s.boundary.observe(q,declared);
 return s.audit.observe(source);
}
function denied(r){
 assert.equal(r.version,BALL_CONTROLLER_AUDIT_VERSION);
 assert.equal(r.authenticatedControllers,0);
 assert.equal(r.authorizedCommands,0);
 assert.equal(r.scheduler,'not-connected');
 assert.equal(r.appliedBallActions,0);
 assert.equal(r.confirmedTouches,0);
 assert.equal(r.possessionInferred,false);
 assert.equal(r.authority,'unavailable');
 assert.deepEqual(r.schedulerQueue,[]);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.reviewedCandidates));
 for(const p of r.reviewedCandidates){
  assert.equal(p.actorAuthenticated,false);
  assert.equal(p.controllerAuthenticated,false);
  assert.equal(p.sessionAuthoritative,false);
  assert.equal(p.commandAuthorized,false);
  assert.equal(p.eligibleForPhysics,false);
  assert.equal(p.dispatched,false);
  assert.ok(Object.isFrozen(p));
 }
}
test('ME-PB-21 no planned binding yields no executable controller',()=>{
 const s=state(plan([]));
 denied(s.audit.snapshot());
 for(let i=0;i<80;i++){
  const r=next(s,i===2?[{}]:[]);
  denied(r);
  if(i===2){
   assert.equal(r.reviewedCandidates[0].bindingStatus,
    'no-active-proposed-binding');
   assert.equal(r.planMatches,0);
  }
 }
});
test('ME-PB-21 a matching planned controller is only a textual hypothesis',()=>{
 const s=state();
 const first=next(s,[{}]);
 denied(first);
 assert.equal(first.planMatches,1);
 assert.equal(first.unmatchedCandidates,0);
 assert.equal(first.reviewedCandidates[0].bindingStatus,
  'matches-untrusted-binding-plan');
 assert.equal(first.reviewedCandidates[0].proposedControllerRef,'controller-a');
 assert.equal(first.reviewedCandidates[0].targetTick,2);
 const expired=next(s);
 denied(expired);
 assert.equal(expired.expiredUnconsumed,1);
 assert.equal(expired.planMatches,0);
 assert.equal(next(s).expiredUnconsumed,0);
});
test('ME-PB-21 missing claimed source remains unbound despite an active plan',()=>{
 const s=state();
 const r=next(s,[{}],[]);
 denied(r);
 assert.equal(r.unmatchedCandidates,1);
 assert.equal(r.reviewedCandidates[0].bindingStatus,'no-source-claim');
 assert.equal(r.reviewedCandidates[0].claimedSourceRef,null);
});
test('ME-PB-21 wrong source and epoch never fall back to another controller',()=>{
 for(const opts of [
  {claimedSourceRef:'source-elsewhere',status:'claimed-source-mismatch'},
  {claimedMatchEpoch:'different-epoch',status:'claimed-epoch-mismatch'}
 ]){
  const s=state(),f=s.mover.step({x:-6,y:0});
  const p=s.proposals.observe(f,[raw(f)]);
  const q=s.quarantine.observe(f,p);
  const source=s.boundary.observe(q,[claim(q.outstandingQuarantine[0],{
   ...(opts.claimedSourceRef?{claimedSourceRef:opts.claimedSourceRef}:{}),
   ...(opts.claimedMatchEpoch?{claimedMatchEpoch:opts.claimedMatchEpoch}:{})
  })]);
  const r=s.audit.observe(source);
  denied(r);
  assert.equal(r.planMatches,0);
  assert.equal(r.reviewedCandidates[0].bindingStatus,opts.status);
 }
});
test('ME-PB-21 deterministic handover uses target-tick interval, not issuance tick',()=>{
 const schedule=plan([
  planRow({validFromTick:1,validThroughTick:12}),
  planRow({claimedSourceRef:'source-b',proposedControllerRef:'controller-b',
   validFromTick:13,validThroughTick:25})
 ]);
 const s=state(schedule);
 for(let tick=1;tick<=27;tick++){
  const f=s.mover.step({x:-6,y:0});
  const action=[11,12,13,24,25].includes(tick);
  const command=action?[raw(f,{sequence:[11,12,13,24,25].indexOf(tick)+1})]:[];
  const p=s.proposals.observe(f,command);
  const q=s.quarantine.observe(f,p);
  const source=q.outstandingQuarantine.map(r=>claim(r,{
   claimedSourceRef:tick===11?'source-a':'source-b'
  }));
  const boundary=s.boundary.observe(q,source);
  const audit=s.audit.observe(boundary);
  denied(audit);
  if(action){
   const expected=tick===11||tick===12||tick===13||tick===24?
    'matches-untrusted-binding-plan':'no-active-proposed-binding';
   // tick 12 -> target 13: new controller begins immediately.
   if(tick===11)assert.equal(audit.reviewedCandidates[0].bindingStatus,expected);
   if(tick===12||tick===13||tick===24)
    assert.equal(audit.reviewedCandidates[0].bindingStatus,expected);
   if(tick===25)assert.equal(audit.reviewedCandidates[0].bindingStatus,expected);
   if(tick===11)assert.equal(audit.reviewedCandidates[0].proposedControllerRef,
    'controller-a');
   if(tick===12)assert.equal(audit.reviewedCandidates[0].proposedControllerRef,
    'controller-b');
  }
 }
});
test('ME-PB-21 outdated source at handover cannot impersonate new plan',()=>{
 const s=state(plan([
  planRow({validFromTick:1,validThroughTick:2}),
  planRow({validFromTick:3,validThroughTick:20,
   claimedSourceRef:'source-b',proposedControllerRef:'controller-b'})
 ]));
 next(s);
 const r=next(s,[{}]); // issued tick 2, targeted tick 3
 denied(r);
 assert.equal(r.reviewedCandidates[0].bindingStatus,'claimed-source-mismatch');
 assert.equal(r.reviewedCandidates[0].proposedControllerRef,'controller-b');
});
test('ME-PB-21 two players can have simultaneous distinct proposed controllers',()=>{
 const s=state(plan([
  planRow(),
  planRow({playerId:'away-10',declaredOrigin:'ai-candidate',
   claimedSourceRef:'ai-source',proposedControllerRef:'ai-controller',
   validFromTick:1,validThroughTick:12})
 ]));
 const f=s.mover.step({x:0,y:0});
 const p=s.proposals.observe(f,[raw(f),raw(f,{
  playerId:'away-10',declaredOrigin:'ai-candidate',
  aim:{x:-1,y:0},action:'shot'
 })]);
 const q=s.quarantine.observe(f,p);
 const claims=q.outstandingQuarantine.map(r=>claim(r,{
  claimedSourceRef:r.playerId==='away-10'?'ai-source':'source-a'
 }));
 const report=s.audit.observe(s.boundary.observe(q,claims));
 denied(report);
 assert.equal(report.planMatches,2);
 assert.deepEqual(report.reviewedCandidates.map(x=>x.proposedControllerRef),
  ['controller-a','ai-controller']);
});
test('ME-PB-21 overlapping player, controller and human-source plans rejected',()=>{
 const invalid=[
  [planRow(),planRow({validFromTick:12,validThroughTick:20,
   claimedSourceRef:'source-b',proposedControllerRef:'controller-b'})],
  [planRow(),planRow({playerId:'away-10',claimedSourceRef:'source-b',
   proposedControllerRef:'controller-a'})],
  [planRow(),planRow({playerId:'away-10',claimedSourceRef:'source-a',
   proposedControllerRef:'controller-b'})]
 ];
 for(const bindings of invalid)
  assert.throws(()=>createBallControllerBindingAudit(plan(bindings)),
   /Overlapping/);
});
test('ME-PB-21 sequential use of the same controller is allowed but untrusted',()=>{
 const s=state(plan([
  planRow({validThroughTick:2}),
  planRow({playerId:'away-10',claimedSourceRef:'source-b',
   proposedControllerRef:'controller-a',validFromTick:3,validThroughTick:10})
 ]));
 for(let i=0;i<4;i++)denied(next(s));
});
test('ME-PB-21 malformed binding plans fail closed with bounded time and labels',()=>{
 const samples=[
  {version:'wrong'},{declaredMatchEpoch:'injected epoch'},
  {declaredMatchEpoch:'A'}, {authorization:'trusted'},
  {bindings:null},{bindings:[] ,serverSigned:true},
  {bindings:[planRow({playerId:'ghost'})]},
  {bindings:[planRow({declaredOrigin:'real-human'})]},
  {bindings:[planRow({claimedSourceRef:''})]},
  {bindings:[planRow({proposedControllerRef:'x'.repeat(49)})]},
  {bindings:[planRow({validFromTick:0})]},
  {bindings:[planRow({validThroughTick:3601})]},
  {bindings:[planRow({validFromTick:1,validThroughTick:602})]},
  {bindings:[planRow({validFromTick:12,validThroughTick:1})]},
  {bindings:[planRow({playerId:'away-10'}),planRow()]},
  {bindings:[planRow(),planRow({validFromTick:1})]},
  {bindings:new Array(45).fill(planRow())}
 ];
 for(const change of samples)
  assert.throws(()=>createBallControllerBindingAudit({...plan(),...change}));
});
test('ME-PB-21 fabricated authenticated boundary cannot change audit state',()=>{
 const s=state(),f=s.mover.step({x:0,y:0});
 const p=s.proposals.observe(f,[raw(f)]);
 const q=s.quarantine.observe(f,p);
 const baseline=s.boundary.observe(q,[claim(q.outstandingQuarantine[0])]);
 const old=s.audit.snapshot();
 const tampered=[
  {sourceAuthentication:'verified'}, {controllerBinding:'trusted'},
  {matchEpochAuthority:'server'}, {scheduler:'enabled'},
  {sourceVerifiedCount:1},{authorizedCommands:1},
  {dispatchedCommands:1},{executableCommands:[{}]},
  {confirmedTouch:true},{possessionInferred:true},
  {expiredWithoutExecution:1},{expiredPlayerIds:['home-10']},
  {claimsMatchedStructurally:0},{tick:99},
  {controllerGrant:{playerId:'home-10'}}
 ];
 for(const changes of tampered){
  assert.throws(()=>s.audit.observe({...baseline,...changes}));
  assert.strictEqual(s.audit.snapshot(),old);
 }
 denied(s.audit.observe(baseline));
});
test('ME-PB-21 forged per-player authority, sequence and order fail atomically',()=>{
 const s=state(),f=s.mover.step({x:-6,y:0});
 const p=s.proposals.observe(f,[raw(f)]);
 const q=s.quarantine.observe(f,p);
 const b=s.boundary.observe(q,[claim(q.outstandingQuarantine[0])]);
 const row=b.quarantinedCandidates[0],old=s.audit.snapshot();
 for(const changes of [
  {sourceAuthenticated:true},{controllerPermissionProven:true},
  {matchEpochAuthoritative:true},{commandAuthorized:true},
  {eligibleForPhysics:true},{dispatched:true},
  {targetTick:5}, {actionLabel:'possess'},
  {provenanceSignature:'forged'},{claimedSourceRef:'INVALID'}
 ]){
  assert.throws(()=>s.audit.observe({...b,quarantinedCandidates:[
   {...row,...changes}
  ]}));
  assert.strictEqual(s.audit.snapshot(),old);
 }
 // A different canonical player is a structurally possible *unplanned*
 // candidate, so classify as unmatched; never treat it as authorized.
 const other=s.audit.observe({...b,quarantinedCandidates:[
  {...row,playerId:'away-10'}
 ]});
 denied(other);
 assert.equal(other.planMatches,0);
 assert.equal(other.reviewedCandidates[0].bindingStatus,
  'no-active-proposed-binding');
});
test('ME-PB-21 forged expiry and same-tick replay rejected',()=>{
 const s=state();
 next(s,[{}]);
 const f=s.mover.step({x:-6,y:0});
 const p=s.proposals.observe(f,[]);
 const q=s.quarantine.observe(f,p);
 const b=s.boundary.observe(q,[]);
 const previous=s.audit.snapshot();
 assert.throws(()=>s.audit.observe({...b,expiredPlayerIds:[]}));
 assert.strictEqual(s.audit.snapshot(),previous);
 const valid=s.audit.observe(b);
 denied(valid);
 assert.equal(valid.expiredUnconsumed,1);
 assert.throws(()=>s.audit.observe(b));
});
test('ME-PB-21 input mutation cannot change frozen plan or reset',()=>{
 const rawPlan=plan([planRow()]);
 const audit=createBallControllerBindingAudit(rawPlan);
 rawPlan.declaredMatchEpoch='injected';
 rawPlan.bindings[0].claimedSourceRef='attacker';
 rawPlan.bindings.push(planRow({validFromTick:13,validThroughTick:20}));
 const reset=audit.reset();
 assert.equal(audit.snapshot().declaredMatchEpoch,'trial-epoch');
 assert.equal(reset.snapshot().declaredMatchEpoch,'trial-epoch');
 assert.equal(reset.snapshot().proposedBindingsCount,1);
 denied(reset.snapshot());
});
test('ME-PB-21 public audit exposes no sign, authenticate, approve or dispatch method',()=>{
 const audit=createBallControllerBindingAudit(plan());
 assert.deepEqual(Object.keys(audit).sort(),['observe','reset','snapshot']);
 for(const method of ['authenticate','verify','grantPermission','authorize',
  'schedule','dispatch','applyImpulse','mint','revoke','sign'])
  assert.equal(audit[method],undefined);
});
const physics=Object.freeze([
 Object.freeze({name:'medium',x:-6,y:0,vx:4,vy:0,ticks:90,requestAt:13,
  contact:true}),
 Object.freeze({name:'fast-ccd',x:-6,y:0,vx:16,vy:0,ticks:70,requestAt:4,
  contact:true,startTick:5}),
 Object.freeze({name:'grazing-gap',x:-5.25,y:-0.14,vx:2,vy:0.1,
  ticks:170,requestAt:31,contact:true,forceGap:32}),
 Object.freeze({name:'sustained',x:-4.96,y:0,vx:0.3,vy:0,
  ticks:100,requestAt:5,contact:true}),
 Object.freeze({name:'turf-only',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,
  ticks:95,requestAt:20,negative:true}),
 Object.freeze({name:'distant',x:0,y:0,vx:0,vy:0,ticks:70,
  requestAt:10,negative:true})
]);
function actualPhysicsReplay(c){
 const init={preset:c.preset??'roll',seed:'pb21-'+c.name,x:c.x,y:c.y,
  z:c.z??0,vx:c.vx,vy:c.vy,vz:0};
 const trial=createEngine(RAPIER,init,{diagnosticPlayerFootContactsEnabled:true});
 const control=createEngine(RAPIER,init,{diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement(),proposals=createBallActionProposalObserver();
 const quarantine=createBallActionQuarantine();
 const source=createBallActionSourceBoundary();
 const binding=createBallControllerBindingAudit(plan([
  planRow({validThroughTick:20}),
  planRow({claimedSourceRef:'source-b',proposedControllerRef:'controller-b',
   validFromTick:21,validThroughTick:40})
 ]));
 const trace=[];
 try{
  for(let tick=1;tick<=c.ticks;tick++){
   const frame=mover.step(control.snapshot().ball.position);
   const p=proposals.observe(frame,tick===c.requestAt?[raw(frame)]:[]);
   const q=quarantine.observe(frame,p);
   const claims=q.outstandingQuarantine.map(r=>claim(r,{
    claimedSourceRef:tick>=21?'source-b':'source-a'
   }));
   const report=binding.observe(source.observe(q,claims));
   denied(report);
   const ballA=trial.step(frame),ballB=control.step(frame);
   assert.equal(canonicalSnapshot(ballA),canonicalSnapshot(ballB));
   assert.deepEqual(trial.footContactSnapshot(),
    control.footContactSnapshot());
   assert.deepEqual(trial.footContactSolverSnapshot(),
    control.footContactSolverSnapshot());
   assert.deepEqual(trial.footContactQualificationSnapshot(),
    control.footContactQualificationSnapshot());
   const events=trial.footContactSnapshot();
   const solver=trial.footContactSolverSnapshot();
   if(tick===c.requestAt){
    assert.equal(report.reviewedCandidates.length,1);
    assert.equal(report.authorizedCommands,0);
   }
   if(tick===c.requestAt+1)
    assert.equal(report.expiredUnconsumed,1);
   trace.push(Object.freeze({
    tick,ball:canonicalSnapshot(ballA),
    starts:Object.freeze([...events.started]),
    reported:Object.freeze(solver.pairs.filter(p=>p.rapierForceReported)
     .map(p=>p.id)),planMatches:report.planMatches,
    expired:report.expiredUnconsumed
   }));
  }
  return Object.freeze(trace);
 }finally{trial.dispose();control.dispose();}
}
for(const c of physics){
 test('ME-PB-21 untrusted controller plan cannot actuate real Rapier '+c.name,()=>{
  const a=actualPhysicsReplay(c),b=actualPhysicsReplay(c);
  assert.deepEqual(a,b,'two independent real Rapier research replays agree');
  const starts=a.reduce((n,r)=>n+r.starts.length,0);
  const forces=a.reduce((n,r)=>n+r.reported.length,0);
  if(c.contact)assert.ok(starts>0&&forces>0);
  if(c.negative){assert.equal(starts,0);assert.equal(forces,0);}
  if(c.startTick)assert.equal(a.find(r=>r.starts.length)?.tick,c.startTick);
  if(c.forceGap){
   const row=a[c.forceGap-1];
   assert.ok(row.starts.includes('home-10'));
   assert.ok(!row.reported.includes('home-10'));
   assert.equal(row.expired,1);
  }
  process.stdout.write('ME_PB_21_CONTROLLER '+JSON.stringify({
   scenario:c.name,realPhysicalStarts:starts,
   reportedPairForces:forces,claimedPlanMatches:a.reduce((n,r)=>
    n+r.planMatches,0),candidateExpiredTick:c.requestAt+1,
   authenticatedControllers:0,executedCommands:0,
   inferredPossessions:0,twiceReplayed:true
  })+'\n');
 });
}
