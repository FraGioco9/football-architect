import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {BALL_RADIUS,ENGINE_VERSION,FIXED_DT,createEngine,canonicalSnapshot,initializeRapier}
 from '../src/core.mjs';
import {createPlayerMovement,PLAYER_DT,PLAYER_VERSION}
 from '../src/player-movement.mjs';
import {PLAYER_BALL_REACH_VERSION,PLAYER_BALL_REACH_RADIUS_M,
 PLAYER_BALL_MAX_CLEARANCE_M,evaluatePlayerBallReach,createPlayerBallReachObserver}
 from '../src/player-ball-reach.mjs';

function sample({tick=0,x=0,y=0,z=BALL_RADIUS,changes={}}={}){
 const base=createPlayerMovement().snapshot();
 const players={...base,tick,timeS:tick*PLAYER_DT,
  players:base.players.map(p=>changes[p.id]?{...p,...changes[p.id]}:p)};
 const physics={version:ENGINE_VERSION,tick,time:tick*FIXED_DT,nearGround:z<=BALL_RADIUS+0.01,
  ball:{position:{x,y,z},velocity:{x:0,y:0,z:0}}};
 return {physics,players};
}
function evaluate(options){const {physics,players}=sample(options);return evaluatePlayerBallReach(physics,players);}
const ids=observation=>observation.candidates.map(x=>x.id);

test('ME-PB-01 uses actual grounded 3D ball center, not an XY-only possession guess',()=>{
 const over={ 'home-10':{x:0,y:0} };
 const air=evaluate({z:BALL_RADIUS+3,changes:over});
 assert.deepEqual(ids(air),[]);
 assert.equal(air.groundLevel,false);
 const ground=evaluate({changes:over});
 assert.equal(ground.version,PLAYER_BALL_REACH_VERSION);
 assert.equal(ground.tick,0);
 assert.equal(ground.groundLevel,true);
 assert.deepEqual(ids(ground),['home-10']);
 assert.deepEqual(ground.nearest,{id:'home-10',team:'home',distanceM:0});
 assert.equal(ground.clearanceM,0);
 assert.ok(Object.isFrozen(ground)&&Object.isFrozen(ground.candidates)&&
  Object.isFrozen(ground.nearest));
 const bystander=evaluate();
 assert.equal(bystander.nearest,null);
 assert.equal(bystander.groundLevel,true);
});

test('ME-PB-01 symmetric Home/Away candidate tie, canonical ordering and provisional radius',()=>{
 const tied=evaluate({changes:{
  'home-10':{x:-0.2,y:0},'away-10':{x:0.2,y:0}
 }});
 assert.deepEqual(ids(tied),['home-10','away-10']);
 assert.equal(tied.nearest.id,'home-10');
 assert.equal(tied.candidates[0].distanceM,tied.candidates[1].distanceM);
 const h=evaluate({x:-5}).nearest,a=evaluate({x:5}).nearest;
 assert.equal(h.id,'home-10');assert.equal(a.id,'away-10');
 assert.equal(h.distanceM,a.distanceM);
 const radius=PLAYER_BALL_REACH_RADIUS_M;
 assert.deepEqual(ids(evaluate({changes:{'home-10':{x:radius,y:0}}})),['home-10']);
 assert.deepEqual(ids(evaluate({changes:{'home-10':{x:radius+0.001,y:0}}})),[]);
});

test('ME-PB-01 ignores airborne and out-of-pitch balls; never clamps into a phantom touch',()=>{
 const near={'home-10':{x:0,y:0}};
 assert.deepEqual(ids(evaluate({z:BALL_RADIUS+PLAYER_BALL_MAX_CLEARANCE_M,changes:near})),
  ['home-10']);
 assert.deepEqual(ids(evaluate({z:BALL_RADIUS+PLAYER_BALL_MAX_CLEARANCE_M+0.005,changes:near})),[]);
 for(const [x,y] of [[52.6,0],[-52.6,0],[0,34.1],[0,-34.1]]){
  // The BALL may cross the pitch boundary; canonical player bodies must remain inside it.
  const px=Math.max(-52.5,Math.min(52.5,x)),py=Math.max(-34,Math.min(34,y));
  const s=evaluate({x,y,changes:{'home-10':{x:px,y:py}}});
  assert.equal(s.onPitch,false);
  assert.equal(s.nearest,null);
 }
 // Real Rapier balls can fall below pitch height only AFTER leaving its finite floor.
 const fallen=evaluate({x:53,y:0,z:-1,changes:{'home-10':{x:52.5,y:0}}});
 assert.equal(fallen.onPitch,false);
 assert.equal(fallen.groundLevel,false);
 assert.equal(fallen.nearest,null);
 // The same two-dimensional ball XY is not sufficient to infer a touch.
 assert.equal(evaluate({z:2,changes:near}).nearest,null);
});

