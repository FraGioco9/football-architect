// ME-PB-54 / A1.3a — physically executed per-fixture match steps.
// These tests do NOT assert an approved calendar, score, goal or real roster.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createUniversalMatchBallSession}
 from '../src/player-ball-universal-world.mjs';
import {TEMPORARY_PLAYER_ATTRIBUTES,TEMPORARY_UNIFORM_MOVEMENT}
 from '../src/temporary-uniform-fixture-squad.mjs';
import {PLAYER_MAX_SPEED_MPS,PLAYER_ACCEL_MPS2,PLAYER_BRAKE_MPS2,
 PLAYER_TURN_RAD_PER_S} from '../src/player-movement.mjs';
import {createPhysicalFixtureStepRuntime,normalizePhysicalFixture,
 PHYSICAL_FIXTURE_RUNTIME_VERSION,PHYSICAL_FIXTURE_CONTACT_FEED_VERSION,
 PHYSICAL_FIXTURE_DUTY_CONTACT_VERSION}
 from '../src/physical-fixture-step-runtime.mjs';

const R=await initializeRapier(rapier);
const scene=Object.freeze({
 preset:'roll',seed:'me-pb-54-fixture-ground',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0
});
const noContact=Object.freeze({
 preset:'roll',seed:'me-pb-54-fixture-distant',
 x:30,y:20,z:0,vx:0,vy:0,vz:0
});
function domestic(country='ENG',h=1,a=2,round=1){
 const competitionId=country+'-1',marker='N'+String(round).padStart(2,'0');
 const homeClubId=country+'-'+h,awayClubId=country+'-'+a;
 return Object.freeze({
  id:`season:1:${competitionId}:${marker}:${homeClubId}:${awayClubId}`,
  competitionId,marker,day:round,round,homeClubId,awayClubId
 });
}
const international=Object.freeze({
 id:'season:2:int-1:I01:ENG-4:IT-6',
 competitionId:'int-1',marker:'I01',day:2,round:1,
 homeClubId:'ENG-4',awayClubId:'IT-6'
});

test('A1.3a generically validates domestic/international fixture shape but does NOT attest calendar source',()=>{
 const inputs=[
  domestic('ENG',1,2,1),domestic('IT',13,16,15),
  domestic('DE',39,40,30),international
 ];
 for(const x of inputs){
  const verified=normalizePhysicalFixture(x);
  assert.equal(verified.id,x.id);
  assert.ok(Object.isFrozen(verified));
  assert.ok(Number.isSafeInteger(verified.season));
 }
 const good=domestic();
 for(const invalid of [
  null,[],{}, {...good,homeClubId:good.awayClubId},
  {...good,fixtureCalendarVerified:true},
  {...good,extra:'fake'},
  {...good,id:'season:1:ENG-1:N01:ENG-2:ENG-1'},
  {...good,marker:'I01'},
  {...good,day:57},{...good,round:0},
  {...good,homeClubId:'ENG-41'}, {...good,awayClubId:'IT-1'},
  {...good,day:NaN},{...good,id:'season:01:ENG-1:N01:ENG-1:ENG-2'},
  {...good,competitionId:'int-1'}
 ]) assert.throws(()=>normalizePhysicalFixture(invalid),
  /Only a canonical-shaped fixture/);
 assert.throws(()=>normalizePhysicalFixture({
  ...international,marker:'N01'
 }),/Only a canonical-shaped fixture/);
});

test('A1.3a true 155-tick fixture step producer matches independent A1.2 Rapier world exactly',()=>{
 const fixture=domestic('ENG',2,3,1);
 const real=createPhysicalFixtureStepRuntime(R,fixture,scene);
 const plain=createUniversalMatchBallSession(R,scene);
 let starts=0,ends=0;
 try{
  const initial=real.snapshot();
  assert.equal(initial.physicsTick,0);
  assert.equal(initial.fixtureId,fixture.id);
  assert.equal(initial.version,PHYSICAL_FIXTURE_RUNTIME_VERSION);
  assert.equal(initial.fixtureCalendarVerified,false);
  assert.equal(initial.rosterBound,false);
  assert.equal(initial.productionScoringConnected,false);
  assert.equal(initial.officialMatchResult,null);
  assert.equal(initial.scoreAuthority,'external-temporary-score-v1');
  assert.ok(Object.isFrozen(initial)&&Object.isFrozen(initial.fixture));
  const frames=real.advance(155);
  assert.equal(frames.length,155);
  assert.ok(Object.isFrozen(frames));
  for(let i=0;i<155;i++){
   const f=frames[i],g=plain.step();
   assert.equal(f.physicsTick,i+1);
   assert.ok(Math.abs(f.elapsedSeconds-(i+1)*FIXED_DT)<1e-9);
   assert.equal(f.canonicalBall,canonicalSnapshot(g.ballSnapshot));
   assert.deepEqual(f.footContact,g.footContact);
   assert.equal(f.officialMatchResult,null);
   assert.equal(f.officialMatchPossession,false);
   assert.equal(f.officialMatchActions,false);
   assert.equal(f.officialGoalEvidence,false);
   assert.equal(f.realFootEventsOnly,true);
   assert.equal(f.movementSource,'canonical-22-local-placeholder-players');
   assert.equal(f.physicalRapierStep,true);
   assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.ballSnapshot));
   starts+=f.footContact.started.length;
   ends+=f.footContact.ended.length;
  }
  assert.equal(frames[0].footContact.started.includes('away-10'),true);
  assert.equal(frames[18].footContact.ended.includes('away-10'),true);
  assert.equal(frames[126].footContact.started.includes('home-10'),true);
  assert.ok(starts>=2&&ends>=2);
  assert.equal(real.snapshot(),frames.at(-1));
 }finally{real.dispose();plain.dispose();}
});

test('A1.3a fixture runtime replay/reset is identical for two teams, flights, bounce and one response',()=>{
 for(const fixture of [domestic('DE',3,4,3),international]){
  for(const preset of ['roll','drop','launch','bounce']){
   const ball=preset==='roll'?scene:{preset,seed:'me-pb-54-fixture-'+preset};
   const response=preset==='drop'?0.85:preset==='bounce'?1.15:1;
   const a=createPhysicalFixtureStepRuntime(R,fixture,ball,
    {globalResponse:response});
   const b=createPhysicalFixtureStepRuntime(R,fixture,ball,
    {globalResponse:response});
   try{
    const aa=a.advance(65),bb=b.advance(65);
    assert.deepEqual(aa,bb);
    assert.equal(aa.at(-1).physicsTick,65);
    assert.equal(aa.at(-1).globalResponse,response);
    const preserved=a.snapshot(),fresh=a.reset();
    try{
     assert.throws(()=>a.step(),/runtime disposed/);
     assert.deepEqual(fresh.advance(65),aa);
     assert.equal(preserved.physicsTick,65);
    }finally{fresh.dispose();}
   }finally{a.dispose();b.dispose();}
  }
 }
});

test('A1.3a fixture no-contact cannot invent real shoe events or authoritative scores',()=>{
 const a=createPhysicalFixtureStepRuntime(R,domestic('FR',1,2),noContact);
 try{
  for(const f of a.advance(70)){
   assert.equal(f.officialMatchResult,null);
   assert.equal(f.productionScoringConnected,false);
   assert.deepEqual(f.footContact.started,[]);
   assert.deepEqual(f.footContact.ended,[]);
   assert.deepEqual(f.footContact.active,[]);
  }
 }finally{a.dispose();}
});

test('A1.3a reject untrusted commands and independent physics knobs without consuming a tick',()=>{
 const fixture=domestic();
 for(const bad of [
  {playerFrame:{}},{ownerPlayerId:'away-10'},
  {globalResponse:1,grassResistance:0.4},
  {globalResponse:0.4},{globalResponse:NaN},
  {officialMatchResult:{home:5,away:0}},null,[]
 ]){
  assert.throws(()=>createPhysicalFixtureStepRuntime(R,fixture,scene,bad),
   /Only a canonical-shaped fixture|only one global response|One bounded global ball response/);
 }
 const rt=createPhysicalFixtureStepRuntime(R,fixture,scene);
 try{
  for(const bad of [0,-1,NaN,Infinity,'1',601,1.25]){
   assert.throws(()=>rt.advance(bad),/Physical fixture advance requires/);
   assert.equal(rt.snapshot().physicsTick,0);
  }
  for(const bad of [null,{},0,{started:['away-10']}]){
   assert.throws(()=>rt.step(bad),/never accepts injected/);
   assert.throws(()=>rt.reset(bad),/never accepts injected/);
   assert.throws(()=>rt.snapshot(bad),/never accepts injected/);
  }
  assert.throws(()=>rt.advance(1,{ownerPlayerId:'home-10'}),
   /never accepts injected/);
  assert.equal(rt.snapshot().physicsTick,0);
  assert.equal(rt.step().physicsTick,1);
 }finally{rt.dispose();}
});

test('A1.3a CLI truly executes real Rapier physical fixture steps; repeat sha witness and keep backend score-only',()=>{
 const script=fileURLToPath(new URL('../tools/physical-fixture-runner.mjs',import.meta.url));
 const fixture=domestic('IT',5,6),req={
  fixture,scenario:scene,ticks:155
 };
 const run=input=>spawnSync(process.execPath,[script],{
  input:JSON.stringify(input),encoding:'utf8',timeout:20000
 });
 const a=run(req),b=run(req);
 assert.equal(a.status,0,a.stderr);
 assert.equal(b.status,0,b.stderr);
 const x=JSON.parse(a.stdout),y=JSON.parse(b.stdout);
 assert.deepEqual(x,y);
 assert.equal(x.fixtureId,fixture.id);
 assert.equal(x.ticks,155);
 assert.equal(x.playerCount,22);
 assert.equal(x.globalResponse,1);
 assert.equal(x.physicalRapierStep,true);
 assert.ok(x.realFootStarts>=2);
 assert.ok(x.realFootEnds>=2);
 assert.match(x.canonicalPhysicalEvidenceSha256,/^[a-f0-9]{64}$/);
 assert.equal(x.fixtureCalendarVerified,false);
 assert.equal(x.rosterBound,false);
 assert.equal(x.officialMatchResult,null);
 assert.equal(x.productionScoringConnected,false);
 assert.equal(x.scoreAuthority,'external-temporary-score-v1');
 assert.equal(run({...req,owner:'away-10'}).status,1,
  'CLI refuses synthetic owner injection');
 const temporary=readFileSync(new URL('../../backend/src/temporary-simulation.ts',
  import.meta.url),'utf8');
 const progression=readFileSync(new URL('../../backend/src/knockout-progression.ts',
  import.meta.url),'utf8');
 assert.match(temporary,/temporary-score-v1/);
 assert.match(progression,/simulateTemporaryMatch/);
 assert.doesNotMatch(temporary,/createPhysicalFixtureStepRuntime/);
 assert.doesNotMatch(progression,/createPhysicalFixtureStepRuntime/);
});

