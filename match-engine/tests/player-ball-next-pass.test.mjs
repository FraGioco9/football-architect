// ME-PB-32: a second autonomous defensive task is authorised only by
// a different real Rapier shoe START plus applied pass impulse in ONE world.
// DEV-only, no official match possession, interception, goal or control.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,
 PLAYER_MAX_SPEED_MPS,PLAYER_DT} from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION} from '../src/player-foot-contact.mjs';
import {acceptObservedPhysicalPass,chooseObservedLaneClosure,
 supersedeObservedLaneClosure,releaseObservedLaneClosure,
 LOCAL_LANE_RELEASE_VERSION,LOCAL_LANE_PASS_EPOCH_VERSION,
 LOCAL_LANE_PASS_CHAIN_VERSION,LOCAL_LANE_PASS_MAX_EVENTS,
 LOCAL_LANE_SUPERSEDE_VERSION}
 from '../src/player-ball-lane-closure.mjs';
import {decideLocalAiThirdPass,LOCAL_THIRD_PASS_VERSION}
 from '../src/player-ball-local-exchange.mjs';
import {readFileSync} from 'node:fs';
const Rapier=await initializeRapier(RapierModule);
const scenario={preset:'roll',seed:'local-ai-exchange',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0};
const coreFlags={diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiExchangeEnabled:true,
 diagnosticLocalAiAutonomousDefenseEnabled:true};
const movementFlags={experimentalAiExchangeApproach:true,
 experimentalAiAutonomousDefense:true,experimentalAiMultiPassDefense:true};

