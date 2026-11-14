// ME-PB-47 — certify only ONE shared ball-response tuning value.
// Fixed material and terrain constants remain technical engine internals.
// This is real Rapier research, not possession, interception or an AI kick.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,
 GRASS_ROLL_DECELERATION,FIXED_DT} from '../src/core.mjs';
import {FOOT_CONTACT_RESTITUTION,FOOT_CONTACT_FRICTION}
 from '../src/player-foot-contact.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {
 GLOBAL_BALL_RESPONSE_VERSION,DEFAULT_GLOBAL_BALL_RESPONSE,
 GLOBAL_BALL_RESPONSE_RANGE,resolveGlobalBallResponse,
 createGlobalResponseResearchEngine
} from '../src/player-ball-global-response.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(rapierModule);
const seeds=Object.freeze([
 Object.freeze({name:'first',x:4.96,y:0,vx:-0.3,vy:0}),
 Object.freeze({name:'second',x:5,y:0,vx:-0.3,vy:0}),
 Object.freeze({name:'distant',x:30,y:20,vx:0,vy:0})
]);
const scene=c=>Object.freeze({
 preset:'roll',seed:'me-pb-47-'+c.name,x:c.x,y:c.y,z:0,
 vx:c.vx,vy:c.vy,vz:0
});
function run(c,response,{ticks=175,withEvidence=true}={}){
 const initial=scene(c);
 const full=createGlobalResponseResearchEngine(Rapier,initial,response);
 const omitted=createGlobalResponseResearchEngine(Rapier,initial,response,
  {omittedShoeId:'home-10'});
 const sham=createGlobalResponseResearchEngine(Rapier,initial,response,
  {omittedShoeId:'home-1'});
 const plain=withEvidence&&response===1?
  createEngine(Rapier,initial,{diagnosticPlayerFootContactsEnabled:true}):null;
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 const a=[],b=[],cTrace=[],events=[],plainTrace=[];
 let firstStart=null,secondStart=null,secondEnd=null;
 let priorToSecondIdentical=true,shamIdentical=true;
 try{
  assert.deepEqual(full.snapshot(),omitted.snapshot());
  assert.deepEqual(full.snapshot(),sham.snapshot());
  for(let tick=1;tick<=ticks;tick++){
   // Every world gets the very SAME canonical 22-player movement
   // from the FULL world's preceding real ball state.
   const frame=mover.step(full.snapshot().ball.position);
   assert.equal(frame.players.length,INITIAL_PLAYERS.length);
   assert.equal(frame.tick,tick);
   const aa=full.step(frame),bb=omitted.step(frame),
    cc=sham.step(frame);
   const contact=full.footContactSnapshot(),
    contactOmitted=omitted.footContactSnapshot(),
    contactSham=sham.footContactSnapshot();
   if(plain){
    plainTrace.push(canonicalSnapshot(plain.step(frame)));
    assert.deepEqual(plain.footContactSnapshot(),contact,
     'single response 1 must preserve default actual Rapier events');
   }
   const snapA=canonicalSnapshot(aa),snapB=canonicalSnapshot(bb),
    snapC=canonicalSnapshot(cc);
   if(firstStart===null&&contact.started.length)
    firstStart=Object.freeze({tick,id:contact.started[0]});
   if(secondStart===null&&contact.started.includes('home-10'))
    secondStart=tick;
   if(secondStart!==null&&secondEnd===null&&
      tick>=secondStart&&contact.ended.includes('home-10'))
    secondEnd=tick;
   if(secondStart===null&&snapA!==snapB)priorToSecondIdentical=false;
   if(snapA!==snapC)shamIdentical=false;
   assert.ok(![
    contactOmitted.started,contactOmitted.active,contactOmitted.ended
   ].some(ids=>ids.includes('home-10')));
   assert.ok(![
    contactSham.started,contactSham.active,contactSham.ended
   ].some(ids=>ids.includes('home-1')));
   events.push(Object.freeze({
    tick,
    started:Object.freeze([...contact.started]),
    ended:Object.freeze([...contact.ended]),
    active:Object.freeze([...contact.active])
   }));
   a.push(snapA);b.push(snapB);cTrace.push(snapC);
  }
  return Object.freeze({
   response,initial:c.name,firstStart,secondStart,secondEnd,
   shamIdentical,priorToSecondIdentical,
   full:Object.freeze(a),withoutShoe:Object.freeze(b),
   sham:Object.freeze(cTrace),events:Object.freeze(events),
   defaultBaseline:Object.freeze(plainTrace),
   officialPossession:false,controlConfirmed:false,
   individualFootImpulseProven:false
  });
 }finally{full.dispose();omitted.dispose();sham.dispose();plain?.dispose();}
}

