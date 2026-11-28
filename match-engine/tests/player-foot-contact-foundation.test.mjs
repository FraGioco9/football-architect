// Physical shoe-contact extraction from #481: genuine Rapier 3D evidence.
// This is an isolated validation fixture, NOT a second gameplay runtime,
// shooter, pass completion, tackle decision or official possession source.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,
 BALL_RADIUS,BALL_MASS_KG,BALL_INERTIA_KG_M2,GRAVITY,nativeBallGroundContactProfile}
 from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_DT,createPlayerMovement}
 from '../src/player-movement.mjs';
import {FOOT_CONTACT_VERSION,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M,FOOT_CONTACT_FRICTION,
 FOOT_CONTACT_RESTITUTION,initialFootPositions,footProxyTransform,
 validateFootContactFrame} from '../src/player-foot-contact.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {createPrivateRapierFootContactBridge,usesNativePairedShoeBridge,hasExclusiveNativeShoeStart,soloCarryTwoFootPositions,planNativeFirstTimeFootRecovery,nativeFirstTimeRecoveryTarget,nativeShoeContactProfile,nativePairedCarryReadout} from '../src/rapier-foot-contact-bridge.mjs';
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

test('ME-01-QA U-01E3: paired bridge eligibility and physical foot authorization',()=>{
 for(const team of ['home','away']){
  const id=team+'-10',ids=[id],pair={actorId:id,independentColliders:2,exclusivePhysicalStart:true,started:['right'],active:['right']};
  assert.equal(usesNativePairedShoeBridge({activePlayerIds:ids}),true);
  assert.equal(usesNativePairedShoeBridge({activePlayerIds:ids,legacyGroundCarry:true}),false);
  assert.equal(usesNativePairedShoeBridge({activePlayerIds:ids,soloCarryAdapter:true}),true);
  assert.equal(usesNativePairedShoeBridge({activePlayerIds:ids,firstTimeShot:true}),true);
  assert.equal(usesNativePairedShoeBridge({activePlayerIds:[]}),false);
  assert.equal(usesNativePairedShoeBridge({}),false);
  const c={started:ids,active:ids,nativePairedFeet:{[id]:pair}};
  assert.equal(hasExclusiveNativeShoeStart(c,id),true);
  for(const invalid of [{actorId:'other'},{independentColliders:1},{started:['other'],active:['other']},{started:null},{active:[]},{exclusivePhysicalStart:false}]){
   assert.equal(hasExclusiveNativeShoeStart({...c,nativePairedFeet:{[id]:{...pair,...invalid}}},id),false);
  }
  assert.equal(hasExclusiveNativeShoeStart({...c,nativePairedFeet:null},id),false);
 }
});

test('ME-01-QA U-01E3: selected native actors have exactly two physical shoe colliders each', {timeout:30000},async()=>{
 const R=await initializeRapier(rapier);
 for(const team of ['home','away']){
  for(const count of [1,2,7,22]){
   const active= count===22?INITIAL_PLAYERS.map(p=>p.id):INITIAL_PLAYERS.filter(p=>p.team===team).slice(0,count).map(p=>p.id);
   const world=new R.World(GRAVITY);
   let bridge;
   try{
    const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,0,4));
    const ball=world.createCollider(R.ColliderDesc.ball(BALL_RADIUS),body);
    bridge=createPrivateRapierFootContactBridge(R,world,ball,INITIAL_PLAYERS,{activePlayerIds:active,nativeCarryStride:true,isolatedPhysicalBodies:count===22,fullFieldNative:count===22});
    assert.deepEqual(bridge.physicalColliderIds,INITIAL_PLAYERS.filter(p=>active.includes(p.id)).map(p=>p.id));
    assert.equal(bridge.physicalShoeColliderCount,2*count);
    assert.equal(world.colliders.len(),2*count+1);
   }finally{bridge?.dispose();world.free();}
  }
 }
});