function playTwoRealPasses(maxTicks=300){
 const engine=createEngine(Rapier,scenario,coreFlags);
 const world=createPlayerMovement(movementFlags);
 const samples=[];
 try{
  assert.deepEqual(world.snapshot().players,INITIAL_PLAYERS);
  assert.equal(world.snapshot().observedPassEpochs.length,0);
  for(let n=0;n<maxTicks;n++){
   const prior=engine.snapshot();
   const latestExchange=engine.localAiExchangeSnapshot();
   const players=world.step(prior.ball.position,{
    velocity:prior.ball.velocity,
    footContact:engine.footContactSnapshot(),
    passEvent:latestExchange.returnPass??latestExchange.pass??null
   });
   const after=engine.step(players);
   const events=engine.localAiExchangeSnapshot();
   const contacts=engine.footContactSnapshot();
   const defender=players.players.find(p=>p.id==='away-10');
   samples.push(Object.freeze({
    tick:after.tick,ball:canonicalSnapshot(after),
    firstPass:events.pass?Object.freeze({
      tick:events.pass.tick,playerId:events.pass.playerId,
      appliedByRealRapier:events.pass.appliedByRealRapier
    }):null,
    returnPass:events.returnPass?Object.freeze({
      tick:events.returnPass.tick,playerId:events.returnPass.playerId,
      previousPassTick:events.returnPass.previousPassTick,
      appliedByRealRapier:events.returnPass.appliedByRealRapier
    }):null,
    contactStarted:Object.freeze([...contacts.started]),
    opponentContact:events.oppositionContact?.tick??null,
    oppositionFlightAudit:events.oppositionFlightAudit,
    passEpochs:players.observedPassEpochs,
    lane:players.observedLaneClosure,
    history:players.observedLaneHistory,
    defender:Object.freeze({x:defender.x,y:defender.y}),
    officialPossession:false
   }));
  }
  return Object.freeze(samples);
 }finally{engine.dispose();}
}
test('ME-PB-32 strict opt-in: ordinary movements and LAB-10 never expose multi-pass epochs',()=>{
 assert.equal(createPlayerMovement().snapshot().observedPassEpochs,undefined);
 assert.equal(createPlayerMovement({
  experimentalAiExchangeApproach:true,experimentalAiAutonomousDefense:true
 }).snapshot().observedPassEpochs,undefined);
 assert.throws(()=>createPlayerMovement({
  experimentalAiMultiPassDefense:true
 }),/Exclusive boolean/);
 assert.throws(()=>createPlayerMovement({
  experimentalAiExchangeApproach:true,
  experimentalAiAutonomousDefense:true,
  experimentalAiMultiPassDefense:'true'
 }),/Exclusive boolean/);
 const zero=createPlayerMovement(movementFlags).snapshot();
 assert.deepEqual(zero.players,INITIAL_PLAYERS);
 assert.equal(zero.observedLaneClosure,null);
 assert.deepEqual(zero.observedPassEpochs,[]);
 assert.deepEqual(zero.observedLaneHistory,[]);
});
test('ME-PB-32 real physical pass identity rejects forged/stale/same-tick/replayed actions',()=>{
 const contact=(tick,id)=>({version:FOOT_CONTACT_VERSION,tick,started:[id]});
 const first={stage:'pass',version:'me-pb-25-dynamic-recipient-v1',
  tick:13,playerId:'home-7',targetPlayerId:'home-10',
  physicalTrigger:'real-rapier-foot-contact-start',
  appliedByRealRapier:true,officialMatchAction:false,
  impulseNs:{x:2.7,y:0,z:0}};
 const firstEpoch=acceptObservedPhysicalPass({
  event:first,contactFrame:contact(13,'home-7'),previousTick:13
 });
 assert.equal(firstEpoch.version,LOCAL_LANE_PASS_EPOCH_VERSION);
 assert.equal(firstEpoch.chainVersion,LOCAL_LANE_PASS_CHAIN_VERSION);
 assert.equal(firstEpoch.sequence,1);
 assert.equal(firstEpoch.previousPassTick,null);
 assert.equal(firstEpoch.tick,13);
 assert.equal(firstEpoch.observedShoeStartTick,13);
 assert.ok(Object.isFrozen(firstEpoch));
 assert.equal(firstEpoch.officialPossession,false);
 assert.equal(acceptObservedPhysicalPass({
  event:first,contactFrame:contact(14,'away-9'),
  previousTick:14,lastAcceptedPassTick:13
 }),null,'old completed kick may not be reused even when the ball is still moving');
 const returnEvent={stage:'return-pass',version:'me-pb-24-local-exchange-v1',
  tick:153,previousPassTick:13,playerId:'home-10',targetPlayerId:'home-7',
  physicalTrigger:'real-rapier-foot-contact-start',
  appliedByRealRapier:true,officialMatchAction:false,
  impulseNs:{x:-3,y:0,z:0}};
 const second=acceptObservedPhysicalPass({
  event:returnEvent,contactFrame:contact(153,'home-10'),
  previousTick:153,previousEpoch:firstEpoch
 });
 assert.equal(second.stage,'return-pass');
 assert.equal(second.sequence,2);
 assert.equal(second.previousPassTick,firstEpoch.tick);
 assert.equal(second.tick,153);
 assert.notEqual(firstEpoch.playerId,second.playerId);
 assert.equal(second.appliedByRealRapier,true);
 const invalid=[
  [{...returnEvent,appliedByRealRapier:false},contact(153,'home-10'),153],
  [returnEvent,contact(153,'home-7'),153],
  [returnEvent,contact(152,'home-10'),153],
  [{...returnEvent,previousPassTick:12},contact(153,'home-10'),153],
  [{...returnEvent,impulseNs:{x:0,y:0,z:0}},contact(153,'home-10'),153],
  [{...returnEvent,stage:'return-control'},contact(153,'home-10'),153],
  [{...returnEvent,officialMatchAction:true},contact(153,'home-10'),153],
  [{...returnEvent,tick:14},contact(14,'home-10'),14],
  [{...returnEvent,playerId:'away-10'},contact(153,'away-10'),153]
 ];
 for(const [event,frame,tick]of invalid)assert.throws(()=>
  acceptObservedPhysicalPass({event,contactFrame:frame,
   previousTick:tick,lastAcceptedPassTick:13}),
  /Verified new same-world Rapier pass/);
 assert.equal(acceptObservedPhysicalPass({
  event:returnEvent,contactFrame:contact(154,'away-10'),
  previousTick:154,previousEpoch:second
 }),null,'already accepted return never starts a third epoch');
});
test('ME-PB-32 measured reverse flight selects a real bounded new waypoint',()=>{
 const plan=chooseObservedLaneClosure({
  players:INITIAL_PLAYERS,ballPosition:{x:-5,y:0},
  ballVelocity:{x:-6.5,y:0},passStage:'return-pass'
 });
 assert.ok(plan);
 assert.equal(plan.passStage,'return-pass');
 assert.equal(plan.directionX,-1);
 assert.ok(plan.waypoint.x<-5);
 assert.ok(Object.isFrozen(plan));
 const forward=chooseObservedLaneClosure({
  players:INITIAL_PLAYERS,ballPosition:{x:-5,y:0},
  ballVelocity:{x:6.5,y:0},passStage:'return-pass'
 });
 assert.ok(forward,'the return direction must come from true measured velocity');
 assert.equal(forward.directionX,1);
 assert.ok(forward.waypoint.x>-5);
 assert.equal(chooseObservedLaneClosure({
  players:INITIAL_PLAYERS,ballPosition:{x:-5,y:0},
  ballVelocity:{x:1,y:0},passStage:'return-pass'
 }),null,'subthreshold Rapier flight cannot start a defensive lane');
});
test('ME-PB-32 two real Rapier pass impulses trigger two separate defense tasks and deterministic replay',()=>{
 const samples=playTwoRealPasses(300);
 const last=samples.at(-1);
 const firstPhysical=samples.find(s=>s.firstPass&&
   s.contactStarted.includes(s.firstPass.playerId));
 const returnPhysical=samples.find(s=>s.returnPass&&
   s.contactStarted.includes(s.returnPass.playerId));
 assert.ok(firstPhysical,'first pass needs true Rapier START');
 assert.ok(returnPhysical,
  'a second independent later real Home #10 shoe START and impulse are needed: '+
   JSON.stringify({first:last.firstPass,return:last.returnPass,
    events:last.passEpochs,history:last.history,
    excerpt:samples.filter(s=>s.tick%20===0).map(s=>({
     tick:s.tick,stages:s.passEpochs.map(e=>e.stage),
     defender:s.defender,lane:s.lane?.phase??null
    }))}));
 assert.ok(returnPhysical.returnPass.tick>firstPhysical.firstPass.tick+2);
 assert.equal(firstPhysical.firstPass.appliedByRealRapier,true);
 assert.equal(returnPhysical.returnPass.appliedByRealRapier,true);
 assert.equal(last.passEpochs.length,2,'one immutable event per distinct kick');
 assert.deepEqual(last.passEpochs.map(e=>e.sequence),[1,2]);
 assert.equal(last.passEpochs[1].previousPassTick,last.passEpochs[0].tick);
 assert.ok(last.passEpochs.every(e=>Object.isFrozen(e)&&
  e.chainVersion===LOCAL_LANE_PASS_CHAIN_VERSION));
 assert.deepEqual(last.passEpochs.map(e=>e.stage),['pass','return-pass']);
 assert.equal(last.passEpochs[0].tick,firstPhysical.firstPass.tick);
 assert.equal(last.passEpochs[1].tick,returnPhysical.returnPass.tick);
 assert.equal(last.history.length,1,'first assignment archived after next real pass');
 assert.equal(last.history[0].passSequence,1);
 assert.ok(['released-after-new-physical-pass',
  'released-after-physical-contact','released-after-observed-flight']
  .includes(last.history[0].phase));
 if(last.history[0].phase==='released-after-new-physical-pass')
  assert.equal(last.history[0].releaseVersion,LOCAL_LANE_SUPERSEDE_VERSION);
 assert.equal(last.lane?.passSequence,2);
 assert.equal(last.lane?.directionX,-1);
 assert.equal(last.officialPossession,false);
 for(let i=1;i<samples.length;i++)
  assert.ok(Math.hypot(
   samples[i].defender.x-samples[i-1].defender.x,
   samples[i].defender.y-samples[i-1].defender.y
  )<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6);
 assert.deepEqual(playTwoRealPasses(300),samples,
  'same physical ball and completed 22-player movement replay deterministically');
 process.stdout.write('ME_PB_32_REAL_SECOND_PASS '+JSON.stringify({
  firstPassTick:last.passEpochs[0].tick,
  secondPassTick:last.passEpochs[1].tick,
  firstRelease:last.history[0].phase,
  secondDefender:last.lane.defenderId,
  secondPhase:last.lane.phase,
  boundedMovement:true,replay:true,officialPossession:false
 })+'\\n');
});
test('ME-PB-32 LAB-11 is only a dropdown choice with normal replay/reset',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-defend-multi" data-value="ai-defend-multi"/);
 assert.doesNotMatch(html,/id="ai-multi-pass-demo"/);
 assert.match(lab,/experimentalAiMultiPassDefense:multiPassDefenseActive/);
 assert.match(lab,/exchange\?\.events\?\.filter/);
});