test('ME-PB-47 one bounded global response derives immutable common shoe/grass coefficients',()=>{
 assert.equal(DEFAULT_GLOBAL_BALL_RESPONSE,1);
 assert.deepEqual(GLOBAL_BALL_RESPONSE_RANGE,{min:0.75,max:1.25});
 const base=resolveGlobalBallResponse();
 assert.equal(base.version,GLOBAL_BALL_RESPONSE_VERSION);
 assert.equal(base.value,1);
 assert.equal(base.internalFootRestitution,FOOT_CONTACT_RESTITUTION);
 assert.equal(base.internalGrassRollDecelerationMps2,GRASS_ROLL_DECELERATION);
 assert.equal(base.internalFootFriction,FOOT_CONTACT_FRICTION);
 assert.equal(base.sameForAllShoes,true);
 assert.equal(base.sameForAllPlayers,true);
 assert.equal(base.sameForAllPitches,true);
 assert.equal(base.calibratedForGameplay,false);
 assert.equal(base.officialPossession,false);
 assert.ok(Object.isFrozen(base)&&Object.isFrozen(GLOBAL_BALL_RESPONSE_RANGE));
 const low=resolveGlobalBallResponse(0.85),
  high=resolveGlobalBallResponse(1.15);
 assert.equal(low.internalFootRestitution,0.12*0.85);
 assert.equal(high.internalFootRestitution,0.12*1.15);
 assert.equal(low.internalGrassRollDecelerationMps2,0.8/0.85);
 assert.equal(high.internalGrassRollDecelerationMps2,0.8/1.15);
 assert.ok(low.internalFootRestitution<base.internalFootRestitution);
 assert.ok(high.internalFootRestitution>base.internalFootRestitution);
 assert.ok(low.internalGrassRollDecelerationMps2>
  base.internalGrassRollDecelerationMps2);
 assert.ok(high.internalGrassRollDecelerationMps2<
  base.internalGrassRollDecelerationMps2);
 assert.equal(low.internalFootFriction,base.internalFootFriction);
 assert.equal(high.internalFootFriction,base.internalFootFriction);
 for(const invalid of [0.749,1.251,-1,0,NaN,Infinity,
  -Infinity,'1',null,{},[],true])
  assert.throws(()=>resolveGlobalBallResponse(invalid),
   /One bounded global ball response value required/);
 assert.equal(resolveGlobalBallResponse(0.75).value,0.75);
 assert.equal(resolveGlobalBallResponse(1.25).value,1.25);
});

test('ME-PB-47 rejects independent physical knobs, player/pitch profiles and ungrounded research',()=>{
 const input=scene(seeds[0]);
 for(const extra of [
  {diagnosticFootRestitution:0.22},
  {diagnosticGrassRollDecelerationMps2:1},
  {footFriction:0.25},
  {playerId:'home-10'},
  {pitchType:'synthetic'},
  {omittedShoeId:'home-10',shoeMaterial:'leather'},
  {omittedShoeId:123},
  [],null
 ]){
  assert.throws(()=>createGlobalResponseResearchEngine(
   Rapier,input,1,extra
  ),/Only an optional ablated shoe ID is supported/);
 }
 assert.throws(()=>createGlobalResponseResearchEngine(
  Rapier,{preset:'launch',z:0,vz:0},1
 ),/Shared response research requires grounded roll/);
 assert.throws(()=>createGlobalResponseResearchEngine(
  Rapier,{preset:'roll',z:0.3},1
 ),/Shared response research requires grounded roll/);
 assert.throws(()=>createGlobalResponseResearchEngine(
  Rapier,input,0.5
 ),/One bounded global ball response value required/);
 assert.throws(()=>createGlobalResponseResearchEngine(
  Rapier,input,1,{omittedShoeId:'not-a-player'}
 ),/Canonical diagnostic omitted foot ID required/);
});

