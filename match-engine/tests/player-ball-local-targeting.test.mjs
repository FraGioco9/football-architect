// ME-PB-25: dynamic canonical teammate decision and same-world defender
// collision. This is a local DEV physics trial, not official possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,
 FIXED_DT} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {chooseLocalPassRecipient,decideLocalSelectedPass,
 localDefenderLineup,LOCAL_DEFENDER_PREPOSITION,
 LOCAL_DEFENDER_ID,LOCAL_TARGET_CANDIDATE_IDS,
 LOCAL_DYNAMIC_PASS_IMPULSE_NS} from '../src/player-ball-local-targeting.mjs';
import {readFileSync} from 'node:fs';
const RAPIER=await initializeRapier(RapierModule);
const demo={preset:'roll',seed:'me-pb-25-local-dynamic',
 x:-19.35,y:0,z:0,vx:0,vy:0,vz:0};
const options=pressured=>({
 diagnosticPlayerFootContactsEnabled:true,
 diagnosticLocalAiExchangeEnabled:true,
 diagnosticLocalAiOpponentLaneEnabled:pressured
});
const movementOptions=pressured=>({
 experimentalAiExchangeApproach:true,
 experimentalAiOpponentLane:pressured
});
const actor=INITIAL_PLAYERS.find(p=>p.id==='home-7');
test('ME-PB-25 selects from three actual candidate forwards, stable on ties',()=>{
 const select=chooseLocalPassRecipient({passer:actor,players:INITIAL_PLAYERS});
 assert.equal(select.receiverId,'home-10');
 assert.equal(select.consideredCandidates.length,3);
 assert.ok(Object.isFrozen(select)&&Object.isFrozen(select.consideredCandidates));
 assert.ok(select.consideredCandidates.every((p,i,a)=>
  i===0||p.scoreM>=a[i-1].scoreM));
 assert.equal(select.guaranteedPhysicalReceipt,false);
 const wing=INITIAL_PLAYERS.map(p=>p.id==='home-10'?
   {...p,x:-40}:p);
 const alternate=chooseLocalPassRecipient({passer:actor,players:wing});
 assert.ok(['home-9','home-11'].includes(alternate.receiverId));
 assert.notEqual(alternate.receiverId,select.receiverId);
 const otherWing=INITIAL_PLAYERS.map(p=>p.id==='home-9'?
   {...p,x:-40}:p);
 assert.ok(['home-10','home-11'].includes(
   chooseLocalPassRecipient({passer:actor,players:otherWing}).receiverId));
 assert.throws(()=>chooseLocalPassRecipient({passer:actor,players:[]}),/canonical/i);
 assert.throws(()=>chooseLocalPassRecipient({passer:{...actor,id:'away-7'},
  players:INITIAL_PLAYERS}),/canonical/i);
});
test('ME-PB-25 local selected pass requires a genuine physical Home #7 START',()=>{
 const selection=chooseLocalPassRecipient({passer:actor,players:INITIAL_PLAYERS});
 const data={tick:13,contactStarted:['home-7'],passer:actor,
  ballPosition:{x:-19.35,y:0,z:0.11},ballRadiusM:0.11,selection};
 const real=decideLocalSelectedPass(data);
 assert.ok(real&&real.stage==='pass');
 assert.equal(real.targetPlayerId,'home-10');
 assert.equal(real.selectedCandidates.length,3);
 assert.equal(real.usedObservedPlayerFrame,true);
 assert.equal(real.inferredPossession,false);
 assert.ok(Math.abs(Math.hypot(real.impulseNs.x,real.impulseNs.y)-
  LOCAL_DYNAMIC_PASS_IMPULSE_NS)<1e-12);
 for(const change of [
  {contactStarted:[]},
  {contactStarted:['home-10']},
  {selection:null},
  {ballPosition:{x:-3,y:0,z:0.11}},
  {passer:{...actor,team:'away'}},
  {ballPosition:{x:-19.35,y:0,z:0.9}}
 ])assert.equal(decideLocalSelectedPass({...data,...change}),null);
 assert.throws(()=>decideLocalSelectedPass({...data,tick:0}),/canonical/);
});
test('ME-PB-25 pre-positioned opponent keeps a 22-body canonical first pose',()=>{
 const lineup=localDefenderLineup(INITIAL_PLAYERS);
 assert.equal(lineup.length,22);
 const before=INITIAL_PLAYERS.find(p=>p.id===LOCAL_DEFENDER_ID);
 const after=lineup.find(p=>p.id===LOCAL_DEFENDER_ID);
 assert.ok(before.x>0);
 assert.equal(after.x,LOCAL_DEFENDER_PREPOSITION.x);
 assert.equal(after.y,LOCAL_DEFENDER_PREPOSITION.y);
 assert.equal(after.facingRad,Math.PI);
 assert.notEqual(before.x,after.x);
 assert.ok(Object.isFrozen(after));
 assert.deepEqual(INITIAL_PLAYERS.filter(p=>p.id!==LOCAL_DEFENDER_ID),
  lineup.filter(p=>p.id!==LOCAL_DEFENDER_ID));
 const m=createPlayerMovement(movementOptions(true));
 const zero=m.snapshot();
 assert.equal(zero.players.find(p=>p.id===LOCAL_DEFENDER_ID).x,after.x);
 assert.equal(zero.tick,0);
 const first=m.step({x:demo.x,y:demo.y});
 assert.equal(first.tick,1);
 assert.ok(Math.hypot(
  first.players.find(p=>p.id===LOCAL_DEFENDER_ID).x-after.x,
  first.players.find(p=>p.id===LOCAL_DEFENDER_ID).y-after.y)<0.2);
 assert.deepEqual(m.reset().snapshot(),zero);
 assert.throws(()=>createPlayerMovement({experimentalAiOpponentLane:true}),
  /Exclusive/);
});
test('ME-PB-25 isolated opponent-lane toggle requires local exchange and real feet',()=>{
 for(const flags of [
  {diagnosticLocalAiOpponentLaneEnabled:true},
  {diagnosticPlayerFootContactsEnabled:true,
   diagnosticLocalAiOpponentLaneEnabled:true},
  {diagnosticPlayerFootContactsEnabled:true,
   diagnosticLocalAiExchangeEnabled:true,diagnosticLocalAiOpponentLaneEnabled:'true'},
  {...options(true),diagnosticLocalAiKickEnabled:true}
 ])assert.throws(()=>createEngine(RAPIER,demo,flags),
  /opponent|exchange|kick|boolean/i);
 const ordinary=createEngine(RAPIER,demo,options(false));
 try{
  assert.equal(ordinary.localAiExchangeSnapshot().opponentLanePrepositioned,false);
 }finally{ordinary.dispose();}
});
function measure(pressured,limit=570){
 const world=createEngine(RAPIER,demo,options(pressured));
 const motion=createPlayerMovement(movementOptions(pressured));
 const samples=[];
 let first=null;
 try{
  for(let tick=1;tick<=limit;tick++){
   const frame=motion.step(world.snapshot().ball.position);
   const snap=world.step(frame);
   const info=world.localAiExchangeSnapshot();
   const starts=world.footContactSnapshot().started;
   if(info.pass&&!first){
    first=info.pass;
    assert.equal(info.pass.tick,tick);
    assert.ok(starts.includes('home-7'));
    const selected=frame.players.find(p=>p.id===info.pass.targetPlayerId);
    assert.ok(selected,'chosen teammate must exist in true 22-player frame');
    assert.deepEqual(info.pass.targetPositionAtPass,
     {x:selected.x,y:selected.y});
   }
   if(info.oppositionContact?.tick===tick){
    assert.ok(starts.includes(info.oppositionContact.playerId),
     'defender evidence requires same-step real Rapier shoe START');
    assert.equal(info.oppositionContact.inferredPossession,false);
   }
   const actualOpponent=frame.players.find(p=>p.id===LOCAL_DEFENDER_ID);
   samples.push(Object.freeze({
    tick,
    ball:canonicalSnapshot(snap),
    starts:Object.freeze([...starts]),
    stages:Object.freeze(info.events.map(e=>e.stage)),
    liveDefender:Object.freeze({x:actualOpponent.x,y:actualOpponent.y}),
    home7:frame.players.find(p=>p.id==='home-7')?.x,
    chosen:info.selectedRecipientId
   }));
  }
  return Object.freeze({
   state:world.localAiExchangeSnapshot(),
   samples:Object.freeze(samples)
  });
 }finally{world.dispose();}
}
test('ME-PB-25 unchanged normal exchange still chooses dynamic target from frame',()=>{
 const {state,samples}=measure(false);
 assert.equal(state.opponentLanePrepositioned,false);
 assert.ok(state.pass,'canonical Home #7 pass still real');
 assert.equal(state.pass.targetPlayerId,'home-10');
 assert.equal(state.pass.selectedCandidates.length,3);
 assert.equal(state.pass.usedObservedPlayerFrame,true);
 assert.ok(state.returnPass,'Home #10 real shoe START remains valid');
 assert.ok(state.finalControl,'Home #7 real return reception remains valid');
 assert.equal(state.oppositionContact,null);
 assert.ok(samples[state.pass.tick-1].starts.includes('home-7'));
});
test('ME-PB-25 a pre-positioned defender physically contests the SAME outgoing pass',()=>{
 const {state,samples}=measure(true);
 const observedStarts=samples.filter(x=>x.starts.some(id=>id.startsWith('away-')));
 if(!state.oppositionContact)
  process.stdout.write('ME_PB_25_CONTEST_DIAGNOSTIC '+JSON.stringify({
   pass:state.pass?.tick??null,target:state.selectedRecipientId,
   returnPass:state.returnPass?.tick??null,
   opponentStartTicks:observedStarts.slice(0,15).map(x=>({
    tick:x.tick,starts:x.starts,defender:x.liveDefender,ball:x.ball})),
   lateBall:samples.at(-1)?.ball,
   movingDefender:samples.filter(x=>x.tick%60===0).map(x=>({
    tick:x.tick,x:x.liveDefender.x,y:x.liveDefender.y}))
  })+'\n');
 assert.ok(state.pass,'same-world outgoing pass must occur before defense');
 assert.ok(state.oppositionContact,'an Away shoe START must interrupt this specific pass');
 assert.equal(state.oppositionContact.actualShoeStart,true);
 assert.equal(state.oppositionContact.interceptionInferred,false);
 assert.equal(state.oppositionContact.inferredPossession,false);
 assert.equal(state.events.at(-1).stage,'opponent-contact');
 assert.equal(state.returnPass,null);
 assert.equal(state.finalControl,null);
 assert.ok(samples[state.oppositionContact.tick-1].starts.includes(
   state.oppositionContact.playerId));
 process.stdout.write('ME_PB_25_LIVE_RAPIER_INTERCEPTION '+JSON.stringify({
  passTick:state.pass.tick,
  chosenRecipient:state.pass.targetPlayerId,
  opponentShoeStartTick:state.oppositionContact.tick,
  opponentId:state.oppositionContact.playerId,
  physicalInterruption:true,
  adjudicatedInterception:false,officialPossession:false
 })+'\n');
});
test('ME-PB-25 contested and ordinary worlds each deterministically replay',()=>{
 assert.deepEqual(measure(false,240),measure(false,240));
 assert.deepEqual(measure(true,240),measure(true,240));
});
test('ME-PB-25 dedicated LAB scenario creates matched physics/movement',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 assert.match(html,/id="preset-opt-ai-defend" data-value="ai-defend"/);
 assert.doesNotMatch(html,/id="ai-defend-demo"/);
 assert.match(lab,/diagnosticLocalAiOpponentLaneEnabled:defendDemoActive/);
 assert.match(lab,/experimentalAiOpponentLane:defendDemoActive/);
 assert.match(lab,/defendDemoActive=choice==='ai-defend'/);
});
