// ME-PB-38: strict pure observer contracts + actual deterministic Rapier replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot}
 from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement}
 from '../src/player-movement.mjs';
import {LOOSE_RESPONSE_VERSION,LOOSE_RESPONSE_MAX_TICKS}
 from '../src/player-ball-loose-response.mjs';
import {FOOT_CONTACT_VERSION} from '../src/player-foot-contact.mjs';
import {CONTROL_EVIDENCE_VERSION,CONTROL_EVIDENCE_MIN_TICKS,
 observeLooseBallControlEvidence} from '../src/player-ball-control-evidence.mjs';
import {readFileSync} from 'node:fs';
const Rapier=await initializeRapier(RapierModule);
const players=INITIAL_PLAYERS.map(p=>Object.freeze({...p,
 x:p.id==='home-10'?0:p.x,y:p.id==='home-10'?0:p.y,
 vx:p.id==='home-10'?0.7:p.vx,
 vy:p.id==='home-10'?0:p.vy,
 facingRad:p.id==='home-10'?0:p.facingRad
}));
const baseResponse=Object.freeze({
 version:LOOSE_RESPONSE_VERSION,phase:'responding',
 contactTick:196,precedingPassTick:153,
 initiatedAtMovementTick:200,lastMovementTick:200,
 responseTicks:1,responders:Object.freeze({home:'home-10',away:'away-10'}),
 officialPossession:false,ballForceApplied:false
});
const responseAt=tick=>Object.freeze({...baseResponse,
 lastMovementTick:tick,responseTicks:tick-199,
 phase:tick===199+LOOSE_RESPONSE_MAX_TICKS?'completed':'responding'
});
const sample=(tick,active=['home-10'],position={x:0.22,y:0,z:0.11},
 velocity={x:0.74,y:0,z:0})=>({
 response:responseAt(tick),movementTick:tick,players,
 contactFrame:Object.freeze({
  version:FOOT_CONTACT_VERSION,tick:tick-1,
  started:Object.freeze([]),ended:Object.freeze([]),
  active:Object.freeze(active)
 }),
 ball:Object.freeze({position:Object.freeze(position),
  velocity:Object.freeze(velocity)})
});
test('ME-PB-38 requires six consecutive unique real contact-frame co-motion candidates; not possession',()=>{
 let previous=null;
 for(let movementTick=201;movementTick<=206;movementTick++){
  previous=observeLooseBallControlEvidence({
   ...sample(movementTick),previous
  });
  assert.equal(previous.version,CONTROL_EVIDENCE_VERSION);
  assert.equal(previous.consecutiveTicks,movementTick-200);
  assert.equal(previous.sustainedCoMotionObserved,
   movementTick-200>=CONTROL_EVIDENCE_MIN_TICKS);
  assert.equal(previous.officialPossession,false);
  assert.equal(previous.controlConfirmed,false);
  assert.equal(previous.interceptionProven,false);
  assert.equal(previous.passCreated,false);
  assert.equal(previous.ballForceApplied,false);
  assert.ok(Object.isFrozen(previous));
 }
 assert.equal(previous.firstSustainedPhysicsTick,205);
 assert.equal(previous.status,'sustained-contact-co-motion-observed');
 previous=observeLooseBallControlEvidence({
  ...sample(207,[]),previous
 });
 assert.equal(previous.consecutiveTicks,0);
 assert.equal(previous.candidatePlayerId,null);
 assert.equal(previous.sustainedCoMotionObserved,true,
  'historical evidence is retained, never promoted to current possession');
 assert.equal(previous.status,'no-qualifying-co-motion');
});
test('ME-PB-38 proximity, static touch, opposing contact, ambiguous shoes and flight are not stable control',()=>{
 const negatives=[
  sample(201,[]),
  sample(201,['away-10']),
  sample(201,['home-10','away-10']),
  sample(201,['home-10'],{x:2,y:0,z:0.11}),
  sample(201,['home-10'],{x:0.22,y:0,z:0.55}),
  sample(201,['home-10'],{x:0.22,y:0,z:0.11},{x:0,y:0,z:0}),
  sample(201,['home-10'],{x:0.22,y:0,z:0.11},{x:-4,y:0,z:0})
 ];
 for(const input of negatives){
  const out=observeLooseBallControlEvidence(input);
  assert.equal(out.consecutiveTicks,0);
  assert.equal(out.sustainedCoMotionObserved,false);
  assert.equal(out.controlConfirmed,false);
 }
 let prior=observeLooseBallControlEvidence(sample(201));
 prior=observeLooseBallControlEvidence({...sample(202),previous:prior});
 prior=observeLooseBallControlEvidence({...sample(203,[]),previous:prior});
 assert.equal(prior.consecutiveTicks,0);
 prior=observeLooseBallControlEvidence({...sample(204),previous:prior});
 assert.equal(prior.consecutiveTicks,1,'one missing real contact resets continuity');
});
test('ME-PB-38 rejects forged/stale physics frames, actors, speeds and snapshots atomically',()=>{
 const ok=sample(201);
 const corrupt=[
  {...ok,contactFrame:{...ok.contactFrame,tick:199}},
  {...ok,contactFrame:{...ok.contactFrame,active:['home-10','home-10']}},
  {...ok,contactFrame:{...ok.contactFrame,active:['unknown']}},
  {...ok,contactFrame:{...ok.contactFrame,version:'fake'}},
  {...ok,players:players.slice(1)},
  {...ok,players:players.map((p,i)=>i===0?{...p,vx:70}:p)},
  {...ok,ball:{...ok.ball,velocity:{x:Infinity,y:0,z:0}}},
  {...ok,ball:{...ok.ball,position:{x:100,y:0,z:0.11}}},
  {...ok,response:{...ok.response,officialPossession:true}},
  {...ok,response:{...ok.response,lastMovementTick:202}},
  {...ok,movementTick:203}
 ];
 for(const trial of corrupt)
  assert.throws(()=>observeLooseBallControlEvidence(trial),
   /Consecutive genuine Rapier/);
 const previous=observeLooseBallControlEvidence(ok);
 for(const bad of [
  {...sample(202),previous:{...previous,controlConfirmed:true}},
  {...sample(202),previous:{...previous,observedPhysicsTick:199}},
  {...sample(203),previous}
 ])assert.throws(()=>observeLooseBallControlEvidence(bad),
  /Consecutive genuine Rapier/);
});
test('ME-PB-38 bounded completed response freezes observer and never grants ownership',()=>{
 let evidence=null;
 for(let movementTick=201;
  movementTick<=199+LOOSE_RESPONSE_MAX_TICKS;movementTick++)
  evidence=observeLooseBallControlEvidence({
   ...sample(movementTick,[]),previous:evidence
  });
 assert.equal(evidence.terminal,true);
 assert.equal(evidence.status,'observation-window-complete');
 assert.equal(evidence.samplesObserved,LOOSE_RESPONSE_MAX_TICKS-1);
 assert.equal(evidence.controlConfirmed,false);
 assert.throws(()=>observeLooseBallControlEvidence({
  ...sample(200+LOOSE_RESPONSE_MAX_TICKS),previous:evidence
 }),/Consecutive genuine Rapier/);
});
const scenario={preset:'roll',seed:'local-ai-exchange',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0};
const flags={diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiExchangeEnabled:true,
 diagnosticLocalAiAutonomousDefenseEnabled:true};