test('A1.3b.2a all 22 temporary players share 20 neutral stats and actual uniform motion limits',()=>{
 const fixture=domestic('IT',4,5);
 const s=createPhysicalFixtureStepRuntime(R,fixture,scene);
 try{
  const x=s.snapshot(),squad=x.temporarySquad;
  assert.equal(squad.playerCount,22);
  assert.equal(squad.playersPerTeam,11);
  assert.equal(squad.source,'homogeneous-temporary-actors');
  assert.equal(squad.statsHomogeneous,true);
  assert.equal(squad.ratingsAppliedToPhysics,false);
  assert.equal(squad.generatedPlayersUsed,false);
  assert.equal(squad.rosterBound,false);
  assert.equal(x.officialMatchResult,null);
  assert.equal(Object.keys(TEMPORARY_PLAYER_ATTRIBUTES).length,20);
  assert.ok(Object.values(TEMPORARY_PLAYER_ATTRIBUTES).every(v=>v===50));
  assert.deepEqual(TEMPORARY_UNIFORM_MOVEMENT,{
   maxSpeedMps:PLAYER_MAX_SPEED_MPS,
   accelerationMps2:PLAYER_ACCEL_MPS2,
   brakingMps2:PLAYER_BRAKE_MPS2,
   turnRadPerSecond:PLAYER_TURN_RAD_PER_S
  });
  assert.deepEqual(squad.players.map(p=>p.engineId),
   ['home','away'].flatMap(team=>Array.from(
    {length:11},(_,i)=>team+'-'+(i+1))));
  for(const team of ['home','away']){
   const players=squad.players.filter(p=>p.team===team);
   assert.equal(players.length,11);
   assert.ok(players.every(p=>p.clubId===
    (team==='home'?fixture.homeClubId:fixture.awayClubId)));
   assert.ok(players.every(p=>p.playerId===null&&
    p.generatedPlayerId===null&&p.temporary));
   assert.ok(players.every(p=>p.attributes===TEMPORARY_PLAYER_ATTRIBUTES));
   assert.ok(players.every(p=>p.movementLimits===TEMPORARY_UNIFORM_MOVEMENT));
   assert.ok(players.every(Object.isFrozen));
  }
  assert.ok(Object.isFrozen(squad));
  assert.ok(Object.isFrozen(squad.players));
  assert.equal(s.step().temporarySquad,squad);
  const reset=s.reset();
  try{assert.deepEqual(reset.snapshot().temporarySquad,squad);}
  finally{reset.dispose();}
 }finally{s.dispose();}
});

test('A1.3b.2a two club pairings with identical uniform ratings give identical real Rapier contact paths',()=>{
 const a=createPhysicalFixtureStepRuntime(R,domestic('ENG',1,2),scene);
 const b=createPhysicalFixtureStepRuntime(R,domestic('DE',3,4),scene);
 try{
  assert.notDeepEqual(a.snapshot().temporarySquad.players.map(p=>p.clubId),
   b.snapshot().temporarySquad.players.map(p=>p.clubId));
  for(let tick=1;tick<=90;tick++){
   const x=a.step(),y=b.step();
   assert.equal(x.canonicalBall,y.canonicalBall);
   assert.deepEqual(x.footContact,y.footContact);
   assert.equal(x.generatedPlayersUsed,false);
   assert.equal(y.officialMatchResult,null);
  }
 }finally{a.dispose();b.dispose();}
 assert.throws(()=>createPhysicalFixtureStepRuntime(R,domestic(),scene,{
  globalResponse:1,playerRatings:{speed:99}
 }),/Only a canonical-shaped fixture/);
});


test('A4.1 normal physical fixture steps expose closed club-bound real Rapier shoe START/ACTIVE/END',()=>{
 const fixture=domestic('ENG',2,3);
 const run=createPhysicalFixtureStepRuntime(R,fixture,scene);
 const plain=createUniversalMatchBallSession(R,scene);
 const expectedClub={home:fixture.homeClubId,away:fixture.awayClubId};
 try{
  const zero=run.snapshot().physicalContactFeed;
  assert.equal(zero.physicsTick,0);
  assert.deepEqual([zero.started,zero.ended,zero.active],[[],[],[]]);
  assert.equal(zero.anyActive,false);
  assert.equal(zero.lifecycleIntegrated,false);
  assert.equal(zero.officialMatchPossession,false);
  assert.ok(Object.isFrozen(zero));
  const frames=run.advance(155);
  let firstStarts=0,ends=0;
  for(const [i,f] of frames.entries()){
   const contact=f.physicalContactFeed,raw=f.footContact,truth=plain.step();
   assert.equal(contact.version,PHYSICAL_FIXTURE_CONTACT_FEED_VERSION);
   assert.equal(contact.physicsTick,i+1);
   assert.equal(contact.fixtureId,fixture.id);
   assert.equal(contact.contactSource,'same-step-real-rapier-shoe-ball-collider');
   assert.equal(contact.shoesInPhysics,22);
   assert.equal(contact.temporaryPlayersOnly,true);
   assert.equal(contact.generatedPlayersUsed,false);
   assert.equal(contact.realPlayerRosterBound,false);
   assert.equal(contact.officialMatchAction,false);
   assert.equal(contact.officialMatchPossession,false);
   assert.equal(contact.officialGoalEvidence,false);
   assert.equal(contact.lifecycleIntegrated,false);
   assert.equal(f.officialMatchResult,null);
   assert.equal(f.productionScoringConnected,false);
   assert.equal(f.canonicalBall,canonicalSnapshot(truth.ballSnapshot),
    'contact feed never changes the authoritative Rapier ball path');
   assert.deepEqual(raw,truth.footContact);
   for(const category of ['started','ended','active']){
    const people=contact[category];
    assert.deepEqual(people.map(p=>p.engineId),raw[category]);
    assert.ok(Object.isFrozen(people));
    for(const actor of people){
     assert.ok(Object.isFrozen(actor));
     assert.equal(actor.clubId,expectedClub[actor.team]);
     assert.equal(actor.playerId,null);
     assert.equal(actor.generatedPlayerId,null);
     assert.equal(actor.temporary,true);
     assert.equal(f.temporarySquad.players.find(p=>p.engineId===actor.engineId)?.clubId,
      actor.clubId);
    }
   }
   assert.equal(contact.anyActive,raw.active.length>0);
   assert.equal(contact.multipleActive,raw.active.length>1);
   firstStarts+=contact.started.length;ends+=contact.ended.length;
  }
  assert.ok(firstStarts>=2&&ends>=2);
  assert.deepEqual(frames[0].physicalContactFeed.started.map(x=>x.engineId),['away-10']);
  assert.deepEqual(frames[18].physicalContactFeed.ended.map(x=>x.engineId),['away-10']);
  assert.deepEqual(frames[126].physicalContactFeed.started.map(x=>x.engineId),['home-10']);
  const reset=run.reset();
  try{
   assert.deepEqual(reset.advance(155).map(f=>f.physicalContactFeed),
    frames.map(f=>f.physicalContactFeed));
  }finally{reset.dispose();}
 }finally{run.dispose();plain.dispose();}
});

test('A4.1 no-contact, alternative fixture and spoofed contact command cannot create a physical event',()=>{
 const fixture=domestic('FR',2,4);
 const untouched=createPhysicalFixtureStepRuntime(R,fixture,noContact);
 try{
  for(const f of untouched.advance(70)){
   assert.deepEqual(f.physicalContactFeed.started,[]);
   assert.deepEqual(f.physicalContactFeed.ended,[]);
   assert.deepEqual(f.physicalContactFeed.active,[]);
   assert.equal(f.physicalContactFeed.anyActive,false);
   assert.equal(f.officialMatchResult,null);
  }
  const next=untouched.snapshot();
  assert.throws(()=>untouched.step({footContact:{started:['home-10']}}),
   /never accepts injected/);
  assert.equal(untouched.snapshot(),next);
 }finally{untouched.dispose();}
 const other=createPhysicalFixtureStepRuntime(R,domestic('DE',3,4),scene);
 try{
  const f=other.step(),started=f.physicalContactFeed.started;
  assert.equal(started[0].clubId,'DE-4');
  assert.equal(started[0].team,'away');
  assert.equal(started[0].playerId,null);
  assert.equal(f.officialMatchPossession,false);
 }finally{other.dispose();}
});


