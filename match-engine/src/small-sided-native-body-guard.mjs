import {attackDirection,validateAttackPolarity} from './match-directions.mjs';
// #628 LAB-VAR-02B — isolated native physical lower-leg/body collisions.
// SAME original Rapier world and step. Only selected small-sided actors have
// native colliders. 22 canonical mover identities remain authoritative for
// movement; no second physics world, artificial collision/possession or kick.
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_DT,PLAYER_MAX_SPEED_MPS}
 from './player-movement.mjs';
import {chooseRecipient} from './player-ball-uniform-autonomous-action.mjs';
import {createNativeFundamentalMask,nativeFundamentalAllowed,nativeAerialSurfaceAllowed,nativeKeeperSequenceDeliveryAllowed,nativeKeeperSequenceClaimAllowed} from './native-fundamental-mask.mjs';
import {planNativeKeeperHighIntercept,NATIVE_HIGH_HAND_MAX_Z} from './small-sided-lab-scenarios.mjs';

export const SMALL_SIDED_BODY_VERSION='me-628-native-physical-body-guard-v1';
const TORSO_CATEGORY=0x0020,LEG_CATEGORY=0x0040,BALL_CATEGORY=0x0001;
const TORSO_RADIUS_M=0.51,LEG_RADIUS_M=0.28,LEG_CENTRE_Z_M=0.43;
// D-01 canonical collision-safe 0.98m separation must also be native
// collision-safe: former twin 0.51m torso radii overlapped by 0.04m.
// This avoids artificial solver separation near the original ball while
// keeping all real opponent torso, leg, shoe and ball colliders enabled.
export const D01_TORSO_RADIUS_M=0.49;
const TORSO_OFFSET_Z_M=0.57;
const finite=Number.isFinite;
const freeze=Object.freeze;
const idPair=(a,b)=>[a,b].sort().join('|');


// ME-01 AERIAL-01: provisional bounded vertical head reach, shared by
// all enabled outfield players. Not an articulated whole-body jump,
// heading action, or assertion of a won aerial duel.
export const NATIVE_AERIAL_VERSION='me-628-native-aerial-head-v1';
export const AERIAL_JUMP_TICKS=42;
export const AERIAL_HEAD_REST_Z_M=1.72;
export const AERIAL_JUMP_RISE_M=0.55;
const AERIAL_HEAD_RADIUS_M=0.13,AERIAL_RECOVERY_TICKS=18;
export function aerialHeadHeight(elapsed){
 if(!Number.isSafeInteger(elapsed)||elapsed<0||elapsed>AERIAL_JUMP_TICKS)throw new RangeError('Bounded aerial jump tick required');
 return AERIAL_HEAD_REST_Z_M+AERIAL_JUMP_RISE_M*Math.sin(Math.PI*elapsed/AERIAL_JUMP_TICKS);
}
export function planNativeAerialJump(actor,ball){
 const p=ball?.position,v=ball?.velocity;
 if(!actor||actor.role==='goalkeeper'||![actor.x,actor.y,actor.vx,actor.vy,p?.x,p?.y,p?.z,v?.x,v?.y,v?.z].every(finite)||
    p.z<1.55||p.z>4.5||v.z>=-0.15||Math.hypot(v.x,v.y)>25)return null;
 // Predict reach only; actual contact must be observed from Rapier.
 for(let k=6;k<=AERIAL_JUMP_TICKS-6;k++){
  const t=k*PLAYER_DT,z=p.z+v.z*t-4.905*t*t;
  const gap=Math.hypot(p.x+v.x*t-(actor.x+actor.vx*t),p.y+v.y*t-(actor.y+actor.vy*t));
  if(gap<=0.20&&Math.abs(z-aerialHeadHeight(k))<=0.12)
   return freeze({actorId:actor.id,expectedTickOffset:k,decisionOnly:true});
 }
 return null;
}
// Shared source arbitration. A contested simultaneous manifold never
// grants either participant the exclusive action or referee last touch.
export function exclusiveNativeAerialStart(evidence,shoeStarts=[],shoeActive=[],conflict=false){
 const contacts=(evidence??[]).filter(s=>s.contact);
 if(conflict||shoeStarts.length||shoeActive.length||contacts.length!==1)return null;
 const hit=contacts[0];
 return hit.contactStarted===true&&hit.actualNativeSolverContact===true&&hit.sameOriginalRapierWorld===true?hit:null;
}
// Read-only contested-contact classification, not a possession or score.
export function observeNativeAerialDuel({tick,evidence,players,action}={}){
 if(!Number.isSafeInteger(tick)||!Array.isArray(evidence)||!Array.isArray(players))return null;
 const heads=evidence.filter(s=>s.version===NATIVE_AERIAL_VERSION&&s.tick===tick);
 const contacts=heads.filter(s=>s.contact&&s.actualNativeSolverContact===true&&s.sameOriginalRapierWorld===true);
 if(!contacts.some(s=>s.contactStarted))return null;
 const actors=contacts.map(s=>players.find(p=>p.id===s.actorId&&p.team===s.team)).filter(Boolean);
 const contested=actors.some(p=>players.some(q=>q.team!==p.team&&q.role!=='goalkeeper'&&Math.hypot(p.x-q.x,p.y-q.y)<=1.6));
 if(!contested)return null;
 const exclusive=exclusiveNativeAerialStart(evidence);
 const winner=exclusive&&action?.nativeExclusiveHeadStart===true&&action.tick===tick&&action.playerId===exclusive.actorId&&action.appliedByRapier===true&&action.actualPhysicsImpulseApplied===true?exclusive:null;
 return freeze({tick,kind:winner?'exclusive-header':contacts.length>1?'ambiguous-contact':'contested-contact',
  actorId:winner?.actorId??null,team:winner?.team??null,contactIds:freeze(contacts.map(s=>s.actorId)),officialPossession:false,officialMatchResult:null});
}
export function createNativeAerialHead(R,world,ballCollider,actor){
 const head=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(actor.x,actor.y,AERIAL_HEAD_REST_Z_M).setCcdEnabled(true));
 const collider=world.createCollider(R.ColliderDesc.ball(AERIAL_HEAD_RADIUS_M)
  .setFriction(0.25).setRestitution(0.25).setCollisionGroups(0),head);
 let jumpStart=null,recoverUntil=0,prepared=null,lastTick=0,previousContact=false;
 function prepare(player,tick,ball,deadBall=false){
  if(prepared!==null||tick!==lastTick+1||player?.id!==actor.id||player.team!==actor.team)
   throw new TypeError('Native aerial head needs consecutive canonical ticks');
  if(deadBall){jumpStart=null;recoverUntil=tick+AERIAL_RECOVERY_TICKS;}
  let started=false;
  if(!deadBall&&jumpStart===null&&tick>=recoverUntil&&planNativeAerialJump(player,ball)){
   jumpStart=tick;started=true;
  }
  const elapsed=jumpStart===null?null:tick-jumpStart+1;
  const active=elapsed!==null&&elapsed<=AERIAL_JUMP_TICKS;
  if(!active&&jumpStart!==null){jumpStart=null;recoverUntil=tick+AERIAL_RECOVERY_TICKS;}
  const target={x:player.x,y:player.y,z:active?aerialHeadHeight(elapsed):AERIAL_HEAD_REST_Z_M};
  collider.setCollisionGroups(active?(LEG_CATEGORY<<16)|BALL_CATEGORY:0);
  head.setNextKinematicTranslation(target);
  prepared={tick,active,started,elapsed:active?elapsed:null,incomingVelocity:freeze({...ball.velocity})};
 }
 function observe(tick){
  if(prepared?.tick!==tick)throw new TypeError('Native aerial evidence requires original post-step solver tick');
  let contact=false;
  if(prepared.active)world.contactPair(ballCollider,collider,m=>{
   if(m.numContacts()>0&&m.numSolverContacts()>0)contact=true;
  });
  const point=head.translation();
  const result=freeze({version:NATIVE_AERIAL_VERSION,tick,actorId:actor.id,team:actor.team,
   surface:'head',incomingVelocity:prepared.incomingVelocity,
   jumping:prepared.active,jumpStarted:prepared.started,jumpElapsedTicks:prepared.elapsed,
   headPosition:freeze({x:point.x,y:point.y,z:point.z}),
   contact,contactStarted:contact&&!previousContact,actualNativeSolverContact:contact,
   sameOriginalRapierWorld:true,physicalHeaderActionApplied:false,officialPossession:false,officialMatchResult:null});
  previousContact=contact;lastTick=tick;prepared=null;return result;
 }
 return freeze({prepare,observe});
}