test('ME-01-QA U-01E4: first-time recovery follows only the authenticated physical striking foot',()=>{
 for(const team of ['home','away'])for(const foot of ['left','right'])for(const direction of [-1,1]){
  const actorId=team+'-10',pose={x:team==='home'?30:-30,y:direction*.1,z:.09},ballPosition={x:pose.x,y:0,z:.11};
  const pair={actorId,independentColliders:2,exclusivePhysicalStart:true,started:[foot],active:[foot],exclusiveFootPosition:pose};
  const contact={started:[actorId],active:[actorId],nativePairedFeet:{[actorId]:pair}};
  const plan=planNativeFirstTimeFootRecovery({contact,actorId,ballPosition});
  assert.deepEqual(plan,{foot,direction});
  assert.equal(planNativeFirstTimeFootRecovery({contact:{...contact,nativePairedFeet:{[actorId]:{...pair,active:['left','right']}}},actorId,ballPosition}),null);
  assert.equal(planNativeFirstTimeFootRecovery({contact:{...contact,nativePairedFeet:{[actorId]:{...pair,exclusiveFootPosition:null}}},actorId,ballPosition}),null);
  let prev=pose;
  for(let age=1;age<=6;age++){
   const target=nativeFirstTimeRecoveryTarget(pose,foot,plan,age);
   assert.equal(target.x,pose.x);assert.equal(target.z,pose.z);
   assert.ok(Math.abs(target.y-prev.y)<=.100000001);
   assert.equal(nativeFirstTimeRecoveryTarget(pose,foot==='left'?'right':'left',plan,age),pose);
   prev=target;
  }
  assert.deepEqual(prev,pose);
  assert.equal(nativeFirstTimeRecoveryTarget(pose,foot,plan,7),pose);
 }
});

test('ME-01-QA U-01E5a: common native material with explicit archived carry exception',()=>{
 const normal=nativeBallGroundContactProfile(),archived=nativeBallGroundContactProfile(true);
 assert.deepEqual(normal,{groundRestitution:.62,ballRestitution:.62,groundFriction:.65,ballFriction:.45});
 assert.deepEqual(archived,{...normal,groundRestitution:0,ballRestitution:0});
 assert.throws(()=>nativeBallGroundContactProfile('carry-solo'),/Boolean/);
 const standard=nativeShoeContactProfile();
 assert.deepEqual(nativeShoeContactProfile({researchScale:true}),standard);
 const old=nativeShoeContactProfile({legacyGround:true});
 assert.equal(old.restitution,0);assert.equal(old.halfHeightM,.015);
 for(const widthScale of [.9,1,1.1])for(const lengthScale of [.9,1,1.05,1.075,1.1]){
  const scaled=nativeShoeContactProfile({researchScale:true,widthScale,lengthScale});
  assert.deepEqual(scaled,{...standard,halfWidthM:standard.halfWidthM*widthScale,halfLengthM:standard.halfLengthM*lengthScale});
 }
 assert.throws(()=>nativeShoeContactProfile({widthScale:1.1}),/geometry/);
});

test('ME-01-QA U-01E5b: current isolated duels use paired shoes; archive is explicit', {timeout:30000},async()=>{
 const R=await initializeRapier(rapier);
 for(const shotSide of ['home','away'])for(const directedDribble of [false,true])for(const historicalCarryPhysics of [false,true]){
  const lab=createControlledActionLab(R,'dribble-1v1',{shotSide,directedDribble,bodyGuardEnabled:directedDribble,historicalCarryPhysics});
  try{
   const first=lab.snapshot(),next=lab.step();
   for(const frame of [first,next]){
    assert.equal(frame.physicalShoeColliderCount,historicalCarryPhysics?2:4);
    assert.equal(frame.nativeContactMaterial.historicalCarryPhysics,historicalCarryPhysics);
    assert.equal(frame.nativeContactMaterial.ballRestitution,historicalCarryPhysics?0:.62);
    assert.equal(frame.nativeContactMaterial.shoe.restitution,historicalCarryPhysics?0:.12);
    assert.equal(frame.smallSidedParticipants.length,2);
   }
  }finally{lab.dispose();}
 }
});

test('ME-01-QA U-01F7: paired carry diagnostic is a read-only projection of actual foot evidence',()=>{
 for(const team of ['home','away'])for(const foot of ['left','right']){
  const id=team+'-10',ids=[id];
  const pair=Object.freeze({actorId:id,independentColliders:2,started:[foot],active:[foot],ended:[],exclusivePhysicalStart:true});
  const readout=nativePairedCarryReadout(pair,{actorId:id,independentColliders:2,nativeObservedGaitFrequencyHz:2,exclusivePhysicalStart:false});
  assert.equal(readout.started,pair.started);assert.equal(readout.active,pair.active);
  assert.equal(readout.exclusivePhysicalStart,true);
  assert.equal(readout.source,'rapier-physical-collider-events');assert.ok(Object.isFrozen(readout));
  assert.equal(hasExclusiveNativeShoeStart({started:ids,active:ids,nativePairedFeet:{[id]:pair},nativeSoloFeet:readout},id),true);
  assert.equal(hasExclusiveNativeShoeStart({started:ids,active:ids,nativePairedFeet:{[id]:{...pair,active:['left','right']}},nativeSoloFeet:readout},id),false);
  assert.throws(()=>nativePairedCarryReadout(null,{actorId:id}),/Actual paired/);
 }
});
