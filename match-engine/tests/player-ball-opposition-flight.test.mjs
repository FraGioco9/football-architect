import test from 'node:test';
import assert from 'node:assert/strict';
import {beginObservedOppositionFlight,advanceObservedOppositionFlight,
 OPPOSITION_FLIGHT_VERSION,OPPOSITION_FLIGHT_CONFIRM_TICKS,
 OPPOSITION_FLIGHT_MAX_FOLLOWUP_TICKS}
 from '../src/player-ball-opposition-flight.mjs';
import {LOCAL_EXCHANGE_VERSION} from '../src/player-ball-local-exchange.mjs';
import {FOOT_CONTACT_VERSION} from '../src/player-foot-contact.mjs';
const contact=Object.freeze({
 version:LOCAL_EXCHANGE_VERSION,stage:'opponent-contact',
 physicalTrigger:'real-rapier-foot-contact-start',
 tick:196,playerId:'away-10',actualShoeStart:true,
 officialMatchAction:false
});
const feet=Object.freeze({
 version:FOOT_CONTACT_VERSION,tick:196,
 started:Object.freeze(['away-10'])
});
const previous=Object.freeze({
 stage:'return-pass',tick:153,playerId:'home-10',
 appliedByRealRapier:true,officialMatchAction:false
});
const start=(before={x:6,y:0,z:0},after={x:4,y:1,z:-0.16})=>
 beginObservedOppositionFlight({
  contact,contactFrame:feet,passEvent:previous,
  preSolverVelocity:before,postSolverVelocity:after,tick:196
 });
const follow=(samples,initial=start())=>{
 let state=initial;
 for(const v of samples){
  state=advanceObservedOppositionFlight({
   audit:state,tick:state.tick+1,velocity:v
  });
 }
 return state;
};
test('ME-PB-36 only real synchronized opponent START after applied pass starts an audit',()=>{
 const valid=start();
 assert.equal(valid.version,OPPOSITION_FLIGHT_VERSION);
 assert.equal(valid.status,'observing');
 assert.equal(valid.contactShoeStartProven,true);
 assert.equal(valid.precedingPassTick,153);
 assert.equal(valid.solverPlanarDeltaMps,Math.hypot(-2,1));
 assert.equal(valid.solverAttribution,'aggregate-not-individual-foot');
 assert.ok(Object.isFrozen(valid)&&Object.isFrozen(valid.incomingVelocity));
 assert.equal(valid.passCreated,false);
 assert.equal(valid.interceptionProven,false);
 assert.equal(valid.physicalCauseExclusivelyProven,false);
 for(const overrides of [
  {contact:{...contact,actualShoeStart:false}},
  {contact:{...contact,playerId:'home-10'}},
  {contact:{...contact,tick:195}},
  {contactFrame:{...feet,tick:195}},
  {contactFrame:{...feet,started:['home-10']}},
  {contactFrame:{...feet,started:['away-10','away-10']}},
  {passEvent:{...previous,appliedByRealRapier:false}},
  {passEvent:{...previous,tick:196}},
  {preSolverVelocity:{x:NaN,y:0,z:0}},
  {postSolverVelocity:{x:4,y:Infinity,z:0}},
  {tick:197}
 ])assert.throws(()=>beginObservedOppositionFlight({
  contact,contactFrame:feet,passEvent:previous,
  preSolverVelocity:{x:6,y:0,z:0},postSolverVelocity:{x:4,y:1,z:0},
  tick:196,...overrides
 }),/Actual synchronized Rapier opponent START/);
});
test('ME-PB-36 reverse/slow/redirect require three consecutive measured frames',()=>{
 const cases=[
  {label:'reversed',v:{x:-2,y:0,z:0}},
  {label:'slowed',v:{x:1,y:0,z:0}},
  {label:'redirected',v:{x:4,y:5,z:0}}
 ];
 for(const {label,v} of cases){
  let state=start();
  for(let i=0;i<OPPOSITION_FLIGHT_CONFIRM_TICKS;i++){
   state=advanceObservedOppositionFlight({
    audit:state,velocity:v,tick:197+i
   });
   assert.equal(state.status,i===OPPOSITION_FLIGHT_CONFIRM_TICKS-1?
    'confirmed-changed-flight':'observing');
   assert.equal(state.classification,i===OPPOSITION_FLIGHT_CONFIRM_TICKS-1?
    label:'contact-only-not-interception');
  }
  assert.equal(state.followupTicks,3);
  assert.equal(state.projectedSpeedMps,
   label==='reversed'?-2:label==='slowed'?1:4);
  assert.equal(state.interceptionProven,false);
  assert.equal(state.officialPossession,false);
  assert.equal(state.passCreated,false);
  assert.strictEqual(advanceObservedOppositionFlight({
   audit:state,velocity:v,tick:state.tick+1
  }),state,'completed flight audit is terminal and immutable');
 }
});
test('ME-PB-36 a momentary rebound or continued flight is contact-only, not interruption',()=>{
 const baseline={x:5.9,y:0.1,z:0};
 const samples=[
  {x:-1,y:0,z:0},baseline,
  {x:1,y:0,z:0},baseline,
  {x:3,y:1,z:0},baseline
 ];
 const state=follow(samples);
 assert.equal(state.status,'contact-only-no-confirmed-change');
 assert.equal(state.classification,'contact-only-no-confirmed-change');
 assert.equal(state.followupTicks,OPPOSITION_FLIGHT_MAX_FOLLOWUP_TICKS);
 assert.equal(state.consistentChangeTicks,0);
 assert.equal(state.passCreated,false);
 assert.equal(state.interceptionProven,false);
 assert.equal(state.officialPossession,false);
});
test('ME-PB-36 strict monotonic physics samples and no low-speed invented disruption',()=>{
 const zero=start({x:0.01,y:0,z:0},{x:0,y:0,z:0});
 assert.equal(zero.status,'insufficient-incoming-flight');
 assert.equal(zero.classification,'contact-only-not-interception');
 assert.strictEqual(advanceObservedOppositionFlight({
  audit:zero,velocity:{x:0,y:0,z:0},tick:197
 }),zero);
 const begin=start();
 for(const changes of [
  {tick:196},{tick:198},
  {velocity:{x:NaN,y:0,z:0}},
  {velocity:{x:0,y:0,z:Infinity}},
  {audit:{...begin,contactShoeStartProven:false}},
  {audit:{...begin,followupTicks:100}},
  {audit:{...begin,incomingVelocity:{x:NaN,y:0,z:0}}}
 ])assert.throws(()=>advanceObservedOppositionFlight({
  audit:begin,tick:197,velocity:{x:-2,y:0,z:0},...changes
 }),/Consecutive measured post-contact Rapier flight/);
 const one=advanceObservedOppositionFlight({
  audit:begin,tick:197,velocity:{x:-2,y:0,z:0}
 });
 const two=advanceObservedOppositionFlight({
  audit:one,tick:198,velocity:{x:6,y:0,z:0}
 });
 assert.equal(two.consistentChangeTicks,0,'a real recovery resets the streak');
 assert.equal(two.status,'observing');
});
