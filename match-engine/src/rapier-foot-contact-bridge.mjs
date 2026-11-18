// #624 - opt-in private 22-shoe Rapier bridge for the EXISTING ball world.
// This module creates no world, assigns no player movement and never kicks.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {soloCarryPhaseConfiguration} from './solo-carry-phases.mjs';
import {FOOT_CONTACT_VERSION,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_FORWARD_OFFSET_M,
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
 // #628 D01-GAIT-01: current 60Hz canonical stride + REAL pre-step Rapier
 // ball position/velocity. This is a foot target only, never a collision,
 // impulse, synthetic START/END, possession or ball correction.
 const gaitClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 export function advanceD01LiveShoeGait({phaseRad,player,ball,tick,solo=false,
  carryPhase=null}={}){
  if(typeof solo!=='boolean'||!Number.isInteger(tick)||tick<1||
     !Number.isFinite(phaseRad)||phaseRad<0||phaseRad>=2*Math.PI||
     !player||!ball?.position||!ball?.velocity||
     ![player.x,player.y,player.vx,player.vy,player.facingRad,
       ball.position.x,ball.position.y,ball.position.z,
       ball.velocity.x,ball.velocity.y,ball.velocity.z]
       .every(Number.isFinite))
   throw new TypeError('Only real consecutive 60Hz canonical player and Rapier ball may cue D-01 shoe');
  const cos=Math.cos(player.facingRad),sin=Math.sin(player.facingRad);
  const relX=ball.position.x-player.x,relY=ball.position.y-player.y;
  const aheadM=relX*cos+relY*sin;
  const lateralM=-relX*sin+relY*cos;
  const speedMps=Math.hypot(player.vx,player.vy);
  // Do not increase the fixed mechanical frequency blindly. Respond smoothly
  // to REAL observed speed and preserve a true full release stroke.
  const cue=solo&&carryPhase!==null?
   soloCarryPhaseConfiguration(carryPhase):null;
  const frequencyHz=solo?
   (cue?cue.shoeFrequencyBaseHz+cue.shoeFrequencySpeedHz*
    gaitClamp(speedMps/4,0,1):1.35+0.35*gaitClamp(speedMps/4,0,1)):
   2.45+0.25*gaitClamp(speedMps/4,0,1);
  const nextPhase=(phaseRad+2*Math.PI*frequencyHz/60)%(2*Math.PI);
  const stroke=-Math.cos(nextPhase);
  // At the original .50–.70m player/ball gap, a modest forward approach
  // reduces missed shoes; backing stroke remains unchanged for native END.
  const approachM=gaitClamp((aheadM-0.53)*0.40,0,0.055)*
   Math.max(0,stroke);
  const forwardM=(solo?(cue?.shoeForwardStrokeM??0.075):0.105)*stroke+
   approachM;
  const sideM=gaitClamp(lateralM*0.20,-0.03,0.03)*
   Math.max(0,stroke);
  return Object.freeze({
   phaseRad:nextPhase,frequencyHz,forwardM,sideM,
   ...(cue?{carryPhase}:{}),
   observedSpeedMps:speedMps,observedAheadM:aheadM,
   observedLateralM:lateralM,observedBallSpeedMps:
    Math.hypot(ball.velocity.x,ball.velocity.y),
   nativeShoeEventCreated:false,ballImpulseCreated:false,
   possessionAssigned:false
  });
 }


export function createPrivateRapierFootContactBridge(R,world,ballCollider,
 initialPlayers=INITIAL_PLAYERS,{sharedQueue=null,activePlayerIds=null,
 isolatedPhysicalBodies=false,isolatedGroundDribbleBallCentreZ=null,
 dribbleAttackerId=null,soloCarry=false}={}){
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
 if(sharedQueue!==null&&
    (typeof sharedQueue.drainCollisionEvents!=='function'||
     typeof sharedQueue.drainContactForceEvents!=='function'))
  throw new TypeError('Native shared Rapier event queue required');
 // A small-sided study must exclude unused Rapier shoe COLLIDERS,
 // rather than merely hiding them on the canvas. The canonical 22-person
 // motion frame still undergoes the same validation on every physics tick.
 if(typeof isolatedPhysicalBodies!=='boolean'||
    (isolatedPhysicalBodies&&activePlayerIds===null))
  throw new TypeError('Body-isolated shoe groups require selected small-sided players');
 if(activePlayerIds!==null&&(!Array.isArray(activePlayerIds)||
   activePlayerIds.length<1||activePlayerIds.length>7||
   new Set(activePlayerIds).size!==activePlayerIds.length||
   activePlayerIds.some(id=>!INITIAL_PLAYERS.some(p=>p.id===id))))
  throw new TypeError('Genuine small-sided source needs 2–7 unique physical shoes');
 if(isolatedGroundDribbleBallCentreZ!==null&&(
    !Number.isFinite(isolatedGroundDribbleBallCentreZ)||
    isolatedGroundDribbleBallCentreZ<0.09||
    isolatedGroundDribbleBallCentreZ>0.13||
    ![1,2].includes(activePlayerIds?.length)))
  throw new TypeError('Only isolated 1v1 original ground-ball shoe height');
 if((dribbleAttackerId===null)!==(isolatedGroundDribbleBallCentreZ===null)||
   (dribbleAttackerId!==null&&(
    !activePlayerIds?.includes(dribbleAttackerId)||
    !/^(home|away)-10$/.test(dribbleAttackerId))))
  throw new TypeError('Original D-01 attacker only for native Rapier foot stride');
 if(typeof soloCarry!=='boolean'||(soloCarry&&(
    activePlayerIds?.length!==1||dribbleAttackerId===null||
    activePlayerIds[0]!==dribbleAttackerId)))
  throw new TypeError('Solo shoe stride needs exactly one original actor');
 const physicalIds=activePlayerIds===null?null:new Set(activePlayerIds);
 const eventQueue=sharedQueue??new R.EventQueue(true);
 const ownsEventQueue=sharedQueue===null;
 const colliders=[],bodies=[],idsByCollider=new Map();
 // One REAL kinematic shoe; the new observed source adapts its motion only,
 // preserving the existing native collider and 7m/s shoe continuity guard.
 function shoeFeet(frame,stepTick,gait=null){
  if(dribbleAttackerId===null)return frame;
  const swingM=gait?.forwardM??-0.105*Math.cos(2*Math.PI*stepTick/24);
  const lateralM=gait?.sideM??0;
  return Object.freeze(frame.map((p,i)=>{
   if(initialPlayers[i].id!==dribbleAttackerId)return p;
   const c=Math.cos(p.facingRad),s=Math.sin(p.facingRad);
   return Object.freeze({...p,
    x:p.x+swingM*c-lateralM*s,
    y:p.y+swingM*s+lateralM*c});
  }));
 }
 const stagedFeet=shoeFeet(initialPlayers,0);
 for(const p of stagedFeet){
  const pose=footProxyTransform(p);
  const groundPose=isolatedGroundDribbleBallCentreZ===null?pose:
   {...pose,z:isolatedGroundDribbleBallCentreZ+0.018};
  const body=world.createRigidBody(
   R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(groundPose.x,groundPose.y,groundPose.z)
     .setRotation(pose.rotation));
  const shoeShape=R.ColliderDesc.roundCuboid(
   FOOT_CONTACT_HALF_LENGTH_M,FOOT_CONTACT_HALF_WIDTH_M,
   isolatedGroundDribbleBallCentreZ===null?FOOT_CONTACT_HALF_HEIGHT_M:0.015,
   isolatedGroundDribbleBallCentreZ===null?FOOT_CONTACT_ROUNDING_M:0.01)
   .setFriction(FOOT_CONTACT_FRICTION)
   .setRestitution(isolatedGroundDribbleBallCentreZ===null?
    FOOT_CONTACT_RESTITUTION:0)
   .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|
    R.ActiveEvents.CONTACT_FORCE_EVENTS);
  if(sharedQueue!==null||isolatedPhysicalBodies)
   shoeShape.setCollisionGroups(0x00010001);
  const collider=physicalIds===null||physicalIds.has(p.id)?
   world.createCollider(shoeShape,body):null;
  bodies.push(body);colliders.push(collider);
  if(collider)idsByCollider.set(collider.handle,p.id);
 }
 const timeline=createFootContactTimeline(stagedFeet);
 let positions=Object.freeze(initialPlayers.map(p=>
  Object.freeze({x:p.x,y:p.y,facingRad:p.facingRad}))),
  tick=0,disposed=false;
 let actualShoeFeet=stagedFeet;
 let gaitPhaseRad=0;
 let active=new Set(),solver=null;
 let current=Object.freeze({
  version:FOOT_CONTACT_VERSION,tick:0,
  started:empty,ended:empty,active:empty,
  onsetBallDeltaVelocityMps:null
 });
 const live=()=>{if(disposed)throw new Error('Rapier contact bridge disposed');};
 function prepare(playerFrame,nextTick,preStepBall=null){
  live();
  if(nextTick!==tick+1)throw new RangeError('Nonconsecutive physical shoe tick');
  // Validate ALL actors, headings and physical displacement before mutation.
  const next=validateFootContactFrame(playerFrame,nextTick,positions);
  const actor=dribbleAttackerId===null?null:
   playerFrame.players.find(p=>p.id===dribbleAttackerId);
  const gait=actor?advanceD01LiveShoeGait({
   phaseRad:gaitPhaseRad,player:actor,ball:preStepBall,tick:nextTick,solo:soloCarry,
   carryPhase:soloCarry?playerFrame.soloCarryPhase?.phase:null
  }):null;
  const proposed=shoeFeet(next,nextTick,gait);
  // The whole shoe also moves when its owner turns or advances. Clamp the
  // actual Rapier kinematic collider trajectory, NOT the canonical player,
  // to the original physical 7m/s ceiling (one 60Hz tick = 0.1167m).
  // This is a real, continuous shoe pose: no new START/END, impulse, or ball
  // ownership is synthesized.
  const newFeet=dribbleAttackerId===null?proposed:
   Object.freeze(proposed.map((foot,i)=>{
    if(initialPlayers[i].id!==dribbleAttackerId)return foot;
    const prior=footProxyTransform(actualShoeFeet[i]);
    const desired=footProxyTransform(foot);
    const dx=desired.x-prior.x,dy=desired.y-prior.y;
    const travelled=Math.hypot(dx,dy);
    const maxM=7/60-1e-6;
    if(travelled<=maxM)return foot;
    const fraction=maxM/travelled;
    return Object.freeze({...foot,
     x:prior.x+dx*fraction-
      FOOT_CONTACT_FORWARD_OFFSET_M*Math.cos(foot.facingRad),
     y:prior.y+dy*fraction-
      FOOT_CONTACT_FORWARD_OFFSET_M*Math.sin(foot.facingRad)});
   }));
  const poses=newFeet.map(footProxyTransform);
  for(let i=0;i<poses.length;i++){
   const p=poses[i];
   if(initialPlayers[i].id===dribbleAttackerId){
    const previous=footProxyTransform(actualShoeFeet[i]);
    if(Math.hypot(p.x-previous.x,p.y-previous.y)>7/60+1e-5)
     throw new TypeError('D-01 real shoe exceeds original 7m/s continuity');
   }
   bodies[i].setNextKinematicTranslation({x:p.x,y:p.y,
    z:isolatedGroundDribbleBallCentreZ===null?p.z:
      isolatedGroundDribbleBallCentreZ+0.018});
   bodies[i].setNextKinematicRotation(p.rotation);
  }
  positions=next;actualShoeFeet=newFeet;
  if(gait)gaitPhaseRad=gait.phaseRad;
 }
 function observe(nextTick,priorBall,postBall,sharedEvents=null){
  live();
  if(nextTick!==tick+1||!priorBall?.position||!priorBall?.velocity||
     !postBall?.position||!postBall?.velocity)
   throw new RangeError('Consecutive actual pre/post Rapier states required');
  const started=new Set(),ended=new Set(),next=new Set(active);
  const visitCollision=(a,b,began)=>{
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const id=idsByCollider.get(other);
   if(!id)return; // no turf, no proxy-to-proxy contact
   if(began){started.add(id);next.add(id);}
   else{ended.add(id);next.delete(id);}
  };
  if(sharedEvents===null)eventQueue.drainCollisionEvents(visitCollision);
  else{
   if(!Array.isArray(sharedEvents.collisions))
    throw new TypeError('One genuine native shared collision sample required');
   for(const e of sharedEvents.collisions)
    visitCollision(e.a,e.b,e.started);
  }
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
  const observedTimeline=timeline.observe(collision,priorBall,actualShoeFeet);
  const forces=[];
  const visitForce=(a,b,f,d,totalMagnitude,maxMagnitude)=>{
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const id=idsByCollider.get(other);
   if(!id)return;
   forces.push({id,totalForceWorldN:vector(f),
    totalForceMagnitudeN:totalMagnitude,
    maxContactForceMagnitudeN:maxMagnitude,
    maxContactForceDirectionWorld:vector(d)});
  };
  if(sharedEvents===null)eventQueue.drainContactForceEvents(e=>
   visitForce(e.collider1(),e.collider2(),e.totalForce(),
    e.maxForceDirection(),e.totalForceMagnitude(),e.maxForceMagnitude()));
  else{
   if(!Array.isArray(sharedEvents.forces))
    throw new TypeError('One genuine native shared force sample required');
   for(const e of sharedEvents.forces)
    visitForce(e.a,e.b,e.force,e.direction,
     e.magnitude,e.maxMagnitude);
  }
  const relevant=new Set([...next,...started,...ended,...forces.map(x=>x.id)]);
  const manifolds=[];
  for(let i=0;i<INITIAL_PLAYERS.length;i++){
   const id=INITIAL_PLAYERS[i].id;
   if(!relevant.has(id)||colliders[i]===null)continue;
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
 function dispose(){if(!disposed){
  disposed=true;
  if(ownsEventQueue)eventQueue.free();
 }}
 return Object.freeze({
  eventQueue,prepare,observe,dispose,
  physicalColliderIds:Object.freeze(initialPlayers.filter(p=>
   physicalIds===null||physicalIds.has(p.id)).map(p=>p.id)),
  snapshot:()=>{live();return current;},
  timeline:()=>{live();return timeline.snapshot();},
  solver:()=>{live();return solver;}
 });
}
