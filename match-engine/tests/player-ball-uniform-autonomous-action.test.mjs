// ME-PB-55 / A4.2b.2: pure contextual policy cannot produce results.
import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_PLAYERS,PLAYER_VERSION} from '../src/player-movement.mjs';
import {selectUniformAutonomousContactAction,UNIFORM_ACTION_CONTEXT_VERSION,
 SHOT_MAX_RANGE_M,SHOT_HALF_GOAL_AIM_Y_M,usesNativeLiveActionRanking,chooseLiveShotLane,chooseRecipient,rankNativeKeeperGoalLanes,nativeCarryImpulseAvailable}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {createProvisionalActionOutcomeObserver,
 PROVISIONAL_ACTION_OBSERVATION_TICKS}
 from '../src/player-ball-action-outcome-observation.mjs';

const ball=Object.freeze({x:-5,y:0,z:0.11});
const quiet=Object.freeze({x:0,y:0,z:0});
function mover(overrides={},tick=1){
 const players=INITIAL_PLAYERS.map(p=>Object.freeze({...p,...(overrides[p.id]??{})}));
 return Object.freeze({version:PLAYER_VERSION,tick,players:Object.freeze(players)});
}
const decide=(players,where=ball,start='home-10')=>
 selectUniformAutonomousContactAction({
  tick:1,contactStarted:[start],contactActive:[start],playerFrame:players,
  ballPosition:where,ballVelocity:quiet,ballRadiusM:0.11
 });
function distantTeammates(){
 return Object.fromEntries(INITIAL_PLAYERS
  .filter(p=>p.team==='home'&&p.id!=='home-10')
  .map(p=>[p.id,{x:-45,y:25}]));
}

test('A4.2b.2 pass chooses an OPEN player lane, not a closer lane blocked by a real opponent',()=>{
 const players=mover({...distantTeammates(),
  'home-9':{x:8,y:0},'home-10':{x:-5,y:0},
  'home-11':{x:10,y:10},'away-10':{x:5,y:0}
 });
 const a=decide(players);
 assert.equal(a?.action,'pass');
 assert.equal(a.recipientId,'home-11');
 assert.equal(a.decisionContext.version,UNIFORM_ACTION_CONTEXT_VERSION);
 assert.equal(a.decisionContext.rule,'open-safe-pass');
 assert.ok(a.decisionContext.passLaneClearanceM>=1.9);
 assert.equal(a.decisionContext.passCompleted,false);
 assert.equal(a.decisionContext.interceptionProven,false);
 assert.equal(a.officialMatchResult,null);
 assert.ok(Object.isFrozen(a.decisionContext));
});

test('A4.2b.2 under immediate opponent pressure and no safe lane, choose clearance not phantom pass',()=>{
 const players=mover({...distantTeammates(),
  'home-10':{x:-5,y:0},'away-10':{x:-3,y:0}
 });
 const a=decide(players);
 assert.equal(a.action,'clearance');
 assert.equal(a.recipientId,null);
 assert.equal(a.decisionContext.underImmediatePressure,true);
 assert.equal(a.decisionContext.rule,'pressured-no-safe-pass');
 assert.equal(a.decisionContext.goalScored,false);
});

test('A4.2b.2 blocked shot does not count as a shot or goal, clear shooting lane does',()=>{
 const position={x:40,y:0,z:0.11};
 const base={...distantTeammates(),'home-10':{x:40,y:0},
  'away-1':{x:48,y:20},'away-9':{x:46,y:0}};
 const blocked=decide(mover(base),position);
 assert.equal(blocked.action,'clearance');
 assert.equal(blocked.decisionContext.shotRange,true);
 assert.equal(blocked.decisionContext.rule,'blocked-shot-no-safe-pass');
 assert.ok(blocked.decisionContext.shotLaneClearanceM<2.4);
 const clear=decide(mover({...base,'away-9':{x:46,y:20}}),position);
 assert.equal(clear.action,'shot');
 assert.equal(clear.decisionContext.rule,'unblocked-goal-lane');
 assert.ok(clear.decisionContext.shotLaneClearanceM>=2.4);
 assert.equal(clear.decisionContext.goalScored,false);
 assert.equal(clear.officialGoalEvidence,false);
});

test('A4.2b.2 contextual policy is symmetric across home/away and never accepts fake shoe starts',()=>{
 const away=mover({'away-10':{x:-40,y:0},'home-1':{x:-48,y:20}});
 const output=decide(away,{x:-40,y:0,z:0.11},'away-10');
 assert.equal(output.action,'shot');
 assert.equal(output.team,'away');
 assert.ok(output.impulseNs.x<0);
 assert.equal(decide(away,{x:30,y:20,z:0.11},'away-10'),null);
 assert.equal(selectUniformAutonomousContactAction({
  tick:1,contactStarted:[],contactActive:[],playerFrame:away,
  ballPosition:{x:-40,y:0,z:0.11},
  ballVelocity:quiet,ballRadiusM:0.11
 }),null);
 assert.throws(()=>selectUniformAutonomousContactAction({
  tick:1,contactStarted:['away-10','away-10'],contactActive:['away-10'],playerFrame:away,
  ballPosition:{x:-40,y:0,z:0.11},
  ballVelocity:quiet,ballRadiusM:0.11
 }),/Verified same-tick/);
});

test('A4.2b.2 read-only outcome observer rejects a fabricated on-ball action or off-tick evidence',()=>{
 const observer=createProvisionalActionOutcomeObserver('f');
 const frame={physicsTick:0,ballSnapshot:{ball:{position:ball}},
  physicalContactFeed:{physicsTick:0,fixtureId:'f',started:[]},
  localAutonomousAction:null,autonomousActionMode:false};
 const zero=observer.observe(frame);
 assert.equal(zero.active,null);
 assert.equal(zero.lastCompleted,null);
 assert.equal(zero.actionSuccessAdjudicated,false);
 assert.equal(zero.observationWindowTicks,PROVISIONAL_ACTION_OBSERVATION_TICKS);
 assert.ok(Object.isFrozen(zero));
 assert.throws(()=>observer.observe({...frame,physicsTick:2}),
  /Trusted sequential Rapier/);
 const next={...frame,physicsTick:1,autonomousActionMode:true,
  physicalContactFeed:{physicsTick:1,fixtureId:'f',started:[]},
  localAutonomousAction:{tick:1,playerId:'home-10',team:'home',
   appliedByRapier:true,actualPhysicsImpulseApplied:true,
   officialMatchAction:false,decisionContext:{outcomeNotYetObserved:true}}};
 assert.throws(()=>observer.observe(next),
  /Untrusted non-Rapier/);
});