// ME-PB-33: these are PURE CONTRACT FIXTURES, not fabricated gameplay.
// The production LAB-11 engine currently generates only TWO real passes.
// More events will be accepted at runtime ONLY after the same Rapier world
// actually exposes another applied impulse and synchronized foot START.
test('ME-PB-33 pass ledger supports linked third/fourth contract records, not inferred physics',()=>{
 const samples=playTwoRealPasses(240);
 const previous=samples.at(-1).passEpochs;
 assert.equal(previous.length,2,'only two real impulse+shoe START actions exist');
 const [first,second]=previous;
 assert.equal(first.sequence,1);
 assert.equal(second.sequence,2);
 const contact=(tick,id)=>({version:FOOT_CONTACT_VERSION,tick,started:[id]});
 const event=(stage,tick,previousPassTick,overrides={})=>({
  stage,version:stage==='pass'?'me-pb-25-dynamic-recipient-v1':
   'me-pb-24-local-exchange-v1',tick,previousPassTick,
  playerId:stage==='pass'?'home-7':'home-10',
  targetPlayerId:stage==='pass'?'home-10':'home-7',
  physicalTrigger:'real-rapier-foot-contact-start',
  appliedByRealRapier:true,officialMatchAction:false,
  impulseNs:{x:stage==='pass'?2.7:-2.2,y:0,z:0},...overrides
 });
 const thirdEvent=event('pass',230,second.tick);
 const third=acceptObservedPhysicalPass({
  event:thirdEvent,contactFrame:contact(230,'home-7'),
  previousTick:230,previousEpoch:second
 });
 assert.equal(third.sequence,3);
 assert.equal(third.previousPassTick,second.tick);
 assert.equal(third.stage,'pass');
 assert.equal(third.chainVersion,LOCAL_LANE_PASS_CHAIN_VERSION);
 assert.equal(third.officialPossession,false);
 assert.ok(Object.isFrozen(third));
 const fourthEvent=event('return-pass',250,third.tick);
 const fourth=acceptObservedPhysicalPass({
  event:fourthEvent,contactFrame:contact(250,'home-10'),
  previousTick:250,previousEpoch:third
 });
 assert.equal(fourth.sequence,4);
 assert.equal(fourth.previousPassTick,third.tick);
 assert.equal(fourth.playerId,third.targetPlayerId);
 assert.equal(acceptObservedPhysicalPass({
  event:thirdEvent,contactFrame:contact(251,'away-10'),
  previousTick:251,previousEpoch:fourth
 }),null,'a stale action never starts a fifth epoch');
 for(const bad of [
  event('return-pass',230,second.tick),
  event('pass',230,first.tick),
  event('pass',230,second.tick,{playerId:'home-10'}),
  event('pass',230,second.tick,{appliedByRealRapier:false}),
  event('pass',230,second.tick,{officialMatchAction:true}),
  event('pass',230,second.tick,{impulseNs:{x:0,y:0,z:0}}),
  event('pass',230,second.tick,{tick:231}),
  event('pass',second.tick+2,second.tick)
 ])assert.throws(()=>acceptObservedPhysicalPass({
  event:bad,contactFrame:contact(230,'home-7'),
  previousTick:230,previousEpoch:second
 }),/Verified new same-world Rapier pass/);
 assert.throws(()=>acceptObservedPhysicalPass({
  event:thirdEvent,contactFrame:contact(230,'away-9'),
  previousTick:230,previousEpoch:second
 }),/Verified new same-world Rapier pass/);
 assert.throws(()=>acceptObservedPhysicalPass({
  event:thirdEvent,contactFrame:contact(230,'home-7'),
  previousTick:230,previousEpoch:{...second,sequence:3}
 }),/Verified previous physical pass epoch/);
 // If a future genuine third Rapier pass becomes available, superseding
 // a SECOND plan is allowed ONLY with the linked, consecutive epoch.
 const secondPlan=Object.freeze({
  ...chooseObservedLaneClosure({
   players:INITIAL_PLAYERS,ballPosition:{x:-5,y:0},
   ballVelocity:{x:6.2,y:0},passStage:'return-pass'
  }),passEventTick:second.tick,passSequence:2,
  activatedAtTick:second.tick+1,phase:'closing'
 });
 const released=supersedeObservedLaneClosure({
  plan:secondPlan,observedPass:third,movementTick:third.tick+1
 });
 assert.equal(released.phase,'released-after-new-physical-pass');
 assert.equal(released.newPhysicalPassTick,third.tick);
 assert.equal(released.interceptionProven,false);
 assert.ok(Object.isFrozen(released));
 const alreadyClosed=Object.freeze({...secondPlan,
  phase:'released-after-physical-contact',releasedAtMovementTick:200});
 assert.strictEqual(supersedeObservedLaneClosure({
  plan:alreadyClosed,observedPass:third,movementTick:third.tick+1
 }),alreadyClosed,'old physical release cannot be overwritten');
 assert.throws(()=>supersedeObservedLaneClosure({
  plan:secondPlan,observedPass:fourth,movementTick:fourth.tick+1
 }),/Distinct verified later Rapier pass/);
 // Contract-level same-tick arbitration: the real player START would be
 // processed before archiving an old closing task, never overwritten.
 const physical=releaseObservedLaneClosure({
  plan:secondPlan,contactFrame:contact(230,secondPlan.defenderId),
  previousTick:230
 });
 assert.equal(physical.phase,'released-after-physical-contact');
 assert.equal(physical.releaseVersion,LOCAL_LANE_RELEASE_VERSION);
 assert.strictEqual(supersedeObservedLaneClosure({
  plan:physical,observedPass:third,movementTick:231
 }),physical,'physical defender contact retains priority over a new pass');
 assert.throws(()=>acceptObservedPhysicalPass({
  event:thirdEvent,
  contactFrame:{version:FOOT_CONTACT_VERSION,tick:230,
   started:['home-7','not-a-player']},
  previousTick:230,previousEpoch:second
 }),/Verified new same-world Rapier pass/);
 assert.throws(()=>acceptObservedPhysicalPass({
  event:thirdEvent,
  contactFrame:{version:FOOT_CONTACT_VERSION,tick:230,
   started:['home-7','home-7']},
  previousTick:230,previousEpoch:second
 }),/Verified new same-world Rapier pass/);
});
test('ME-PB-33 finite eight-action cap, strict order and bounded immutable history',()=>{
 const contact=(tick,id)=>({version:FOOT_CONTACT_VERSION,tick,started:[id]});
 let epoch=null;const ledger=[];
 for(let sequence=1;sequence<=LOCAL_LANE_PASS_MAX_EVENTS;sequence++){
  const first=sequence%2===1;
  const tick=10+sequence*10;
  const event={
   stage:first?'pass':'return-pass',
   version:first?'me-pb-25-dynamic-recipient-v1':
     'me-pb-24-local-exchange-v1',
   tick,...(epoch?{previousPassTick:epoch.tick}:{}),
   playerId:first?'home-7':'home-10',
   targetPlayerId:first?'home-10':'home-7',
   physicalTrigger:'real-rapier-foot-contact-start',
   appliedByRealRapier:true,officialMatchAction:false,
   impulseNs:{x:first?2:-2,y:0,z:0}
  };
  const next=acceptObservedPhysicalPass({
   event,contactFrame:contact(tick,event.playerId),
   previousTick:tick,previousEpoch:epoch
  });
  assert.equal(next.sequence,sequence);
  assert.equal(next.previousPassTick,epoch?.tick??null);
  assert.ok(Object.isFrozen(next));
  ledger.push(next);epoch=next;
 }
 assert.equal(ledger.length,8);
 assert.deepEqual(ledger.map(e=>e.sequence),[1,2,3,4,5,6,7,8]);
 assert.equal(acceptObservedPhysicalPass({
  event:{stage:'pass',tick:100},contactFrame:contact(100,'home-7'),
  previousTick:100,previousEpoch:epoch
 }),null,'a ninth synthetic contract record is never accepted');
 const actual=playTwoRealPasses(300).at(-1);
 assert.equal(actual.passEpochs.length,2,
  'real LAB-11 does not fabricate a third physical pass');
 assert.equal(actual.history.length,1,
  'the first physical defensive assignment is archived once');
 assert.equal(actual.lane.passSequence,2);
 assert.deepEqual(playTwoRealPasses(300).at(-1),actual,
  'exact same physics and defense replay after ledger generalization');
});