// AERIAL-03: independent, opt-in physical receiving surfaces. A prediction
// enables a reachable body part, never a ball touch or possession.
export const NATIVE_AERIAL_CONTROL_VERSION='me-628-native-aerial-control-v1';
export const AERIAL_CONTROL_HEIGHT=freeze({chest:1.35,foot:0.85});
export function planNativeAerialControl(actor,ball,surface){
 const z=AERIAL_CONTROL_HEIGHT[surface],p=ball?.position,v=ball?.velocity;
 if(!z||!actor||actor.role==='goalkeeper'||![actor.x,actor.y,actor.vx,actor.vy,p?.x,p?.y,p?.z,v?.x,v?.y,v?.z].every(finite)||
    v.z>=-0.15||p.z<z-0.20||p.z>4.5||Math.hypot(v.x,v.y)>25)return null;
 // The raised foot must follow the immediate reachable ball, rather than
 // jumping between a predicted future crossing and the resting body.
 // Plan a receiving reach from live geometry; keep the same solver gate.
 if(surface==='foot'){
  const disc=v.z*v.z+19.62*(p.z-z);
  const eta=disc>=0?(v.z+Math.sqrt(disc))/9.81:NaN;
  if(!finite(eta)||eta>0.30||p.z<z-0.20)return null;
  const t=Math.max(PLAYER_DT,eta),px=p.x+v.x*t,py=p.y+v.y*t;
  const predictedGap=Math.hypot(px-actor.x-actor.vx*Math.max(0,t-PLAYER_DT),py-actor.y-actor.vy*Math.max(0,t-PLAYER_DT));
  if(predictedGap>0.78)return null;
  const dx=p.x+v.x*PLAYER_DT-actor.x,dy=p.y+v.y*PLAYER_DT-actor.y;
  const gap=Math.hypot(dx,dy),reach=0.62;
  // With a slow ball and low relative approach speed, a player can lift
  // the receiving foot slightly to meet the descent before it escapes.
  // Spend the same reach budget in 3D; never enlarge the collider or
  // change fast delivery/volley mechanics.
  const slow=Math.hypot(v.x,v.y)<=4&&Math.hypot(v.x-actor.vx,v.y-actor.vy)<=1.5;
  const nextHeight=p.z+v.z*PLAYER_DT-4.905*PLAYER_DT*PLAYER_DT;
  const lift=slow?Math.max(0,Math.min(0.12,nextHeight-z-0.18)):0;
  const offset=Math.min(Math.sqrt(reach*reach-lift*lift),gap);
  return freeze({surface,actorId:actor.id,dx:gap>1e-8?dx/gap*offset:0,dy:gap>1e-8?dy/gap*offset:0,targetZ:z+lift,decisionOnly:true});
 }
 for(let k=1;k<=18;k++){
  const t=k*PLAYER_DT,h=p.z+v.z*t-4.905*t*t;
  const dx=p.x+v.x*t-actor.x-actor.vx*t,dy=p.y+v.y*t-actor.y-actor.vy*t;
  const gap=Math.hypot(dx,dy),reach=surface==='chest'?0.32:0.55;
  if(Math.abs(h-z)<=0.16&&gap<=reach+0.12){
   const offset=Math.min(reach,gap);
   return freeze({surface,actorId:actor.id,dx:gap>1e-8?dx/gap*offset:0,dy:gap>1e-8?dy/gap*offset:0,decisionOnly:true});
  }
 }
 return null;
}
export function createNativeAerialControl(R,world,ballCollider,actor,surface){
 const z=AERIAL_CONTROL_HEIGHT[surface];
 if(!z)throw new TypeError('Known aerial receiving surface required');
 const rigid=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(actor.x,actor.y,z).setCcdEnabled(true));
 const collider=world.createCollider(R.ColliderDesc.ball(surface==='chest'?0.19:0.14)
  .setFriction(0.2).setRestitution(0).setCollisionGroups(0),rigid);
 let prepared=null,lastTick=0,previousContact=false,recoverUntil=0;
 function prepare(player,tick,ball,deadBall=false,headPriority=false){
  if(prepared||tick!==lastTick+1||player?.id!==actor.id||player.team!==actor.team)
   throw new TypeError('Native aerial receiving surface requires consecutive canonical ticks');
  const plan=!deadBall&&!headPriority&&tick>=recoverUntil?planNativeAerialControl(player,ball,surface):null;
  collider.setCollisionGroups(plan?(LEG_CATEGORY<<16)|BALL_CATEGORY:0);
  rigid.setNextKinematicTranslation({x:player.x+(plan?.dx??0),y:player.y+(plan?.dy??0),z:plan?.targetZ??z});
  prepared={tick,plan,incomingVelocity:freeze({...ball.velocity}),incomingPosition:freeze({...ball.position})};
 }
 function observe(tick){
  if(prepared?.tick!==tick)throw new TypeError('Native receiving surface needs current solver tick');
  let contact=false;
  if(prepared.plan)world.contactPair(ballCollider,collider,manifold=>{
   if(manifold.numContacts()>0&&manifold.numSolverContacts()>0)contact=true;
  });
  const contactStarted=contact&&!previousContact;
  if(contactStarted)recoverUntil=tick+18;
  const surfacePosition=freeze({...rigid.translation()}),ballCentre=freeze({...ballCollider.translation()});
  // Geometric proximity is diagnostic only, never a substitute for a
  // solver manifold or proof of a receiving action.
  const result=freeze({version:NATIVE_AERIAL_CONTROL_VERSION,surface,tick,actorId:actor.id,team:actor.team,
   contact,contactStarted,actualNativeSolverContact:contact,incomingVelocity:prepared.incomingVelocity,
   incomingPosition:prepared.incomingPosition,surfacePosition,ballCentre,
   centreGapM:Math.hypot(ballCentre.x-surfacePosition.x,ballCentre.y-surfacePosition.y,ballCentre.z-surfacePosition.z),
   reachPlanned:prepared.plan!==null,
   sameOriginalRapierWorld:true,officialPossession:false});
  previousContact=contact;lastTick=tick;prepared=null;return result;
 }
 return freeze({prepare,observe});
}
// One mass-aware cushion on the real ball after exclusive solver contact.
// No possession, attachment, position mutation or automatic second touch.
export function planNativeAerialCushion({surface,incoming,velocity,massKg,actor}={}){
 if(!AERIAL_CONTROL_HEIGHT[surface]||!actor||![incoming?.x,incoming?.y,incoming?.z,velocity?.x,velocity?.y,velocity?.z,massKg,actor.vx,actor.vy].every(finite)||
    massKg<=0||incoming.z>=-0.15)return null;
 // A raised foot drops the ball gently towards the turf; when the solver
 // has already removed most speed, do not accelerate the ball to a preset.
 const relativeSpeed=Math.hypot(velocity.x-actor.vx,velocity.y-actor.vy,velocity.z);
 const down=surface==='chest'?1.4:Math.min(0.65,relativeSpeed*0.45);
 // Preserve the original chest response. A foot cushion instead follows
 // the receiver horizontally and reduces relative motion in every axis.
 const blend=surface==='chest'?0.65:1;
 const desired={x:actor.vx*blend,y:actor.vy*blend,z:-down};
 const raw={x:massKg*(desired.x-velocity.x),y:massKg*(desired.y-velocity.y),z:massKg*(desired.z-velocity.z)};
 const magnitude=Math.hypot(raw.x,raw.y,raw.z),scale=Math.min(1,5/Math.max(magnitude,1e-9));
 if(magnitude<0.025)return null;
 const impulseNs=freeze({x:raw.x*scale,y:raw.y*scale,z:raw.z*scale});
 const result={x:velocity.x+impulseNs.x/massKg,y:velocity.y+impulseNs.y/massKg,z:velocity.z+impulseNs.z/massKg};
 if(Math.hypot(result.x-actor.vx,result.y-actor.vy,result.z)>=Math.hypot(velocity.x-actor.vx,velocity.y-actor.vy,velocity.z))return null;
 return freeze({impulseNs,decisionOnly:true,officialPossession:false});
}
export function createSmallSidedNativeBodyGuard(R,world,ballCollider,
 initialPlayers,activePlayerIds,{feedbackEnabled=false,
  dribbleGroundBallCentreZ=null,fullFieldNative=false,aerialEnabled=false,aerialSurface='all',allowedFundamentals=null}={}){
 const mask=createNativeFundamentalMask(allowedFundamentals);
 if(!['all','head','chest','foot'].includes(aerialSurface))throw new TypeError('Known aerial training restriction required');
 if(typeof aerialEnabled!=='boolean'||aerialEnabled&&(!feedbackEnabled||dribbleGroundBallCentreZ!==null))
  throw new TypeError('Native aerial research requires original guarded movement feedback');
 if(typeof fullFieldNative!=='boolean'||fullFieldNative&&(activePlayerIds?.length!==22||feedbackEnabled!==true||dribbleGroundBallCentreZ!==null))throw new TypeError('Full field requires all 22 native bodies and canonical feedback');
 if(typeof feedbackEnabled!=='boolean')
  throw new TypeError('LAB feedback option must be a boolean');
 if(dribbleGroundBallCentreZ!==null&&(!Number.isFinite(dribbleGroundBallCentreZ)||
   dribbleGroundBallCentreZ<0.09||dribbleGroundBallCentreZ>0.13||
   ![1,2].includes(activePlayerIds?.length)))
  throw new TypeError('D-01 low-level ball/leg source requires genuine 1v1');
 if(!R?.RigidBodyDesc||!R?.ColliderDesc||
    typeof world?.createRigidBody!=='function'||
    typeof world?.contactPair!=='function'||
    ballCollider?.handle===undefined||
    !Array.isArray(initialPlayers)||initialPlayers.length!==22||
    !Array.isArray(activePlayerIds)||activePlayerIds.length<1||
    activePlayerIds.length>(fullFieldNative?22:7)||
    new Set(activePlayerIds).size!==activePlayerIds.length||
    initialPlayers.some((p,i)=>p?.id!==INITIAL_PLAYERS[i].id||
      p.team!==INITIAL_PLAYERS[i].team||
      ![p.x,p.y,p.vx,p.vy].every(finite))||
    activePlayerIds.some(id=>!INITIAL_PLAYERS.some(p=>p.id===id)))
  throw new TypeError('Only selected original small-sided bodies in same Rapier world');
 const active=new Set(activePlayerIds);
 const entries=[];
 for(const actor of initialPlayers){
  if(!active.has(actor.id))continue;
  const rigid=world.createRigidBody(R.RigidBodyDesc.dynamic()
   .setTranslation(actor.x,actor.y,LEG_CENTRE_Z_M)
   .setGravityScale(0).setCcdEnabled(true));
  // Upper torso: native, mutually colliding selected human bodies ONLY.
  const torso=world.createCollider(R.ColliderDesc.ball(
    dribbleGroundBallCentreZ===null?TORSO_RADIUS_M:D01_TORSO_RADIUS_M)
   .setTranslation(0,0,TORSO_OFFSET_Z_M)
   .setDensity(35).setFriction(0.6).setRestitution(0)
   .setCollisionGroups((TORSO_CATEGORY<<16)|TORSO_CATEGORY),rigid);
  // Lower leg: can physically deflect the existing ball, but never touch
  // shoe colliders. Body contact is not automatically "ball protection".
  const leg=world.createCollider(R.ColliderDesc.ball(dribbleGroundBallCentreZ===null?LEG_RADIUS_M:0.14)
   .setTranslation(0,0,dribbleGroundBallCentreZ===null?0:
    dribbleGroundBallCentreZ+0.018-LEG_CENTRE_Z_M)
   .setDensity(80).setFriction(0.7).setRestitution(0)
   .setCollisionGroups((LEG_CATEGORY<<16)|BALL_CATEGORY),rigid);
  entries.push({id:actor.id,team:actor.team,rigid,torso,leg,
   head:aerialEnabled&&actor.role!=='goalkeeper'&&['all','head'].includes(aerialSurface)&&nativeAerialSurfaceAllowed(mask,'head')?createNativeAerialHead(R,world,ballCollider,actor):null,
   controls:aerialEnabled&&actor.role!=='goalkeeper'?['chest','foot'].filter(surface=>(aerialSurface==='all'||aerialSurface===surface)&&nativeAerialSurfaceAllowed(mask,surface)).map(surface=>createNativeAerialControl(R,world,ballCollider,actor,surface)):[]});
 }
 if(entries.length!==activePlayerIds.length)
  throw new Error('Selected physical body identity mismatch');
 let tick=0,prepared=null,disposed=false,previousBallIds=new Set();
 let lastAcceptedTick=0;
 let latest=null,prior=initialPlayers.map(p=>({id:p.id,x:p.x,y:p.y}));
 function requireLive(){if(disposed)throw new Error('Physical body guard disposed');}
 function snapshot(){requireLive();return latest;}
 function prepare(frame,nextTick,ball=null,deadBall=false){
  requireLive();
  if(aerialEnabled&&(!ball||!['x','y','z'].every(k=>finite(ball.position?.[k])&&finite(ball.velocity?.[k]))||typeof deadBall!=='boolean'))
   throw new TypeError('Native aerial preparation needs real prior ball sample');
  if((feedbackEnabled&&lastAcceptedTick!==tick)||
     prepared!==null||nextTick!==tick+1||
     !Number.isSafeInteger(nextTick)||
     frame?.version!==PLAYER_VERSION||frame.tick!==nextTick||
     !Array.isArray(frame.players)||frame.players.length!==22)
   throw new TypeError('One original canonical same-tick movement frame required');
  for(let i=0;i<22;i++){
   const p=frame.players[i],old=prior[i];
   if(p?.id!==INITIAL_PLAYERS[i].id||
      p.team!==INITIAL_PLAYERS[i].team||
      ![p.x,p.y,p.vx,p.vy].every(finite)||
      Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-7||
      Math.abs(p.x-old.x-p.vx*PLAYER_DT)>1e-6||
      Math.abs(p.y-old.y-p.vy*PLAYER_DT)>1e-6)
    throw new TypeError('Only validated original player motion may drive native bodies');
  }
  for(const e of entries){
   const actor=frame.players.find(p=>p.id===e.id);
   e.rigid.setLinvel({x:actor.vx,y:actor.vy,z:0},true);
   e.head?.prepare(actor,nextTick,ball,deadBall);
   for(const control of e.controls)control.prepare(actor,nextTick,ball,deadBall,!!e.head&&!!planNativeAerialJump(actor,ball));
  }
  prior=frame.players.map(p=>({id:p.id,x:p.x,y:p.y}));
  prepared=nextTick;
 }
 function hasSolverContact(left,right){
  let hit=false;
  world.contactPair(left,right,m=>{
   if(m.numContacts()>0&&m.numSolverContacts()>0)hit=true;
  });
  return hit;
 }
 function observe(nextTick){
  requireLive();
  if(prepared!==nextTick||nextTick!==tick+1)
   throw new TypeError('Native body evidence only after same-world Rapier step');
  const now=new Set();
  for(const e of entries)if(hasSolverContact(ballCollider,e.leg))now.add(e.id);
  const ballContactIds=freeze(entries.filter(e=>now.has(e.id)).map(e=>e.id));
  const starts=freeze(entries.filter(e=>now.has(e.id)&&
    !previousBallIds.has(e.id)).map(e=>e.id));
  const ends=freeze(entries.filter(e=>!now.has(e.id)&&
    previousBallIds.has(e.id)).map(e=>e.id));
  const opponentBodyPairs=[];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const a=entries[i],b=entries[j];
   if(a.team!==b.team&&hasSolverContact(a.torso,b.torso))
    opponentBodyPairs.push(idPair(a.id,b.id));
  }
  const sourceBodies=freeze(entries.map(e=>{
   const p=e.rigid.translation(),v=e.rigid.linvel();
   const canonical=prior.find(q=>q.id===e.id);
   return freeze({id:e.id,team:e.team,
    position:freeze({x:p.x,y:p.y,z:p.z}),
    velocity:freeze({x:v.x,y:v.y,z:v.z}),
    originalCanonicalDriftM:Math.hypot(p.x-canonical.x,p.y-canonical.y)});
  }));
  const aerial=aerialEnabled?freeze(entries.flatMap(e=>[...(e.head?[e.head.observe(nextTick)]:[]),...e.controls.map(control=>control.observe(nextTick))])):null;
  tick=nextTick;prepared=null;previousBallIds=now;
  latest=freeze({
   version:SMALL_SIDED_BODY_VERSION,tick,
   oneOriginalRapierWorld:true,selectedColliderIds:freeze(entries.map(e=>e.id)),
   lowerLegBallContacts:ballContactIds,
   lowerLegBallStarts:starts,lowerLegBallEnds:ends,
   nativeOpposingTorsoPairs:freeze(opponentBodyPairs.sort()),
   bodies:sourceBodies,
   ...(aerialEnabled?{aerial,headBallContacts:freeze(aerial.filter(x=>x.version===NATIVE_AERIAL_VERSION&&x.contact).map(x=>x.actorId)),
    headBallStarts:freeze(aerial.filter(x=>x.version===NATIVE_AERIAL_VERSION&&x.contactStarted).map(x=>x.actorId)),
    aerialControlContacts:freeze(aerial.filter(x=>x.version===NATIVE_AERIAL_CONTROL_VERSION&&x.contact).map(x=>x.actorId)),
    aerialControlStarts:freeze(aerial.filter(x=>x.version===NATIVE_AERIAL_CONTROL_VERSION&&x.contactStarted).map(x=>x.actorId))}:{}),
   ballProtectionProven:false,successfulPossession:false,
   tackleWon:false,officialMatchResult:null,
   evidenceSource:'native-rapier-solver-manifold'
  });
  return latest;
 }
 function acknowledgeCanonicalResponse(frame){
  requireLive();
  if(!feedbackEnabled||prepared!==null||lastAcceptedTick!==tick-1||
     frame?.tick!==tick||frame.version!==PLAYER_VERSION||
     frame.smallSidedPhysicalFeedback?.tick!==tick||
     typeof frame.smallSidedPhysicalFeedback.accepted!=='boolean'||
     !Array.isArray(frame.players)||frame.players.length!==22)
   throw new TypeError('One current original mover acknowledgment required');
  const accepted=frame.players.map((p,i)=>{
   if(p.id!==INITIAL_PLAYERS[i].id||
      p.team!==INITIAL_PLAYERS[i].team||
      ![p.x,p.y,p.vx,p.vy].every(finite))
    throw new TypeError('Original mover feedback receipt identity mismatch');
   return {id:p.id,x:p.x,y:p.y};
  });
  prior=accepted;lastAcceptedTick=tick;
  return latest;
 }
 function dispose(){disposed=true;}
 latest=freeze({version:SMALL_SIDED_BODY_VERSION,tick:0,
  oneOriginalRapierWorld:true,selectedColliderIds:freeze(entries.map(e=>e.id)),
  lowerLegBallContacts:freeze([]),lowerLegBallStarts:freeze([]),
  lowerLegBallEnds:freeze([]),nativeOpposingTorsoPairs:freeze([]),
  bodies:freeze([]),...(aerialEnabled?{aerial:freeze([]),headBallContacts:freeze([]),headBallStarts:freeze([]),aerialControlContacts:freeze([]),aerialControlStarts:freeze([])}:{}),ballProtectionProven:false,
  successfulPossession:false,tackleWon:false,officialMatchResult:null,
  evidenceSource:'native-rapier-solver-manifold'});
 return freeze({prepare,observe,snapshot,dispose,
  ...(feedbackEnabled?{acknowledgeCanonicalResponse}:{})});
}