test('ME-PB-47 one scalar (0.85, 1, 1.15) yields genuine three-world Rapier responses',()=>{
 const results=seeds.slice(0,2).flatMap(initial=>
  [0.85,1,1.15].map(response=>run(initial,response)));
 assert.equal(results.length,6);
 for(const row of results){
  assert.equal(row.events.length,175);
  assert.equal(row.shamIdentical,true,
   'sham 22-player world must be bit-identical at every Rapier tick');
  assert.equal(row.officialPossession,false);
  assert.equal(row.controlConfirmed,false);
  assert.equal(row.individualFootImpulseProven,false);
  assert.equal(row.firstStart?.id,'away-10');
  assert.equal(row.firstStart?.tick,1);
  assert.ok(row.secondStart!==null&&row.secondStart>row.firstStart.tick);
  assert.ok(row.full.some((f,i)=>f!==row.withoutShoe[i]),
   'same kinematic inputs diverge in actual contact solver');
  if(row.secondEnd!==null)
   assert.ok(row.secondEnd>row.secondStart);
 }
 const a=results.find(x=>x.initial==='first'&&x.response===1);
 const b=results.find(x=>x.initial==='second'&&x.response===1);
 assert.equal(a.secondStart,127);
 assert.equal(a.secondEnd,130);
 assert.equal(b.secondStart,125);
 assert.equal(b.secondEnd,128);
 assert.deepEqual(a.full,a.defaultBaseline,
  'single global scalar 1 must preserve exact default 22-player Rapier motion');
 assert.deepEqual(b.full,b.defaultBaseline);
 const distinct=results.filter(x=>x.initial==='first');
 assert.ok(distinct.some(x=>x.full.join('')!==a.full.join('')),
  'a changed global response value must change whole-ball dynamics');
 process.stdout.write('ME_PB_47_ONE_GLOBAL_RESPONSE_REAL_RAPIER '+
  JSON.stringify({worlds:results.length,technicalDefaultsUnchanged:true,
   responseValues:[0.85,1,1.15],
   cases:results.map(r=>({
    initial:r.initial,response:r.response,
    firstTick:r.firstStart?.tick,secondStart:r.secondStart,
    secondEnd:r.secondEnd,shamIdentical:r.shamIdentical,
    preSecondIdentical:r.priorToSecondIdentical
   })),
   allShoesIdentical:true,allPitchesIdentical:true,
   controlledReception:false,officialPossession:false})+'\n');
});

test('ME-PB-47 independently replayable, ablation negative and no new physical observer impulses',()=>{
 for(const value of [0.85,1,1.15]){
  const first=run(seeds[0],value,{withEvidence:false});
  const replay=run(seeds[0],value,{withEvidence:false});
  assert.deepEqual(first,replay,'actual Rapier collision frames replay');
  assert.equal(first.shamIdentical,true);
 }
 const negative=run(seeds[2],1,{ticks:70,withEvidence:false});
 assert.equal(negative.firstStart,null);
 assert.equal(negative.secondStart,null);
 assert.equal(negative.secondEnd,null);
 assert.deepEqual(negative.full,negative.withoutShoe);
 assert.deepEqual(negative.full,negative.sham);
 assert.ok(negative.events.every(x=>
  x.started.length===0&&x.ended.length===0&&x.active.length===0));
 // The production-ish normal core engine still has NO foot colliders.
 const noFeet=createEngine(Rapier,scene(seeds[0]));
 try{
  assert.equal(noFeet.footContactSnapshot,undefined);
  assert.equal(noFeet.snapshot().tick,0);
  for(let tick=1;tick<=60;tick++)
   assert.equal(noFeet.step().tick,tick);
 }finally{noFeet.dispose();}
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/global-ball-response|ball-response-scale/);
 assert.equal(FIXED_DT,1/60);
});