test('A4.2a canonical autonomous assignments and authentic Rapier contacts are paired in all 22 fixture steps',()=>{
 const fixture=domestic('ENG',2,3);
 const runner=createPhysicalFixtureStepRuntime(R,fixture,scene);
 const independent=createUniversalMatchBallSession(R,scene);
 try{
  const atZero=runner.snapshot().contactDecisionObservation;
  assert.equal(atZero.physicsTick,0);
  assert.equal(atZero.duties.length,22);
  assert.equal(atZero.started.length,0);
  assert.equal(atZero.actionPolicyConnected,false);
  const frames=runner.advance(155);
  let nStarts=0,nEnds=0,pressDuties=0;
  for(const [index,frame] of frames.entries()){
   const reference=independent.step(),readout=frame.contactDecisionObservation;
   assert.equal(readout.version,PHYSICAL_FIXTURE_DUTY_CONTACT_VERSION);
   assert.equal(readout.physicsTick,index+1);
   assert.equal(readout.fixtureId,fixture.id);
   assert.equal(readout.source,'same-physics-tick-real-mover-and-rapier');
   assert.equal(readout.playerCount,22);
   assert.equal(readout.duties.length,22);
   assert.equal(readout.actionPolicyConnected,false);
   assert.equal(readout.footballActionExecuted,false);
   assert.equal(readout.officialMatchPossession,false);
   assert.equal(readout.officialGoalEvidence,false);
   assert.equal(readout.productionScoringConnected,false);
   assert.equal(readout.matchesPhysicalContactFeed,true);
   assert.equal(frame.officialMatchResult,null);
   assert.equal(frame.canonicalBall,canonicalSnapshot(reference.ballSnapshot));
   assert.deepEqual(frame.footContact,reference.footContact);
   const predicted=reference.autonomousMovement.players;
   for(const [j,p] of readout.duties.entries()){
    const original=frame.temporarySquad.players[j];
    assert.equal(p.engineId,predicted[j].engineId);
    assert.equal(p.movementDuty,predicted[j].movementDuty);
    assert.equal(p.clubId,original.clubId);
    assert.equal(p.playerId,null);
    assert.equal(p.intendedFootballAction,null);
    assert.equal(p.actionExecuted,false);
    assert.ok(Object.isFrozen(p));
    if(p.movementDuty==='press')pressDuties++;
   }
   for(const phase of ['started','active','ended']){
    assert.deepEqual(readout[phase].map(p=>p.engineId),
     frame.physicalContactFeed[phase].map(p=>p.engineId));
    for(const p of readout[phase]){
     const duty=readout.duties.find(d=>d.engineId===p.engineId);
     assert.equal(p.movementDuty,duty?.movementDuty);
     assert.equal(p.clubId,duty?.clubId);
     assert.equal(p.contactPhase,phase);
     assert.equal(p.contactTick,index+1);
     assert.equal(p.footballActionAuthorized,false);
     assert.equal(p.ballOwnershipConfirmed,false);
     assert.ok(Object.isFrozen(p));
    }
    assert.ok(Object.isFrozen(readout[phase]));
   }
   assert.equal(readout.physicalFootContactsObserved,frame.physicalContactFeed.anyActive);
   assert.ok(Object.isFrozen(readout)&&Object.isFrozen(readout.duties));
   nStarts+=readout.started.length;nEnds+=readout.ended.length;
  }
  assert.ok(pressDuties>0);
  assert.ok(nStarts>=2&&nEnds>=2);
  assert.deepEqual(frames[0].contactDecisionObservation.started.map(p=>p.engineId),
   ['away-10']);
  assert.deepEqual(frames[18].contactDecisionObservation.ended.map(p=>p.engineId),
   ['away-10']);
  assert.deepEqual(frames[126].contactDecisionObservation.started.map(p=>p.engineId),
   ['home-10']);
  const reset=runner.reset();
  try{
   assert.deepEqual(reset.advance(155).map(f=>f.contactDecisionObservation),
    frames.map(f=>f.contactDecisionObservation));
  }finally{reset.dispose();}
 }finally{runner.dispose();independent.dispose();}
});

test('A4.2a no-contact autonomous movement cannot fabricate touches, actions or a scorer',()=>{
 const r=createPhysicalFixtureStepRuntime(R,domestic('FR',2,4),noContact);
 try{
  const baseline=r.snapshot();
  assert.equal(baseline.contactDecisionObservation.duties.length,22);
  assert.deepEqual(baseline.contactDecisionObservation.started,[]);
  for(const frame of r.advance(75)){
   const decision=frame.contactDecisionObservation;
   assert.equal(decision.duties.length,22);
   assert.deepEqual(decision.started,[]);
   assert.deepEqual(decision.active,[]);
   assert.deepEqual(decision.ended,[]);
   assert.equal(decision.footballActionExecuted,false);
   assert.equal(decision.actionPolicyConnected,false);
   assert.equal(frame.productionScoringConnected,false);
  }
  const current=r.snapshot();
  assert.throws(()=>r.step({press:'home-10',passTo:'home-7'}),
   /never accepts injected/);
  assert.equal(r.snapshot(),current);
 }finally{r.dispose();}
 const fixture=domestic('DE',3,4);
 const s=createPhysicalFixtureStepRuntime(R,fixture,scene);
 try{
  const f=s.step(),d=f.contactDecisionObservation.started[0];
  assert.equal(d.engineId,'away-10');
  assert.equal(d.clubId,fixture.awayClubId);
  assert.equal(d.team,'away');
  assert.equal(d.playerId,null);
  assert.equal(d.intendedFootballAction,null);
 }finally{s.dispose();}
});


test('A4.2b.1 opt-in real Rapier action is selected for ANY verified temporary shoe, applies real impulse, keeps baseline untouched',()=>{
 const fixture=domestic('ENG',2,3),autonomous={autonomousActions:true};
 const run=createPhysicalFixtureStepRuntime(R,fixture,scene,autonomous);
 const original=createPhysicalFixtureStepRuntime(R,fixture,scene);
 const replay=createPhysicalFixtureStepRuntime(R,fixture,scene,autonomous);
 try{
  assert.equal(run.snapshot().localAutonomousAction,null);
  assert.equal(original.snapshot().autonomousActionMode,false);
  const advanced=run.step(),reference=original.step();
  assert.equal(advanced.physicsTick,1);
  assert.deepEqual(advanced.footContact,reference.footContact);
  assert.ok(advanced.footContact.started.includes('away-10'));
  const action=advanced.localAutonomousAction;
  assert.ok(action,'first autonomous touch executes one real physical action');
  assert.equal(action.playerId,'away-10');
  assert.equal(action.tick,1);
  assert.ok(['pass','shot','clearance'].includes(action.action));
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.officialMatchAction,false);
  assert.equal(action.officialMatchPossession,false);
  assert.equal(action.officialMatchResult,null);
  assert.equal(action.temporaryPlayersOnly,true);
  assert.equal(advanced.ballForceApplied,true);
  assert.equal(advanced.localFootballActionExecuted,true);
  assert.equal(advanced.contactDecisionObservation.actionPolicyConnected,true);
  assert.equal(advanced.contactDecisionObservation.footballActionExecuted,true);
  assert.equal(advanced.contactDecisionObservation.localAutonomousAction,action);
  assert.equal(advanced.contactDecisionObservation.officialGoalEvidence,false);
  assert.equal(advanced.officialMatchResult,null);
  assert.equal(advanced.productionScoringConnected,false);
  assert.notEqual(advanced.canonicalBall,reference.canonicalBall,
   'actual on-contact Rapier body receives a kick impulse');
  assert.deepEqual(replay.step(),advanced);
  const seq=run.advance(100),replaySeq=replay.advance(100);
  assert.deepEqual(seq,replaySeq,'same seeded real Rapier action replay');
  for(const frame of seq){
   assert.equal(frame.officialMatchResult,null);
   assert.equal(frame.contactDecisionObservation.actionPolicyConnected,true);
   assert.equal(frame.localFootballActionExecuted,frame.localAutonomousAction!==null);
   if(frame.localAutonomousAction){
    assert.ok(frame.physicalContactFeed.started.some(p=>
     p.engineId===frame.localAutonomousAction.playerId));
    assert.equal(frame.ballForceApplied,true);
   }
  }
  const fresh=run.reset();
  try{
   assert.deepEqual(fresh.step(),advanced);
   assert.deepEqual(fresh.advance(100),seq);
  }finally{fresh.dispose();}
 }finally{run.dispose();original.dispose();replay.dispose();}
});

test('A4.2b.1 zero physical shoe contact means no chosen action, impulse, or fabricated scorer',()=>{
 const f=domestic('FR',2,4);
 const a=createPhysicalFixtureStepRuntime(R,f,noContact,{autonomousActions:true});
 const baseline=createPhysicalFixtureStepRuntime(R,f,noContact);
 try{
  for(let i=0;i<75;i++){
   const s=a.step(),ref=baseline.step();
   assert.equal(s.localAutonomousAction,null);
   assert.equal(s.localFootballActionExecuted,false);
   assert.equal(s.ballForceApplied,false);
   assert.equal(s.contactDecisionObservation.actionPolicyConnected,true);
   assert.equal(s.contactDecisionObservation.footballActionExecuted,false);
   assert.deepEqual(s.physicalContactFeed.started,[]);
   assert.equal(s.canonicalBall,ref.canonicalBall);
   assert.equal(s.officialMatchResult,null);
  }
 }finally{a.dispose();baseline.dispose();}
 for(const options of [
  {autonomousActions:false},{autonomousActions:'true'},
  {autonomousActions:true,passTo:'home-10'},
  {autonomousActions:true,shotPower:999},
  {globalResponse:1,autonomousActions:true,actor:'away-10'}
 ]) assert.throws(()=>createPhysicalFixtureStepRuntime(R,f,scene,options),
 /Only a canonical-shaped fixture/);
 const x=createPhysicalFixtureStepRuntime(R,f,scene,{autonomousActions:true});
 try{
  assert.throws(()=>x.step({action:'shot',playerId:'away-10'}),
   /never accepts injected/);
  assert.equal(x.snapshot().physicsTick,0);
 }finally{x.dispose();}
});


