import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {BALL_RADIUS,ENGINE_VERSION,FIXED_DT,createEngine,canonicalSnapshot,initializeRapier}
 from '../src/core.mjs';
import {PLAYER_DT,INITIAL_PLAYERS,createPlayerMovement}
 from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M,FOOT_CONTACT_FORWARD_OFFSET_M,
 FOOT_CONTACT_CENTER_HEIGHT_M,FOOT_CONTACT_RESTITUTION,
 FOOT_CONTACT_RESTITUTION_RANGE,footProxyTransform,
 validateFootContactFrame,initialFootPositions}
 from '../src/player-foot-contact.mjs';

const RAPIER=await initializeRapier(rapierModule);
const roll={preset:'roll',seed:'pb02-physical-roll',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
const mirrored={...roll,x:6,vx:-4};
const face=event=>event?.active||[];
function run(input,contact,ticks=120,restitution=FOOT_CONTACT_RESTITUTION){
 const e=createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:contact,diagnosticFootRestitution:restitution
 });
 const movement=createPlayerMovement(),contacts=[],snapshots=[],playerSamples=[];
 try{
  for(let i=1;i<=ticks;i++){
   const player=contact?movement.step(e.snapshot().ball.position):null;
   const s=contact?e.step(player):e.step();
   snapshots.push(canonicalSnapshot(s));
   if(contact){
    const q=e.footContactSnapshot();
    assert.equal(q.tick,i);
    assert.ok(Object.isFrozen(q)&&Object.isFrozen(q.started)&&
      Object.isFrozen(q.ended)&&Object.isFrozen(q.active));
    assert.equal(Object.hasOwn(q,'possessor'),false);
    assert.equal(Object.hasOwn(q,'owner'),false);
    assert.ok(q.onsetBallDeltaVelocityMps===null||
      (Number.isFinite(q.onsetBallDeltaVelocityMps)&&
       q.onsetBallDeltaVelocityMps>=0));
    assert.equal(q.started.length>0,q.onsetBallDeltaVelocityMps!==null);
    contacts.push(q);
    playerSamples.push(player);
   }
  }
  return {last:e.snapshot(),trace:snapshots,contacts,players:playerSamples};
 }finally{e.dispose();}
}

test('ME-PB-02 foot geometry is provisional, separate from wider PB-01 reach, deterministic canonical 22',()=>{
 assert.equal(FOOT_CONTACT_VERSION,'me-pb-03-oriented-foot-contact-v1');
 assert.ok(FOOT_CONTACT_HALF_LENGTH_M>FOOT_CONTACT_HALF_WIDTH_M);
 assert.ok(FOOT_CONTACT_FORWARD_OFFSET_M>FOOT_CONTACT_HALF_LENGTH_M);
 assert.ok(FOOT_CONTACT_CENTER_HEIGHT_M>FOOT_CONTACT_HALF_HEIGHT_M+
   FOOT_CONTACT_ROUNDING_M);
 const positions=initialFootPositions();
 assert.equal(positions.length,22);
 assert.deepEqual(positions.map(x=>x.x),INITIAL_PLAYERS.map(x=>x.x));
 assert.ok(Object.isFrozen(positions)&&Object.isFrozen(positions[0]));
 const player=createPlayerMovement().step({x:0,y:0,z:BALL_RADIUS});
 const next=validateFootContactFrame(player,1,positions);
 assert.equal(next.length,22);
 assert.ok(Object.isFrozen(next)&&Object.isFrozen(next[10]));
});

test('ME-PB-02 never enables foot colliders by default or accepts control frames in default core',()=>{
 const e=createEngine(RAPIER,roll),f=createEngine(RAPIER,roll);
 try{
  assert.equal(e.footContactSnapshot,undefined);
  assert.equal(e.footContactTimelineSnapshot,undefined);
  assert.equal(e.footContactSolverSnapshot,undefined);
  assert.equal(e.footContactMomentumAuditSnapshot,undefined);
  assert.equal(e.footContactQualificationSnapshot,undefined);
  assert.throws(()=>e.step(createPlayerMovement().step({x:0,y:0})),/not allowed/);
  for(let t=0;t<240;t++){
   const a=e.step(),b=f.step();
   assert.equal(canonicalSnapshot(a),canonicalSnapshot(b));
  }
  assert.throws(()=>createEngine(RAPIER,roll,{diagnosticPlayerFootContactsEnabled:'true'}),/boolean/);
 }finally{e.dispose();f.dispose();}
});

test('ME-PB-02 real Rapier collider hits Home forward and physically changes ball trajectory',()=>{
 const plain=run(roll,false,100),colliding=run(roll,true,100);
 const starts=colliding.contacts.flatMap(q=>q.started);
 assert.ok(starts.includes('home-10'),
   'expected actual Rapier collision event with Home #10, got '+starts.join(','));
 assert.ok(Math.abs(plain.last.ball.position.x-colliding.last.ball.position.x)>0.05,
   'physical contact must change the ball trajectory, not merely label a reach');
 assert.ok(colliding.contacts.some(q=>face(q).includes('home-10')));
 assert.ok(colliding.contacts.every(q=>
   q.started.every(id=>INITIAL_PLAYERS.some(p=>p.id===id))));
 assert.equal(colliding.last.version,ENGINE_VERSION);
 assert.equal(colliding.last.tick,100);
});