// ME-PB-34: unlike the ME-PB-33 ledger-only fixtures this starts a
// standalone REAL Rapier world and waits for the third independent
// Home #7 collision, not for a scripted time or fabricated foot event.
const threeCoreFlags={...coreFlags,diagnosticLocalAiThirdPassEnabled:true};
const threeMovementFlags={...movementFlags,experimentalAiThreePassDefense:true};
function playThreeRealPasses(limit=450,{fourth=false}={}){
 const engine=createEngine(Rapier,scenario,{
  ...threeCoreFlags,...(fourth?{diagnosticLocalAiFourthPassEnabled:true}:{})
 });
 const movement=createPlayerMovement({
  ...threeMovementFlags,...(fourth?{experimentalAiFourPassDefense:true}:{})
 });
 const observations=[];
 try{
  assert.deepEqual(movement.snapshot().players,INITIAL_PLAYERS);
  for(let t=0;t<limit;t++){
   const before=engine.snapshot();
   const exchange=engine.localAiExchangeSnapshot();
   const events=exchange.events.filter(e=>
    e.stage==='pass'||e.stage==='return-pass');
   const frame=movement.step(before.ball.position,{
    velocity:before.ball.velocity,footContact:engine.footContactSnapshot(),
    passEvent:events.at(-1)??null
   });
   const after=engine.step(frame),newExchange=engine.localAiExchangeSnapshot();
   const contact=engine.footContactSnapshot();
   const a=frame.players.find(p=>p.id==='away-10');
   const h=frame.players.find(p=>p.id==='home-7');
   const h10=frame.players.find(p=>p.id==='home-10');
   observations.push(Object.freeze({
    tick:after.tick,ball:canonicalSnapshot(after),
    contacts:Object.freeze([...contact.started]),
    passEvents:Object.freeze(newExchange.events.filter(e=>
     e.stage==='pass'||e.stage==='return-pass').map(e=>Object.freeze({
      version:e.version,stage:e.stage,tick:e.tick,playerId:e.playerId,
      previousPassTick:e.previousPassTick??null,
      appliedByRealRapier:e.appliedByRealRapier,officialMatchAction:e.officialMatchAction
     }))),
    opponentContact:newExchange.oppositionContact?.tick??null,
    oppositionFlightAudit:newExchange.oppositionFlightAudit,
    fourthPass:newExchange.fourthPass?Object.freeze({
      tick:newExchange.fourthPass.tick,
      playerId:newExchange.fourthPass.playerId,
      previousPassTick:newExchange.fourthPass.previousPassTick,
      appliedByRealRapier:newExchange.fourthPass.appliedByRealRapier
    }):null,
    postThirdFootStarts:newExchange.postThirdFootStarts,
    lane:frame.observedLaneClosure,history:frame.observedLaneHistory,
    epochs:frame.observedPassEpochs,
    away10:Object.freeze({x:a.x,y:a.y}),
    home7:Object.freeze({x:h.x,y:h.y}),
    home10:Object.freeze({x:h10.x,y:h10.y}),
    ballX:after.ball.position.x,ballY:after.ball.position.y
   }));
  }
  return Object.freeze(observations);
 }finally{engine.dispose();}
}
test('ME-PB-34 third action proposal only follows a new physical Home #7 START',()=>{
 const player={id:'home-7',team:'home',x:0,y:0};
 const teammate={id:'home-10',team:'home',x:10,y:2};
 const context={tick:231,contactStarted:['home-7'],
  firstPass:{stage:'pass',playerId:'home-7',tick:13},
  returnPass:{stage:'return-pass',playerId:'home-10',
   targetPlayerId:'home-7',previousPassTick:13,tick:153},
  player,teammate,ballPosition:{x:0.2,y:0,z:0.11},
  ballVelocity:{x:-3,y:0,z:0},
  ballRadiusM:0.11,ballMassKg:0.43};
 const proposed=decideLocalAiThirdPass(context);
 assert.ok(proposed);
 assert.equal(proposed.version,LOCAL_THIRD_PASS_VERSION);
 assert.equal(proposed.stage,'pass');
 assert.equal(proposed.previousPassTick,153);
 assert.equal(proposed.playerId,'home-7');
 assert.equal(proposed.targetPlayerId,'home-10');
 assert.equal(proposed.physicalTrigger,'real-rapier-foot-contact-start');
 assert.equal(proposed.officialMatchAction,false);
 assert.ok(Math.hypot(proposed.impulseNs.x,proposed.impulseNs.y)>0);
 assert.ok(Object.isFrozen(proposed.impulseNs));
 for(const change of [
  {contactStarted:[]},{contactStarted:['home-10']},
  {tick:155},{player:{...player,id:'home-8'}},
  {teammate:{...teammate,x:0.3,y:0}},
  {ballPosition:{x:4,y:0,z:0.11}},
  {ballPosition:{x:0.2,y:0,z:2}},
  {returnPass:{...context.returnPass,previousPassTick:12}},
  {ballVelocity:{x:NaN,y:0,z:0}}
 ])assert.equal(decideLocalAiThirdPass({...context,...change}),null,
  'third pass cannot be inferred from missing/forged contact and position');
 assert.throws(()=>createEngine(Rapier,scenario,{
  ...coreFlags,diagnosticLocalAiThirdPassEnabled:'true'
 }),/Explicit boolean/);
 assert.throws(()=>createEngine(Rapier,scenario,{
  diagnosticLocalAiThirdPassEnabled:true
 }),/Third pass requires autonomous/);
 assert.throws(()=>createPlayerMovement({
  ...movementFlags,experimentalAiThreePassDefense:'true'
 }),/Exclusive boolean/);
 assert.throws(()=>createPlayerMovement({
  experimentalAiThreePassDefense:true
 }),/Exclusive boolean/);
});
test('ME-PB-34 real third Rapier contact, applied impulse and third defensive response',()=>{
 const samples=playThreeRealPasses(450);
 const last=samples.at(-1),passEvents=last.passEvents;
 const physical=passEvents.map(e=>samples.find(s=>s.tick===e.tick));
 assert.equal(passEvents.length,3,
  'independent real third Home #7 foot contact did not occur: '+
  JSON.stringify({
   passEvents,opponentContact:last.opponentContact,
   recent:samples.filter(s=>s.tick%30===0).map(s=>({
    tick:s.tick,stages:s.passEvents.map(e=>e.stage),lane:s.lane?.phase??null,
    home7:s.home7,away10:s.away10,ballX:s.ballX,ballY:s.ballY,
    opponent:s.opponentContact
   }))
  }));
 assert.deepEqual(passEvents.map(e=>e.stage),['pass','return-pass','pass']);
 assert.deepEqual(passEvents.map(e=>e.playerId),['home-7','home-10','home-7']);
 assert.ok(passEvents.every((e,i)=>e.appliedByRealRapier&&
  e.officialMatchAction===false&&physical[i].contacts.includes(e.playerId)));
 assert.ok(passEvents[0].tick+2<passEvents[1].tick&&
  passEvents[1].tick+2<passEvents[2].tick);
 assert.equal(passEvents[2].previousPassTick,passEvents[1].tick);
 assert.equal(last.epochs.length,3);
 assert.deepEqual(last.epochs.map(e=>e.sequence),[1,2,3]);
 assert.equal(last.epochs[2].tick,passEvents[2].tick);
 assert.equal(last.epochs[2].previousPassTick,passEvents[1].tick);
 assert.equal(last.lane?.passSequence,3);
 assert.ok(last.history.length>=1);
 assert.ok(last.history.every(p=>p.phase!=='closing'));
 assert.equal(last.epochs[2].officialPossession,false);
 for(let i=1;i<samples.length;i++)
  assert.ok(Math.hypot(
   samples[i].away10.x-samples[i-1].away10.x,
   samples[i].away10.y-samples[i-1].away10.y
  )<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6);
 assert.deepEqual(playThreeRealPasses(450),samples,
  'third same-world physical impulse and next defender must replay');
 process.stdout.write('ME_PB_34_REAL_THIRD_PASS '+JSON.stringify({
  firstTick:passEvents[0].tick,secondTick:passEvents[1].tick,
  thirdTick:passEvents[2].tick,thirdDefense:last.lane.phase,
  defender:last.lane.defenderId,replay:true,officialPossession:false
 })+'\\n');
});
test('ME-PB-34 third physical pass follows measured signed Rapier velocity',()=>{
 const initial=INITIAL_PLAYERS,position={x:-8,y:0};
 const backward=chooseObservedLaneClosure({
  players:initial,ballPosition:position,
  ballVelocity:{x:-6.5,y:0},passStage:'pass',passSequence:3
 });
 assert.ok(backward);
 assert.equal(backward.passSequence,3);
 assert.equal(backward.directionX,-1);
 assert.equal(backward.passStage,'pass');
 assert.ok(backward.waypoint.x<position.x);
 const forward=chooseObservedLaneClosure({
  players:initial,ballPosition:position,
  ballVelocity:{x:6.5,y:0},passStage:'pass',passSequence:3
 });
 assert.ok(forward);
 assert.equal(forward.directionX,1);
 assert.ok(forward.waypoint.x>position.x);
 assert.throws(()=>chooseObservedLaneClosure({
  players:initial,ballPosition:position,
  ballVelocity:{x:6.5,y:0},passStage:'return-pass',passSequence:3
 }),/Canonical alternating/);
 assert.ok(Object.isFrozen(backward));
});

