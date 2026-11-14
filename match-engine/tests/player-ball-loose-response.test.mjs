// ME-PB-37 — ownerless two-team tactical reaction after the confirmed
// real Rapier opposition shoe START; movement/contacts are not possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot}
 from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,PLAYER_DT,
 createPlayerMovement} from '../src/player-movement.mjs';
import {OPPOSITION_FLIGHT_VERSION}
 from '../src/player-ball-opposition-flight.mjs';
import {beginObservedLooseBallResponse,advanceObservedLooseBallResponse,
 LOOSE_RESPONSE_VERSION,LOOSE_RESPONSE_MAX_TICKS}
 from '../src/player-ball-loose-response.mjs';
import {readFileSync} from 'node:fs';
const Rapier=await initializeRapier(RapierModule);
const ball={x:0,y:0};
const audit=Object.freeze({
 version:OPPOSITION_FLIGHT_VERSION,contactShoeStartProven:true,
 contactTick:196,precedingPassTick:153,tick:199,followupTicks:3,
 status:'confirmed-changed-flight',classification:'slowed',
 solverAttribution:'aggregate-not-individual-foot',
 officialPossession:false,interceptionProven:false,
 passCreated:false,physicalCauseExclusivelyProven:false
});
const init=()=>beginObservedLooseBallResponse({
 audit,players:INITIAL_PLAYERS,ballPosition:ball,movementTick:200
});
test('ME-PB-37 requires a terminal observed REAL opponent-contact audit',()=>{
 const plan=init();
 assert.equal(plan.version,LOOSE_RESPONSE_VERSION);
 assert.equal(plan.phase,'responding');
 assert.equal(plan.initiatedAtMovementTick,200);
 assert.equal(plan.contactTick,196);
 assert.equal(plan.precedingPassTick,153);
 assert.ok(plan.responders.home.startsWith('home-'));
 assert.ok(plan.responders.away.startsWith('away-'));
 assert.ok(INITIAL_PLAYERS.some(p=>p.id===plan.responders.home&&
  p.role!=='goalkeeper'));
 assert.ok(INITIAL_PLAYERS.some(p=>p.id===plan.responders.away&&
  p.role!=='goalkeeper'));
 assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.responders)&&
  Object.isFrozen(plan.observedBall));
 assert.equal(plan.officialPossession,false);
 assert.equal(plan.interceptionProven,false);
 assert.equal(plan.passCreated,false);
 assert.equal(plan.ballForceApplied,false);
 for(const change of [
  {audit:{...audit,status:'observing'}},
  {audit:{...audit,contactShoeStartProven:false}},
  {audit:{...audit,officialPossession:true}},
  {audit:{...audit,interceptionProven:true}},
  {audit:{...audit,passCreated:true}},
  {audit:{...audit,solverAttribution:'credited-to-away-10'}},
  {audit:{...audit,precedingPassTick:197}},
  {audit:{...audit,tick:198}},
  {audit:{...audit,followupTicks:2}},
  {movementTick:202},{ballPosition:{x:NaN,y:0}},
  {ballPosition:{x:100,y:0}},
  {players:INITIAL_PLAYERS.slice(1)},
  {players:INITIAL_PLAYERS.map((p,i)=>i===2?{...p,id:'other'}:p)},
  {players:INITIAL_PLAYERS.map((p,i)=>i===2?{...p,x:NaN}:p)}
 ])assert.throws(()=>beginObservedLooseBallResponse({
  audit,players:INITIAL_PLAYERS,ballPosition:ball,movementTick:200,
  ...change
 }),/required|Canonical|Real Rapier/);
 assert.deepEqual(INITIAL_PLAYERS,createPlayerMovement().snapshot().players,
  'no fake relocated players at tick zero');
});
test('ME-PB-37 actual nearest outfielders, deterministic tie and both sides',()=>{
 const players=INITIAL_PLAYERS.map(p=>({
  ...p,x:p.team==='home'?-20:20,y:p.y>0?8:-8
 }));
 for(const id of ['home-2','home-3','away-2','away-3']){
  const p=players.find(p=>p.id===id);
  assert.ok(p&&p.role!=='goalkeeper');
  p.x=0;p.y=0;
 }
 const plan=beginObservedLooseBallResponse({
  audit,players,ballPosition:ball,movementTick:200
 });
 assert.deepEqual(plan.responders,{home:'home-2',away:'away-2'});
 assert.equal(plan.observedFlightStatus,'confirmed-changed-flight');
 assert.equal(plan.observedFlightClassification,'slowed');
});
test('ME-PB-37 fixed 90-tick recovery expires without inventing ownership',()=>{
 let plan=init();
 for(let tick=201;tick<200+LOOSE_RESPONSE_MAX_TICKS;tick++){
  plan=advanceObservedLooseBallResponse({
   plan,audit,players:INITIAL_PLAYERS,
   ballPosition:{x:tick/100,y:0},movementTick:tick
  });
  assert.equal(plan.responseTicks,tick-199);
 }
 assert.equal(plan.phase,'completed');
 assert.equal(plan.completionReason,'bounded-recovery-window');
 assert.equal(plan.responseTicks,LOOSE_RESPONSE_MAX_TICKS);
 assert.equal(plan.lastMovementTick,289);
 assert.equal(plan.officialPossession,false);
 assert.equal(plan.ballForceApplied,false);
 assert.equal(plan.contactInferred,false);
 assert.ok(Object.isFrozen(plan));
 assert.throws(()=>advanceObservedLooseBallResponse({
  plan,audit,players:INITIAL_PLAYERS,
  ballPosition:ball,movementTick:291
 }),/Next genuine ownerless/);
 const start=init();
 for(const x of [
  {movementTick:202},
  {audit:{...audit,contactTick:195}},
  {audit:{...audit,interceptionProven:true}},
  {players:INITIAL_PLAYERS.slice(0,21)},
  {ballPosition:{x:Infinity,y:0}}
 ])assert.throws(()=>advanceObservedLooseBallResponse({
  plan:start,audit,players:INITIAL_PLAYERS,ballPosition:ball,
  movementTick:201,...x
 }),/Next genuine ownerless|Canonical|Real Rapier/);
});
const scenario={preset:'roll',seed:'local-ai-exchange',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0};
const coreFlags={diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiExchangeEnabled:true,
 diagnosticLocalAiAutonomousDefenseEnabled:true};