test('ME-PB-02 mirrored Away collision generates physical response without Home favoritism',()=>{
 const a=run(roll,true,90),b=run(mirrored,true,90);
 assert.ok(a.contacts.some(x=>x.started.includes('home-10')));
 assert.ok(b.contacts.some(x=>x.started.includes('away-10')));
 assert.ok(Math.abs(a.last.ball.position.x+b.last.ball.position.x)<0.5,
   'mirrored ball response must have comparable longitudinal displacement');
 assert.equal(a.contacts.length,b.contacts.length);
});

test('ME-PB-02 high airborne ball never contacts ground-level foot proxies',()=>{
 const trial={preset:'launch',seed:'pb02-air',x:-6,y:0,z:3,vx:4,vy:0,vz:0};
 const r=run(trial,true,35);
 assert.ok(r.last.ball.position.z>BALL_RADIUS+0.6);
 assert.deepEqual(r.contacts.flatMap(c=>c.started),[]);
 assert.deepEqual(r.contacts.flatMap(c=>c.active),[]);
});

test('ME-PB-02 gaps, identity spoofing and impossible teleports fail before Rapier step',()=>{
 const e=createEngine(RAPIER,roll,{diagnosticPlayerFootContactsEnabled:true});
 try{
  const frame=createPlayerMovement().step({x:-6,y:0});
  assert.throws(()=>e.step(),/canonical 60Hz/);
  assert.throws(()=>e.step({...frame,tick:2}),/canonical 60Hz/);
  assert.equal(e.snapshot().tick,0);
  const wrong=frame.players.map((p,i)=>i===9?{...p,id:'away-10'}:p);
  assert.throws(()=>e.step({...frame,players:wrong}),/bounded physical player step/);
  const teleport=frame.players.map((p,i)=>i===9?{...p,x:p.x+1}:p);
  assert.throws(()=>e.step({...frame,players:teleport}),/bounded physical player step/);
  const badNaN=frame.players.map((p,i)=>i===9?{...p,y:NaN}:p);
  assert.throws(()=>e.step({...frame,players:badNaN}),/bounded physical player step/);
  const bogusTime={...frame,timeS:frame.timeS+.02};
  assert.throws(()=>e.step(bogusTime),/canonical 60Hz/);
  assert.equal(e.snapshot().tick,0);
  const valid=e.step(frame);
  assert.equal(valid.tick,1);
  assert.throws(()=>e.step(frame),/canonical 60Hz/);
  assert.equal(e.snapshot().tick,1);
 }finally{e.dispose();}
});

test('ME-PB-02 experiment is replayable with identical real 22-player kinematics and collision events',()=>{
 const left=run(roll,true,180),right=run(roll,true,180);
 assert.deepEqual(left.trace,right.trace);
 assert.deepEqual(left.contacts,right.contacts);
 assert.deepEqual(left.players,right.players);
 assert.ok(left.contacts.some(x=>x.started.length>0));
 const cold=createEngine(RAPIER,roll,{diagnosticPlayerFootContactsEnabled:true});
 try{
  const reset=cold.reset();
  try{
   assert.equal(reset.snapshot().tick,0);
   assert.deepEqual(reset.footContactSnapshot(),cold.footContactSnapshot?.()??{
     version:FOOT_CONTACT_VERSION,tick:0,started:[],ended:[],active:[]
   });
   assert.deepEqual(Object.keys(reset.footContactSnapshot()),
     ['version','tick','started','ended','active','onsetBallDeltaVelocityMps']);
   assert.equal(reset.footContactTimelineSnapshot().tick,0);
   assert.deepEqual(reset.footContactTimelineSnapshot().ongoing,[]);
   assert.equal(reset.footContactSolverSnapshot().tick,0);
   assert.deepEqual(reset.footContactSolverSnapshot().pairs,[]);
   assert.equal(reset.footContactMomentumAuditSnapshot().tick,0);
   assert.equal(reset.footContactMomentumAuditSnapshot().ballDeltaLinearMomentumWorldNs,null);
   assert.equal(reset.footContactQualificationSnapshot().tick,0);
   assert.equal(reset.footContactQualificationSnapshot().category,'none');
  }finally{reset.dispose();}
 }finally{cold.dispose();}
});