test('A4.2b.3 only one genuine START with one matching active shoe authorizes AI kick',()=>{
 const players=mover(),position={x:-5,y:0,z:0.11};
 const decideContact=(started,active)=>selectUniformAutonomousContactAction({
  tick:1,contactStarted:started,contactActive:active,
  playerFrame:players,ballPosition:position,ballVelocity:quiet,
  ballRadiusM:0.11
 });
 const exclusive=decideContact(['home-10'],['home-10']);
 assert.ok(exclusive,'one unopposed physical shoe contact can decide');
 for(const [started,active] of [
  [['home-10','away-10'],['home-10','away-10']],
  [['home-10'],['home-10','away-10']],
  [[],['home-10']],[[],[]]
 ])assert.equal(decideContact(started,active),null);
 for(const [started,active] of [
  [['home-10'],undefined],[['home-10'],[]],
  [['home-10'],['away-10']],
  [['home-10'],['home-10','home-10']],
  [['home-10'],['imposter']]
 ])assert.throws(()=>decideContact(started,active),/Verified same-tick/);
 assert.equal(exclusive.officialMatchAction,false);
 assert.equal(exclusive.officialMatchResult,null);
});

test('C1.1 all 22 temporary actors including both goalkeepers can propose a pass to a LIVE teammate from an exclusive real-contact input',()=>{
 for(const actor of INITIAL_PLAYERS){
  const attack=actor.team==='home'?1:-1;
  const mate=INITIAL_PLAYERS.find(p=>p.team===actor.team&&p.id!==actor.id);
  const players=mover(Object.fromEntries(INITIAL_PLAYERS.map(p=>[
   p.id,p.id===actor.id?{x:0,y:0}:
    p.id===mate.id?{x:attack*10,y:4}:
    p.team===actor.team?{x:-attack*40,y:28}:
    {x:attack*35,y:25}
  ])));
  const pick=decide(players,{x:0,y:0,z:0.11},actor.id);
  assert.equal(pick?.action,'pass',actor.id);
  assert.equal(pick.playerId,actor.id);
  assert.equal(pick.team,actor.team);
  assert.equal(pick.recipientId,mate.id);
  assert.equal(pick.passTarget.originPlayerId,actor.id);
  assert.equal(pick.passTarget.recipientId,mate.id);
  assert.equal(pick.passTarget.team,actor.team);
  assert.equal(pick.passTarget.originX,0);
  assert.equal(pick.passTarget.recipientX,attack*10);
  assert.equal(pick.passTarget.recipientY,4);
  assert.equal(pick.passTarget.physicsTick,1);
  assert.equal(pick.passTarget.physicalPassAttemptOnly,true);
  assert.equal(pick.passTarget.passCompleted,false);
  assert.ok(pick.decisionContext.passLaneClearanceM>=1.9);
  assert.ok(pick.impulseNs.x*attack>0);
  assert.ok(Math.abs(Math.hypot(...Object.values(pick.impulseNs))-2.4)<1e-8);
  assert.equal(pick.officialMatchAction,false);
  assert.ok(Object.isFrozen(pick.passTarget));
 }
});

test('C1.1 moving the live teammate changes the real intended pass target but no output claims reception',()=>{
 const layout=Object.fromEntries(INITIAL_PLAYERS.map(p=>[
  p.id,p.id==='home-5'?{x:0,y:0}:
   p.id==='home-6'?{x:12,y:8}:
   p.team==='home'?{x:-40,y:28}:{x:35,y:25}
 ]));
 const a=decide(mover(layout),{x:0,y:0,z:0.11},'home-5');
 const b=decide(mover({...layout,'home-6':{x:9,y:-7}}),
  {x:0,y:0,z:0.11},'home-5');
 assert.equal(a.action,'pass');
 assert.equal(b.action,'pass');
 assert.equal(a.recipientId,'home-6');
 assert.equal(b.recipientId,'home-6');
 assert.equal(a.passTarget.recipientY,8);
 assert.equal(b.passTarget.recipientY,-7);
 assert.ok(a.impulseNs.y>0&&b.impulseNs.y<0);
 assert.equal(a.passTarget.passCompleted,false);
 assert.equal(b.passTarget.passCompleted,false);
 assert.equal(decide(mover(layout),{x:30,y:28,z:0.11},'home-5'),null);
});