test('ME-PB-01 observer records real consecutive entry/exit only; tick zero is a baseline',()=>{
 const o=createPlayerBallReachObserver();
 assert.deepEqual(o.snapshot().entered,[]);
 assert.equal(o.snapshot().tick,null);
 const at=t=>sample({tick:t,changes:{'home-10':{x:t<3?0:5,y:0}}});
 const initial=at(0);
 const first=o.observe(initial.physics,initial.players);
 assert.deepEqual(ids(first),['home-10']);
 assert.deepEqual(first.entered,[]);assert.deepEqual(first.exited,[]);
 const next=at(1),still=o.observe(next.physics,next.players);
 assert.deepEqual(still.entered,[]);assert.deepEqual(still.exited,[]);
 const third=sample({tick:2,changes:{'home-10':{x:0,y:0},'away-10':{x:0.2,y:0}}});
 const entered=o.observe(third.physics,third.players);
 assert.deepEqual(entered.entered,['away-10']);
 assert.deepEqual(entered.exited,[]);
 const last=at(3),left=o.observe(last.physics,last.players);
 assert.deepEqual(left.entered,[]);
 assert.deepEqual(left.exited,['home-10','away-10']);
 assert.deepEqual(ids(left),[]);
 assert.deepEqual(o.snapshot(),left);
 assert.ok(Object.isFrozen(left)&&Object.isFrozen(left.exited));
 assert.throws(()=>o.observe(last.physics,last.players),/consecutive/);
 assert.throws(()=>o.observe(...Object.values(at(5))),/consecutive/);
 assert.equal(o.reset().tick,null);
 const replay=o.observe(initial.physics,initial.players);
 assert.deepEqual(replay,first);
});

test('ME-PB-01 no inferred possession when both sides physically occupy reach',()=>{
 const observer=createPlayerBallReachObserver();
 const d=sample({changes:{'home-10':{x:0,y:0},'away-10':{x:0,y:0}}});
 const baseline=observer.observe(d.physics,d.players);
 assert.equal(baseline.candidates.length,2);
 assert.equal(baseline.nearest.id,'home-10');
 assert.equal(Object.hasOwn(baseline,'possessor'),false);
 assert.equal(Object.hasOwn(baseline,'touch'),false);
 assert.equal(Object.hasOwn(baseline,'impulse'),false);
});

test('ME-PB-01 rejects forged clocks, body identities, malformed and non-finite states',()=>{
 const {physics,players}=sample();
 const bad=(p=physics,v=players)=>()=>evaluatePlayerBallReach(p,v);
 assert.throws(bad({...physics,tick:1}),/Synchronized/);
 assert.throws(bad(physics,{...players,timeS:FIXED_DT}),/Synchronized/);
 assert.throws(bad({...physics,version:'other'}),/versions/);
 assert.throws(bad(physics,{...players,version:'fake'}),/versions/);
 assert.throws(bad({...physics,ball:{...physics.ball,position:{x:0,y:0,z:NaN}}}),/3D Rapier/);
 assert.throws(bad({...physics,ball:{...physics.ball,velocity:{x:Infinity,y:0,z:0}}}),/3D Rapier/);
 assert.throws(bad({...physics,ball:{...physics.ball,position:{x:0,y:0,z:-1}}}),/3D Rapier/);
 assert.throws(bad(physics,{...players,players:players.players.slice(1)}),/22/);
 const wrong=[...players.players];wrong[0]={...wrong[0],id:'away-1'};
 assert.throws(bad(physics,{...players,players:wrong}),/canonical physical/);
 const nonfinite=[...players.players];nonfinite[8]={...nonfinite[8],vx:NaN};
 assert.throws(bad(physics,{...players,players:nonfinite}),/canonical physical/);
 const outside=[...players.players];outside[0]={...outside[0],x:99};
 assert.throws(bad(physics,{...players,players:outside}),/canonical physical/);
 assert.throws(()=>createPlayerBallReachObserver().observe(
  sample({tick:1}).physics,sample({tick:1}).players),/consecutive/);
});

test('ME-PB-01 480 real Rapier ticks leave ball replay and autonomous players byte-identical',async()=>{
 const RAPIER=await initializeRapier(rapierModule);
 const input={preset:'roll',x:-5,y:0,z:0,vx:0,vy:0,vz:0,seed:'pb01-replay'};
 const e=createEngine(RAPIER,input),f=createEngine(RAPIER,input);
 try{
  const a=createPlayerMovement(),b=createPlayerMovement();
  const obs=createPlayerBallReachObserver(),control=createPlayerBallReachObserver();
  const first=obs.observe(e.snapshot(),a.snapshot());
  const firstControl=control.observe(f.snapshot(),b.snapshot());
  assert.deepEqual(first,firstControl);
  assert.deepEqual(ids(first),['home-10']);
  assert.deepEqual(first.entered,[]);
  for(let tick=1;tick<=480;tick++){
   const physical=e.step(),reference=f.step();
   assert.equal(canonicalSnapshot(physical),canonicalSnapshot(reference));
   const player=a.step(physical.ball.position),same=b.step(reference.ball.position);
   assert.deepEqual(player,same);
   const r=obs.observe(physical,player);
   const t=control.observe(reference,same);
   assert.deepEqual(r,t);
   assert.equal(r.tick,tick);
   assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.candidates));
   assert.equal(Object.hasOwn(r,'possessor'),false);
  }
  assert.equal(canonicalSnapshot(e.snapshot()),canonicalSnapshot(f.snapshot()));
  assert.deepEqual(a.snapshot(),b.snapshot());
 }finally{e.dispose();f.dispose();}
});
