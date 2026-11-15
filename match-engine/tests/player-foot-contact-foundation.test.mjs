// Physical shoe-contact extraction from #481: genuine Rapier 3D evidence.
// This is an isolated validation fixture, NOT a second gameplay runtime,
// shooter, pass completion, tackle decision or official possession source.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,
 BALL_RADIUS,BALL_MASS_KG,BALL_INERTIA_KG_M2,GRAVITY}
 from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_DT,createPlayerMovement}
 from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M,FOOT_CONTACT_FRICTION,
 FOOT_CONTACT_RESTITUTION,initialFootPositions,footProxyTransform,
 validateFootContactFrame} from '../src/player-foot-contact.mjs';
import {createFootContactTimeline,FOOT_CONTACT_TIMELINE_VERSION}
 from '../src/player-foot-contact-timeline.mjs';
import {summarizeFootSolverEvidence,FOOT_SOLVER_EVIDENCE_VERSION}
 from '../src/player-foot-contact-solver.mjs';

const ordered=items=>Object.freeze(INITIAL_PLAYERS.filter(p=>
 items.has(p.id)).map(p=>p.id));

function realRapierFootStep(R,team){
 const actor=INITIAL_PLAYERS.find(p=>p.id===team+'-10');
 const facing=footProxyTransform(actor);
 const ballAt={
  x:facing.x+0.20*Math.cos(actor.facingRad),
  y:facing.y+0.20*Math.sin(actor.facingRad),z:BALL_RADIUS
 };
 const world=new R.World(GRAVITY);
 world.timestep=PLAYER_DT;
 const queue=new R.EventQueue(true);
 try{
  world.createCollider(R.ColliderDesc.cuboid(52.5,34,0.2)
   .setTranslation(0,0,-0.2).setFriction(0.65));
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic()
   .setTranslation(ballAt.x,ballAt.y,ballAt.z)
   .setCcdEnabled(true));
  const ball=world.createCollider(R.ColliderDesc.ball(BALL_RADIUS)
   .setMassProperties(BALL_MASS_KG,{x:0,y:0,z:0},
    {x:BALL_INERTIA_KG_M2,y:BALL_INERTIA_KG_M2,z:BALL_INERTIA_KG_M2},
    {w:1,x:0,y:0,z:0})
   .setFriction(0.45).setRestitution(0.62),body);
  const shoes=new Map(),lookup=new Map();
  for(const p of INITIAL_PLAYERS){
   const pose=footProxyTransform(p);
   const foot=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pose.x,pose.y,pose.z).setRotation(pose.rotation));
   const collider=world.createCollider(R.ColliderDesc.roundCuboid(
    FOOT_CONTACT_HALF_LENGTH_M,FOOT_CONTACT_HALF_WIDTH_M,
    FOOT_CONTACT_HALF_HEIGHT_M,FOOT_CONTACT_ROUNDING_M)
    .setFriction(FOOT_CONTACT_FRICTION)
    .setRestitution(FOOT_CONTACT_RESTITUTION)
    .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|
     R.ActiveEvents.CONTACT_FORCE_EVENTS),foot);
   shoes.set(p.id,{body:foot,collider});
   lookup.set(collider.handle,p.id);
  }
  assert.equal(shoes.size,22);
  const mover=createPlayerMovement();
  const frame=mover.step({x:ballAt.x,y:ballAt.y});
  const feet=validateFootContactFrame(frame,1,initialFootPositions());
  for(let i=0;i<feet.length;i++){
   const pose=footProxyTransform(feet[i]),shoe=shoes.get(INITIAL_PLAYERS[i].id);
   shoe.body.setNextKinematicTranslation({x:pose.x,y:pose.y,z:pose.z});
   shoe.body.setNextKinematicRotation(pose.rotation);
  }
  const preBall={position:{...body.translation()},velocity:{...body.linvel()}};
  world.step(queue); // only Rapier, NOT distance-derived or invented contact
  const starts=new Set(),ends=new Set();
  queue.drainCollisionEvents((a,b,began)=>{
   const other=a===ball.handle?b:b===ball.handle?a:null;
   const id=lookup.get(other);
   if(!id)return; // reject shoe-shoe collisions and floor contacts
   if(began)starts.add(id);else ends.add(id);
  });
  const collision=Object.freeze({
   version:FOOT_CONTACT_VERSION,tick:1,
   started:ordered(starts),ended:ordered(ends),active:ordered(starts),
   onsetBallDeltaVelocityMps:starts.size?Math.hypot(
    body.linvel().x-preBall.velocity.x,
    body.linvel().y-preBall.velocity.y,
    body.linvel().z-preBall.velocity.z):null
  });
  const timeline=createFootContactTimeline();
  const evidence=timeline.observe(collision,preBall,feet);
  const forces=[];
  queue.drainContactForceEvents(event=>{
   const a=event.collider1(),b=event.collider2();
   const other=a===ball.handle?b:b===ball.handle?a:null;
   const id=lookup.get(other);
   if(!id)return;
   const f=event.totalForce(),max=event.maxForceDirection();
   forces.push({id,totalForceWorldN:{x:f.x,y:f.y,z:f.z},
    totalForceMagnitudeN:event.totalForceMagnitude(),
    maxContactForceMagnitudeN:event.maxForceMagnitude(),
    maxContactForceDirectionWorld:{x:max.x,y:max.y,z:max.z}});
  });
  const manifolds=[];
  for(const p of INITIAL_PLAYERS){
   const shoe=shoes.get(p.id);
   world.contactPair(ball,shoe.collider,(m,flipped)=>{
    if(!m.numContacts()&&!m.numSolverContacts())return;
    const n=m.normal();
    manifolds.push({id:p.id,flipped,normalWorld:{x:n.x,y:n.y,z:n.z},
     geometricContacts:m.numContacts(),solverContacts:m.numSolverContacts()});
   });
  }
  const solver=summarizeFootSolverEvidence(collision,forces,manifolds);
  return Object.freeze({collision,evidence,solver,
   postBall:{x:body.translation().x,y:body.translation().y,
    z:body.translation().z}});
 }finally{queue.free();world.free();}
}

