// #624 - opt-in private 22-shoe Rapier bridge for the EXISTING ball world.
// This module creates no world, assigns no player movement and never kicks.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_CONTACT_VERSION,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M,FOOT_CONTACT_FRICTION,
 FOOT_CONTACT_RESTITUTION,footProxyTransform,
 validateFootContactFrame} from './player-foot-contact.mjs';
import {createFootContactTimeline} from './player-foot-contact-timeline.mjs';
import {summarizeFootSolverEvidence} from './player-foot-contact-solver.mjs';

const empty=Object.freeze([]);
const ordered=set=>Object.freeze(INITIAL_PLAYERS
 .filter(p=>set.has(p.id)).map(p=>p.id));
const vector=p=>Object.freeze({x:p.x,y:p.y,z:p.z});

export function createPrivateRapierFootContactBridge(R,world,ballCollider,initialPlayers=INITIAL_PLAYERS){
 if(!R||typeof R.EventQueue!=='function'||!world||
    typeof world.createRigidBody!=='function'||
    !ballCollider||ballCollider.handle===undefined||
    ballCollider.handle===null)
  throw new TypeError('Existing private Rapier ball world and collider required');
 if(!Array.isArray(initialPlayers)||initialPlayers.length!==INITIAL_PLAYERS.length||
    initialPlayers.some((p,i)=>!p||p.id!==INITIAL_PLAYERS[i].id||
     p.team!==INITIAL_PLAYERS[i].team||p.role!==INITIAL_PLAYERS[i].role||
     ![p.x,p.y,p.facingRad].every(Number.isFinite)||
     Math.abs(p.x)>52.5||Math.abs(p.y)>34))
  throw new TypeError('Ordered canonical 22-player initial shoes required');
 const eventQueue=new R.EventQueue(true);
 const colliders=[],bodies=[],idsByCollider=new Map();
 for(const p of initialPlayers){
  const pose=footProxyTransform(p);
  const body=world.createRigidBody(
   R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pose.x,pose.y,pose.z).setRotation(pose.rotation));
  const collider=world.createCollider(R.ColliderDesc.roundCuboid(
   FOOT_CONTACT_HALF_LENGTH_M,FOOT_CONTACT_HALF_WIDTH_M,
   FOOT_CONTACT_HALF_HEIGHT_M,FOOT_CONTACT_ROUNDING_M)
   .setFriction(FOOT_CONTACT_FRICTION)
   .setRestitution(FOOT_CONTACT_RESTITUTION)
   .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|
    R.ActiveEvents.CONTACT_FORCE_EVENTS),body);
  bodies.push(body);colliders.push(collider);
  idsByCollider.set(collider.handle,p.id);
 }
 const timeline=createFootContactTimeline();
 let positions=Object.freeze(initialPlayers.map(p=>
  Object.freeze({x:p.x,y:p.y,facingRad:p.facingRad}))),
  tick=0,disposed=false;
 let active=new Set(),solver=null;
 let current=Object.freeze({
  version:FOOT_CONTACT_VERSION,tick:0,
  started:empty,ended:empty,active:empty,
  onsetBallDeltaVelocityMps:null
 });
 const live=()=>{if(disposed)throw new Error('Rapier contact bridge disposed');};
 function prepare(playerFrame,nextTick){
  live();
  if(nextTick!==tick+1)throw new RangeError('Nonconsecutive physical shoe tick');
  // Validate ALL actors, headings and physical displacement before mutation.
  const next=validateFootContactFrame(playerFrame,nextTick,positions);
  const poses=next.map(footProxyTransform);
  for(let i=0;i<poses.length;i++){
   const p=poses[i];
   bodies[i].setNextKinematicTranslation({x:p.x,y:p.y,z:p.z});
   bodies[i].setNextKinematicRotation(p.rotation);
  }
  positions=next;
 }
 function observe(nextTick,priorBall,postBall){
  live();
  if(nextTick!==tick+1||!priorBall?.position||!priorBall?.velocity||
     !postBall?.position||!postBall?.velocity)
   throw new RangeError('Consecutive actual pre/post Rapier states required');
  const started=new Set(),ended=new Set(),next=new Set(active);
  eventQueue.drainCollisionEvents((a,b,began)=>{
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const id=idsByCollider.get(other);
   if(!id)return; // no turf, no proxy-to-proxy contact
   if(began){started.add(id);next.add(id);}
   else{ended.add(id);next.delete(id);}
  });
  const dv=Math.hypot(
   postBall.velocity.x-priorBall.velocity.x,
   postBall.velocity.y-priorBall.velocity.y,
   postBall.velocity.z-priorBall.velocity.z
  );
  const collision=Object.freeze({
   version:FOOT_CONTACT_VERSION,tick:nextTick,
   started:ordered(started),ended:ordered(ended),active:ordered(next),
   // Whole-ball delta includes gravity/turf; never shoe attribution.
   onsetBallDeltaVelocityMps:started.size?dv:null
  });
  const observedTimeline=timeline.observe(collision,priorBall,positions);
  const forces=[];
  eventQueue.drainContactForceEvents(e=>{
   const a=e.collider1(),b=e.collider2();
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const id=idsByCollider.get(other);
   if(!id)return;
   const f=e.totalForce(),d=e.maxForceDirection();
   forces.push({id,totalForceWorldN:vector(f),
    totalForceMagnitudeN:e.totalForceMagnitude(),
    maxContactForceMagnitudeN:e.maxForceMagnitude(),
    maxContactForceDirectionWorld:vector(d)});
  });
  const relevant=new Set([...next,...started,...ended,...forces.map(x=>x.id)]);
  const manifolds=[];
  for(let i=0;i<INITIAL_PLAYERS.length;i++){
   const id=INITIAL_PLAYERS[i].id;
   if(!relevant.has(id))continue;
   world.contactPair(ballCollider,colliders[i],(m,flipped)=>{
    const geometricContacts=m.numContacts(),solverContacts=m.numSolverContacts();
    if(!geometricContacts&&!solverContacts)return;
    manifolds.push({id,flipped,normalWorld:vector(m.normal()),
     geometricContacts,solverContacts});
   });
  }
  const observedSolver=summarizeFootSolverEvidence(
   collision,forces,manifolds);
  tick=nextTick;active=next;current=collision;solver=observedSolver;
  return Object.freeze({collision,timeline:observedTimeline,solver});
 }
 function dispose(){if(!disposed){disposed=true;eventQueue.free();}}
 return Object.freeze({
  eventQueue,prepare,observe,dispose,
  snapshot:()=>{live();return current;},
  timeline:()=>{live();return timeline.snapshot();},
  solver:()=>{live();return solver;}
 });
}