test('A4.2b.2 actual 60Hz Rapier action aftermath tracks 12 subsequent frames without claiming a pass or goal',()=>{
 const fixture=domestic('ENG',2,3);
 const options={autonomousActions:true};
 const live=createPhysicalFixtureStepRuntime(R,fixture,scene,options);
 const independent=createPhysicalFixtureStepRuntime(R,fixture,scene,options);
 const baseline=createPhysicalFixtureStepRuntime(R,fixture,scene);
 try{
  const before=live.snapshot().physicalActionOutcome;
  assert.equal(before.physicsTick,0);
  assert.equal(before.active,null);
  assert.equal(before.lastCompleted,null);
  const first=live.step(),baselineFirst=baseline.step();
  const action=first.localAutonomousAction;
  assert.ok(action,'real Rapier shoe START triggers action');
  assert.equal(action.tick,1);
  assert.ok(first.physicalContactFeed.started.some(p=>p.engineId===action.playerId));
  assert.equal(action.decisionContext.outcomeNotYetObserved,true);
  assert.equal(action.decisionContext.passCompleted,false);
  assert.equal(action.decisionContext.goalScored,false);
  assert.notEqual(first.canonicalBall,baselineFirst.canonicalBall);
  const firstOutcome=first.physicalActionOutcome;
  assert.equal(firstOutcome.physicsTick,1);
  assert.equal(firstOutcome.latestExecutedAction,action);
  assert.equal(firstOutcome.active.actionTick,1);
  assert.equal(firstOutcome.active.playerId,action.playerId);
  assert.equal(firstOutcome.active.elapsedPhysicsTicks,0);
  assert.equal(firstOutcome.active.ballTravelSinceImpulseM,0);
  assert.equal(firstOutcome.active.terminal,false);
  assert.equal(firstOutcome.active.passCompleted,null);
  assert.equal(firstOutcome.active.goalScored,null);
  assert.equal(firstOutcome.actionSuccessAdjudicated,false);
  assert.equal(firstOutcome.officialMatchResult,null);
  assert.ok(Object.isFrozen(firstOutcome.active));
  assert.deepEqual(independent.step(),first);
  const later=live.advance(15),again=independent.advance(15);
  assert.deepEqual(later,again,'action outcome ledger replay remains deterministic');
  const at12=later[10].physicalActionOutcome;
  assert.equal(at12.physicsTick,12);
  assert.equal(at12.active?.actionTick,1);
  assert.equal(at12.active?.elapsedPhysicsTicks,11);
  const at13=later[11].physicalActionOutcome;
  assert.equal(at13.physicsTick,13);
  assert.equal(at13.lastCompleted?.actionTick,1);
  assert.equal(at13.lastCompleted.terminal,true);
  assert.equal(at13.lastCompleted.elapsedPhysicsTicks,12);
  assert.ok(at13.lastCompleted.ballTravelSinceImpulseM>0);
  assert.equal(at13.lastCompleted.shotOnTarget,null);
  assert.equal(at13.lastCompleted.passCompleted,null);
  assert.equal(at13.lastCompleted.interceptionConfirmed,null);
  assert.equal(at13.lastCompleted.tackleConfirmed,null);
  assert.equal(at13.lastCompleted.goalScored,null);
  assert.equal(at13.actionSuccessAdjudicated,false);
  assert.ok(Object.isFrozen(at13.lastCompleted.opponentShoeStarts));
  for(const frame of later){
   const observation=frame.physicalActionOutcome;
   assert.equal(observation.physicsTick,frame.physicsTick);
   assert.equal(observation.fixtureId,fixture.id);
   assert.equal(observation.physicalActionExecutionProven,
    frame.localAutonomousAction!==null);
   assert.equal(observation.latestExecutedAction,frame.localAutonomousAction);
   assert.equal(observation.officialMatchResult,null);
   assert.equal(observation.officialGoalEvidence,false);
   assert.equal(frame.officialMatchResult,null);
   assert.ok(Object.isFrozen(observation));
  }
  const restarted=live.reset();
  try{
   assert.deepEqual(restarted.step(),first);
   assert.deepEqual(restarted.advance(15),later);
  }finally{restarted.dispose();}
 }finally{live.dispose();independent.dispose();baseline.dispose();}
});

test('A4.2b.2 opt-out and no-contact preserve original Rapier trajectory and yield NO physical action outcome',()=>{
 for(const opts of [{}, {autonomousActions:true}]){
  const none=createPhysicalFixtureStepRuntime(R,domestic('FR',2,4),noContact,opts);
  const baseline=createPhysicalFixtureStepRuntime(R,domestic('FR',2,4),noContact);
  try{
   for(let t=1;t<=45;t++){
    const f=none.step(),r=baseline.step(),o=f.physicalActionOutcome;
    assert.equal(f.canonicalBall,r.canonicalBall);
    assert.equal(o.active,null);
    assert.equal(o.lastCompleted,null);
    assert.equal(o.ballMotionObserved,false);
    assert.equal(o.physicalActionExecutionProven,false);
    assert.equal(o.officialMatchPossession,false);
    assert.equal(o.officialMatchResult,null);
    assert.deepEqual(f.physicalContactFeed.started,[]);
   }
  }finally{none.dispose();baseline.dispose();}
 }
 const original=createPhysicalFixtureStepRuntime(R,domestic('ENG',2,3),scene);
 const reference=createUniversalMatchBallSession(R,scene);
 try{
  for(let i=0;i<75;i++){
   const f=original.step(),other=reference.step();
   assert.equal(f.canonicalBall,canonicalSnapshot(other.ballSnapshot));
   assert.equal(f.physicalActionOutcome.active,null);
   assert.equal(f.physicalActionOutcome.lastCompleted,null);
  }
 }finally{original.dispose();reference.dispose();}
});


test('A4.2b.2 local CLI exposes genuine action aftermath but never returns a completed pass or scored goal',()=>{
 const script=fileURLToPath(new URL('../tools/physical-fixture-runner.mjs',import.meta.url));
 const fixture=domestic('IT',5,6);
 const run=input=>spawnSync(process.execPath,[script],{
  input:JSON.stringify(input),encoding:'utf8',timeout:20000
 });
 const trial={fixture,scenario:scene,ticks:30,autonomousActions:true};
 const a=run(trial),b=run(trial);
 assert.equal(a.status,0,a.stderr);
 assert.equal(b.status,0,b.stderr);
 const out=JSON.parse(a.stdout);
 assert.deepEqual(out,JSON.parse(b.stdout));
 assert.equal(out.localFootballActionTrial,true);
 assert.ok(out.localAutonomousActionCount>=1);
 assert.ok(out.completedPhysicalActionObservationWindows>=1);
 assert.equal(out.provisionalObservationWindowTicks,12);
 assert.equal(out.actionSuccessAdjudicated,false);
 assert.equal(out.lastObservedPhysicalAction?.terminal,true);
 assert.ok(out.lastObservedPhysicalAction?.ballTravelSinceImpulseM>=0);
 assert.equal(out.lastObservedPhysicalAction?.passCompleted,null);
 assert.equal(out.lastObservedPhysicalAction?.goalScored,null);
 assert.equal(out.lastObservedPhysicalAction?.interceptionConfirmed,null);
 assert.equal(out.officialMatchResult,null);
 assert.equal(out.productionScoringConnected,false);
 const quiet=run({...trial,scenario:noContact});
 assert.equal(quiet.status,0,quiet.stderr);
 const x=JSON.parse(quiet.stdout);
 assert.equal(x.localAutonomousActionCount,0);
 assert.equal(x.completedPhysicalActionObservationWindows,0);
 assert.equal(x.lastObservedPhysicalAction,null);
 assert.equal(x.actionSuccessAdjudicated,false);
 assert.equal(run({...trial,pretendPassCompleted:true}).status,1);
});

test('A4.3a integrated continuous 11v11 Rapier action evidence is authentic, non-scoring and replayable',()=>{
 const fixture=domestic('ENG',2,3,3),opts={autonomousActions:true};
 const first=createPhysicalFixtureStepRuntime(R,fixture,scene,opts);
 const reference=createPhysicalFixtureStepRuntime(R,fixture,scene,opts);
 try{
  const frames=first.advance(180);
  assert.deepEqual(reference.advance(180),frames);
  let actionCount=0,shoeStarts=0,lastActionTick=-12;
  const closed=new Set();
  for(const [i,f] of frames.entries()){
   const tick=i+1,contacts=f.physicalContactFeed;
   const duties=f.contactDecisionObservation,outcome=f.physicalActionOutcome;
   assert.equal(tick,f.physicsTick);
   assert.ok(Math.abs(f.elapsedSeconds-tick*FIXED_DT)<1e-8);
   assert.equal(contacts.physicsTick,tick);
   assert.equal(duties.physicsTick,tick);
   assert.equal(outcome.physicsTick,tick);
   assert.equal(f.playerCount,22);
   assert.equal(f.temporarySquad.playersPerTeam,11);
   assert.equal(duties.duties.length,22);
   assert.equal(duties.started.length,contacts.started.length);
   shoeStarts+=contacts.started.length;
   for(let j=0;j<contacts.started.length;j++){
    const actual=contacts.started[j],assigned=duties.started[j];
    assert.equal(assigned.engineId,actual.engineId);
    assert.equal(assigned.team,actual.team);
    assert.equal(assigned.clubId,actual.clubId);
    assert.equal(assigned.contactTick,tick);
    assert.equal(actual.playerId,null);
   }
   const action=f.localAutonomousAction;
   assert.equal(f.localFootballActionExecuted,action!==null);
   assert.equal(f.ballForceApplied,action!==null);
   assert.equal(duties.footballActionExecuted,action!==null);
   assert.equal(outcome.latestExecutedAction,action);
   assert.equal(outcome.actionSuccessAdjudicated,false);
   assert.equal(f.officialMatchResult,null);
   assert.equal(f.officialMatchPossession,false);
   assert.equal(f.officialMatchActions,false);
   assert.equal(f.productionScoringConnected,false);
   assert.equal(f.generatedPlayersUsed,false);
   assert.equal(f.rosterBound,false);
   assert.ok(Object.isFrozen(f)&&Object.isFrozen(contacts)&&
    Object.isFrozen(duties)&&Object.isFrozen(outcome));
   if(action){
    actionCount++;
    assert.ok(tick-lastActionTick>=12);
    lastActionTick=tick;
    assert.ok(contacts.started.some(p=>
     p.engineId===action.playerId&&p.team===action.team));
    assert.equal(contacts.active.length,1,'real shoe contact must be exclusive');
    assert.equal(contacts.started.length,1,'only one real shoe starts');
    assert.equal(contacts.active[0].engineId,action.playerId);
    assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
    assert.equal(action.appliedByRapier,true);
    assert.equal(action.actualPhysicsImpulseApplied,true);
    assert.equal(action.officialMatchAction,false);
    assert.equal(outcome.active?.actionTick,tick);
   }
   const completed=outcome.lastCompleted;
   if(completed&&!closed.has(completed.actionTick)){
    closed.add(completed.actionTick);
    assert.equal(completed.terminal,true);
    assert.equal(completed.elapsedPhysicsTicks,12);
    for(const name of ['passCompleted','shotOnTarget','interceptionConfirmed',
     'tackleConfirmed','goalScored'])assert.equal(completed[name],null);
   }
  }
  assert.ok(shoeStarts>=actionCount&&actionCount>0);
  assert.ok(closed.size>0,'at least one full observed 12-tick Rapier window');
  const fresh=first.reset();
  try{assert.deepEqual(fresh.advance(180),frames);}
  finally{fresh.dispose();}
 }finally{first.dispose();reference.dispose();}
});