test('C1.2a contract-only contact classifications cannot certify a completed pass',()=>{
 // Synthetic feed vectors test the classifier's refusal to INFER success.
 // Real contact authenticity is asserted separately by 11v11 Rapier tests.
 const layout=Object.fromEntries(INITIAL_PLAYERS.map(p=>[
  p.id,p.id==='home-5'?{x:0,y:0}:
   p.id==='home-6'?{x:12,y:8}:
   p.team==='home'?{x:-40,y:28}:{x:35,y:25}
 ]));
 const policy=decide(mover(layout),{x:0,y:0,z:0.11},'home-5');
 assert.equal(policy.action,'pass');
 const action=Object.freeze({...policy,appliedByRapier:true,
  actualPhysicsImpulseApplied:true});
 const fixtureId='c1-contract-only',position={x:0,y:0,z:0.11};
 const contact=(tick,players)=>({
  physicsTick:tick,fixtureId,
  contactSource:'same-step-real-rapier-shoe-ball-collider',
  realFootEventsOnly:true,started:players.map(id=>({
   engineId:id,team:id.split('-')[0]
  })),
  active:players.map(id=>({engineId:id,team:id.split('-')[0]}))
 });
 const frame=(tick,starts,observedAction=null)=>({
  physicsTick:tick,ballSnapshot:{ball:{position}},
  physicalContactFeed:contact(tick,starts),
  localAutonomousAction:observedAction,autonomousActionMode:true
 });
 for(const [shoeStarts,kind] of [
  [['home-6'],'intended-recipient-shoe'],
  [['home-7'],'other-teammate-shoe'],
  [['home-5'],'passer-recontact'],
  [['away-10'],'opponent-shoe'],
  [['away-10','home-6'],'simultaneous-shoes-ambiguous']
 ]){
  const observer=createProvisionalActionOutcomeObserver(fixtureId);
  observer.observe(frame(0,[]));
  const started=observer.observe(frame(1,['home-5'],action));
  assert.equal(started.physicalPassFollowThrough.active.status,'observing');
  const post=observer.observe(frame(2,shoeStarts));
  const trail=post.physicalPassFollowThrough;
  assert.equal(trail.active,null);
  assert.equal(trail.lastResolved.status,'contact-observed');
  assert.equal(trail.lastResolved.firstSubsequentContact.kind,kind);
  assert.deepEqual(trail.lastResolved.firstSubsequentContact.contacts.map(x=>x.engineId),shoeStarts);
  assert.equal(trail.lastResolved.firstSubsequentContact.physicsTick,2);
  assert.equal(trail.lastResolved.passCompleted,null);
  assert.equal(trail.lastResolved.firstSubsequentContact.passCompleted,null);
  assert.equal(trail.lastResolved.officialMatchPossession,false);
  assert.equal(trail.lastResolved.officialMatchResult,null);
  assert.ok(Object.isFrozen(trail.lastResolved.firstSubsequentContact.contacts));
 }
 const observer=createProvisionalActionOutcomeObserver(fixtureId);
 observer.observe(frame(0,[]));observer.observe(frame(1,['home-5'],action));
 const empty=observer.observe(frame(2,[])).physicalPassFollowThrough;
 assert.equal(empty.active?.status,'observing');
 assert.equal(empty.lastResolved,null);
 assert.equal(empty.active?.firstSubsequentContact,null);
 const expires=createProvisionalActionOutcomeObserver(fixtureId);
 expires.observe(frame(0,[]));expires.observe(frame(1,['home-5'],action));
 let last;
 for(let tick=2;tick<=301;tick++)
  last=expires.observe(frame(tick,[]));
 assert.equal(last.physicalPassFollowThrough.active,null);
 assert.equal(last.physicalPassFollowThrough.lastResolved.status,'expired-without-contact');
 assert.equal(last.physicalPassFollowThrough.lastResolved.elapsedPhysicsTicks,300);
 assert.equal(last.physicalPassFollowThrough.lastResolved.passCompleted,null);
});

test('C1.2a later contact contract rejects spoofed shoe IDs, teams and duplicate STARTs',()=>{
 const layout=Object.fromEntries(INITIAL_PLAYERS.map(p=>[
  p.id,p.id==='home-5'?{x:0,y:0}:
   p.id==='home-6'?{x:12,y:8}:
   p.team==='home'?{x:-40,y:28}:{x:35,y:25}
 ]));
 const action={...decide(mover(layout),{x:0,y:0,z:0.11},'home-5'),
  appliedByRapier:true,actualPhysicsImpulseApplied:true};
 const fixtureId='c1-negative-shoes',position={x:0,y:0,z:0.11};
 const newObserver=()=>{
  const o=createProvisionalActionOutcomeObserver(fixtureId);
  o.observe({physicsTick:0,ballSnapshot:{ball:{position}},
   physicalContactFeed:{physicsTick:0,fixtureId,started:[]},
   localAutonomousAction:null,autonomousActionMode:true});
  o.observe({physicsTick:1,ballSnapshot:{ball:{position}},
   physicalContactFeed:{physicsTick:1,fixtureId,
    started:[{engineId:'home-5',team:'home'}],
    active:[{engineId:'home-5',team:'home'}]},
   localAutonomousAction:action,autonomousActionMode:true});
  return o;
 };
 const invalid=[
  [{engineId:'home-6',team:'away'}],
  [{engineId:'home-12',team:'home'}],
  [{engineId:'home-6',team:'home'},{engineId:'home-6',team:'home'}]
 ];
 for(const started of invalid){
  const o=newObserver();
  assert.throws(()=>o.observe({physicsTick:2,ballSnapshot:{ball:{position}},
   physicalContactFeed:{physicsTick:2,fixtureId,
    contactSource:'same-step-real-rapier-shoe-ball-collider',
    realFootEventsOnly:true,started},
   localAutonomousAction:null,autonomousActionMode:true
  }),/Malformed or ambiguous Rapier shoe identity/);
 }
 const o=newObserver();
 assert.throws(()=>o.observe({physicsTick:2,ballSnapshot:{ball:{position}},
  physicalContactFeed:{physicsTick:2,fixtureId,
   contactSource:'untrusted-local-stub',realFootEventsOnly:false,
   started:[{engineId:'home-6',team:'home'}]},
  localAutonomousAction:null,autonomousActionMode:true
 }),/authentic later Rapier shoe starts/);
});

test('C1.2b authentic contact-frame kinematics cannot be represented as an official pass result',()=>{
 const scenario={x:-5,y:0,z:0.11}, v0={x:0,y:0,z:0}, v1={x:4,y:0,z:0};
 const players=mover(Object.fromEntries(INITIAL_PLAYERS.map(p=>[
  p.id,p.id==='home-10'?{x:-5,y:0}:
   p.id==='home-11'?{x:5,y:5}:
   p.team==='home'?{x:-40,y:28}:{x:35,y:25}
 ])));
 const policy=decide(players,scenario,'home-10');
 assert.equal(policy.action,'pass');
 const action={...policy,appliedByRapier:true,actualPhysicsImpulseApplied:true};
 const fixtureId='c1-kinematics-contract';
 const session=createProvisionalActionOutcomeObserver(fixtureId);
 const feed=(tick,starts)=>({
  fixtureId,physicsTick:tick,
  realFootEventsOnly:true,
  contactSource:'same-step-real-rapier-shoe-ball-collider',
  started:starts.map(engineId=>({engineId,team:engineId.split('-')[0]})),
  active:starts.map(engineId=>({engineId,team:engineId.split('-')[0]}))
 });
 const frame=(tick,starts,velocity,localAutonomousAction=null)=>({
  physicsTick:tick,ballSnapshot:{ball:{position:scenario,velocity}},
  physicalContactFeed:feed(tick,starts),
  localAutonomousAction,autonomousActionMode:true
 });
 session.observe(frame(0,[],v0));
 session.observe(frame(1,['home-10'],v1,action));
 const observed=session.observe(frame(2,['home-11'],v0));
 const contact=observed.physicalPassFollowThrough.lastResolved.firstSubsequentContact;
 assert.equal(contact.kind,'intended-recipient-shoe');
 assert.equal(contact.ballKinematics.priorPhysicsTick,1);
 assert.equal(contact.ballKinematics.contactPhysicsTick,2);
 assert.deepEqual(contact.ballKinematics.ballVelocityPriorTick,v1);
 assert.deepEqual(contact.ballKinematics.ballVelocityAtContact,v0);
 assert.equal(contact.ballKinematics.observedVelocityDeltaMps,4);
 assert.equal(contact.ballKinematics.solverImpulseInferred,false);
 assert.equal(contact.passCompleted,null);
 assert.equal(observed.officialMatchResult,null);
});