test('genuine Rapier 60Hz shoe START, immutable timeline and solver for HOME/AWAY',
 {timeout:30000},async()=>{
 const R=await initializeRapier(rapier);
 for(const team of ['home','away']){
  const first=realRapierFootStep(R,team);
  assert.equal(first.collision.tick,1);
  assert.deepEqual(first.collision.started,[team+'-10'],
   team+' shoe START must come exclusively from the real Rapier event queue');
  assert.deepEqual(first.collision.active,[team+'-10']);
  assert.deepEqual(first.collision.ended,[]);
  assert.equal(first.evidence.version,FOOT_CONTACT_TIMELINE_VERSION);
  assert.equal(first.evidence.tick,1);
  assert.equal(first.evidence.onsets.length,1);
  assert.equal(first.evidence.onsets[0].id,team+'-10');
  assert.equal(first.evidence.ongoing[0].observedTicks,1);
  assert.equal(first.solver.version,FOOT_SOLVER_EVIDENCE_VERSION);
  assert.equal(first.solver.tick,1);
  assert.ok(first.solver.pairs.some(p=>p.id===team+'-10'));
  assert.ok(Object.isFrozen(first.collision));
  assert.ok(Object.isFrozen(first.evidence));
  assert.ok(Object.isFrozen(first.solver));
  assert.deepEqual(realRapierFootStep(R,team),first,
   'independent 22-foot Rapier source must replay deterministically');
 }
});