test('A4.3a local CLI action-provenance digest is deterministic and never a score receipt',()=>{
 const script=fileURLToPath(new URL('../tools/physical-fixture-runner.mjs',import.meta.url));
 const fixture=domestic('IT',5,6);
 const run=input=>spawnSync(process.execPath,[script],{
  input:JSON.stringify(input),encoding:'utf8',timeout:30000
 });
 const trial={fixture,scenario:scene,ticks:45,autonomousActions:true};
 const a=run(trial),b=run(trial),control=run({fixture,scenario:scene,ticks:45});
 for(const out of [a,b,control])assert.equal(out.status,0,out.stderr);
 const first=JSON.parse(a.stdout),second=JSON.parse(b.stdout);
 const baseline=JSON.parse(control.stdout);
 assert.deepEqual(first,second);
 assert.match(first.localActionProvenanceSha256,/^[0-9a-f]{64}$/);
 assert.match(first.canonicalPhysicalEvidenceSha256,/^[0-9a-f]{64}$/);
 assert.equal(first.actionProvenanceSource,
  'real-rapier-shoe-duty-impulse-and-window');
 assert.equal(first.actionProvenanceIsOfficial,false);
 assert.ok(first.localAutonomousActionCount>0);
 assert.notEqual(first.localActionProvenanceSha256,
  baseline.localActionProvenanceSha256);
 assert.equal(baseline.localAutonomousActionCount,0);
 assert.equal(first.officialMatchResult,null);
 assert.equal(first.productionScoringConnected,false);
 assert.equal(first.scoreAuthority,'external-temporary-score-v1');
 assert.equal(first.playersPerTeam,11);
 assert.equal(first.rosterBound,false);
 assert.equal(first.generatedPlayersUsed,false);
});

test('A4.3b independent domestic/international 11v11 scenarios preserve verified 60Hz contact/action/replay/reset',()=>{
 const cases=[
  {name:'domestic home/away contact',fixture:domestic('ENG',2,3,4),
   scenario:scene,options:{autonomousActions:true},ticks:150,actionRequired:true},
  {name:'international club identity and shared response',fixture:international,
   scenario:scene,options:{autonomousActions:true,globalResponse:1.15},
   ticks:150,actionRequired:true},
  {name:'distant no-contact shared response',fixture:domestic('ES',5,6,2),
   scenario:noContact,options:{autonomousActions:true,globalResponse:0.85},
   ticks:60,actionRequired:false},
  {name:'independent gravity drop',fixture:domestic('IT',5,6,3),
   scenario:{preset:'drop',seed:'me-pb-55-a43b-drop'},
   options:{autonomousActions:true},ticks:80,actionRequired:null}
 ];
 for(const c of cases){
  const live=createPhysicalFixtureStepRuntime(R,c.fixture,c.scenario,c.options);
  const reference=createPhysicalFixtureStepRuntime(R,c.fixture,c.scenario,c.options);
  try{
   const frames=live.advance(c.ticks),prior=new Set(),closed=new Set();
   let count=0;
   assert.equal(live.snapshot(),frames.at(-1),c.name);
   for(const [i,f] of frames.entries()){
    const tick=i+1,feed=f.physicalContactFeed;
    const duty=f.contactDecisionObservation,outcome=f.physicalActionOutcome;
    assert.deepEqual(reference.step(),f,c.name+' exact independent 60Hz replay '+tick);
    assert.equal(f.physicsTick,tick);
    assert.ok(Math.abs(f.elapsedSeconds-tick*FIXED_DT)<1e-8);
    assert.equal(feed.physicsTick,tick);
    assert.equal(duty.physicsTick,tick);
    assert.equal(outcome.physicsTick,tick);
    assert.equal(f.fixtureId,c.fixture.id);
    assert.equal(f.temporarySquad.playersPerTeam,11);
    assert.equal(f.temporarySquad.statsHomogeneous,true);
    assert.equal(f.playerCount,22);
    assert.equal(f.generatedPlayersUsed,false);
    assert.equal(f.rosterBound,false);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.officialGoalEvidence,false);
    assert.equal(f.productionScoringConnected,false);
    assert.equal(f.remotePersistence,false);
    assert.equal(outcome.actionSuccessAdjudicated,false);
    assert.equal(outcome.officialMatchResult,null);
    assert.ok(Object.isFrozen(f)&&Object.isFrozen(feed)&&
     Object.isFrozen(duty)&&Object.isFrozen(outcome));
    for(const phase of ['started','active','ended']){
     assert.deepEqual(feed[phase].map(x=>x.engineId),f.footContact[phase],
      c.name+' authentic Rapier '+phase+' tick '+tick);
     assert.deepEqual(duty[phase].map(x=>x.engineId),f.footContact[phase]);
    }
    for(const p of feed.started)assert.equal(prior.has(p.engineId),false,
     c.name+' START cannot repeat an active shoe');
    for(const p of feed.ended)assert.equal(
     prior.has(p.engineId)||feed.started.some(x=>x.engineId===p.engineId),true);
    const next=new Set([...prior,...feed.started.map(p=>p.engineId)]);
    for(const p of feed.ended)next.delete(p.engineId);
    assert.deepEqual([...next].sort(),feed.active.map(p=>p.engineId).sort(),
     c.name+' START/ACTIVE/END must reconcile');
    prior.clear();for(const p of next)prior.add(p);
    const action=f.localAutonomousAction;
    assert.equal(f.ballForceApplied,action!==null);
    assert.equal(duty.footballActionExecuted,action!==null);
    assert.equal(outcome.latestExecutedAction,action);
    if(feed.active.length>1||feed.started.length!==1)
     assert.equal(action,null,'contested or non-exclusive contact may not kick');
    if(action){
     count++;
     assert.equal(feed.started.length,1);
     assert.equal(feed.active.length,1);
     assert.equal(feed.started[0].engineId,action.playerId);
     assert.equal(feed.active[0].engineId,action.playerId);
     assert.equal(feed.active[0].team,action.team);
     assert.equal(action.appliedByRapier,true);
     assert.equal(action.actualPhysicsImpulseApplied,true);
     assert.equal(action.officialMatchAction,false);
     assert.equal(action.officialMatchResult,null);
     assert.equal(outcome.active?.actionTick,tick);
     const impulse=Math.hypot(...['x','y','z'].map(k=>action.impulseNs[k]));
     assert.ok(impulse>0&&impulse<=3.000001,
      'physical ball impulse uses the uniform bounded policy');
    }
    const terminal=outcome.lastCompleted;
    if(terminal&&!closed.has(terminal.actionTick)){
     closed.add(terminal.actionTick);
     assert.equal(terminal.terminal,true);
     assert.equal(terminal.elapsedPhysicsTicks,12);
     assert.equal(terminal.passCompleted,null);
     assert.equal(terminal.shotOnTarget,null);
     assert.equal(terminal.interceptionConfirmed,null);
     assert.equal(terminal.tackleConfirmed,null);
     assert.equal(terminal.goalScored,null);
    }
   }
   if(c.actionRequired===true)assert.ok(count>0,c.name+' must execute a genuine action');
   if(c.actionRequired===false)assert.equal(count,0,c.name+' must remain contact-free');
   const restarted=live.reset();
   try{
    assert.throws(()=>live.step(),/disposed/);
    assert.throws(()=>live.snapshot(),/disposed/);
    assert.equal(restarted.snapshot().physicsTick,0);
    assert.deepEqual(restarted.advance(c.ticks),frames,
     c.name+' reset must replay physical evidence, not a saved transcript');
   }finally{restarted.dispose();}
  }finally{live.dispose();reference.dispose();}
 }
});

test('A4.3b only fixture labels differ across homogeneous domestic and international 11v11 Rapier runs',()=>{
 const local=createPhysicalFixtureStepRuntime(
  R,domestic('ENG',2,3,4),scene,{autonomousActions:true});
 const foreign=createPhysicalFixtureStepRuntime(
  R,international,scene,{autonomousActions:true});
 try{
  let executed=0;
  for(let i=1;i<=110;i++){
   const a=local.step(),b=foreign.step();
   assert.notEqual(a.fixtureId,b.fixtureId);
   assert.equal(a.canonicalBall,b.canonicalBall);
   assert.deepEqual(a.footContact,b.footContact);
   assert.deepEqual(a.localAutonomousAction,b.localAutonomousAction);
   assert.deepEqual(a.ballSnapshot,b.ballSnapshot);
   assert.equal(a.physicalActionOutcome.active?.actionTick??null,
    b.physicalActionOutcome.active?.actionTick??null);
   assert.equal(a.physicalActionOutcome.lastCompleted?.ballTravelSinceImpulseM??null,
    b.physicalActionOutcome.lastCompleted?.ballTravelSinceImpulseM??null);
   assert.equal(a.localAutonomousAction?.officialMatchResult??null,null);
   assert.equal(a.officialMatchResult,null);
   assert.equal(b.officialMatchResult,null);
   if(a.localAutonomousAction)executed++;
  }
  assert.ok(executed>0,'same real shoe actions irrespective of fixture labels');
 }finally{local.dispose();foreign.dispose();}
});

