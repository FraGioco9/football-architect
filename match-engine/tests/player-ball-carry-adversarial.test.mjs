// C3.3b adversarial contract vectors: SYNTHETIC feed-shaped data only.
// Real 22-player Rapier acceptance remains in player-ball-carry-proximity.test.mjs.
// Synthetic frames must NEVER be cited as proof of actual physical contacts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicalCarryProximityObserver,
 PROXIMITY_INTERRUPTION_REASONS,PROXIMITY_LATERAL_BAND_M}
 from '../src/player-ball-physical-carry-proximity.mjs';

const fixtureId='season:1:IT-1:N01:IT-1:IT-2';
const contactSource='same-step-real-rapier-shoe-ball-collider';
const actor=id=>Object.freeze({engineId:id,team:id.split('-')[0]});
const ids=['home','away'].flatMap(team=>
 Array.from({length:11},(_,i)=>team+'-'+(i+1)));
function frame(obs,t,{ball={x:0,y:0},player={x:-0.1,y:0},
 started=[],active=[],ended=[],action=null,witness=null,verified=0}={}){
 const positions=Object.freeze(ids.map(id=>Object.freeze({
  engineId:id,team:id.split('-')[0],
  x:id==='home-9'?player.x:12,y:id==='home-9'?player.y:20
 })));
 const feed=Object.freeze({
  physicsTick:t,fixtureId,realFootEventsOnly:true,
  contactSource,officialMatchPossession:false,
  started:Object.freeze(started.map(actor)),
  active:Object.freeze(active.map(actor)),
  ended:Object.freeze(ended.map(actor)),
  multipleActive:active.length>1
 });
 return obs.observe({
  physicsTick:t,
  ballSnapshot:Object.freeze({tick:t,ball:Object.freeze({
   position:Object.freeze({x:ball.x,y:ball.y,z:0.11})})}),
  physicalPlayerPositions:positions,
  physicalContactFeed:feed,
  localAutonomousAction:action?Object.freeze({
   tick:t,playerId:'home-9',team:'home',action:'carry',
   appliedByRapier:true,actualPhysicsImpulseApplied:true
  }):null,
  physicalCarryContactSequence:Object.freeze({
   physicsTick:t,fixtureId,readOnly:true,dribbleConfirmed:null,
   authenticatedCarryImpulses:action?1:0,
   verifiedGroundCarryRecontacts:verified,
   latestVerifiedGroundCarryRecontact:witness
  })
 });
}
const open=()=>{
 const obs=createPhysicalCarryProximityObserver(fixtureId);
 frame(obs,0);
 frame(obs,1,{started:['home-9'],active:['home-9'],action:true});
 frame(obs,2,{ball:{x:-0.2,y:0},player:{x:0.1,y:0},
  ended:['home-9']});
 return obs;
};
const assertNotAdjudicated=state=>{
 assert.equal(state.measuredWindows,0);
 assert.equal(state.dribbleConfirmed,null);
 assert.equal(state.ballControlConfirmed,null);
 assert.equal(state.officialMatchPossession,false);
 assert.equal(state.officialMatchResult,null);
};
test('C3.3b different genuine-shaped shoe START/ACTIVE interrupts same-actor window',()=>{
 const cases=[
  {name:'opponent',started:['away-5'],active:['away-5'],
   reason:'opponent-shoe',shoe:'away-5'},
  {name:'teammate',started:['home-8'],active:['home-8'],
   reason:'teammate-shoe',shoe:'home-8'},
  {name:'contested',started:['home-9','away-5'],
   active:['home-9','away-5'],reason:'ambiguous-shoes',shoe:'away-5'}
 ];
 for(const c of cases){
  const obs=open();
  const s=frame(obs,3,{started:c.started,active:c.active});
  assertNotAdjudicated(s);
  assert.equal(s.interruptedWindows,1,c.name);
  assert.equal(s.interruptionReasons[c.reason],1);
  assert.deepEqual(s.latestInterruptedWindow.otherPhysicalShoeIds,
   c.name==='contested'?['away-5']: [c.shoe]);
  assert.equal(s.latestInterruptedWindow.reason,c.reason);
  assert.equal(s.latestInterruptedWindow.realRapierInterruptionObserved,true);
  assert.equal(s.activeMeasurement,null);
  assert.ok(Object.isFrozen(s.latestInterruptedWindow));
  assert.ok(Object.isFrozen(s.interruptionReasons));
  // A later same-actor new shoe START must not resurrect an interrupted window.
  const next=frame(obs,4,{started:['home-9'],active:['home-9'],
   action:true,verified:1,witness:{
    engineId:'home-9',team:'home',firstShoeTick:1,
    shoeEndTick:2,secondShoeTick:4,
    measuredAttackingProgressM:0.8,secondRealBoundedCarryImpulseApplied:true
   }});
  assert.equal(next.measuredWindows,0);
  assert.equal(next.activeMeasurement.firstShoeTick,4);
 }
});