test('C1.2c independent opposition shoe trail persists after first genuine teammate reception (contract vectors only)',()=>{
 // Synthetic vectors verify what the read-only classifier MUST and MUST NOT
 // infer. Real contact is proved separately against independent Rapier worlds.
 const layout=Object.fromEntries(INITIAL_PLAYERS.map(p=>[
  p.id,p.id==='home-5'?{x:0,y:0}:
   p.id==='home-6'?{x:10,y:4}:
   p.team==='home'?{x:-40,y:28}:{x:35,y:25}
 ]));
 const action={...decide(mover(layout),{x:0,y:0,z:0.11},'home-5'),
  appliedByRapier:true,actualPhysicsImpulseApplied:true};
 assert.equal(action.action,'pass');
 const fixtureId='c1-opponent-contract',point={x:0,y:0,z:0.11};
 const contact=(tick,ids)=>({
  physicsTick:tick,fixtureId,realFootEventsOnly:true,
  contactSource:'same-step-real-rapier-shoe-ball-collider',
  started:ids.map(engineId=>({engineId,team:engineId.split('-')[0]})),
  active:ids.map(engineId=>({engineId,team:engineId.split('-')[0]}))
 });
 const frame=(tick,ids,velocity,localAutonomousAction=null)=>({
  physicsTick:tick,ballSnapshot:{ball:{position:point,velocity}},
  physicalContactFeed:contact(tick,ids),
  localAutonomousAction,autonomousActionMode:true
 });
 const obs=createProvisionalActionOutcomeObserver(fixtureId);
 const v0={x:0,y:0,z:0},v1={x:3,y:0,z:0};
 obs.observe(frame(0,[],v0));
 const started=obs.observe(frame(1,['home-5'],v1,action));
 assert.equal(started.physicalPassFollowThrough.opponentChallenge.active.status,'observing');
 const teammate=obs.observe(frame(2,['home-6'],v1)).physicalPassFollowThrough;
 assert.equal(teammate.lastResolved.firstSubsequentContact.kind,
  'intended-recipient-shoe');
 assert.equal(teammate.opponentChallenge.active.actionTick,1);
 assert.equal(teammate.opponentChallenge.lastResolved,null);
 const opponent=obs.observe(frame(3,['away-10'],v0)).physicalPassFollowThrough;
 const challenge=opponent.opponentChallenge;
 assert.equal(challenge.active,null);
 assert.equal(challenge.lastResolved.status,'opponent-contact-observed');
 assert.equal(challenge.lastResolved.actionTick,1);
 assert.equal(challenge.lastResolved.observedThroughTick,3);
 assert.equal(challenge.lastResolved.passerTeam,'home');
 assert.equal(challenge.lastResolved.firstOpponentContact.physicsTick,3);
 assert.deepEqual(challenge.lastResolved.firstOpponentContact.contacts.map(
  x=>x.engineId),['away-10']);
 assert.equal(challenge.lastResolved.firstOpponentContact.contacts[0].team,'away');
 assert.equal(challenge.lastResolved.firstOpponentContact.ballKinematics.observedVelocityDeltaMps,3);
 assert.equal(challenge.lastResolved.firstOpponentContact.ballKinematics.solverImpulseInferred,false);
 assert.equal(challenge.lastResolved.firstOpponentContact.simultaneousShoesAmbiguous,false);
 assert.equal(challenge.lastResolved.interceptionConfirmed,null);
 assert.equal(challenge.lastResolved.tackleConfirmed,null);
 assert.equal(challenge.lastResolved.passCompleted,null);
 assert.equal(challenge.officialMatchResult,null);
 assert.ok(Object.isFrozen(challenge.lastResolved));
 assert.ok(Object.isFrozen(challenge.lastResolved.firstOpponentContact));
 assert.equal(opponent.lastResolved.firstSubsequentContact.kind,
  'intended-recipient-shoe','first contact must remain unchanged');
});

