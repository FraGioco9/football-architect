// #628 LAB-VAR-02B — isolated native physical lower-leg/body collisions.
// SAME original Rapier world and step. Only selected small-sided actors have
// native colliders. 22 canonical mover identities remain authoritative for
// movement; no second physics world, artificial collision/possession or kick.
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_DT,PLAYER_MAX_SPEED_MPS}
 from './player-movement.mjs';

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

export function createSmallSidedNativeBodyGuard(R,world,ballCollider,
 initialPlayers,activePlayerIds,{feedbackEnabled=false,
  dribbleGroundBallCentreZ=null}={}){
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
    activePlayerIds.length>7||
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
  entries.push({id:actor.id,team:actor.team,rigid,torso,leg});
 }
 if(entries.length!==activePlayerIds.length)
  throw new Error('Selected physical body identity mismatch');
 let tick=0,prepared=null,disposed=false,previousBallIds=new Set();
 let lastAcceptedTick=0;
 let latest=null,prior=initialPlayers.map(p=>({id:p.id,x:p.x,y:p.y}));
 function requireLive(){if(disposed)throw new Error('Physical body guard disposed');}
 function snapshot(){requireLive();return latest;}
 function prepare(frame,nextTick){
  requireLive();
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
  tick=nextTick;prepared=null;previousBallIds=now;
  latest=freeze({
   version:SMALL_SIDED_BODY_VERSION,tick,
   oneOriginalRapierWorld:true,selectedColliderIds:freeze(entries.map(e=>e.id)),
   lowerLegBallContacts:ballContactIds,
   lowerLegBallStarts:starts,lowerLegBallEnds:ends,
   nativeOpposingTorsoPairs:freeze(opponentBodyPairs.sort()),
   bodies:sourceBodies,
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
  bodies:freeze([]),ballProtectionProven:false,
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
export function planNativeKeeperDive(keeper,ball){
 const dir=keeper.team==='home'?1:-1,p=ball.position,v=ball.velocity;
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
// GK-05: a provisional grip only after a native solver contact. No
// setTranslation/setLinvel on the ball. The constraint joins at the ball's
// CURRENT centre and is verified over subsequent real world steps.
export function eligibleKeeperGrip({team,contact,ballPosition,before,after,glovePosition,gloveVelocity}){
 if(!['home','away'].includes(team)||contact!==true||
    ![ballPosition,before,after,glovePosition,gloveVelocity].every(v=>v&&['x','y','z'].every(k=>finite(v[k]))))return false;
 const dir=team==='home'?1:-1;
 const gap=Math.hypot(ballPosition.x-glovePosition.x,ballPosition.y-glovePosition.y,ballPosition.z-glovePosition.z);
 const relative=Math.hypot(after.x-gloveVelocity.x,after.y-gloveVelocity.y,after.z-gloveVelocity.z);
 return -dir*ballPosition.x>=36&&-dir*ballPosition.x<52.39&&Math.abs(ballPosition.y)<=20.16&&
  ballPosition.z>=0.10&&ballPosition.z<=2.2&&gap<=0.36&&
  Math.hypot(before.x,before.y,before.z)<=8&&relative<=3.5;
}
export function createNativeKeeperGrip(R,world,hand,ballBody,team){
 let joint=null,anchor=null,heldSince=null,confirmedTick=null,latest=null;
 function release(){
  if(joint)world.removeImpulseJoint(joint,true);
  joint=null;anchor=null;heldSince=null;confirmedTick=null;
 }
 function tryGrip(tick,evidence){
  if(joint||!eligibleKeeperGrip({team,...evidence}))return false;
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
   const dir=team==='home'?1:-1;
   if(errorM>0.12||relativeSpeedMps>4||-dir*p.x<36||-dir*p.x>=52.39||Math.abs(p.y)>20.16||p.z<0.09){
    release();released=true;
   }else if(confirmedTick===null&&tick-heldSince>=6&&errorM<=0.05&&relativeSpeedMps<=0.8){
    confirmedTick=tick;
   }else if(confirmedTick===null&&tick-heldSince>=12){
    release();released=true;
   }
  }
  latest=freeze({active:joint!==null,heldSince,confirmedTick,errorM,relativeSpeedMps,released,
   officialPossession:false,officialSave:false});
  return latest;
 }
 return freeze({tryGrip,observe,release,active:()=>joint!==null,snapshot:()=>latest});
}
// Nearby keeper challenge: only a reachable, slow, live ball near an
// opponent inside the penalty area. The solver decides contact and grip.
export function planNativeKeeperChallenge(keeper,attacker,ball){
 const dir=keeper.team==='home'?1:-1,p=ball.position,v=ball.velocity;
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
export function createNativeKeeperDive(R,world,ballCollider,keeper,ballBody=null,{closeChallengeEnabled=false}={}){
 const dir=keeper.team==='home'?1:-1;
 const rest=p=>({x:p.x+dir*0.35,y:p.y,z:0.85});
 const origin=rest(keeper);
 const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(origin.x,origin.y,origin.z).setCcdEnabled(true));
 const glove=world.createCollider(R.ColliderDesc.ball(DIVE_GLOVE_RADIUS_M)
  .setFriction(0.35).setRestitution(0.05).setCollisionGroups(0),body);
 const grip=ballBody?createNativeKeeperGrip(R,world,body,ballBody,keeper.team):null;
 let plan=null,shotTick=null,usedShot=null,startTick=null,active=false,priorHit=false,lastChallengeTick=-60;
 let latest=freeze({version:KEEPER_DIVE_VERSION,tick:0,keeperId:keeper.id,
  phase:'ready',glove:null,started:false,contact:false,contactStarted:false,
  officialSave:false});
 const lerp=(a,b,u)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u});
 let prepared=null;
 function prepare(frame,tick,ball,lastAction){
  const actor=frame.players.find(p=>p.id===keeper.id);
  if(lastAction?.tick===tick-1&&lastAction.action==='shot'&&
     lastAction.team!==keeper.team&&lastAction.appliedByRapier===true&&
     lastAction.actualPhysicsImpulseApplied===true)shotTick=lastAction.tick;
  let started=false,phase='ready',target=rest(actor);
  if(!grip?.active()&&!plan){
   const shotCandidate=shotTick!==null&&shotTick!==usedShot?planNativeKeeperDive(actor,ball):null;
   const attacker=frame.players.find(p=>p.team!==keeper.team&&p.id.endsWith('-10'));
   const challenge=closeChallengeEnabled&&shotTick===null&&tick-lastChallengeTick>=60?
    planNativeKeeperChallenge(actor,attacker,ball):null;
   const candidate=shotCandidate?freeze({...shotCandidate,kind:'shot'}):challenge;
   if(candidate){
    plan=candidate;startTick=tick;started=true;
    if(candidate.kind==='challenge')lastChallengeTick=tick;
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
  }else if(plan){
   const elapsed=tick-startTick+1,holdTicks=4,recoveryTicks=24;
   if(elapsed<=plan.reachTicks){
    phase=plan.kind==='challenge'?'challenging':'diving';target=lerp(plan.start,plan.target,elapsed/plan.reachTicks);
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
  prepared={tick,phase,started,priorVelocity:freeze({...ball.velocity}),
   plan:plan?freeze({kind:plan.kind,eta:plan.eta,limited:plan.limited,intended:plan.intended,target:plan.target}):null};
 }
 function observe(tick,postVelocity){
  if(prepared?.tick!==tick||!['x','y','z'].every(k=>finite(postVelocity?.[k])))
   throw new Error('Keeper dive requires same native world step and observed ball velocity');
  let hit=false;
  if(active)world.contactPair(ballCollider,glove,m=>{
   if(m.numContacts()>0&&m.numSolverContacts()>0)hit=true;
  });
  const pos=body.translation();
  if(hit&&grip&&!grip.active()&&prepared.phase!=='recovering'){
   const accepted=grip.tryGrip(tick,{contact:true,ballPosition:ballBody.translation(),
    before:prepared.priorVelocity,after:postVelocity,glovePosition:pos,gloveVelocity:body.linvel()});
   if(accepted){plan=null;glove.setCollisionGroups(0);}
  }
  const catchState=grip?.observe(tick)??null;
  if(catchState?.released){active=false;plan=null;}
  latest=freeze({version:KEEPER_DIVE_VERSION,tick,keeperId:keeper.id,
   phase:prepared.phase,started:prepared.started,plan:prepared.plan,
   glove:active?freeze({x:pos.x,y:pos.y,z:pos.z}):null,
   contact:hit,contactStarted:hit&&!priorHit,
   contactMotion:hit?freeze({before:prepared.priorVelocity,after:freeze({...postVelocity})}):null,
   catchState,
   officialSave:false,source:'native-rapier-solver-manifold'});
  priorHit=hit;prepared=null;return latest;
 }
 return freeze({prepare,observe,snapshot:()=>latest});
}
