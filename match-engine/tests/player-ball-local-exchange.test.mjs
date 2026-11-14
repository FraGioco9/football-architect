// ME-PB-24 — genuine first/return 60Hz Rapier exchange and adversarial
// opposition-contact evidence. Never synthetic pass completion/possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT,
 BALL_MASS_KG} from '../src/core.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';
import {decideLocalAiReturnPass,decideLocalAiReturnControl,
 observeLocalOppositionContact,LOCAL_RETURN_MAX_IMPULSE_NS,
 LOCAL_EXCHANGE_VERSION} from '../src/player-ball-local-exchange.mjs';
import {readFileSync} from 'node:fs';
const RAPIER=await initializeRapier(RapierModule);
const demo=Object.freeze({preset:'roll',seed:'local-ai-exchange',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0});
const opts={diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiExchangeEnabled:true};
function replay(limit=540){
 const engine=createEngine(RAPIER,demo,opts);
 const players=createPlayerMovement({experimentalAiExchangeApproach:true});
 const baseline=createEngine(RAPIER,demo,{
  diagnosticPlayerFootContactsEnabled:true});
 const rows=[];
 try{
  for(let i=1;i<=limit;i++){
   const f=players.step(engine.snapshot().ball.position);
   const actual=engine.step(f),plain=baseline.step(f);
   const state=engine.localAiExchangeSnapshot();
   const starts=engine.footContactSnapshot().started;
   if(!state.pass)assert.equal(canonicalSnapshot(actual),canonicalSnapshot(plain));
   if(state.returnPass?.tick===i){
    assert.ok(starts.includes('home-10'),
     'return pass needs independent real Home #10 Rapier START');
    assert.ok(state.pass.tick<i-2);
   }
   if(state.finalControl?.tick===i){
    assert.ok(starts.includes('home-7'),
     'final control needs later real Home #7 Rapier START');
    assert.ok(state.returnPass.tick<i-2);
   }
   if(state.oppositionContact?.tick===i){
    assert.ok(starts.includes(state.oppositionContact.playerId));
   }
   assert.ok(state.events.length<=4);
   assert.ok(Object.isFrozen(state.events));
   assert.equal(state.inferredPossession,false);
   assert.equal(state.officialMatchAction,false);
   rows.push(Object.freeze({
     tick:i,ball:canonicalSnapshot(actual),
     starts:Object.freeze([...starts]),
     stages:Object.freeze(state.events.map(e=>e.stage)),
     opposition:state.oppositionContact?.playerId??null,
     participants:starts.includes('home-10')?Object.freeze(
       f.players.filter(p=>p.id==='home-7'||p.id==='home-10')
         .map(p=>Object.freeze({id:p.id,x:p.x,y:p.y})))
       :null
   }));
  }
  return Object.freeze({events:engine.localAiExchangeSnapshot(),rows});
 }finally{engine.dispose();baseline.dispose();}
}
const baseEvent={stage:'pass',playerId:'home-7',targetPlayerId:'home-10',tick:13};
const passInput={
 tick:153,contactStarted:['home-10'],firstPass:baseEvent,
 player:{id:'home-10',team:'home',x:-5,y:0},
 teammate:{id:'home-7',team:'home',x:-20,y:0},
 ballPosition:{x:-5.3,y:0,z:0.11},
 ballVelocity:{x:2,y:0,z:0},
 ballRadiusM:0.11,ballMassKg:BALL_MASS_KG
};
test('ME-PB-24 strictly opt-in and mutually exclusive, no change in default physics',()=>{
 const defaultWorld=createEngine(RAPIER,demo);
 const firstPassOnly=createEngine(RAPIER,demo,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticLocalAiPassReceiveEnabled:true});
 try{
  assert.equal(defaultWorld.localAiExchangeSnapshot,undefined);
  assert.equal(firstPassOnly.localAiExchangeSnapshot,undefined);
 }finally{defaultWorld.dispose();firstPassOnly.dispose();}
 for(const extra of [
   {diagnosticLocalAiExchangeEnabled:true},
   {diagnosticPlayerFootContactsEnabled:true,diagnosticLocalAiExchangeEnabled:'yes'},
   {...opts,diagnosticLocalAiKickEnabled:true},
   {...opts,diagnosticLocalAiPassReceiveEnabled:true},
   {...opts,diagnosticOmittedFootId:'home-10'}
 ]){
  assert.throws(()=>createEngine(RAPIER,demo,extra),/exchange|boolean/);
 }
 assert.throws(()=>createPlayerMovement({
  experimentalAiExchangeApproach:true,experimentalAiPassReceiveApproach:true
 }),/Exclusive/);
});
test('ME-PB-24 return pass chooses Home #7 from actual teammate frame and real START',()=>{
 const result=decideLocalAiReturnPass(passInput);
 assert.ok(result);
 assert.equal(result.stage,'return-pass');
 assert.equal(result.targetPlayerId,'home-7');
 assert.equal(result.version,LOCAL_EXCHANGE_VERSION);
 assert.equal(result.passCompletionInferred,false);
 assert.equal(result.inferredPossession,false);
 assert.ok(result.impulseNs.x<0);
 const short=decideLocalAiReturnPass({...passInput,
  teammate:{...passInput.teammate,x:-7.1}});
 assert.ok(short,'physically valid short measured teammate return cannot be ruled out by old 8m gate');
 assert.ok(Math.hypot(result.impulseNs.x,result.impulseNs.y)<
  LOCAL_RETURN_MAX_IMPULSE_NS);
 assert.ok(Object.isFrozen(result.impulseNs));
 for(const delta of [
   {contactStarted:[]},{tick:15},{firstPass:null},
   {player:{...passInput.player,id:'away-10'}},
   {teammate:{...passInput.teammate,id:'home-11'}},
   {ballPosition:{...passInput.ballPosition,z:0.7}},
   {ballVelocity:{x:50,y:0,z:0}}
 ]){
  assert.equal(decideLocalAiReturnPass({...passInput,...delta}),null);
 }
 assert.throws(()=>decideLocalAiReturnPass({...passInput,tick:0}),/Valid Rapier/);
});
test('ME-PB-24 return control cannot be claimed without another physical contact',()=>{
 const pass=decideLocalAiReturnPass(passInput);
 const input={tick:350,contactStarted:['home-7'],returnPass:pass,
   player:{id:'home-7',team:'home',x:-19,y:0},
   ballPosition:{x:-19.25,y:0,z:0.11},
   ballVelocity:{x:-3,y:0,z:0},ballRadiusM:0.11,
   ballMassKg:BALL_MASS_KG};
 const control=decideLocalAiReturnControl(input);
 assert.equal(control.stage,'return-control');
 assert.equal(control.inferredPossession,false);
 for(const delta of [
   {contactStarted:[]},{tick:pass.tick+2},
   {returnPass:null},{player:{...input.player,id:'home-10'}},
   {ballPosition:{...input.ballPosition,x:-16}},
   {ballVelocity:{x:-30,y:0,z:0}}
 ]){
  assert.equal(decideLocalAiReturnControl({...input,...delta}),null);
 }
});
test('ME-PB-24 real exchange produces separate physical outbound/return impulses',()=>{
 const {events,rows}=replay();
 assert.ok(events.pass,'real Home #7 initial START and impulse required');
 assert.ok(events.returnPass,'real Home #10 later START and impulse required: '+
   JSON.stringify({events:events.events.map(x=>({
    stage:x.stage,tick:x.tick,playerId:x.playerId})),
    firstHome10Starts:rows.filter(r=>r.starts.includes('home-10')).slice(0,8),
    firstHome7Starts:rows.filter(r=>r.starts.includes('home-7')).slice(0,8)}));
 assert.equal(events.pass.tick,13);
 assert.ok(events.returnPass.tick>events.pass.tick+2);
 assert.equal(events.returnPass.playerId,'home-10');
 assert.equal(events.pass.playerId,'home-7');
 assert.equal(events.returnPass.appliedByRealRapier,true);
 assert.ok(rows[events.returnPass.tick-1].starts.includes('home-10'));
 if(events.finalControl){
  assert.ok(events.finalControl.tick>events.returnPass.tick+2);
  assert.ok(rows[events.finalControl.tick-1].starts.includes('home-7'));
 }
 if(events.oppositionContact)
  assert.ok(rows[events.oppositionContact.tick-1].starts.includes(
    events.oppositionContact.playerId));
 process.stdout.write('ME_PB_24_REAL_EXCHANGE '+JSON.stringify({
   initialPassTick:events.pass.tick,returnPassTick:events.returnPass.tick,
   realReturnControlTick:events.finalControl?.tick??null,
   actualOppositionContactTick:events.oppositionContact?.tick??null,
   stages:events.events.map(x=>x.stage),
   realRapierContactGates:true,officialMatchPossession:false
 })+'\n');
});
test('ME-PB-24 independent 22-player Rapier exchange replays identically',()=>{
 assert.deepEqual(replay(440),replay(440));
});
test('ME-PB-24 real opponent shoe START is observed, never invented as possession',()=>{
 const initial={preset:'roll',seed:'pb24-opponent-evidence',
  x:4.65,y:0,z:0,vx:0,vy:0,vz:0};
 const world=createEngine(RAPIER,initial,{
  diagnosticPlayerFootContactsEnabled:true});
 const movement=createPlayerMovement();
 let observed=null;
 try{
  for(let tick=1;tick<=100;tick++){
   const f=movement.step(world.snapshot().ball.position);
   const snap=world.step(f);
   const e=observeLocalOppositionContact({
    tick,contactStarted:world.footContactSnapshot().started,
    players:f.players,ballPosition:snap.ball.position,
    ballRadiusM:0.11,phase:'outbound'});
   if(e){observed=e;break;}
  }
 }finally{world.dispose();}
 assert.ok(observed,'an actual away shoe-ball START must occur in this control');
 assert.match(observed.playerId,/^away-/);
 assert.equal(observed.actualShoeStart,true);
 assert.equal(observed.inferredPossession,false);
 assert.equal(observed.interceptionInferred,false);
 assert.equal(observed.consequence,'physical-opposition-contact-stop');
 assert.equal(observeLocalOppositionContact({
    tick:1,contactStarted:[],players:[],
    ballPosition:{x:0,y:0,z:0.11},
    ballRadiusM:0.11,phase:'outbound'}),null);
});
test('ME-PB-24 dropdown LAB selection and normal reset wiring',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-exchange" data-value="ai-exchange"/);
 assert.doesNotMatch(html,/id="ai-exchange-demo"/);
 assert.match(lab,/diagnosticLocalAiExchangeEnabled:exchangeDemoActive/);
 assert.match(lab,/experimentalAiExchangeApproach:exchangeDemoActive/);
 assert.match(lab,/exchangeDemoActive=choice==='ai-exchange'/);
});