test('C1.2c opponent observer rejects a forged shoe after genuine first recipient contact, supports ambiguous START and expiry',()=>{
 const layout=Object.fromEntries(INITIAL_PLAYERS.map(p=>[
  p.id,p.id==='home-5'?{x:0,y:0}:
   p.id==='home-6'?{x:10,y:4}:
   p.team==='home'?{x:-40,y:28}:{x:35,y:25}
 ]));
 const action={...decide(mover(layout),{x:0,y:0,z:0.11},'home-5'),
  appliedByRapier:true,actualPhysicsImpulseApplied:true};
 const fixtureId='c1-opponent-negatives',position={x:0,y:0,z:0.11};
 const frame=(tick,entries,localAutonomousAction=null,source=
  'same-step-real-rapier-shoe-ball-collider')=>({
  physicsTick:tick,ballSnapshot:{ball:{position,
   velocity:{x:0,y:0,z:0}}},
  physicalContactFeed:{physicsTick:tick,fixtureId,
   contactSource:source,realFootEventsOnly:source.startsWith('same-step'),
   started:entries,active:entries},
  localAutonomousAction,autonomousActionMode:true
 });
 const make=()=>{
  const o=createProvisionalActionOutcomeObserver(fixtureId);
  o.observe(frame(0,[]));
  o.observe(frame(1,[{engineId:'home-5',team:'home'}],action));
  o.observe(frame(2,[{engineId:'home-6',team:'home'}]));
  return o;
 };
 for(const e of [
  [{engineId:'away-10',team:'home'}],
  [{engineId:'away-12',team:'away'}],
  [{engineId:'away-10',team:'away'},
   {engineId:'away-10',team:'away'}]
 ]){
  assert.throws(()=>make().observe(frame(3,e)),
   /Malformed or ambiguous Rapier shoe identity/);
 }
 assert.throws(()=>make().observe(frame(3,[
  {engineId:'away-10',team:'away'}
 ],null,'forged-local-feed')), /authentic later Rapier shoe starts/);
 const simultaneous=make().observe(frame(3,[
  {engineId:'away-10',team:'away'},
  {engineId:'home-7',team:'home'}
 ])).physicalPassFollowThrough.opponentChallenge.lastResolved;
 assert.equal(simultaneous.status,'opponent-contact-observed');
 assert.equal(simultaneous.firstOpponentContact.simultaneousShoesAmbiguous,true);
 assert.deepEqual(simultaneous.firstOpponentContact.contacts.map(x=>x.engineId),
  ['away-10']);
 assert.equal(simultaneous.interceptionConfirmed,null);
 const expires=make();
 let last=null;
 for(let tick=3;tick<=301;tick++)last=expires.observe(frame(tick,[]));
 const expired=last.physicalPassFollowThrough.opponentChallenge;
 assert.equal(expired.active,null);
 assert.equal(expired.lastResolved.status,'expired-without-opponent-contact');
 assert.equal(expired.lastResolved.elapsedPhysicsTicks,300);
 assert.equal(expired.lastResolved.firstOpponentContact,null);
 assert.equal(expired.lastResolved.interceptionConfirmed,null);
 assert.equal(expired.lastResolved.officialMatchResult,null);
});


test('C2.3b both teams can AIM a near-post physical SHOT only from authentic exclusive input and clear LIVE lane',()=>{
 assert.equal(SHOT_MAX_RANGE_M,35);
 assert.equal(SHOT_HALF_GOAL_AIM_Y_M,3.1);
 for(const side of ['home','away']){
  const sign=side==='home'?1:-1;
  const actor=side+'-10',keeper=(side==='home'?'away':'home')+'-1';
  const opponents=INITIAL_PLAYERS.filter(p=>p.team!==side);
  const overrides=Object.fromEntries(INITIAL_PLAYERS.map(p=>[
   p.id,p.id===actor?{x:sign*20,y:0}:
    p.id===keeper?{x:sign*46,y:0}:
     p.team===side?{x:-sign*42,y:28}:{x:sign*36,y:26}
  ]));
  const frame=mover(overrides);
  const shot=decide(frame,{x:sign*20,y:0,z:0.11},actor);
  assert.equal(shot.action,'shot',side);
  assert.equal(shot.team,side);
  assert.equal(shot.shotTarget.targetX,sign*52.5);
  assert.ok(Math.abs(shot.shotTarget.targetY)===3.1);
  assert.ok(shot.shotTarget.laneClearanceM>=2.4);
  assert.equal(shot.shotTarget.physicsTick,1);
  assert.equal(shot.shotTarget.shooterId,actor);
  assert.equal(shot.shotTarget.goalScored,null);
  assert.equal(shot.shotTarget.shotOnTarget,null);
  assert.equal(shot.shotTarget.attemptOnly,true);
  assert.equal(shot.officialMatchAction,false);
  assert.ok(Object.isFrozen(shot.shotTarget));
  const noContact=selectUniformAutonomousContactAction({
   tick:1,contactStarted:[],contactActive:[],playerFrame:frame,
   ballPosition:{x:sign*20,y:0,z:0.11},ballVelocity:quiet,
   ballRadiusM:0.11
  });
  assert.equal(noContact,null);
  const contested=selectUniformAutonomousContactAction({
   tick:1,contactStarted:[actor,keeper],contactActive:[actor,keeper],
   playerFrame:frame,ballPosition:{x:sign*20,y:0,z:0.11},
   ballVelocity:quiet,ballRadiusM:0.11
  });
  assert.equal(contested,null);
  const far=decide(frame,{x:-sign*20,y:0,z:0.11},actor);
  assert.equal(far,null,'no shot just because a team has a nominal target');
 }
});

test('C3.3m real Rapier-origin pass distance is valid on both 3m and 25m edges, mirrored',()=>{
 for(const team of ['home','away']){
  const attack=team==='home'?1:-1;
  const actorId=team+'-10',recipientId=team+'-11';
  const origin=-attack*5;
  for(const d of [3.1,25]){
   const players=mover(Object.fromEntries(INITIAL_PLAYERS.map(p=>[
    p.id,p.id===actorId?{x:origin,y:0}:
     p.id===recipientId?{x:origin+attack*d,y:0}:
     p.team===team?{x:-attack*45,y:25}:
      {x:attack*35,y:25}
   ])));
   const badShift=d<5?0.65:-0.75;
   const badBall={x:origin+attack*badShift,y:0,z:0.11};
   const bad=decide(players,badBall,actorId);
   assert.ok(bad,'a real exclusive shoe can still select a safe action');
   assert.equal(bad.action,'clearance',
    'out-of-range ball-origin target must never be represented as a pass');
   assert.equal(bad.passTarget,null);
   const goodShift=d<5?-0.65:0.65;
   const good=decide(players,{x:origin+attack*goodShift,y:0,z:0.11},actorId);
   assert.equal(good?.action,'pass','true ball-origin range stays valid');
   assert.ok(good.passTarget.distanceM>=3&&good.passTarget.distanceM<=25);
   assert.equal(good.passTarget.originPlayerId,actorId);
   assert.equal(good.passTarget.recipientId,recipientId);
   assert.equal(good.passTarget.physicalPassAttemptOnly,true);
   assert.equal(good.passTarget.passCompleted,false);
  }
 }
});

 test('D-12 interception recovery carry works without an isolated dribble context',()=>{
 for(const side of ['home','away']){
  const other=side==='home'?'away':'home',defender=other+'-2';
  const frame=mover({[side+'-10']:{x:-12,y:8},[side+'-9']:{x:0,y:8},[defender]:{x:-6,y:8}},25);
  const a=selectUniformAutonomousContactAction({tick:25,contactStarted:[defender],contactActive:[defender],playerFrame:frame,ballPosition:{x:-6,y:8,z:0.11},ballVelocity:quiet,ballRadiusM:0.11,activePlayerIds:[side+'-10',side+'-9',defender],interceptionContext:{side,phase:'intercepted'},isolatedDribbleContext:null});
  assert.equal(a.action,'carry');assert.equal(a.playerId,defender);assert.equal(a.decisionContext.rule,'interception-recovery-native-carry');assert.equal(a.officialMatchPossession,false);
 }
 });