function replay(steps=320){
 const engine=createEngine(Rapier,scenario,flags);
 const movement=createPlayerMovement({
  experimentalAiExchangeApproach:true,
  experimentalAiAutonomousDefense:true,experimentalAiMultiPassDefense:true
 });
 const frames=[];
 try{
  for(let n=0;n<steps;n++){
   const before=engine.snapshot();
   const ex=engine.localAiExchangeSnapshot();
   const previousContact=engine.footContactSnapshot();
   const nextPlayers=movement.step(before.ball.position,{
    velocity:before.ball.velocity,footContact:previousContact,
    passEvent:ex.events.filter(e=>e.stage==='pass'||
      e.stage==='return-pass').at(-1)??null,
    oppositionFlightAudit:ex.oppositionFlightAudit
   });
   const physics=engine.step(nextPlayers);
   const evidence=nextPlayers.observedControlEvidence;
   frames.push(Object.freeze({
    tick:physics.tick,
    physics:canonicalSnapshot(physics),
    started:Object.freeze([...engine.footContactSnapshot().started]),
    priorFootActive:Object.freeze([...previousContact.active]),
    response:nextPlayers.observedLooseBallResponse?.phase??null,
    evidence
   }));
  }
  return Object.freeze(frames);
 }finally{engine.dispose();}
}
test('ME-PB-38 real 60Hz Rapier LAB-11 contact produces only actual-source evidence and repeatable replay',()=>{
 const frames=replay(),copy=replay();
 assert.deepEqual(frames,copy,'physical solver and observer deterministic');
 const opponent=frames.find(x=>x.started.includes('away-10'));
 assert.ok(opponent,'a genuine Rapier opposition shoe START is observed');
 const first=frames.find(x=>x.evidence!==null);
 assert.ok(first&&first.tick>opponent.tick,
  'no evidence can start before a verified opposition-contact response');
 const last=frames.at(-1).evidence;
 assert.ok(last&&last.terminal);
 assert.equal(last.controlConfirmed,false);
 assert.equal(last.officialPossession,false);
 assert.equal(last.interceptionProven,false);
 assert.equal(last.ballForceApplied,false);
 for(const frame of frames){
  if(!frame.evidence)continue;
  if(frame.evidence.terminal)
   assert.ok(frame.evidence.observedPhysicsTick<=frame.tick-1,
    'a completed response is immutable in later physics frames');
  else
   assert.equal(frame.evidence.observedPhysicsTick,frame.tick-1);
  if(frame.evidence.candidatePlayerId&&
     frame.evidence.observedPhysicsTick===frame.tick-1)
   assert.ok(frame.priorFootActive.includes(frame.evidence.candidatePlayerId),
    'no co-motion candidate without physical Rapier shoe contact');
 }
 process.stdout.write('ME_PB_38_REAL_RAPIER_CONTROL_EVIDENCE '+JSON.stringify({
  firstPhysicsTick:first.evidence.observedPhysicsTick,
  sustainedCoMotionObserved:last.sustainedCoMotionObserved,
  maximumConsecutiveTicks:last.maximumConsecutiveTicks,
  actualOpponentContactTick:opponent.tick,
  controlConfirmed:false,officialPossession:false,replay:true
 })+'\n');
});
test('ME-PB-38 uses existing LAB-11 diagnostics; no new LAB-14, buttons or routes',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/preset-opt-ai-defend-control/);
 assert.match(lab,/observedControlEvidence/);
 assert.match(lab,/shoe co-motion evidence:/);
});