test('foot-contact frame refuses spoofed actor, time gap and impossible teleport',()=>{
 const mover=createPlayerMovement();
 const frame=mover.step({x:0,y:0}),previous=initialFootPositions();
 assert.equal(validateFootContactFrame(frame,1,previous).length,22);
 const spoof={...frame,players:frame.players.map((p,i)=>
  i===0?{...p,id:'forged-player'}:p)};
 assert.throws(()=>validateFootContactFrame(spoof,1,previous),TypeError);
 assert.throws(()=>validateFootContactFrame(frame,2,previous),TypeError);
 const teleport={...frame,players:frame.players.map((p,i)=>
  i===0?{...p,x:p.x+20}:p)};
 assert.throws(()=>validateFootContactFrame(teleport,1,previous),TypeError);
 const timeline=createFootContactTimeline();
 assert.throws(()=>timeline.observe({
  version:FOOT_CONTACT_VERSION,tick:1,
  started:['home-10'],active:[],ended:[]
 },{position:{x:0,y:0,z:BALL_RADIUS},
  velocity:{x:0,y:0,z:0}},previous),RangeError);
 // Shape validation is not authentication of an externally supplied list.
 // Only the private closed Rapier producer may provide true shoe authority.
});

test('opt-in production core reuses ONE genuine Rapier world for shoe events, default remains off',
 {timeout:30000},async()=>{
 const R=await initializeRapier(rapier);
 for(const team of ['home','away']){
  const actor=INITIAL_PLAYERS.find(p=>p.id===team+'-10');
  const pose=footProxyTransform(actor);
  const x=pose.x+0.20*Math.cos(actor.facingRad);
  const y=pose.y+0.20*Math.sin(actor.facingRad);
  const scenario={preset:'roll',seed:'contact-core-'+team,
   x,y,z:0,vx:0,vy:0,vz:0};
  const ordinary=createEngine(R,scenario);
  const withShoes=createEngine(R,scenario,{
   diagnosticPlayerFootContactsEnabled:true
  });
  const replay=createEngine(R,scenario,{
   diagnosticPlayerFootContactsEnabled:true
  });
  try{
   assert.equal('footContactSnapshot' in ordinary,false);
   assert.equal('footContactSnapshot' in withShoes,true);
   assert.equal(withShoes.footContactSnapshot().tick,0);
   assert.throws(()=>ordinary.step({
    version:'claimed-shoe-frame',tick:1
   }),TypeError,'ordinary accepted core rejects external shoe frames');
   const mover=createPlayerMovement();
   const moverReplay=createPlayerMovement();
   const one=mover.step({x,y});
   const two=moverReplay.step({x,y});
   const frame=withShoes.step(one);
   const echo=replay.step(two);
   const feed=withShoes.footContactSnapshot();
   assert.equal(frame.tick,1);
   assert.equal(feed.tick,1);
   assert.deepEqual(feed.started,[team+'-10'],
    'source MUST be current genuine internal Rapier collider START');
   assert.deepEqual(feed.active,[team+'-10']);
   assert.deepEqual(withShoes.footContactTimelineSnapshot().onsets
    .map(x=>x.id),[team+'-10']);
   assert.equal(withShoes.footContactSolverSnapshot().tick,1);
   assert.equal(withShoes.footContactSolverSnapshot().pairs
    .some(x=>x.id===team+'-10'),true);
   assert.equal(canonicalSnapshot(frame),canonicalSnapshot(echo));
   assert.deepEqual(feed,replay.footContactSnapshot());
   assert.throws(()=>withShoes.step({
    ...one,tick:3
   }),TypeError,'stale/forged next-tick frame must not advance Rapier');
   assert.equal(withShoes.snapshot().tick,1);
   assert.equal(ordinary.step().tick,1);
   assert.equal('footContactSnapshot' in ordinary,false);
   assert.equal(ordinary.snapshot().version,frame.version);
   const restarted=withShoes.reset();
   try{
    assert.equal(restarted.footContactSnapshot().tick,0);
    assert.equal(restarted.snapshot().tick,0);
   }finally{restarted.dispose();}
  }finally{
   ordinary.dispose();
   withShoes.dispose();
   replay.dispose();
  }
 }
});