test('UME-05I native carry uses the same live opponent geometry in open play and directed duel',async()=>{
 const {planNativeCarryTouch,chooseDirectedDribbleTouch}=await import('../src/isolated-dribble-touches.mjs');
 for(const attackingSide of ['home','away']){
  const dir=attackingSide==='home'?1:-1,other=attackingSide==='home'?'away':'home';
  const attacker={id:attackingSide+'-7',team:attackingSide,x:-dir*0.5,y:0};
  const ballPosition={x:0,y:0,z:0.11},ballVelocity={x:dir,y:0,z:0};
  for(const y of [-0.7,0.7]){
   const defender={id:other+'-4',team:other,x:dir*2,y};
   const args={attackingSide,attacker,defender,ballPosition,ballVelocity};
   const common=planNativeCarryTouch({...args,maxImpulseNs:0.30});
   const locked=chooseDirectedDribbleTouch({...args,variantIndex:0,tick:1});
   assert.deepEqual(common.desiredVelocity,locked.desiredVelocity);
   assert.equal(common.magnitudeNs,locked.magnitudeNs);
   assert.equal(Math.sign(common.dy),-Math.sign(y));
   assert.ok(common.magnitudeNs<=0.30);assert.equal(common.officialPossession,false);
  }
  const unopposed=planNativeCarryTouch({attackingSide,attacker,ballPosition,ballVelocity:{x:dir*3,y:0,z:0}});
  assert.equal(unopposed.magnitudeNs,0);
  assert.equal(unopposed.fromLiveOpponent,false);
 }
});
test('UME-02 same native contact selector for pair, overload and full participant set',()=>{
 const field=mover(Object.fromEntries(INITIAL_PLAYERS.map(p=>[p.id,{x:p.team==='home'?-45:45,y:25}]).concat([['home-10',{x:-5,y:0}],['away-2',{x:-1,y:0}]])));
 const source={tick:1,contactStarted:['home-10'],contactActive:['home-10'],playerFrame:field,ballPosition:ball,ballVelocity:quiet,ballRadiusM:0.11,allowPhysicalCarry:true,nativeActionPolicy:true,collectiveControl:{tick:0,kind:'loose',playerId:null,sourceTick:null,officialPossession:false}};
 const sets=[['home-10','away-2'],['home-10','away-2','home-9'],INITIAL_PLAYERS.map(p=>p.id)];
 for(const activePlayerIds of sets){
  const action=selectUniformAutonomousContactAction({...source,activePlayerIds});
  assert.equal(action?.action,'carry');assert.equal(action.decisionContext.smallSidedChoice.selected,'carry');
  assert.ok(action.decisionContext.nativeCarryTouch);assert.ok(Math.hypot(...Object.values(action.impulseNs))<=0.42+1e-9);
  assert.equal(selectUniformAutonomousContactAction({...source,activePlayerIds,contactStarted:[],contactActive:[]}),null);
  assert.equal(selectUniformAutonomousContactAction({...source,activePlayerIds,contactActive:['home-10','away-2']}),null);
 }
 assert.throws(()=>selectUniformAutonomousContactAction({...source,activePlayerIds:sets[0],collectiveControl:null}),/control observation/);
});

test('UME-05J native interception correction is shared and bounded across mirrored actors',async()=>{
 const {planNativeInterceptionCushion,chooseDuelInterceptionTouch}=await import('../src/isolated-dribble-touches.mjs');
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const attacker={id:side+'-7',team:side,x:-dir*4,y:0};
  const defender={id:other+'-4',team:other,x:dir*0.2,y:0.3};
  const ballPosition={x:0,y:0,z:0.11},ballVelocity={x:dir*6,y:0,z:0};
  const args={attackingSide:side,attacker,defender,ballPosition,ballVelocity};
  const duel=chooseDuelInterceptionTouch(args);
  assert.ok(duel);
  const common=planNativeInterceptionCushion({...args,desiredVelocity:duel.desiredVelocity,maxImpulseNs:2.2});
  for(const key of ['dx','dy','magnitudeNs','carrierGapM','defenderGapM','actorId','opponentId'])assert.equal(common[key],duel[key]);
  assert.equal(common.interceptionConfirmed,false);assert.equal(common.officialPossession,false);
  assert.equal(common.nativeExclusiveShoeRequired,true);assert.ok(Object.isFrozen(common.desiredVelocity));
  assert.equal(planNativeInterceptionCushion({...args,desiredVelocity:ballVelocity,maxImpulseNs:2.2}),null);
  assert.equal(planNativeInterceptionCushion({...args,attacker:{...attacker,x:0.2},desiredVelocity:duel.desiredVelocity,maxImpulseNs:2.2}),null);
  assert.equal(planNativeInterceptionCushion({...args,desiredVelocity:duel.desiredVelocity,maxImpulseNs:6}),null);
  // The isolated delivery keeps its existing provisional target and
  // ceiling; the common correction must match the actual selector.
  const passerId=side+'-10',recipientId=side+'-9',defenderId=other+'-2';
  const frame=mover({[passerId]:{x:attacker.x,y:0},[recipientId]:{x:dir*5,y:0},[defenderId]:{x:defender.x,y:defender.y}},25);
  const input={tick:25,contactStarted:[defenderId],contactActive:[defenderId],playerFrame:frame,ballPosition,ballVelocity,ballRadiusM:0.11,activePlayerIds:[passerId,recipientId,defenderId],interceptionContext:{side,phase:'flight'}};
  const action=selectUniformAutonomousContactAction(input);
  assert.equal(action?.action,'interception');
  const expected=planNativeInterceptionCushion({...args,attacker:{...attacker,id:passerId},defender:{...defender,id:defenderId},desiredVelocity:action.defensiveTarget.desiredVelocity,maxImpulseNs:5.8});
  assert.equal(action.defensiveTarget.magnitudeNs,expected.magnitudeNs);
  assert.ok(Math.abs(Math.hypot(action.impulseNs.x,action.impulseNs.y)-expected.magnitudeNs)<1e-9);
  assert.equal(action.officialMatchPossession,false);
  assert.equal(selectUniformAutonomousContactAction({...input,contactStarted:[],contactActive:[]}),null);
  assert.equal(selectUniformAutonomousContactAction({...input,contactActive:[defenderId,passerId]}),null);
 }
});