const movementFlags={experimentalAiExchangeApproach:true,
 experimentalAiAutonomousDefense:true,experimentalAiMultiPassDefense:true};
function realReplay({feedAudit=true,steps=325}={}){
 const engine=createEngine(Rapier,scenario,coreFlags);
 const movement=createPlayerMovement(movementFlags),frames=[];
 try{
  assert.deepEqual(movement.snapshot().players,INITIAL_PLAYERS);
  assert.equal(movement.snapshot().observedLooseBallResponse,null);
  for(let n=0;n<steps;n++){
   const previous=engine.snapshot(),exchange=engine.localAiExchangeSnapshot();
   const players=movement.step(previous.ball.position,{
    velocity:previous.ball.velocity,
    footContact:engine.footContactSnapshot(),
    passEvent:exchange.events.filter(e=>e.stage==='pass'||
      e.stage==='return-pass').at(-1)??null,
    ...(feedAudit?{oppositionFlightAudit:exchange.oppositionFlightAudit}:{})
   });
   const next=engine.step(players),after=engine.localAiExchangeSnapshot();
   const contact=engine.footContactSnapshot();
   frames.push(Object.freeze({
    tick:next.tick,canonicalBall:canonicalSnapshot(next),
    passTicks:Object.freeze(after.events.filter(e=>e.stage==='pass'||
      e.stage==='return-pass').map(e=>e.tick)),
    actualStarted:Object.freeze([...contact.started]),
    opponentStart:after.oppositionContact?.tick??null,
    flight:after.oppositionFlightAudit?.status??null,
    response:players.observedLooseBallResponse,
    positions:Object.freeze(players.players.map(p=>Object.freeze({
      id:p.id,x:p.x,y:p.y
    })))
   }));
  }
  return Object.freeze(frames);
 }finally{engine.dispose();}
}
test('ME-PB-37 same-world Rapier opponent contact triggers bounded ownerless response, not possession',()=>{
 const frames=realReplay(),reference=realReplay({feedAudit:false});
 const opponent=frames.find(f=>f.opponentStart!==null);
 assert.equal(opponent?.opponentStart,196);
 assert.ok(opponent.actualStarted.includes('away-10'),
  'the opposition event is an actual Rapier shoe START');
 assert.deepEqual(frames[0].passTicks,[]);
 const start=frames.find(f=>f.response?.responseTicks===1);
 assert.ok(start,'only the completed opponent-flight audit can begin pursuit');
 assert.ok(start.tick>=199&&start.tick<=204,
  'the pursuit starts from the observed post-contact physics');
 assert.equal(start.response.contactTick,196);
 assert.equal(start.response.officialPossession,false);
 assert.equal(start.response.interceptionProven,false);
 assert.equal(start.response.passCreated,false);
 assert.ok(Object.isFrozen(start.response));
 assert.ok(start.response.responders.home.startsWith('home-'));
 assert.ok(start.response.responders.away.startsWith('away-'));
 for(let i=0;i<start.tick-1;i++)
  assert.deepEqual(frames[i].positions,reference[i].positions,
   'before the qualified touch, pre-existing LAB-11 movement is untouched');
 const last=frames.at(-1),terminal=last.response;
 assert.equal(terminal.phase,'completed');
 assert.equal(terminal.responseTicks,LOOSE_RESPONSE_MAX_TICKS);
 assert.deepEqual(last.passTicks,[13,153],
  'the ownerless response did not manufacture a third pass');
 assert.equal(terminal.officialPossession,false);
 assert.equal(terminal.interceptionProven,false);
 assert.equal(terminal.ballForceApplied,false);
 const ids=Object.values(start.response.responders);
 const after=frames.find(f=>f.tick===Math.min(start.tick+18,frames.length));
 assert.ok(after);
 const movement=ids.map(id=>{
  const before=start.positions.find(p=>p.id===id);
  const later=after.positions.find(p=>p.id===id);
  return Math.hypot(later.x-before.x,later.y-before.y);
 });
 assert.ok(movement.some(d=>d>0.08),
  'at least one selected actual player must react to the loose physical ball');
 assert.ok(frames.some((frame,i)=>i>start.tick+10&&
  frame.positions.some((p,j)=>Math.hypot(
   p.x-reference[i].positions[j].x,
   p.y-reference[i].positions[j].y)>0.001)),
  'the grounded recovery targets produce measurable player movement');
 for(let i=1;i<frames.length;i++)
  for(let p=0;p<frames[i].positions.length;p++){
   const now=frames[i].positions[p],prev=frames[i-1].positions[p];
   assert.ok(Math.hypot(now.x-prev.x,now.y-prev.y)<=
    PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6,
    'the existing global 7 m/s movement bound is preserved');
  }
 assert.deepEqual(realReplay(),frames,
  'same-world physics and ownerless movement replay deterministically');
 process.stdout.write('ME_PB_37_OWNERLESS_RAPIER_RESPONSE '+JSON.stringify({
  contactTick:196,firstResponseTick:start.tick,
  responders:start.response.responders,
  physicallyMovedM:movement,
  completedTick:terminal.lastMovementTick,
  physicalPasses:last.passTicks.length,
  officialPossession:false,interceptionProven:false,replay:true
 })+'\\n');
});
test('ME-PB-37 existing LAB-11 row, no new LAB-14 or extra controls',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/preset-opt-ai-defend-loose/);
 assert.match(lab,/post-contact loose ball:/);
 assert.match(lab,/oppositionFlightAudit:exchange\?\.oppositionFlightAudit/);
 assert.match(lab,/observedLooseBallResponse/);
});