test('ME-PB-34 LAB-12 uses Scenario dropdown, not separate controls',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-defend-three" data-value="ai-defend-three"/);
 assert.doesNotMatch(html,/id="ai-third-pass-demo"/);
 assert.match(lab,/diagnosticLocalAiThirdPassEnabled:threePassDefenseActive/);
 assert.match(lab,/experimentalAiThreePassDefense:threePassDefenseActive/);
});

test('ME-PB-35 fourth action is physically gated and never accepted in earlier LAB worlds',()=>{
 assert.equal(playThreeRealPasses(450).at(-1).fourthPass,null,
  'LAB-12 remains exactly three real passes');
 assert.equal(playThreeRealPasses(450).at(-1).postThirdFootStarts.length,0,
  'LAB-12 does not expose the new opt-in observer');
 assert.throws(()=>createEngine(Rapier,scenario,{
  ...threeCoreFlags,diagnosticLocalAiFourthPassEnabled:'true'
 }),/Explicit boolean fourth/);
 assert.throws(()=>createEngine(Rapier,scenario,{
  ...coreFlags,diagnosticLocalAiFourthPassEnabled:true
 }),/Fourth pass requires existing third-pass/);
 assert.throws(()=>createPlayerMovement({
  ...threeMovementFlags,experimentalAiFourPassDefense:'true'
 }),/Exclusive boolean/);
 assert.throws(()=>createPlayerMovement({
  ...movementFlags,experimentalAiFourPassDefense:true
 }),/Exclusive boolean/);
});
test('ME-PB-35 four separate Rapier kicks and read-only non-kick contact classification',()=>{
 const samples=playThreeRealPasses(720,{fourth:true});
 const last=samples.at(-1),events=last.passEvents;
 const physical=events.map(e=>samples.find(s=>s.tick===e.tick));
 assert.equal(events.length,4,
  'a fourth event must have its own real Home #10 START and impulse: '+
  JSON.stringify({
   events,lastOpponentContact:last.opponentContact,
   postThird:last.postThirdFootStarts,
   timeline:samples.filter(s=>s.tick%30===0).map(s=>({
    tick:s.tick,stages:s.passEvents.map(e=>e.stage),
    home10:s.home10,ballX:s.ballX,ballY:s.ballY,
    contacts:s.contacts,opposition:s.opponentContact
   }))
  }));
 assert.deepEqual(events.map(e=>e.stage),
  ['pass','return-pass','pass','return-pass']);
 assert.deepEqual(events.map(e=>e.playerId),
  ['home-7','home-10','home-7','home-10']);
 assert.ok(events.every((e,i)=>e.appliedByRealRapier===true&&
  e.officialMatchAction===false&&physical[i].contacts.includes(e.playerId)));
 for(let i=1;i<4;i++){
  assert.ok(events[i].tick>events[i-1].tick+2);
  assert.equal(events[i].previousPassTick,events[i-1].tick);
 }
 assert.equal(last.fourthPass?.tick,events[3].tick);
 assert.equal(last.fourthPass?.appliedByRealRapier,true);
 assert.deepEqual(last.epochs.map(e=>e.sequence),[1,2,3,4]);
 assert.equal(last.lane?.passSequence,4);
 const post=last.postThirdFootStarts;
 assert.ok(Object.isFrozen(post));
 assert.ok(post.length>=1);
 assert.ok(post.every(e=>e.realRapierStart===true&&
  e.inferredPossession===false&&Object.isFrozen(e)));
 const actions=post.filter(e=>e.fourthPassApplied);
 assert.equal(actions.length,1);
 assert.equal(actions[0].tick,events[3].tick);
 assert.equal(actions[0].playerId,'home-10');
 assert.ok(post.every(e=>e.countedAsPass===e.fourthPassApplied));
 assert.ok(post.every(e=>e.tick>events[2].tick));
 assert.equal(last.epochs[3].officialPossession,false);
 for(let i=1;i<samples.length;i++){
  for(const k of ['away10','home7','home10'])
   assert.ok(Math.hypot(samples[i][k].x-samples[i-1][k].x,
    samples[i][k].y-samples[i-1][k].y)<=
    PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-6);
 }
 assert.deepEqual(playThreeRealPasses(720,{fourth:true}),samples,
  'four physical passes and next defender must replay exactly');
 process.stdout.write('ME_PB_35_REAL_FOURTH_PASS '+JSON.stringify({
  ticks:events.map(e=>e.tick),postThirdContacts:post.length,
  nonPassContacts:post.filter(e=>!e.countedAsPass).length,
  fourthDefender:last.lane?.defenderId,
  phase:last.lane?.phase,replay:true,officialPossession:false
 })+'\\n');
});
test('ME-PB-35 LAB-13 is a dropdown scenario, never an action button',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-defend-four" data-value="ai-defend-four"/);
 assert.doesNotMatch(html,/id="ai-fourth-pass-demo"/);
 assert.match(lab,/diagnosticLocalAiFourthPassEnabled:fourPassDefenseActive/);
 assert.match(lab,/experimentalAiFourPassDefense:fourPassDefenseActive/);
});