test('ME-PB-02 physics frame and valid foot positions stay 60Hz without changing approved player fields',()=>{
 assert.equal(FIXED_DT,PLAYER_DT);
 const e=createEngine(RAPIER,roll,{diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement();
 try{
  const initial=Object.keys(mover.snapshot().players[0]);
  for(let tick=1;tick<=120;tick++){
   const next=mover.step(e.snapshot().ball.position),ball=e.step(next);
   assert.equal(ball.tick,next.tick);
   assert.equal(ball.time,next.timeS);
   assert.deepEqual(Object.keys(next.players[0]),initial);
  }
  assert.ok(Object.isFrozen(e.footContactSnapshot()));
 }finally{e.dispose();}
});

test('ME-PB-03 oriented rounded shoe geometry follows canonical Home/Away facing, not body-center sphere',()=>{
 const home=INITIAL_PLAYERS.find(p=>p.id==='home-10');
 const away=INITIAL_PLAYERS.find(p=>p.id==='away-10');
 const h=footProxyTransform(home),a=footProxyTransform(away);
 assert.ok(FOOT_CONTACT_HALF_LENGTH_M*2+FOOT_CONTACT_ROUNDING_M*2>=0.20);
 assert.ok(FOOT_CONTACT_HALF_WIDTH_M*2+FOOT_CONTACT_ROUNDING_M*2<=0.18);
 assert.ok(FOOT_CONTACT_HALF_HEIGHT_M*2+FOOT_CONTACT_ROUNDING_M*2<0.15);
 assert.ok(Math.abs(h.x-home.x-FOOT_CONTACT_FORWARD_OFFSET_M)<1e-10);
 assert.ok(Math.abs(a.x-away.x+FOOT_CONTACT_FORWARD_OFFSET_M)<1e-10);
 assert.ok(Math.abs(h.y-home.y)<1e-10);
 assert.ok(Math.abs(a.y-away.y)<1e-10);
 assert.equal(h.rotation.w,1);
 assert.ok(Math.abs(a.rotation.w)<1e-10);
 assert.ok(Math.abs(a.rotation.z-1)<1e-10);
 assert.ok(Object.isFrozen(h)&&Object.isFrozen(h.rotation));
 const side=footProxyTransform({x:5,y:3,facingRad:Math.PI/2});
 assert.ok(Math.abs(side.x-5)<1e-10);
 assert.ok(Math.abs(side.y-3-FOOT_CONTACT_FORWARD_OFFSET_M)<1e-10);
});

test('ME-PB-03 forbids spoofed facing, instant 180 degree foot turns and malformed quaternions',()=>{
 const world=createPlayerMovement(),prev=initialFootPositions();
 const frame=world.step({x:0,y:0,z:BALL_RADIUS});
 const base=validateFootContactFrame(frame,1,prev);
 assert.equal(base.length,22);
 const change=p=>frame.players.map((q,i)=>i===9?{...q,...p}:q);
 for(const bad of [{facingRad:Math.PI},{facingRad:Infinity},
   {facingRad:NaN},{facingRad:-3.4}]){
  assert.throws(()=>validateFootContactFrame({...frame,players:change(bad)},1,prev),
    /bounded physical player step and facing/);
 }
 assert.throws(()=>footProxyTransform({x:0,y:0,facingRad:NaN}),/canonical tactical facing/);
 assert.throws(()=>footProxyTransform({x:0,y:0,facingRad:Infinity}),/canonical tactical facing/);
});

test('ME-PB-03 restitution sensitivity is bounded and impossible without explicit opt-in',()=>{
 assert.equal(FOOT_CONTACT_RESTITUTION_RANGE.min,0);
 assert.ok(FOOT_CONTACT_RESTITUTION_RANGE.max<=0.35);
 const invalid=[-0.01,0.36,NaN,Infinity,'0.25'];
 for(const diagnosticFootRestitution of invalid){
  assert.throws(()=>createEngine(RAPIER,roll,{
   diagnosticPlayerFootContactsEnabled:true,diagnosticFootRestitution
  }),/bounded/);
 }
 assert.throws(()=>createEngine(RAPIER,roll,{
  diagnosticPlayerFootContactsEnabled:false,diagnosticFootRestitution:0
 }),/requires explicit foot-collider opt-in/);
});

test('ME-PB-03 real rounded foot contact onset measures Rapier ball delta-v, not invented kick',()=>{
 const r=run(roll,true,95);
 const onsets=r.contacts.filter(q=>q.started.length);
 assert.ok(onsets.some(q=>q.started.includes('home-10')));
 assert.ok(onsets.some(q=>q.onsetBallDeltaVelocityMps>0.01));
 for(const q of r.contacts){
  assert.ok(Object.isFrozen(q));
  assert.equal(Object.hasOwn(q,'kickStrength'),false);
  assert.equal(Object.hasOwn(q,'possessor'),false);
  if(q.started.length===0)assert.equal(q.onsetBallDeltaVelocityMps,null);
 }
});

test('ME-PB-03 measured collision response changes under a bounded material comparison',()=>{
 const soft=run(roll,true,95,FOOT_CONTACT_RESTITUTION_RANGE.min);
 const firm=run(roll,true,95,FOOT_CONTACT_RESTITUTION_RANGE.max);
 assert.ok(soft.contacts.some(q=>q.started.includes('home-10')));
 assert.ok(firm.contacts.some(q=>q.started.includes('home-10')));
 assert.ok(Math.abs(soft.last.ball.position.x-firm.last.ball.position.x)>0.001,
  'same incoming ball and real 22-player frames must yield different Rapier response');
 assert.deepEqual(soft.players[0],firm.players[0],
  'player state at collision test start must not depend on chosen foot material');
});