test('UME-05K one bounded ground correction preserves defensive attempt geometry and ceilings',async()=>{
 const {chooseDribbleDefensiveTouch,planNativeDefensiveGroundTouch,SLIDING_TACKLE_MAX_IMPULSE_NS}=await import('../src/isolated-dribble-touches.mjs');
 for(const attackingSide of ['home','away']){
  const dir=attackingSide==='home'?1:-1,other=attackingSide==='home'?'away':'home';
  const defender={id:other+'-6',team:other,x:dir*0.6,y:0.2};
  const ballPosition={x:0,y:0,z:0.11},ballVelocity={x:dir*1.4,y:0,z:0};
  for(const [carrierX,kind,sliding,cap] of [[-0.6,'tackle',false,1.25],[-0.6,'tackle',true,SLIDING_TACKLE_MAX_IMPULSE_NS],[-4,'interception',false,1.25]]){
   const attacker={id:attackingSide+'-8',team:attackingSide,x:dir*carrierX,y:0};
   const source={attackingSide,attacker,defender,ballPosition,ballVelocity};
   const touch=chooseDribbleDefensiveTouch({...source,sliding});
   assert.equal(touch?.kind,kind);
   const common=planNativeDefensiveGroundTouch({...source,kind,desiredVelocity:touch.desiredVelocity,maxImpulseNs:cap});
   assert.ok(common);
   assert.equal(common.magnitudeNs,Math.min(cap,0.43*Math.hypot(touch.desiredVelocity.x-ballVelocity.x,touch.desiredVelocity.y-ballVelocity.y)));
   for(const key of ['dx','dy','magnitudeNs','actorId','opponentId','carrierGapM','defenderGapM'])assert.equal(common[key],touch[key]);
   assert.equal(common.officialPossession,false);assert.equal(common.nativeExclusiveShoeRequired,true);
   assert.equal(planNativeDefensiveGroundTouch({...source,kind:kind==='tackle'?'interception':'tackle',desiredVelocity:touch.desiredVelocity,maxImpulseNs:cap}),null);
  }
 }
});

test('UME-05L identical witnessed pass interception in free play and isolated exercise, including backward and fast passes',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const passerId=side+'-10',recipientId=side+'-9',defenderId=other+'-2';
  const frame=mover(Object.fromEntries(INITIAL_PLAYERS.map(p=>[p.id,p.id===passerId?{x:-dir*4,y:0}:p.id===recipientId?{x:dir*5,y:0}:p.id===defenderId?{x:dir*0.2,y:0.3}:{x:p.team===side?-40:40,y:25}])),25);
  const ballPosition={x:0,y:0,z:0.11},activePlayerIds=[passerId,recipientId,defenderId];
  const delivery={kind:'pass',team:side,playerId:passerId,recipientId,tick:12};
  const common={tick:25,contactStarted:[defenderId],contactActive:[defenderId],playerFrame:frame,ballPosition,ballRadiusM:0.11,activePlayerIds};
  for(const ballVelocity of [{x:dir*12,y:0,z:0},{x:-dir*5,y:0,z:0},{x:0,y:4,z:0}]){
   const input={...common,ballVelocity};
   const isolated=selectUniformAutonomousContactAction({...input,interceptionContext:{side,phase:'flight'}});
   const open={...input,allowPhysicalCarry:true,nativeActionPolicy:true,collectiveControl:{tick:24,kind:'loose',playerId:null,officialPossession:false,delivery}};
   const native=selectUniformAutonomousContactAction(open);
   assert.equal(isolated?.action,'interception');assert.equal(native?.action,'interception');
   assert.deepEqual(native.defensiveTarget,isolated.defensiveTarget);
   assert.deepEqual(native.impulseNs,isolated.impulseNs);
   assert.equal(native.officialMatchPossession,false);
   assert.equal(selectUniformAutonomousContactAction({...open,contactStarted:[],contactActive:[]}),null);
   const noRecipient=selectUniformAutonomousContactAction({...open,collectiveControl:{...open.collectiveControl,delivery:{...delivery,recipientId:'missing'}}});
   assert.notEqual(noRecipient?.action,'interception');
   const expired=selectUniformAutonomousContactAction({...open,collectiveControl:{...open.collectiveControl,delivery:{...delivery,tick:-200}}});
   assert.notEqual(expired?.action,'interception');
   const close=mover({[passerId]:{x:-dir*4,y:0},[recipientId]:{x:dir*0.5,y:0},[defenderId]:{x:dir*0.2,y:0.3}},25);
   assert.equal(selectUniformAutonomousContactAction({...input,playerFrame:close,interceptionContext:{side,phase:'flight'}}),null);
  }
 }
});

test('ME-01-QA U-01F2: forbidden shot leaves an actually available pass, not invented contact',()=>{
 const where={x:40,y:0,z:.11};
 const players=mover({...distantTeammates(),'home-10':{x:40,y:0},'home-9':{x:45,y:7},'away-1':{x:48,y:20},'away-9':{x:46,y:20}});
 const input={tick:1,contactStarted:['home-10'],contactActive:['home-10'],playerFrame:players,ballPosition:where,ballVelocity:quiet,ballRadiusM:.11,activePlayerIds:['home-10','home-9']};
 assert.equal(selectUniformAutonomousContactAction(input)?.action,'shot');
 assert.equal(selectUniformAutonomousContactAction({...input,allowedFundamentals:['pass']})?.action,'pass');
 assert.equal(selectUniformAutonomousContactAction({...input,allowedFundamentals:[]}),null);
 assert.equal(selectUniformAutonomousContactAction({...input,allowedFundamentals:['pass'],contactStarted:[],contactActive:[]}),null);
});