test('A4.3c two isolated 11v11 Rapier fixtures survive interleaving and reset without cross-match state',()=>{
 const home=domestic('ENG',2,3,5),away=international;
 const firstOptions={autonomousActions:true,globalResponse:0.85};
 const secondOptions={autonomousActions:true,globalResponse:1.15};
 let first=createPhysicalFixtureStepRuntime(R,home,scene,firstOptions);
 const firstControl=createPhysicalFixtureStepRuntime(R,home,scene,firstOptions);
 const second=createPhysicalFixtureStepRuntime(R,away,scene,secondOptions);
 const secondControl=createPhysicalFixtureStepRuntime(R,away,scene,secondOptions);
 try{
  const firstHistory=[];
  let firstActions=0,secondActions=0;
  for(let tick=1;tick<=160;tick++){
   // Advance the OTHER fixture first: there must be no shared Rapier
   // clock, action cooldown, contact timeline or observer state.
   const b=second.step(),bExpected=secondControl.step();
   assert.deepEqual(b,bExpected,'fixture B independent at tick '+tick);
   assert.equal(b.physicsTick,tick);
   assert.equal(b.fixtureId,away.id);
   assert.equal(b.officialMatchResult,null);
   if(b.localAutonomousAction)secondActions++;
   if(tick<=100){
    const a=first.step(),expected=firstControl.step();
    assert.deepEqual(a,expected,'fixture A independent at tick '+tick);
    assert.equal(a.physicsTick,tick);
    assert.equal(a.fixtureId,home.id);
    assert.equal(a.officialMatchResult,null);
    if(a.localAutonomousAction)firstActions++;
    firstHistory.push(a);
   }
   if(tick===100){
    const bBefore=second.snapshot(),bReferenceBefore=secondControl.snapshot();
    const old=first;
    first=old.reset();
    assert.throws(()=>old.snapshot(),/disposed/);
    assert.throws(()=>old.step(),/disposed/);
    assert.equal(first.snapshot().physicsTick,0);
    assert.equal(first.snapshot().fixtureId,home.id);
    for(const [i,expected] of firstHistory.entries())
     assert.deepEqual(first.step(),expected,
      'fresh Rapier world replays fixture A tick '+(i+1));
    assert.equal(second.snapshot(),bBefore,
     'fixture A reset/replay must not mutate B');
    assert.equal(secondControl.snapshot(),bReferenceBefore);
   }
  }
  assert.ok(firstActions>0&&secondActions>0,'both matches have real physical kicks');
  assert.equal(first.snapshot().physicsTick,100);
  assert.equal(second.snapshot().physicsTick,160);
  assert.equal(firstControl.snapshot().physicsTick,100);
  assert.equal(secondControl.snapshot().physicsTick,160);
  assert.equal(first.snapshot().officialMatchResult,null);
  assert.equal(second.snapshot().officialMatchResult,null);
 }finally{
  first.dispose();firstControl.dispose();second.dispose();secondControl.dispose();
 }
});

test('A4.3c independent CLI digest binds fixture identity but does not change universal physics or scoring',()=>{
 const script=fileURLToPath(new URL('../tools/physical-fixture-runner.mjs',import.meta.url));
 const invoke=fixture=>spawnSync(process.execPath,[script],{
  input:JSON.stringify({fixture,scenario:scene,ticks:45,autonomousActions:true}),
  encoding:'utf8',timeout:30000
 });
 const home=invoke(domestic('ENG',2,3,1)),foreign=invoke(international);
 assert.equal(home.status,0,home.stderr);
 assert.equal(foreign.status,0,foreign.stderr);
 const a=JSON.parse(home.stdout),b=JSON.parse(foreign.stdout);
 assert.ok(a.localAutonomousActionCount>0&&b.localAutonomousActionCount>0);
 assert.notEqual(a.fixtureId,b.fixtureId);
 assert.equal(a.canonicalPhysicalEvidenceSha256,b.canonicalPhysicalEvidenceSha256,
  'the universal Rapier ball ignores synthetic club metadata');
 assert.equal(a.finalCanonicalBall,b.finalCanonicalBall);
 assert.notEqual(a.localActionProvenanceSha256,b.localActionProvenanceSha256,
  'local diagnostic action transcript must be fixture-bound');
 for(const out of [a,b]){
  assert.equal(out.actionProvenanceIsOfficial,false);
  assert.equal(out.scoreAuthority,'external-temporary-score-v1');
  assert.equal(out.productionScoringConnected,false);
  assert.equal(out.officialMatchResult,null);
  assert.equal(out.rosterBound,false);
  assert.equal(out.generatedPlayersUsed,false);
  assert.equal(out.playersPerTeam,11);
  assert.ok(out.completedPhysicalActionObservationWindows>=1);
  assert.equal(out.lastObservedPhysicalAction?.passCompleted,null);
  assert.equal(out.lastObservedPhysicalAction?.goalScored,null);
 }
});

test('C1.1 real 11v11 Rapier pass attempts bind a frozen live target to physical travel and reset',()=>{
 const fixture=domestic('ENG',2,3,5);
 const session=createPhysicalFixtureStepRuntime(R,fixture,scene,{autonomousActions:true});
 const replay=createPhysicalFixtureStepRuntime(R,fixture,scene,{autonomousActions:true});
 try{
  const frames=session.advance(150),observed=[];
  for(const f of frames){
   assert.deepEqual(replay.step(),f,'genuine Rapier fixture replay');
   const action=f.localAutonomousAction;
   const outcome=f.physicalActionOutcome;
   if(action?.action==='pass'){
    const target=action.passTarget;
    assert.ok(target);
    assert.equal(target.physicsTick,f.physicsTick);
    assert.equal(target.originPlayerId,action.playerId);
    assert.equal(target.recipientId,action.recipientId);
    assert.equal(target.team,action.team);
    assert.equal(f.physicalContactFeed.started.length,1);
    assert.equal(f.physicalContactFeed.active.length,1);
    assert.equal(f.physicalContactFeed.active[0].engineId,action.playerId);
    assert.equal(action.appliedByRapier,true);
    assert.equal(outcome.active?.physicalPassAttempt?.target,target);
    assert.equal(outcome.active?.physicalPassAttempt?.passCompleted,null);
    assert.equal(action.officialMatchResult,null);
    observed.push(action.tick);
   }
   if(outcome.lastCompleted?.action==='pass'){
    const pass=outcome.lastCompleted.physicalPassAttempt;
    assert.ok(pass);
    assert.equal(pass.observedThroughTick,pass.actionTick+12);
    assert.ok(pass.physicalBallTravelM>=0);
    assert.equal(pass.passCompleted,null);
    assert.equal(outcome.lastCompleted.passCompleted,null);
    assert.equal(outcome.lastCompleted.goalScored,null);
   }
  }
  assert.ok(observed.length>0,'a real Rapier pass must occur in this 11v11 scenario');
  const fresh=session.reset();
  try{assert.deepEqual(fresh.advance(150),frames);}
  finally{fresh.dispose();}
  assert.equal(frames.at(-1).officialMatchResult,null);
 }finally{session.dispose();replay.dispose();}
});

test('C1.2a independent real Rapier 11v11 pass follow-through: both teams, no fabricated receiver or opponent',()=>{
 const scenarios=[
  {team:'away',ball:{...scene,x:4.96,vx:-0.3,seed:'c1-away-real-pass'}},
  {team:'home',ball:{...scene,x:-4.96,vx:0.3,seed:'c1-home-real-pass'}}
 ];
 for(const entry of scenarios){
  const fixture=entry.team==='away'?international:domestic('IT',3,8,4);
  const options={autonomousActions:true};
  const real=createPhysicalFixtureStepRuntime(R,fixture,entry.ball,options);
  const reference=createPhysicalFixtureStepRuntime(R,fixture,entry.ball,options);
  let observedPasses=0,verifiedContacts=0;
  try{
   let prior=null;
   for(let tick=1;tick<=165;tick++){
    const frame=real.step(),control=reference.step();
    assert.deepEqual(frame,control,'separate real Rapier worlds have identical '+entry.team+' follow-through');
    assert.equal(frame.physicsTick,tick);
    const trail=frame.physicalActionOutcome.physicalPassFollowThrough;
    assert.equal(trail.physicsTick,tick);
    assert.equal(trail.fixtureId,fixture.id);
    assert.equal(trail.passCompleted,null);
    assert.equal(trail.officialMatchResult,null);
    assert.equal(frame.officialMatchResult,null);
    assert.equal(frame.officialMatchPossession,false);
    const act=frame.localAutonomousAction;
    if(act?.action==='pass'){
     observedPasses++;
     assert.equal(act.team,entry.team);
     assert.equal(frame.physicalContactFeed.started.length,1);
     assert.equal(frame.physicalContactFeed.active.length,1);
     assert.equal(frame.physicalContactFeed.active[0].engineId,act.playerId);
     assert.equal(trail.active?.playerId,act.playerId);
     assert.equal(trail.active?.intendedRecipientId,act.recipientId);
     assert.equal(trail.active?.target,act.passTarget);
     assert.equal(trail.active?.status,'observing');
    }
    const closed=trail.lastResolved;
    if(closed&&closed!==prior){
     if(closed.status==='contact-observed'){
      const e=closed.firstSubsequentContact;
      assert.ok(e.physicsTick>closed.actionTick);
      assert.ok(e.physicsTick<=tick);
      assert.equal(e.passCompleted,null);
      assert.ok(e.contacts.length>0);
      for(const shoe of e.contacts){
       assert.equal(shoe.physicsTick,e.physicsTick);
       assert.match(shoe.engineId,/^(home|away)-(?:[1-9]|10|11)$/);
       assert.equal(shoe.team,shoe.engineId.split('-')[0]);
      }
      if(e.physicsTick===tick)assert.deepEqual(
       e.contacts.map(s=>s.engineId),
       frame.physicalContactFeed.started.map(s=>s.engineId),
       'follow-through first contact comes from THIS real Rapier tick'
      );
      verifiedContacts++;
     }else assert.equal(closed.status,'expired-without-contact');
     assert.equal(closed.passCompleted,null);
     assert.equal(closed.officialMatchResult,null);
    }
    prior=closed;
   }
   assert.ok(observedPasses>=1,'at least one authentic '+entry.team+' Rapier pass attempt');
   const after=real.reset(),replay=reference.reset();
   try{for(let t=1;t<=165;t++)
     assert.deepEqual(after.step(),replay.step(),
      'reset replay keeps both teams physical contact lineage');}
   finally{after.dispose();replay.dispose();}
  }finally{real.dispose();reference.dispose();}
 }
});

test('C1.2a no-contact 11v11 fixture never invents a pass follow-through',()=>{
 const s=createPhysicalFixtureStepRuntime(R,domestic('PT',3,5),noContact,{
  autonomousActions:true
 });
 try{
  for(let i=0;i<70;i++){
   const f=s.step(),trail=f.physicalActionOutcome.physicalPassFollowThrough;
   assert.equal(f.localAutonomousAction,null);
   assert.equal(trail.active,null);
   assert.equal(trail.lastResolved,null);
   assert.equal(trail.passCompleted,null);
   assert.equal(trail.officialMatchResult,null);
   assert.equal(f.officialMatchResult,null);
  }
 }finally{s.dispose();}
});