test('C3.3b no physical END or unverified second carry cannot count as close control',()=>{
 const obs=createPhysicalCarryProximityObserver(fixtureId);
 frame(obs,0);
 frame(obs,1,{started:['home-9'],active:['home-9'],action:true});
 const s=frame(obs,2,{started:['home-9'],active:['home-9'],
  action:true,verified:1,witness:{
   engineId:'home-9',team:'home',firstShoeTick:1,
   shoeEndTick:null,secondShoeTick:2,
   measuredAttackingProgressM:0.3,
   secondRealBoundedCarryImpulseApplied:true
  }});
 assert.equal(s.measuredWindows,0);
 assert.equal(s.interruptionReasons['unverified-second-start'],1);
 assert.equal(s.dribbleConfirmed,null);
 const own=open();
 const invalid=frame(own,3,{started:['home-9'],active:['home-9'],
  action:true,verified:0,witness:null});
 assert.equal(invalid.measuredWindows,0);
 assert.equal(invalid.interruptionReasons['unverified-second-start'],1);
});

test('C3.3b expired 150-tick physical pursuit is not a future dribble',()=>{
 const obs=open();
 for(let tick=3;tick<=152;tick++){
  const s=frame(obs,tick);
  if(tick<152)assert.equal(s.interruptedWindows,0);
  if(tick===152){
   assert.equal(s.interruptionReasons.expired,1);
   assert.equal(s.latestInterruptedWindow.observedThroughTick,152);
   assertNotAdjudicated(s);
  }
 }
});

test('C3.3b far-ball, lateral offset and behind-actor frames remain non-possession even with forged proof',()=>{
 const obs=createPhysicalCarryProximityObserver(fixtureId);
 frame(obs,0);
 frame(obs,1,{started:['home-9'],active:['home-9'],action:true});
 frame(obs,2,{ball:{x:-0.2,y:0},player:{x:0.1,y:0},
  ended:['home-9']});
 frame(obs,3,{ball:{x:0.6,y:2},player:{x:0,y:0}});
 const fakeWitness={
  engineId:'home-9',team:'home',
  firstShoeTick:1,shoeEndTick:2,secondShoeTick:4,
  measuredAttackingProgressM:0.8,
  secondRealBoundedCarryImpulseApplied:true
 };
 const s=frame(obs,4,{ball:{x:0.8,y:2.2},
  player:{x:0.1,y:0},started:['home-9'],active:['home-9'],
  action:true,witness:fakeWitness,verified:1});
 const w=s.latestMeasuredWindow;
 // This witness is deliberately synthetic and not physically plausible;
 // it proves *lack of adjudication*, never dribbling acceptance.
 assert.equal(s.measuredWindows,1);
 assert.equal(w.nearFrames,2);
 assert.equal(w.farFrames,2);
 assert.equal(w.maxConsecutiveFarFrames,2);
 assert.equal(w.nearFrameFraction,0.5);
 assert.ok(w.ballBehindActorFrames>=1);
 assert.ok(w.lateralSeparatedFrames>=2);
 assert.equal(w.lateralDiagnosticBandM,PROXIMITY_LATERAL_BAND_M);
 assert.equal(w.ballAttached,false);
 assert.equal(w.ballControlConfirmed,null);
 assert.equal(w.dribbleConfirmed,null);
 assert.equal(w.officialMatchPossession,false);
 assert.equal(s.dribbleConfirmed,null);
 assert.equal(s.officialMatchResult,null);
 assert.deepEqual(PROXIMITY_INTERRUPTION_REASONS,[
  'opponent-shoe','teammate-shoe','ambiguous-shoes',
  'expired','unverified-second-start'
 ]);
});