test('ME-01-QA U-02c2a: native ranking and bounded contested delivery geometry',()=>{
 for(const nativeActionPolicy of [true,false])for(const pairedPhysicalSource of [true,false])
  assert.equal(usesNativeLiveActionRanking({nativeActionPolicy,pairedPhysicalSource}),nativeActionPolicy||pairedPhysicalSource);
 for(const team of ['home','away'])for(const polarity of [1,-1]){
  const dir=(team==='home'?1:-1)*polarity;
  const actor={id:team+'-10',team,x:dir*25,y:0},receiver={id:team+'-9',team,x:dir*37,y:0};
  const defender={id:(team==='home'?'away':'home')+'-2',team:team==='home'?'away':'home',x:dir*31,y:0};
  const players=[actor,receiver,defender],ball={x:actor.x,y:0,z:.11};
  assert.equal(chooseRecipient(actor,ball,players,polarity),null);
  assert.equal(chooseRecipient(actor,ball,players,polarity,{requiredRecipientId:receiver.id,minimumLaneClearanceM:0}).player,receiver);
  assert.equal(chooseRecipient(actor,ball,players,polarity,{requiredRecipientId:'missing',minimumLaneClearanceM:0}),null);
  assert.equal(chooseRecipient(actor,ball,[actor,{...receiver,x:actor.x+dir}],polarity,{requiredRecipientId:receiver.id,minimumLaneClearanceM:0}),null);
  assert.equal(chooseLiveShotLane(ball,dir*52.5,team,players,{minimumClearanceM:0,aimY:0}).clearance,0);
  assert.equal(chooseLiveShotLane(ball,dir*52.5,team,players,{aimY:0}),null);
  assert.equal(chooseLiveShotLane(ball,dir*52.5,team,players,{minimumClearanceM:0,aimY:9}),null);
 }
});

test('ME-01-QA U-02c2b: keeper lanes preserve outfield blocking constraints',()=>{
 for(const team of ['home','away'])for(const polarity of [1,-1]){
  const dir=(team==='home'?1:-1)*polarity,other=team==='home'?'away':'home';
  const ball={x:dir*47,y:0},keeper={id:other+'-1',team:other,role:'goalkeeper',x:dir*50,y:0};
  const open=rankNativeKeeperGoalLanes(ball,team,[keeper],polarity);
  assert.equal(open.minimum,0);
  assert.ok(open.lane);assert.equal(open.lane.target.x,dir*52.5);
  const blocked=rankNativeKeeperGoalLanes(ball,team,[keeper,{id:other+'-2',team:other,role:'defender',x:ball.x,y:0}],polarity);
  assert.equal(blocked.lane,null);
  assert.equal(rankNativeKeeperGoalLanes(ball,team,[],polarity),null);
  assert.equal(rankNativeKeeperGoalLanes({x:dir*20,y:0},team,[keeper],polarity).lane,null);
 }
});

test('ME-01-QA U-04d2: paired keeper exercise and open play share the physical action proposal',()=>{
 for(const team of ['home','away']){
  const dir=team==='home'?1:-1,actor=team+'-10',keeper=(team==='home'?'away':'home')+'-1';
  for(const x of [25,30,42,48])for(const y of [0,1,5]){
   const playerFrame=mover({[actor]:{x:dir*(x-.3),y,vx:dir*2,vy:0},[keeper]:{x:dir*50,y:0}});
   const source={tick:1,contactStarted:[actor],contactActive:[actor],playerFrame,
    ballPosition:{x:dir*x,y,z:.11},ballVelocity:quiet,ballRadiusM:.11,
    activePlayerIds:[actor,keeper],allowPhysicalCarry:true,pairedPhysicalSource:true,allowedFundamentals:['carry','shot','save']};
   const exercise=selectUniformAutonomousContactAction({...source,keeperSingleShotSide:team});
   const open=selectUniformAutonomousContactAction({...source,nativeActionPolicy:true,collectiveControl:{tick:0,kind:'loose',playerId:null,officialPossession:false}});
   assert.equal(exercise?.action,open?.action);
   assert.deepEqual(exercise?.impulseNs,open?.impulseNs);
   assert.deepEqual(exercise?.shotTarget,open?.shotTarget);
   assert.deepEqual(exercise?.decisionContext.nativeCarryTouch,open?.decisionContext.nativeCarryTouch);
   if(exercise)assert.equal(exercise.officialMatchAction,false);
   assert.equal(selectUniformAutonomousContactAction({...source,keeperSingleShotSide:team,contactStarted:[],contactActive:[]}),null);
  }
 }
});

test('ME-01-QA U-04d: reject non-action Carry before ranking a valid native shot',()=>{
 for(const team of ['home','away']){
  const dir=team==='home'?1:-1,actor=team+'-10',keeper=(team==='home'?'away':'home')+'-1';
  const playerFrame=mover({[actor]:{x:dir*29.7,y:0,vx:0,vy:0},[keeper]:{x:dir*50,y:4}});
  const source={tick:1,contactStarted:[actor],contactActive:[actor],playerFrame,
   ballPosition:{x:dir*30,y:0,z:.11},ballVelocity:{x:dir*4,y:0,z:0},ballRadiusM:.11,
   activePlayerIds:[actor,keeper],allowPhysicalCarry:true,pairedPhysicalSource:true};
  for(const context of [{smallSidedDecisionContext:{situationId:'keeper-1v1',variantIndex:2,attackingSide:team}},
   {nativeActionPolicy:true,collectiveControl:{tick:0,kind:'loose',playerId:null,officialPossession:false}}]){
   const input={...source,...context,allowedFundamentals:['carry','shot']};
   const shot=selectUniformAutonomousContactAction(input);
   assert.equal(shot?.action,'shot');
   assert.equal(shot.decisionContext.smallSidedChoice.context.canCarry,false);
   assert.equal(shot.decisionContext.smallSidedChoice.selected,'shot');
   assert.equal(selectUniformAutonomousContactAction({...input,allowedFundamentals:['carry']}),null);
   assert.equal(selectUniformAutonomousContactAction({...input,contactStarted:[],contactActive:[]}),null);
  }
 }
 for(const [p,expected] of [[null,false],[{magnitudeNs:0},false],[{magnitudeNs:.024},false],[{magnitudeNs:.025},true],[{magnitudeNs:.42},true],[{magnitudeNs:NaN},false]])
  assert.equal(nativeCarryImpulseAvailable(p),expected);
});