// GK-03: one bounded physical reaching glove for the active keeper duel.
// Uses the existing world/ball and the actual post-shot trajectory. A
// reaching glove is the first dive primitive, not a full articulated body.
export const KEEPER_DIVE_VERSION='me-628-native-keeper-dive-v1';
// Full reaching pose includes lateral body extension, not just arm length.
// These are provisional geometric/kinematic limits, not attribute tuning.
const DIVE_REACH_M=2.65,DIVE_GLOVE_RADIUS_M=0.21,DIVE_SPEED_MPS=8.5;
// Ball-centre limit follows the bounded high hand target plus collider
// radii; no change to the native glove size or overall extension.
const HIGH_CLAIM_BALL_MAX_Z=NATIVE_HIGH_HAND_MAX_Z+DIVE_GLOVE_RADIUS_M+0.11;
export function planNativeKeeperDive(keeper,ball,attackPolarity=1){
 const dir=attackDirection(keeper.team,attackPolarity),p=ball.position,v=ball.velocity;
 if(![keeper.x,keeper.y,p.x,p.y,p.z,v.x,v.y,v.z].every(finite)||
    v.x*dir>=-2)return null;
 const goalX=-dir*52.5,goalEta=(goalX-p.x)/v.x;
 if(goalEta<=0||Math.abs(p.y+v.y*goalEta)>3.77||
    p.z+v.z*goalEta-4.905*goalEta**2>2.55)return null;
 const start={x:keeper.x+dir*0.35,y:keeper.y,z:0.85};
 const eta=(start.x-p.x)/v.x;
 if(eta<0.10||eta>0.85)return null;
 const intended={x:start.x,y:p.y+v.y*eta,z:Math.max(0.21,p.z+v.z*eta-4.905*eta**2)};
 const dy=intended.y-start.y,dz=intended.z-start.z,gap=Math.hypot(dy,dz);
 // A keeper may stretch for a shot beyond his maximum reach and miss.
 // Reject implausible projected points, not all attempts at the corners.
 if(gap<0.08||intended.z>2.55||gap>DIVE_REACH_M+1.25)return null;
 const reachTicks=Math.max(6,Math.min(51,Math.round(eta/PLAYER_DT)));
 const travel=Math.min(gap,DIVE_REACH_M,DIVE_SPEED_MPS*reachTicks*PLAYER_DT);
 const scale=travel/gap;
 const target={x:start.x,y:start.y+dy*scale,z:Math.min(2.45,start.z+dz*scale)};
 return freeze({start:freeze(start),target:freeze(target),intended:freeze(intended),
  eta,reachTicks,limited:travel<gap-1e-8});
}
// The high reach uses the original kinematic glove and grip controller.
// No new hand ownership or collision source is introduced.
export function planNativeKeeperHighClaim(keeper,ball,attackPolarity=1){
 const forecast=planNativeKeeperHighIntercept(keeper,ball?.position,ball?.velocity,attackPolarity);
 if(!forecast||forecast.eta>0.85)return null;
 const dir=attackDirection(keeper.team,attackPolarity);
 const start={x:keeper.x+dir*0.35,y:keeper.y,z:0.85},intended=forecast.point;
 const dx=intended.x-start.x,dy=intended.y-start.y,dz=intended.z-start.z;
 const distance=Math.hypot(dx,dy,dz);
 const reachTicks=Math.max(6,Math.min(51,Math.round(forecast.eta/PLAYER_DT)));
 const travel=Math.min(DIVE_REACH_M,DIVE_SPEED_MPS*reachTicks*PLAYER_DT);
 if(distance<0.1||distance>travel+0.30)return null;
 const scale=Math.min(1,travel/distance);
 return freeze({kind:'high-claim',start:freeze(start),target:freeze({x:start.x+dx*scale,y:start.y+dy*scale,z:start.z+dz*scale}),
  intended,eta:forecast.eta,reachTicks,limited:scale<1});
}
// GK-05: a provisional grip only after a native solver contact. No
// setTranslation/setLinvel on the ball. The constraint joins at the ball's
// CURRENT centre and is verified over subsequent real world steps.
export function eligibleKeeperGrip({team,contact,ballPosition,before,after,glovePosition,gloveVelocity,attackPolarity=1,highClaim=false}){
 validateAttackPolarity(attackPolarity);
 if(!['home','away'].includes(team)||contact!==true||
    ![ballPosition,before,after,glovePosition,gloveVelocity].every(v=>v&&['x','y','z'].every(k=>finite(v[k]))))return false;
 const dir=attackDirection(team,attackPolarity);
 const gap=Math.hypot(ballPosition.x-glovePosition.x,ballPosition.y-glovePosition.y,ballPosition.z-glovePosition.z);
 const relative=Math.hypot(after.x-gloveVelocity.x,after.y-gloveVelocity.y,after.z-gloveVelocity.z);
 return -dir*ballPosition.x>=36&&-dir*ballPosition.x<52.39&&Math.abs(ballPosition.y)<=20.16&&
  ballPosition.z>=0.10&&ballPosition.z<=(highClaim?HIGH_CLAIM_BALL_MAX_Z:2.2)&&gap<=0.36&&
  (!highClaim||ballPosition.z>=1.40)&&Math.hypot(before.x,before.y,before.z)<=(highClaim?22:8)&&relative<=3.5;
}
// High claims can absorb a faster delivery than a low scoop, but only
// after an exclusive legal solver contact. Pressure or excessive relative
// speed favours a punch rather than attaching the original ball.
export function planNativeHighHandAction({keeper,players,ballPosition,incoming,velocity,handPosition,handVelocity,massKg,contact=false,conflict=false,attackPolarity=1}={}){
 validateAttackPolarity(attackPolarity);
 if(!keeper||keeper.role!=='goalkeeper'||!['home','away'].includes(keeper.team)||!Array.isArray(players)||contact!==true||conflict!==false||
    ![ballPosition,incoming,velocity,handPosition,handVelocity].every(v=>v&&['x','y','z'].every(k=>finite(v[k])))||
    !finite(massKg)||massKg<=0||incoming.z>=-0.15)return null;
 const dir=attackDirection(keeper.team,attackPolarity),p=ballPosition;
 if(-dir*p.x<36||-dir*p.x>=52.39||Math.abs(p.y)>20.16||p.z<1.40||p.z>HIGH_CLAIM_BALL_MAX_Z||
    Math.hypot(p.x-handPosition.x,p.y-handPosition.y,p.z-handPosition.z)>0.36)return null;
 const pressure=players.some(q=>q.team!==keeper.team&&Math.hypot(q.x-p.x,q.y-p.y)<1.5);
 const incomingSpeed=Math.hypot(incoming.x,incoming.y,incoming.z);
 const relative=Math.hypot(incoming.x-handVelocity.x,incoming.y-handVelocity.y,incoming.z-handVelocity.z);
 const catchDelta={x:massKg*(handVelocity.x-velocity.x),y:massKg*(handVelocity.y-velocity.y),z:massKg*(handVelocity.z-velocity.z)};
 const catchNorm=Math.hypot(catchDelta.x,catchDelta.y,catchDelta.z);
 const catchScale=Math.min(1,6/Math.max(catchNorm,1e-9));
 const residual=(1-catchScale)*catchNorm/massKg;
 if(!pressure&&incomingSpeed<=22&&relative<=23&&residual<=3.0)
  return freeze({kind:'catch',impulseNs:freeze({x:catchDelta.x*catchScale,y:catchDelta.y*catchScale,z:catchDelta.z*catchScale}),decisionOnly:true,officialPossession:false});
 // Clear away from own goal, favouring a flank when the centre is crowded.
 const flank=p.y===0?(incoming.y>=0?1:-1):Math.sign(p.y);
 const desired={x:dir*11,y:flank*4,z:2.2};
 const raw={x:massKg*(desired.x-velocity.x),y:massKg*(desired.y-velocity.y),z:massKg*(desired.z-velocity.z)};
 const norm=Math.hypot(raw.x,raw.y,raw.z),scale=Math.min(1,8/Math.max(norm,1e-9));
 if(norm<0.025||dir*(velocity.x+raw.x*scale/massKg)<=0)return null;
 return freeze({kind:'punch',impulseNs:freeze({x:raw.x*scale,y:raw.y*scale,z:raw.z*scale}),decisionOnly:true,officialPossession:false});
}
export const NATIVE_KEEPER_DISTRIBUTION_DELAY_TICKS=120;
export function planNativeKeeperDistribution(keeper,position,players,attackPolarity=1,allowedFundamentals=null){
 const mask=createNativeFundamentalMask(allowedFundamentals);
 validateAttackPolarity(attackPolarity);
 if(!keeper||keeper.role!=='goalkeeper'||!['home','away'].includes(keeper.team)||
    ![keeper.x,keeper.y,position?.x,position?.y,position?.z].every(finite)||!Array.isArray(players))return null;
 const dir=attackDirection(keeper.team,attackPolarity);
 if(-dir*position.x<36||-dir*position.x>=52.39||Math.abs(position.y)>20.16||position.z<0.09||position.z>2.2)return null;
 const recipient=nativeFundamentalAllowed(mask,'pass')?chooseRecipient(keeper,position,players.filter(p=>p.role!=='goalkeeper'||p.id===keeper.id),attackPolarity):null;
 if(!recipient&&!nativeFundamentalAllowed(mask,'clearance'))return null;
 const dx=recipient?recipient.player.x-position.x:dir*15,dy=recipient?recipient.player.y-position.y:-position.y*0.15;
 const length=Math.hypot(dx,dy);
 if(length<1e-8)return null;
 const speed=recipient?Math.max(6,Math.min(12,4+length*0.3)):9;
 return freeze({kind:recipient?'pass':'clearance',recipientId:recipient?.player.id??null,
  desiredVelocity:freeze({x:dx/length*speed,y:dy/length*speed,z:-0.5}),decisionOnly:true,officialPossession:false});
}
export function createNativeKeeperGrip(R,world,hand,ballBody,team,allowedFundamentals=null){
 const mask=createNativeFundamentalMask(allowedFundamentals);
 let joint=null,anchor=null,heldSince=null,confirmedTick=null,latest=null,lastObservedTick=null,gripPolarity=1;
 function release(){
  if(joint)world.removeImpulseJoint(joint,true);
  joint=null;anchor=null;heldSince=null;confirmedTick=null;
 }
 function tryGrip(tick,evidence,attackPolarity=1){
  validateAttackPolarity(attackPolarity);
  if(!nativeFundamentalAllowed(mask,'save')||joint||!eligibleKeeperGrip({team,...evidence,attackPolarity}))return false;
  gripPolarity=attackPolarity;
  const p=ballBody.translation(),h=hand.translation();
  // The kinematic glove does not rotate. Local anchor at the measured
  // ball centre avoids an initial positional snap; ball stays dynamic.
  anchor={x:p.x-h.x,y:p.y-h.y,z:p.z-h.z};
  joint=world.createImpulseJoint(R.JointData.spherical(anchor,{x:0,y:0,z:0}),hand,ballBody,true);
  joint.setContactsEnabled(false);
  heldSince=tick;
  return true;
 }
 function observe(tick){
  let errorM=null,relativeSpeedMps=null,released=false;
  if(joint&&tick>heldSince){
   const p=ballBody.translation(),h=hand.translation(),v=ballBody.linvel(),hv=hand.linvel();
   errorM=Math.hypot(p.x-h.x-anchor.x,p.y-h.y-anchor.y,p.z-h.z-anchor.z);
   relativeSpeedMps=Math.hypot(v.x-hv.x,v.y-hv.y,v.z-hv.z);
   const dir=attackDirection(team,gripPolarity);
   if(errorM>0.12||relativeSpeedMps>4||-dir*p.x<36||-dir*p.x>=52.39||Math.abs(p.y)>20.16||p.z<0.09){
    release();released=true;
   }else if(confirmedTick===null&&tick-heldSince>=6&&errorM<=0.05&&relativeSpeedMps<=0.8){
    confirmedTick=tick;
   }else if(confirmedTick===null&&tick-heldSince>=12){
    release();released=true;
   }
  }
  lastObservedTick=tick;
  latest=freeze({active:joint!==null,heldSince,confirmedTick,errorM,relativeSpeedMps,released,
   officialPossession:false,officialSave:false});
  return latest;
 }
 function distribute(tick,keeper,players){
  if(!joint||confirmedTick===null||lastObservedTick!==tick||tick-confirmedTick<NATIVE_KEEPER_DISTRIBUTION_DELAY_TICKS||keeper?.team!==team)return null;
  const plan=planNativeKeeperDistribution(keeper,ballBody.translation(),players,gripPolarity,mask);
  if(!plan)return null;
  const before=freeze({...ballBody.linvel()}),origin=freeze({...ballBody.translation()}),mass=ballBody.mass();
  if(!finite(mass)||mass<=0)return null;
  const delta={x:mass*(plan.desiredVelocity.x-before.x),y:mass*(plan.desiredVelocity.y-before.y),z:mass*(plan.desiredVelocity.z-before.z)};
  const magnitude=Math.hypot(delta.x,delta.y,delta.z),scale=magnitude>6?6/magnitude:1;
  const impulse=freeze({x:delta.x*scale,y:delta.y*scale,z:delta.z*scale});
  if(!Object.values(impulse).every(finite)||magnitude<0.025)return null;
  const confirmed=confirmedTick;
  release();ballBody.applyImpulse(impulse,true);
  latest=freeze({...latest,active:false,heldSince:null,confirmedTick:null,released:true});
  return freeze({tick,keeperId:keeper.id,team,kind:plan.kind,recipientId:plan.recipientId,confirmedGripTick:confirmed,
   origin,before,after:freeze({...ballBody.linvel()}),impulseNs:impulse,nativeGripReleased:true,
   appliedByRapier:true,actualPhysicsImpulseApplied:true,officialPossession:false,officialSave:false});
 }
 return freeze({tryGrip,observe,release,distribute,active:()=>joint!==null,snapshot:()=>latest});
}
// Nearby keeper challenge: only a reachable, slow, live ball near an
// opponent inside the penalty area. The solver decides contact and grip.
export function planNativeKeeperChallenge(keeper,attacker,ball,attackPolarity=1){
 const dir=attackDirection(keeper.team,attackPolarity),p=ball.position,v=ball.velocity;
 if(!attacker||attacker.team===keeper.team||
    ![keeper.x,keeper.y,attacker.x,attacker.y,p.x,p.y,p.z,v.x,v.y,v.z].every(finite)||
    -dir*p.x<36||-dir*p.x>=52.39||Math.abs(p.y)>20.16||p.z<0.09||p.z>0.5||
    Math.hypot(v.x,v.y,v.z)>6||Math.hypot(attacker.x-p.x,attacker.y-p.y)>2.2||
    Math.hypot(keeper.x-p.x,keeper.y-p.y)>1.75||dir*(p.x-keeper.x)<-0.2)return null;
 const start={x:keeper.x+dir*0.35,y:keeper.y,z:0.85};
 const eta=0.20,reachTicks=Math.round(eta/PLAYER_DT);
 const intended={x:p.x+v.x*eta,y:p.y+v.y*eta,z:Math.max(0.21,p.z)};
 if(-dir*intended.x<36||-dir*intended.x>=52.39||Math.abs(intended.y)>20.16)return null;
 const gap=Math.hypot(intended.x-start.x,intended.y-start.y,intended.z-start.z);
 if(gap>1.65||gap<0.08)return null;
 return freeze({kind:'challenge',start:freeze(start),target:freeze(intended),intended:freeze(intended),eta,reachTicks,limited:false});
}
export function createNativeKeeperDive(R,world,ballCollider,keeper,ballBody=null,{closeChallengeEnabled=false,nativeOpenPlayIds=null,allowedFundamentals=null,keeperSequence=null}={}){
 const mask=createNativeFundamentalMask(allowedFundamentals),canSave=nativeFundamentalAllowed(mask,'save');
 if(nativeOpenPlayIds!==null&&(!Array.isArray(nativeOpenPlayIds)||!nativeOpenPlayIds.includes(keeper.id)||new Set(nativeOpenPlayIds).size!==nativeOpenPlayIds.length))throw new TypeError('Native keeper requires explicit physical participants');
 const nativeOpenPlay=nativeOpenPlayIds!==null;
 if(keeperSequence!==null&&(!nativeOpenPlay||keeperSequence.surface!=='glove'||keeperSequence.keeperId!==keeper.id))throw new TypeError('Keeper sequence requires configured active keeper');
 let sequenceDelivery=null;
 let attackPolarity=1;
 const rest=p=>({x:p.x+attackDirection(keeper.team,attackPolarity)*0.35,y:p.y,z:0.85});
 const origin=rest(keeper);
 const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(origin.x,origin.y,origin.z).setCcdEnabled(true));
 const glove=world.createCollider(R.ColliderDesc.ball(DIVE_GLOVE_RADIUS_M)
  .setFriction(0.35).setRestitution(0.05).setCollisionGroups(0),body);
 const grip=ballBody?createNativeKeeperGrip(R,world,body,ballBody,keeper.team,mask):null;
 let plan=null,shotTick=null,usedShot=null,crossTick=null,usedCross=null,startTick=null,active=false,priorHit=false,lastChallengeTick=-60;
 let highGripSettling=null;
 let latest=freeze({version:KEEPER_DIVE_VERSION,tick:0,keeperId:keeper.id,
  phase:'ready',glove:null,started:false,contact:false,contactStarted:false,
  officialSave:false});
 const lerp=(a,b,u)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u});
 let prepared=null;
 function prepare(frame,tick,ball,lastAction,deadBall=false,nextPolarity=1){
  validateAttackPolarity(nextPolarity);
  if(nextPolarity!==attackPolarity){
   if(nativeOpenPlayIds?.length!==22||!deadBall||plan||active||grip?.active()||prepared!==null)
    throw new TypeError('Keeper direction change requires cleared full-field dead ball');
   attackPolarity=nextPolarity;
  }
  const actor=frame.players.find(p=>p.id===keeper.id);
  if(lastAction?.tick===tick-1&&lastAction.action==='shot'&&
     lastAction.team!==keeper.team&&lastAction.appliedByRapier===true&&
     lastAction.actualPhysicsImpulseApplied===true)shotTick=lastAction.tick;
  if(nativeOpenPlay&&shotTick!==null&&(tick-shotTick>180||lastAction?.tick===tick-1&&lastAction.action!=='shot'))shotTick=null;
  if(nativeOpenPlay&&lastAction?.tick===tick-1&&lastAction.team!==keeper.team&&
     (lastAction.action==='cross'||lastAction.passTarget?.deliveryProfile==='lofted')&&lastAction.appliedByRapier===true&&lastAction.actualPhysicsImpulseApplied===true)crossTick=lastAction.tick;
  else if(deadBall||crossTick!==null&&(tick-crossTick>180||lastAction?.tick===tick-1))crossTick=null;
  if(keeperSequence!==null){
   if(deadBall||sequenceDelivery&&tick-sequenceDelivery.tick>180)sequenceDelivery=null;
   if(!deadBall&&nativeKeeperSequenceDeliveryAllowed(keeperSequence,lastAction,tick))sequenceDelivery={tick:lastAction.tick,airborne:false};
   if(sequenceDelivery&&ball.position.z>0.31)sequenceDelivery.airborne=true;
  }
  const sequenceEligible=nativeKeeperSequenceClaimAllowed(keeperSequence,keeper.id,sequenceDelivery,tick);
  const physicalPlayers=nativeOpenPlay?frame.players.filter(p=>nativeOpenPlayIds.includes(p.id)):null;
  let started=false,phase='ready',target=rest(actor);
  if(canSave&&!deadBall&&!grip?.active()&&!plan){
   const shotCandidate=keeperSequence===null&&shotTick!==null&&shotTick!==usedShot?planNativeKeeperDive(actor,ball,attackPolarity):null;
   const attacker=nativeOpenPlay?physicalPlayers.filter(p=>p.team!==keeper.team).sort((a,b)=>Math.hypot(a.x-ball.position.x,a.y-ball.position.y)-Math.hypot(b.x-ball.position.x,b.y-ball.position.y)||a.id.localeCompare(b.id))[0]:frame.players.find(p=>p.team!==keeper.team&&p.id.endsWith('-10'));
   const challenge=keeperSequence===null&&(closeChallengeEnabled||nativeOpenPlay)&&shotTick===null&&tick-lastChallengeTick>=60?
    planNativeKeeperChallenge(actor,attacker,ball,attackPolarity):null;
   const highCandidate=sequenceEligible&&crossTick!==null&&crossTick!==usedCross?planNativeKeeperHighClaim(actor,ball,attackPolarity):null;
   const candidate=shotCandidate?freeze({...shotCandidate,kind:'shot'}):highCandidate??challenge;
   if(candidate){
    plan=candidate;startTick=tick;started=true;
    if(candidate.kind==='challenge')lastChallengeTick=tick;
    else if(candidate.kind==='high-claim')usedCross=crossTick;
    else usedShot=shotTick;
    // Inactive glove is brought to the original player's actual ready hand
    // before enabling collision. Every active extension is kinematic.
    body.setTranslation(plan.start,true);
    glove.setCollisionGroups((LEG_CATEGORY<<16)|BALL_CATEGORY);
    active=true;priorHit=false;
   }
  }
  if(grip?.active()){
   phase='holding';target=rest(actor);
   const h=body.translation(),d=Math.hypot(target.x-h.x,target.y-h.y,target.z-h.z);
   if(d>0.045)target=lerp(h,target,0.045/d);
   // For a newly accepted high catch, blend hand speed towards the
   // ordinary holding pose over the confirmation window. The ball
   // stays on the original physical joint; no additional ball impulse.
   if(highGripSettling){
    const elapsed=tick-highGripSettling.tick;
    if(elapsed<=6){
     const u=Math.max(0,1-elapsed/6),v=highGripSettling.velocity;
     const candidate={x:target.x*(1-u)+(h.x+v.x*PLAYER_DT)*u,y:target.y*(1-u)+(h.y+v.y*PLAYER_DT)*u,z:target.z*(1-u)+(h.z+v.z*PLAYER_DT)*u};
     const dir=attackDirection(actor.team,attackPolarity);
     const localGap=Math.hypot(candidate.x-actor.x,candidate.y-actor.y,candidate.z-0.85);
     // Never extend the original keeper's reachable/legal envelope.
     if(localGap<=DIVE_REACH_M&&-dir*candidate.x>=36.36&&-dir*candidate.x<=52.03&&Math.abs(candidate.y)<=19.8&&candidate.z>=0.45&&candidate.z<=2.45)target=candidate;
    }else highGripSettling=null;
   }
  }else if(plan){
   const elapsed=tick-startTick+1,holdTicks=4,recoveryTicks=24;
   if(elapsed<=plan.reachTicks){
    phase=plan.kind==='challenge'?'challenging':plan.kind==='high-claim'?'high-claiming':'diving';target=lerp(plan.start,plan.target,elapsed/plan.reachTicks);
   }else if(elapsed<=plan.reachTicks+holdTicks){
    phase='extended';target=plan.target;
   }else if(elapsed<=plan.reachTicks+holdTicks+recoveryTicks){
    phase='recovering';
    target=lerp(plan.target,rest(actor),(elapsed-plan.reachTicks-holdTicks)/recoveryTicks);
   }else{
    glove.setCollisionGroups(0);active=false;plan=null;priorHit=false;
   }
  }
  body.setNextKinematicTranslation(target);
  prepared={tick,phase,started,actor,physicalPlayers,priorVelocity:freeze({...ball.velocity}),
   plan:plan?freeze({kind:plan.kind,eta:plan.eta,limited:plan.limited,intended:plan.intended,target:plan.target}):null};
 }
 function observe(tick,postVelocity,{otherBallContact=false,sequenceInterrupted=false}={}){
  if(typeof otherBallContact!=='boolean'||typeof sequenceInterrupted!=='boolean')throw new TypeError('Boolean competing physical contact required');
  if(prepared?.tick!==tick||!['x','y','z'].every(k=>finite(postVelocity?.[k])))
   throw new Error('Keeper dive requires same native world step and observed ball velocity');
  let hit=false;
  if(active)world.contactPair(ballCollider,glove,m=>{
   if(m.numContacts()>0&&m.numSolverContacts()>0)hit=true;
  });
  const pos=body.translation();
  let highHandAction=null,highHandDiagnostic=null;
  if(keeperSequence!==null&&sequenceInterrupted)sequenceDelivery=null;
  const sequenceEligible=nativeKeeperSequenceClaimAllowed(keeperSequence,keeper.id,sequenceDelivery,tick,{conflict:keeperSequence!==null&&otherBallContact});
  if(canSave&&sequenceEligible&&hit&&grip&&!grip.active()&&prepared.phase!=='recovering'){
   const high=prepared.plan?.kind==='high-claim';
   const evidence={contact:true,ballPosition:ballBody.translation(),
    before:prepared.priorVelocity,after:postVelocity,glovePosition:pos,gloveVelocity:body.linvel(),highClaim:high};
   if(high){
    const handPlan=!priorHit?planNativeHighHandAction({keeper:prepared.actor,players:prepared.physicalPlayers??[],
     ballPosition:evidence.ballPosition,incoming:evidence.before,velocity:postVelocity,handPosition:pos,handVelocity:evidence.gloveVelocity,
     massKg:ballBody.mass(),contact:true,conflict:otherBallContact,attackPolarity}):null;
    if(!priorHit)highHandDiagnostic=freeze({tick,decision:handPlan?.kind??null,otherBallContact,
     position:freeze({...evidence.ballPosition}),incomingSpeedMps:Math.hypot(...Object.values(evidence.before)),
     handRelativeSpeedMps:Math.hypot(evidence.before.x-evidence.gloveVelocity.x,evidence.before.y-evidence.gloveVelocity.y,evidence.before.z-evidence.gloveVelocity.z),
     nearestOpponentM:Math.min(150,...(prepared.physicalPlayers??[]).filter(q=>q.team!==keeper.team).map(q=>Math.hypot(q.x-evidence.ballPosition.x,q.y-evidence.ballPosition.y))),
     handGapM:Math.hypot(evidence.ballPosition.x-pos.x,evidence.ballPosition.y-pos.y,evidence.ballPosition.z-pos.z),incomingVerticalMps:evidence.before.z});
    if(handPlan){
     const before=freeze({...ballBody.linvel()});
     const magnitude=Math.hypot(...Object.values(handPlan.impulseNs));
     if(magnitude>0.025)ballBody.applyImpulse(handPlan.impulseNs,true);
     const after=freeze({...ballBody.linvel()});
     const accepted=handPlan.kind==='catch'&&grip.tryGrip(tick,{...evidence,after},attackPolarity);
     highHandAction=freeze({tick,keeperId:keeper.id,kind:handPlan.kind==='punch'?'punch':accepted?'catch-attempt':'deflection',
      impulseNs:handPlan.impulseNs,before,after,nativeExclusiveHandStart:true,actualNativeSolverContact:true,
      actualPhysicsImpulseApplied:magnitude>0.025,officialPossession:false,officialSave:false});
     if(accepted)highGripSettling=freeze({tick,velocity:freeze({...evidence.gloveVelocity})});
     if(accepted||handPlan.kind==='punch'){
      plan=null;glove.setCollisionGroups(0);
      if(!accepted)active=false;
     }
    }
   }else{
    const accepted=grip.tryGrip(tick,evidence,attackPolarity);
    if(accepted){plan=null;glove.setCollisionGroups(0);}
   }
  }
  let catchState=grip?.observe(tick)??null;
  const distribution=nativeOpenPlay&&catchState?.active?grip.distribute(tick,prepared.actor,prepared.physicalPlayers):null;
  if(distribution){catchState=grip.snapshot();shotTick=null;lastChallengeTick=tick;glove.setCollisionGroups(0);}
  if(catchState?.released){active=false;plan=null;highGripSettling=null;}
  latest=freeze({version:KEEPER_DIVE_VERSION,tick,keeperId:keeper.id,
   phase:prepared.phase,started:prepared.started,plan:prepared.plan,
   glove:active?freeze({x:pos.x,y:pos.y,z:pos.z}):null,
   contact:hit,contactStarted:hit&&!priorHit,
   contactMotion:hit?freeze({before:prepared.priorVelocity,after:freeze({...postVelocity})}):null,
   catchState,...(nativeOpenPlay?{distribution,highHandAction,highHandDiagnostic}:{}),
   ...(keeperSequence!==null?{sequenceDeliveryTick:sequenceDelivery?.tick??null,sequenceAirborne:sequenceDelivery?.airborne??false}:{}),
   officialSave:false,source:'native-rapier-solver-manifold'});
  if(keeperSequence!==null&&hit)sequenceDelivery=null;
  priorHit=hit;prepared=null;return latest;
 }
 function clearForDeadBall(tick){
  if(!nativeOpenPlay||latest.tick!==tick||tick<1||prepared!==null)throw new TypeError('Current native keeper tick required for dead ball');
  sequenceDelivery=null;
  grip?.release();const catchState=grip?.observe(tick)??null;
  plan=null;shotTick=null;usedShot=null;crossTick=null;usedCross=null;startTick=null;active=false;priorHit=false;lastChallengeTick=tick;highGripSettling=null;
  glove.setCollisionGroups(0);
  latest=freeze({version:KEEPER_DIVE_VERSION,tick,keeperId:keeper.id,phase:'ready',
   glove:null,started:false,contact:false,contactStarted:false,catchState,
   distribution:null,officialSave:false,source:'native-rapier-solver-manifold'});
  return latest;
 }
 return freeze({prepare,observe,clearForDeadBall,snapshot:()=>latest});
}