// ME-PB-36: a genuine Away shoe START is not, on its own, proof of
// interception, possession or even changed flight. Subsequent *completed*
// Rapier velocity observations establish only a qualified flight outcome.
test('ME-PB-36 real opponent contact is distinct from measured later flight outcome',()=>{
 const samples=playTwoRealPasses(300);
 const contact=samples.find(s=>s.opponentContact!==null);
 assert.ok(contact,'LAB-11 requires a true opponent Rapier shoe START');
 assert.equal(contact.opponentContact,196);
 const initial=contact.oppositionFlightAudit;
 assert.ok(initial);
 assert.equal(initial.contactTick,196);
 assert.equal(initial.contactShoeStartProven,true);
 assert.equal(initial.precedingPassTick,153);
 assert.equal(initial.status,'observing');
 assert.equal(initial.classification,'contact-only-not-interception');
 assert.equal(initial.solverAttribution,'aggregate-not-individual-foot');
 assert.ok(initial.solverPlanarDeltaMps>=0);
 assert.equal(initial.officialPossession,false);
 assert.equal(initial.interceptionProven,false);
 assert.equal(initial.passCreated,false);
 const complete=samples.at(-1).oppositionFlightAudit;
 assert.ok(['confirmed-changed-flight','contact-only-no-confirmed-change']
  .includes(complete.status));
 assert.ok(complete.followupTicks>=3&&complete.followupTicks<=6);
 assert.equal(complete.tick,196+complete.followupTicks);
 assert.equal(complete.physicalCauseExclusivelyProven,false);
 assert.equal(complete.officialPossession,false);
 assert.equal(complete.interceptionProven,false);
 assert.equal(complete.passCreated,false);
 assert.deepEqual(samples.at(-1).passEpochs.map(e=>e.tick),[13,153],
  'no extra pass inferred from defender contact or ball rebound');
 assert.deepEqual(playTwoRealPasses(300),samples,
  'real post-contact flight remains deterministic in one Rapier world');
 process.stdout.write('ME_PB_36_RAPIER_OPPOSITION_FLIGHT '+JSON.stringify({
  contactTick:initial.contactTick,
  passTick:initial.precedingPassTick,
  solverDelta:initial.solverPlanarDeltaMps,
  flightOutcome:complete.status,classification:complete.classification,
  followup:complete.followupTicks,
  officialPossession:false,interceptionProven:false,replay:true
 })+'\\n');
});
test('ME-PB-36 regular and LAB-12/13 histories have no invented opponent outcome',()=>{
 const third=playThreeRealPasses(450).at(-1);
 const fourth=playThreeRealPasses(720,{fourth:true}).at(-1);
 for(const scene of [third,fourth]){
  assert.equal(scene.opponentContact,null);
  assert.equal(scene.oppositionFlightAudit,null);
 }
});