test('C1.2b live autonomous 22-player contact pursuit uses real Rapier collisions, not designated players',()=>{
 const starts=[
  {id:'away',x:4.96,vx:-0.3,y:0,seed:'c12b-away-mid'},
  {id:'home',x:-4.96,vx:0.3,y:0,seed:'c12b-home-mid'},
  {id:'away',x:19.96,vx:-0.3,y:0,seed:'c12b-away-inner'},
  {id:'home',x:-19.96,vx:0.3,y:0,seed:'c12b-home-inner'},
  {id:'away',x:4.96,vx:-0.2,y:18,seed:'c12b-away-wide'},
  {id:'home',x:-4.96,vx:0.2,y:-18,seed:'c12b-home-wide'}
 ];
 const seen={home:{passes:0,receiver:0,opponent:0,other:0},
  away:{passes:0,receiver:0,opponent:0,other:0}};
 let physicalContactEvidence=0;
 for(const [index,item] of starts.entries()){
  const fixture=index%2===0?international:domestic('ENG',3,4,6);
  const scenario=Object.freeze({preset:'roll',seed:item.seed,
   x:item.x,y:item.y,z:0,vx:item.vx,vy:0,vz:0});
  const real=createPhysicalFixtureStepRuntime(R,fixture,scenario,
   {autonomousActions:true});
  const reference=createPhysicalFixtureStepRuntime(R,fixture,scenario,
   {autonomousActions:true});
  let previousResolvedTick=null;
  try{
   for(let tick=1;tick<=330;tick++){
    const f=real.step(),control=reference.step();
    assert.deepEqual(f,control,'independent real 11v11 Rapier fixture tick');
    assert.equal(f.physicsTick,tick);
    assert.equal(f.officialMatchResult,null);
    const trail=f.physicalActionOutcome.physicalPassFollowThrough;
    assert.equal(trail.physicsTick,tick);
    assert.equal(trail.fixtureId,fixture.id);
    assert.equal(trail.passCompleted,null);
    if(f.localAutonomousAction?.action==='pass'){
     const a=f.localAutonomousAction;
     seen[a.team].passes++;
     assert.equal(f.physicalContactFeed.started.length,1);
     assert.equal(f.physicalContactFeed.active.length,1);
     assert.equal(f.physicalContactFeed.started[0].engineId,a.playerId);
     assert.equal(trail.active?.actionTick,a.tick);
    }
    const receiverDuty=f.contactDecisionObservation.duties.filter(
     d=>d.movementDuty==='receive-pass-intent');
    assert.ok(receiverDuty.length<=1);
    if(receiverDuty.length){
     assert.equal(receiverDuty[0].temporary,true);
     assert.equal(receiverDuty[0].actionExecuted,false);
    }
    const resolved=trail.lastResolved;
    if(!resolved||resolved.actionTick===previousResolvedTick)continue;
    previousResolvedTick=resolved.actionTick;
    assert.equal(resolved.passCompleted,null);
    assert.equal(resolved.officialMatchResult,null);
    if(resolved.status!=='contact-observed')continue;
    physicalContactEvidence++;
    const c=resolved.firstSubsequentContact;
    assert.ok(c&&c.physicsTick>resolved.actionTick);
    assert.equal(c.passCompleted,null);
    if(c.physicsTick===tick)assert.deepEqual(
     c.contacts.map(x=>x.engineId),
     f.physicalContactFeed.started.map(x=>x.engineId),
     'contact IDs must come exclusively from actual Rapier START'
    );
    assert.ok(c.ballKinematics,'genuine frames must include physical velocity');
    assert.equal(c.ballKinematics.contactPhysicsTick,c.physicsTick);
    assert.equal(c.ballKinematics.priorPhysicsTick,c.physicsTick-1);
    assert.ok(Number.isFinite(c.ballKinematics.observedVelocityDeltaMps));
    assert.equal(c.ballKinematics.solverImpulseInferred,false);
    assert.equal(c.ballKinematics.passCompleted,null);
    assert.ok(Object.isFrozen(c.ballKinematics));
    const team=resolved.team;
    if(c.hasIntendedRecipient)seen[team].receiver++;
    if(c.hasOpponent)seen[team].opponent++;
    if(!c.hasIntendedRecipient&&!c.hasOpponent)seen[team].other++;
   }
   const reset=real.reset(),referenceReset=reference.reset();
   try{
    for(let i=0;i<30;i++)assert.deepEqual(reset.step(),referenceReset.step(),
      'replay/reset keeps the closed Rapier shoe lineage');
   }finally{reset.dispose();referenceReset.dispose();}
  }finally{real.dispose();reference.dispose();}
 }
 console.log('C1_2B_REAL_RAPIER_CONTACT_EVIDENCE',JSON.stringify(seen));
 assert.ok(seen.home.passes>0&&seen.away.passes>0,
  'real autonomous pass attempts must originate from both teams');
 assert.ok(physicalContactEvidence>0,
  'at least one actual later Rapier shoe START must be observed');
});

test('C1.2b ordinary opt-out movement and no-contact fixtures never synthesize a receiver',()=>{
 const f=domestic('FR',8,9,6);
 for(const options of [{},{autonomousActions:true}]){
  const trial=createPhysicalFixtureStepRuntime(R,f,noContact,options);
  const ref=createPhysicalFixtureStepRuntime(R,f,noContact,options);
  try{
   for(let i=0;i<75;i++){
    const observed=trial.step();
    assert.deepEqual(observed,ref.step());
    assert.equal(observed.physicalActionOutcome.physicalPassFollowThrough.active,null);
    assert.equal(observed.physicalActionOutcome.physicalPassFollowThrough.lastResolved,null);
    assert.equal(observed.officialMatchResult,null);
    assert.equal(observed.officialMatchPossession,false);
   }
  }finally{trial.dispose();ref.dispose();}
 }
});