// UME-06D2C: two real hand proxies on one kinematic carrier, in the
// original ball world. This is bounded hand physics, NOT an articulated
// arm/foot model or certification of a legal IFAB throw-in.
export function createNativeThrowInHands(R,world,ballCollider,ballBody,placement,actor){
 if(placement?.kind!=='throw-in'||placement.takerId!==actor?.id||placement.assignedTeam!==actor.team||
    ![actor.x,actor.y,placement.spot?.x,placement.spot?.y].every(finite))
  throw new TypeError('Verified throw-in placement and original actor required');
 const at=placement.spot,side=Math.sign(at.y);
 const carrier=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(actor.x,actor.y,0.9).setCcdEnabled(true));
 const hands=[-1,1].map(sign=>world.createCollider(R.ColliderDesc.ball(0.105)
  .setTranslation(sign*0.17,0,0).setFriction(0.5).setRestitution(0)
  .setCollisionGroups(0),carrier));
 let joint=null,anchor=null,gripTick=null,confirmedTicks=0,latest=null,prepared=null,done=false;
 const disable=()=>hands.forEach(hand=>hand.setCollisionGroups(0));
 function prepare(frame,tick){
  if(done||prepared||frame.tick!==tick)throw new TypeError('Consecutive native throw approach required');
  const p=frame.players.find(q=>q.id===actor.id);
  const near=Math.hypot(p.x-at.x,p.y-at.y)<=1.1&&Math.hypot(p.vx,p.vy)<=0.65;
  const target=joint?{x:at.x,y:at.y,z:1.85}:near?{x:at.x,y:at.y,z:0.13}:{x:p.x,y:p.y,z:0.9};
  const now=carrier.translation(),dx=target.x-now.x,dy=target.y-now.y,dz=target.z-now.z;
  const length=Math.hypot(dx,dy,dz),limit=joint?0.035:0.10,scale=length>limit?limit/length:1;
  if(!joint){if(near)hands.forEach(hand=>hand.setCollisionGroups((LEG_CATEGORY<<16)|BALL_CATEGORY));else disable();}
  carrier.setNextKinematicTranslation({x:now.x+dx*scale,y:now.y+dy*scale,z:now.z+dz*scale});
  prepared={tick,near};
 }
 function observe(tick,foot,otherContacts){
  if(prepared?.tick!==tick)throw new TypeError('Native throw-in requires current solver step');
  const contact=hands.map(hand=>{let hit=false;world.contactPair(ballCollider,hand,m=>{
   if(m.numContacts()>0&&m.numSolverContacts()>0)hit=true;
  });return hit;});
  let take=null;
  const p=ballBody.translation(),h=carrier.translation();
  const exclusive=foot.tick===tick&&foot.active.length===0&&foot.started.length===0&&otherContacts.length===0;
  if(!joint&&prepared.near&&exclusive&&contact.every(Boolean)&&Math.hypot(p.x-at.x,p.y-at.y)<=0.25&&p.z<=0.35){
   anchor={x:p.x-h.x,y:p.y-h.y,z:p.z-h.z};
   joint=world.createImpulseJoint(R.JointData.spherical(anchor,{x:0,y:0,z:0}),carrier,ballBody,true);
   joint.setContactsEnabled(false);disable();gripTick=tick;
  }else if(joint){
   const errorM=Math.hypot(p.x-h.x-anchor.x,p.y-h.y-anchor.y,p.z-h.z-anchor.z);
   const v=ballBody.linvel(),hv=carrier.linvel();
   const relative=Math.hypot(v.x-hv.x,v.y-hv.y,v.z-hv.z);
   if(errorM<=0.08&&relative<=0.8&&exclusive)confirmedTicks++;
   else confirmedTicks=0;
   if(confirmedTicks>=6&&tick-gripTick>=30&&p.z>=1.65&&p.z<=2.2&&Math.abs(p.y-at.y)<=0.35&&exclusive){
    const before=freeze({...v}),origin=freeze({...p});
    world.removeImpulseJoint(joint,true);joint=null;disable();done=true;
    const impulseNs=freeze({x:0,y:-side*1.8,z:0.55});
    ballBody.applyImpulse(impulseNs,true);
    take=freeze({tick,type:'throw-in',team:actor.team,actorId:actor.id,sourceEventTick:placement.sourceEventTick,
     impulseNs,origin,before,after:freeze({...ballBody.linvel()}),singleOriginalRapierBall:true,sameOriginalRapierWorld:true,
     physicalImpulseApplied:true,originalNativeShoeStart:false,originalNativeHandContact:true,
     nativeTwoHandSolverContact:true,gripTick,confirmedTicks,nativeGripReleased:true,
     provisionalHandReleaseWithoutHandCollider:false,legalThrowConfirmed:false,
     officialMatchAction:false,officialPossession:false,officialMatchResult:null});
   }
  }
  latest=freeze({tick,actorId:actor.id,phase:done?'released':joint?'lifting':'approaching',gripTick,
   active:joint!==null,confirmedTicks,contacts:freeze(contact),legalThrowConfirmed:false});
  prepared=null;return take;
 }
 function dispose(){if(joint)world.removeImpulseJoint(joint,true);joint=null;disable();world.removeRigidBody(carrier);done=true;}
 return freeze({prepare,observe,snapshot:()=>latest,dispose});
}
