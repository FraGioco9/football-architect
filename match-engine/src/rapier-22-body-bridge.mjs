// #628 Phase M7 — explicit same-world Rapier 22-body research observer.
// No other world, fake collision, ball/shoe interaction or football authority.
// Source motion remains the accepted 60 Hz canonical kinematic mover;
// native dynamic responses are measured but NOT fed back into that mover.
import {INITIAL_PLAYERS,PLAYER_RADIUS_M,PLAYER_MIN_SEPARATION_M,
 PLAYER_MAX_SPEED_MPS,PLAYER_VERSION,PLAYER_DT} from './player-movement.mjs';

const BODY_INTERACTION_GROUP=0x00200020; // body category 0x20 vs itself ONLY
const BODY_Z_M=1;
const COLLIDER_RADIUS_M=PLAYER_MIN_SEPARATION_M/2;
const MAX_RECORDED_EVENTS=40;
const xyz=p=>Object.freeze({x:p.x,y:p.y,z:p.z});
const finite=Number.isFinite;
const pair=(a,b)=>[a,b].sort().join('|');

export function createPrivateRapier22BodyBridge(R,world,initialPlayers=INITIAL_PLAYERS,
 {controlledEncounter=false}={}){
 if(typeof controlledEncounter!=='boolean')
  throw new TypeError('Research encounter flag must be boolean');
 if(!R||typeof R.EventQueue!=='function'||!R.ColliderDesc||
    !world||typeof world.createRigidBody!=='function')
  throw new TypeError('Current original Rapier World required');
 if(!Array.isArray(initialPlayers)||initialPlayers.length!==22||
    initialPlayers.some((p,i)=>p.id!==INITIAL_PLAYERS[i].id||
     p.team!==INITIAL_PLAYERS[i].team||
     !finite(p.x)||!finite(p.y)||!finite(p.vx)||!finite(p.vy)))
  throw new TypeError('Canonical ordered 22 real player samples required');
 // Small, explicitly disclosed 2cm total collision skin in M8 only:
 // physical impact BEFORE canonical 0.98m hard separation rejection.
 // M7 and default colliders remain unchanged.
 const radiusM=controlledEncounter?0.51:COLLIDER_RADIUS_M;
 const events=new R.EventQueue(true);
 const bodies=[],colliders=[],byHandle=new Map();
 for(const p of initialPlayers){
  // Zero gravity on this one body, not on the ball or the shared World.
  const rigid=world.createRigidBody(R.RigidBodyDesc.dynamic()
   .setTranslation(p.x,p.y,BODY_Z_M)
   .setGravityScale(0)
   .setCcdEnabled(true));
  const collider=world.createCollider(R.ColliderDesc.ball(radiusM)
   .setDensity(60).setFriction(0.6).setRestitution(0)
   .setCollisionGroups(BODY_INTERACTION_GROUP)
   .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),rigid);
  bodies.push(rigid);colliders.push(collider);
  byHandle.set(collider.handle,p.id);
 }
 let current=initialPlayers.map(p=>Object.freeze({
  id:p.id,team:p.team,x:p.x,y:p.y,vx:p.vx,vy:p.vy
 }));
 let tick=0,prepared=null,disposed=false,lastAcceptedTick=0;
 let appliedMoverResponses=0;
 const activePairs=new Set();
 let totalStarts=0,totalEnds=0,lastTickStarts=0,lastTickEnds=0;
 const timeline=[];
 function requireLive(){if(disposed)throw new Error('Rapier body bridge disposed');}
 function snapshot(){
  requireLive();
  const players=bodies.map((body,i)=>{
   const position=xyz(body.translation()),velocity=xyz(body.linvel());
   return Object.freeze({
    id:INITIAL_PLAYERS[i].id,team:INITIAL_PLAYERS[i].team,
    position,velocity,
    canonical:Object.freeze({x:current[i].x,y:current[i].y}),
    driftM:Math.hypot(position.x-current[i].x,position.y-current[i].y)
   });
  });
  let minPhysicalGapM=Infinity;
  for(let i=0;i<22;i++)for(let j=i+1;j<22;j++){
   const a=players[i].position,b=players[j].position;
   minPhysicalGapM=Math.min(minPhysicalGapM,
    Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z));
  }
  return Object.freeze({
   tick,physicalActors:Object.freeze(players),
   actualNativeStarts:totalStarts,actualNativeEnds:totalEnds,
   currentTickStarts:lastTickStarts,currentTickEnds:lastTickEnds,
   events:Object.freeze([...timeline]),
   activePairs:Object.freeze([...activePairs].sort()),
   controlledEncounter,
   minPhysicalGapM,
   maxCanonicalDriftM:Math.max(...players.map(p=>p.driftM)),
   collisionColliderRadiusM:radiusM,
   sameOriginalRapierBallWorld:true,
   physicalPositionsFedBackIntoMover:appliedMoverResponses>0,
   appliedMoverResponses,
   physicallyAuthoritativeMatchWorld:false,
   verifiedMatchBodyCollision:false,
   officialTackle:false,officialInterception:false,
   officialPossession:false,officialResult:null
  });
 }
 function prepare(frame,nextTick){
  requireLive();
  if((controlledEncounter&&lastAcceptedTick!==tick)||
     prepared!==null||!Number.isSafeInteger(nextTick)||
     nextTick!==tick+1||
     !Array.isArray(frame?.players)||frame.players.length!==22||
     frame.tick!==nextTick||frame.version!==PLAYER_VERSION)
   throw new TypeError('One ordered current 60 Hz canonical frame required');
  const samples=frame.players;
  for(let i=0;i<22;i++){
   const p=samples[i];
   if(!p||p.id!==INITIAL_PLAYERS[i].id||
      p.team!==INITIAL_PLAYERS[i].team||
      p.role!==INITIAL_PLAYERS[i].role||
      ![p.x,p.y,p.vx,p.vy,p.facingRad].every(finite)||
      Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-7||
      Math.abs(p.x-current[i].x-p.vx*PLAYER_DT)>1e-6||
      Math.abs(p.y-current[i].y-p.vy*PLAYER_DT)>1e-6)
    throw new TypeError('Invalid canonical player motion or order');
  }
  // The input is the original *measured* velocity, not a guessed target.
  // Rapier's dynamic solver is free to change this velocity upon contact.
  for(let i=0;i<22;i++){
   const p=samples[i];
   bodies[i].setLinvel({x:p.vx,y:p.vy,z:0},true);
  }
  current=samples.map(p=>Object.freeze({
   id:p.id,team:p.team,x:p.x,y:p.y,vx:p.vx,vy:p.vy
  }));
  prepared=nextTick;
 }
 function observe(observedTick){
  requireLive();
  if(prepared!==observedTick||observedTick!==tick+1)
   throw new TypeError('One genuine post-step Rapier body event sample required');
  lastTickStarts=0;lastTickEnds=0;
  events.drainCollisionEvents((a,b,began)=>{
   const idA=byHandle.get(a),idB=byHandle.get(b);
   if(!idA||!idB||idA===idB)
    throw new Error('Unexpected non-body collision in isolated interaction group');
   const recorded=Object.freeze({
    tick:observedTick,pair:pair(idA,idB),
    type:began?'rapier-body-start':'rapier-body-end',
    source:'native-rapier-collision-event'
   });
   timeline.push(recorded);
   if(began)activePairs.add(recorded.pair);
   else activePairs.delete(recorded.pair);
   if(timeline.length>MAX_RECORDED_EVENTS)timeline.shift();
   if(began){totalStarts++;lastTickStarts++;}
   else{totalEnds++;lastTickEnds++;}
  });
  tick=observedTick;prepared=null;
  return snapshot();
 }
 // After the actual solver step, acknowledge the independently
 // validated canonical response (which may reject an unsafe correction).
 // Never reposition a physical body or generate a collision here.
 function acknowledgeCanonicalResponse(frame){
  requireLive();
  if(!controlledEncounter||prepared!==null||
     lastAcceptedTick!==tick-1||frame?.tick!==tick||
     frame.version!==PLAYER_VERSION||frame.players?.length!==22)
   throw new TypeError('One same-tick original mover response required');
  const accepted=frame.players.map((p,i)=>{
   const body=INITIAL_PLAYERS[i];
   if(p.id!==body.id||p.team!==body.team||
      ![p.x,p.y,p.vx,p.vy].every(finite))
    throw new TypeError('Canonical acknowledgment order mismatch');
   return Object.freeze({id:p.id,team:p.team,
    x:p.x,y:p.y,vx:p.vx,vy:p.vy});
  });
  if(frame.lastPhysicalReconciliation?.tick===tick&&
     frame.lastPhysicalReconciliation.accepted===true)
   appliedMoverResponses++;
  current=accepted;
  lastAcceptedTick=tick;
  return snapshot();
 }
 function dispose(){
  if(!disposed){
   disposed=true;
   events.free();
   // Bodies/colliders belong to the shared world and are freed by world.free().
  }
 }
 return Object.freeze({snapshot,prepare,observe,dispose,eventQueue:events,
  ...(controlledEncounter?{acknowledgeCanonicalResponse}:{})
 });
}