test('C1.2c actual Rapier 11v11 opponent shoe challenge after authenticated passes (both teams, replay)',()=>{
 const scenarios=[
  {team:'away',x:4.96,y:0,vx:-0.3,seed:'c12c-away-mid'},
  {team:'home',x:-4.96,y:0,vx:0.3,seed:'c12c-home-mid'},
  {team:'away',x:19.96,y:0,vx:-0.3,seed:'c12c-away-inner'},
  {team:'home',x:-19.96,y:0,vx:0.3,seed:'c12c-home-inner'},
  {team:'away',x:4.96,y:18,vx:-0.2,seed:'c12c-away-wide'},
  {team:'home',x:-4.96,y:-18,vx:0.2,seed:'c12c-home-wide'},
  {team:'away',x:4.96,y:-18,vx:-0.2,seed:'c12c-away-other-flank'},
  {team:'home',x:-4.96,y:18,vx:0.2,seed:'c12c-home-other-flank'}
 ];
 const seen={home:{passes:0,defenderDuty:0,opponentShoe:0,
  opponentAfterReceiver:0,postContactSixTickTraces:0,
  postContactTravelM:0,postContactVelocityDeltaMps:0,
  sealedSixFrameFlights:0,verifiedResetReplays:0},
  away:{passes:0,defenderDuty:0,
  opponentShoe:0,opponentAfterReceiver:0,
  postContactSixTickTraces:0,postContactTravelM:0,
  postContactVelocityDeltaMps:0,sealedSixFrameFlights:0,
  verifiedResetReplays:0}};
 for(const [index,scenario] of scenarios.entries()){
  const fixture=index%2===0?international:domestic('DE',5,9,6);
  const ball=Object.freeze({preset:'roll',seed:scenario.seed,x:scenario.x,
   y:scenario.y,z:0,vx:scenario.vx,vy:0,vz:0});
  const run=createPhysicalFixtureStepRuntime(R,fixture,ball,
   {autonomousActions:true});
  const independent=createPhysicalFixtureStepRuntime(R,fixture,ball,
   {autonomousActions:true});
  let priorOpponentEpoch=null;
  // C4.1: independent physical 60Hz ball path AFTER the genuine
  // rival's Rapier shoe START; movement is evidence, not an
  // attributed single-foot impulse or a football interception.
  let pendingDefenderFollowup=null;
  // D1.1: retain the first COMPLETE genuine defender follow-up per
  // original passer team. A post-reset run must reproduce its actual
  // contact tick, all six physical ball frames and canonical ball.
  const resetCandidates=[];
  try{
   for(let tick=1;tick<=375;tick++){
    const f=run.step(),reference=independent.step();
    assert.deepEqual(f,reference,
     'independent same-fixture real 60Hz Rapier frames reproduce');
    assert.equal(f.physicsTick,tick);
    if(pendingDefenderFollowup){
     const follow=pendingDefenderFollowup;
     assert.ok(tick>follow.contactTick);
     const ball=f.ball,point=ball.position,velocity=ball.velocity;
     assert.ok([point.x,point.y,point.z,
      velocity.x,velocity.y,velocity.z].every(Number.isFinite));
     follow.ballTravel3DM+=Math.hypot(
      point.x-follow.previousPoint.x,
      point.y-follow.previousPoint.y,
      point.z-follow.previousPoint.z);
     follow.velocityDeltaMps+=Math.hypot(
      velocity.x-follow.previousVelocity.x,
      velocity.y-follow.previousVelocity.y,
      velocity.z-follow.previousVelocity.z);
     follow.frames++;
     follow.previousPoint={...point};
     follow.previousVelocity={...velocity};
     if(follow.frames===6){
      assert.equal(tick-follow.contactTick,6);
      assert.ok(follow.ballTravel3DM>=0);
      assert.ok(Number.isFinite(follow.velocityDeltaMps));
      const sealed=f.physicalActionOutcome.physicalPassFollowThrough
       .opponentChallenge.defenderFlight.lastCompleted;
      assert.ok(sealed&&Object.isFrozen(sealed),
       'C4.1b genuine 60Hz closed observer must complete six samples');
      assert.equal(sealed.contactTick,follow.contactTick);
      assert.equal(sealed.passerTeam,follow.passerTeam);
      assert.equal(sealed.observedThroughTick,tick);
      assert.equal(sealed.sampledFrames,6);
      assert.ok(Math.abs(sealed.path3DM-follow.ballTravel3DM)<1e-9);
      assert.ok(Math.abs(sealed.velocityDeltaSumMps-
       follow.velocityDeltaMps)<1e-9);
      assert.equal(sealed.isolatedShoeImpulseProven,false);
      assert.equal(sealed.interceptionConfirmed,null);
      assert.equal(sealed.tackleConfirmed,null);
      assert.equal(sealed.officialMatchPossession,false);
      assert.ok(sealed.samples.every((sample,index)=>
       sample.physicsTick===follow.contactTick+index+1&&
       Object.isFrozen(sample)&&Object.isFrozen(sample.position)&&
       Object.isFrozen(sample.velocity)));
      if(seen[follow.passerTeam].verifiedResetReplays===0&&
         !resetCandidates.some(x=>x.passerTeam===follow.passerTeam))
       resetCandidates.push(Object.freeze({
        passerTeam:follow.passerTeam,contactTick:follow.contactTick,
        verifiedTick:tick,originalFlight:sealed,
        originalCanonicalBall:f.canonicalBall,
        originalPlayerCount:f.playerCount,
        originalFixtureId:f.fixtureId
       }));
      seen[follow.passerTeam].sealedSixFrameFlights++;
      seen[follow.passerTeam].postContactSixTickTraces++;
      seen[follow.passerTeam].postContactTravelM+=
       follow.ballTravel3DM;
      seen[follow.passerTeam].postContactVelocityDeltaMps+=
       follow.velocityDeltaMps;
      pendingDefenderFollowup=null;
     }
    }
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.officialMatchPossession,false);
    const trail=f.physicalActionOutcome.physicalPassFollowThrough;
    const opposition=trail.opponentChallenge;
    assert.equal(trail.passCompleted,null);
    assert.equal(opposition.interceptionConfirmed,null);
    assert.equal(opposition.tackleConfirmed,null);
    assert.equal(opposition.officialMatchResult,null);
    assert.equal(opposition.readOnly,true);
    const act=f.localAutonomousAction;
    if(act?.action==='pass'){
     seen[act.team].passes++;
     assert.equal(f.physicalContactFeed.started.length,1);
     assert.equal(f.physicalContactFeed.started[0].engineId,act.playerId);
     assert.equal(opposition.active.actionTick,act.tick);
     assert.equal(opposition.active.passerTeam,act.team);
    }
    const challengeDuties=f.contactDecisionObservation.duties.filter(
     d=>d.movementDuty==='challenge-pass-intent');
    assert.ok(challengeDuties.length<=1,'no more than one opposing challenger');
    if(challengeDuties.length){
     const d=challengeDuties[0],
      origin=opposition.active??opposition.lastResolved;
     assert.ok(origin,'real pass must precede opponent pursuit');
     assert.notEqual(d.team,origin.passerTeam);
     assert.equal(d.actionExecuted,false);
     assert.equal(d.intendedFootballAction,null);
     assert.equal(d.temporary,true);
     seen[origin.passerTeam].defenderDuty++;
    }
    const concluded=opposition.lastResolved;
    if(!concluded||concluded.actionTick===priorOpponentEpoch)continue;
    priorOpponentEpoch=concluded.actionTick;
    assert.equal(concluded.fixtureId,fixture.id);
    assert.equal(concluded.interceptionConfirmed,null);
    assert.equal(concluded.tackleConfirmed,null);
    assert.equal(concluded.passCompleted,null);
    assert.equal(concluded.officialMatchResult,null);
    if(concluded.status==='expired-without-opponent-contact'){
     assert.equal(concluded.firstOpponentContact,null);
     continue;
    }
    assert.equal(concluded.status,'opponent-contact-observed');
    seen[concluded.passerTeam].opponentShoe++;
    const first=concluded.firstOpponentContact;
    assert.ok(first.physicsTick>concluded.actionTick);
    assert.equal(first.physicsTick,tick,
     'new positive opponent observation comes from this exact tick');
    assert.ok(first.contacts.length>0);
    assert.deepEqual(first.contacts.map(x=>x.engineId),
     f.physicalContactFeed.started.filter(x=>
      x.team!==concluded.passerTeam).map(x=>x.engineId),
     'positive witness must be a real closed Rapier shoe START');
    for(const shoe of first.contacts){
     assert.notEqual(shoe.team,concluded.passerTeam);
     assert.match(shoe.engineId,/^(home|away)-(?:[1-9]|10|11)$/);
     assert.equal(shoe.contactKind,'opponent-shoe');
     assert.ok(f.physicalContactFeed.active.some(actor=>
      actor.engineId===shoe.engineId&&actor.team===shoe.team),
      'C4.1: opponent START also needs SAME-TICK real Rapier ACTIVE');
     const position=f.physicalPlayerPositions.find(actor=>
      actor.engineId===shoe.engineId&&actor.team===shoe.team);
     assert.ok(position&&Number.isFinite(position.x)&&
      Number.isFinite(position.y),
      'C4.1: real defending shoe must belong to a moved canonical player');
    }
    assert.ok(first.ballKinematics);
    assert.equal(first.ballKinematics.contactPhysicsTick,tick);
    assert.equal(first.ballKinematics.priorPhysicsTick,tick-1);
    assert.ok(Number.isFinite(first.ballKinematics.observedVelocityDeltaMps));
    assert.equal(first.ballKinematics.solverImpulseInferred,false);
    assert.equal(first.interceptionConfirmed,null);
    assert.equal(first.tackleConfirmed,null);
    assert.equal(first.passCompleted,null);
    if(!pendingDefenderFollowup){
     const point=f.ball.position,velocity=f.ball.velocity;
     assert.ok([point.x,point.y,point.z,
      velocity.x,velocity.y,velocity.z].every(Number.isFinite));
     pendingDefenderFollowup={passerTeam:concluded.passerTeam,
      contactTick:tick,frames:0,ballTravel3DM:0,
      velocityDeltaMps:0,
      previousPoint:{...point},previousVelocity:{...velocity}};
    }
    if(trail.lastResolved?.status==='contact-observed'&&
       trail.lastResolved.actionTick===concluded.actionTick&&
       trail.lastResolved.firstSubsequentContact?.hasIntendedRecipient)
     seen[concluded.passerTeam].opponentAfterReceiver++;
   }
   const fresh=run.reset(),replay=independent.reset();
   try{
    // All scenes retain 60 reset ticks; exactly the first real completed
    // defender episode per team extends that ORIGINAL reset to its
    // physical contact+6 endpoint (not a fabricated contact injection).
    const through=Math.max(60,...resetCandidates.map(x=>x.verifiedTick));
    for(let t=1;t<=through;t++){
     const again=fresh.step(),reference=replay.step();
     assert.deepEqual(again,reference,
      'D1.1 independent post-reset full real Rapier frame at tick '+t);
     assert.equal(again.physicsTick,t);
     assert.equal(again.officialMatchPossession,false);
     assert.equal(again.officialMatchResult,null);
     for(const witness of resetCandidates){
      if(t!==witness.verifiedTick)continue;
      const recovered=again.physicalActionOutcome
       .physicalPassFollowThrough.opponentChallenge
       .defenderFlight.lastCompleted;
      assert.ok(recovered,'D1.1 reset must reproduce an actual rival shoe');
      assert.deepEqual(recovered,witness.originalFlight,
       'D1.1 exact same real opposing START and all six ball/velocity frames');
      assert.equal(again.canonicalBall,witness.originalCanonicalBall);
      assert.equal(again.fixtureId,witness.originalFixtureId);
      assert.equal(again.playerCount,witness.originalPlayerCount);
      assert.equal(recovered.contactTick,witness.contactTick);
      assert.equal(recovered.sampledFrames,6);
      assert.equal(recovered.officialMatchPossession,false);
      assert.equal(recovered.interceptionConfirmed,null);
      seen[witness.passerTeam].verifiedResetReplays++;
     }
    }
   }finally{fresh.dispose();replay.dispose();}
  }finally{run.dispose();independent.dispose();}
 }
 console.log('C1_2C_GENUINE_RAPIER_OPPONENT_WITNESS',JSON.stringify(seen));
 console.log('D1_1_GENUINE_RAPIER_DEFENDER_RESET_REPLAY',JSON.stringify({
  home:seen.home.verifiedResetReplays,away:seen.away.verifiedResetReplays,
  source:'same-60hz-real-rapier-reset-not-contact-injection',
  footballResultAdjudicated:false
 }));
 assert.ok(seen.home.passes>0&&seen.away.passes>0,
  'actual source passes required for both teams');
 assert.ok(seen.home.defenderDuty>0&&seen.away.defenderDuty>0,
  'both teams must autonomously challenge a genuine opposing pass');
 assert.ok(seen.home.opponentShoe>0&&seen.away.opponentShoe>0,
  'at least one REAL later opposition Rapier shoe START per passing team');
 // C4.1 is not classified as a successful interception/tackle. It
 // requires an independent six-tick physical 3D ball + velocity trace
 // AFTER authentic opposing START/ACTIVE for each original passer team.
 for(const t of ['home','away']){
  assert.equal(seen[t].verifiedResetReplays,1,
   'D1.1 exactly one first genuine full defender/contact+6 RESET replay for '+t);
  assert.ok(seen[t].postContactSixTickTraces>0,
   'C4.1 needs real defender follow-up for '+t);
  assert.ok(seen[t].postContactTravelM>0,
   'C4.1 no synthetic stationary six-tick physical ball path for '+t);
  assert.equal(seen[t].sealedSixFrameFlights,
   seen[t].postContactSixTickTraces,
   'C4.1b live sealed observer matches independently measured six frames');
  assert.ok(Number.isFinite(seen[t].postContactVelocityDeltaMps));
 }
});

test('C1.2c no-contact fixture and opt-out cannot fabricate a challenger or interception',()=>{
 const fixture=domestic('PT',6,8,4);
 for(const options of [{},{autonomousActions:true}]){
  const real=createPhysicalFixtureStepRuntime(R,fixture,noContact,options);
  try{
   for(let tick=1;tick<=80;tick++){
    const f=real.step();
    const trail=f.physicalActionOutcome.physicalPassFollowThrough;
    const opposition=trail.opponentChallenge;
    assert.equal(f.localAutonomousAction,null);
    assert.equal(opposition.active,null);
    assert.equal(opposition.lastResolved,null);
    assert.equal(opposition.defenderFlight.pendingCount,0);
    assert.equal(opposition.defenderFlight.completedCount,0);
    assert.equal(opposition.defenderFlight.lastCompleted,null);
    assert.equal(opposition.interceptionConfirmed,null);
    assert.equal(opposition.tackleConfirmed,null);
    assert.equal(opposition.officialMatchResult,null);
    assert.equal(f.contactDecisionObservation.duties.some(d=>
     d.movementDuty==='challenge-pass-intent'),false);
    assert.equal(f.officialMatchResult,null);
   }
  }finally{real.dispose();}
 }
});
