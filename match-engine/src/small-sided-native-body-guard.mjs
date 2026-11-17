// #628 LAB-VAR-02B — isolated native physical lower-leg/body collisions.
// SAME original Rapier world and step. Only selected small-sided actors have
// native colliders. 22 canonical mover identities remain authoritative for
// movement; no second physics world, artificial collision/possession or kick.
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_DT,PLAYER_MAX_SPEED_MPS}
 from './player-movement.mjs';

export const SMALL_SIDED_BODY_VERSION='me-628-native-physical-body-guard-v1';
const TORSO_CATEGORY=0x0020,LEG_CATEGORY=0x0040,BALL_CATEGORY=0x0001;
const TORSO_RADIUS_M=0.51,LEG_RADIUS_M=0.28,LEG_CENTRE_Z_M=0.43;
const TORSO_OFFSET_Z_M=0.57;
const finite=Number.isFinite;
const freeze=Object.freeze;
const idPair=(a,b)=>[a,b].sort().join('|');

export function createSmallSidedNativeBodyGuard(R,world,ballCollider,
 initialPlayers,activePlayerIds){
 if(!R?.RigidBodyDesc||!R?.ColliderDesc||
    typeof world?.createRigidBody!=='function'||
    typeof world?.contactPair!=='function'||
    ballCollider?.handle===undefined||
    !Array.isArray(initialPlayers)||initialPlayers.length!==22||
    !Array.isArray(activePlayerIds)||activePlayerIds.length<2||
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
  const torso=world.createCollider(R.ColliderDesc.ball(TORSO_RADIUS_M)
   .setTranslation(0,0,TORSO_OFFSET_Z_M)
   .setDensity(35).setFriction(0.6).setRestitution(0)
   .setCollisionGroups((TORSO_CATEGORY<<16)|TORSO_CATEGORY),rigid);
  // Lower leg: can physically deflect the existing ball, but never touch
  // shoe colliders. Body contact is not automatically "ball protection".
  const leg=world.createCollider(R.ColliderDesc.ball(LEG_RADIUS_M)
   .setDensity(80).setFriction(0.7).setRestitution(0)
   .setCollisionGroups((LEG_CATEGORY<<16)|BALL_CATEGORY),rigid);
  entries.push({id:actor.id,team:actor.team,rigid,torso,leg});
 }
 if(entries.length!==activePlayerIds.length)
  throw new Error('Selected physical body identity mismatch');
 let tick=0,prepared=null,disposed=false,previousBallIds=new Set();
 let latest=null,prior=initialPlayers.map(p=>({id:p.id,x:p.x,y:p.y}));
 function requireLive(){if(disposed)throw new Error('Physical body guard disposed');}
 function snapshot(){requireLive();return latest;}
 function prepare(frame,nextTick){
  requireLive();
  if(prepared!==null||nextTick!==tick+1||
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
 function dispose(){disposed=true;}
 latest=freeze({version:SMALL_SIDED_BODY_VERSION,tick:0,
  oneOriginalRapierWorld:true,selectedColliderIds:freeze(entries.map(e=>e.id)),
  lowerLegBallContacts:freeze([]),lowerLegBallStarts:freeze([]),
  lowerLegBallEnds:freeze([]),nativeOpposingTorsoPairs:freeze([]),
  bodies:freeze([]),ballProtectionProven:false,
  successfulPossession:false,tackleWon:false,officialMatchResult:null,
  evidenceSource:'native-rapier-solver-manifold'});
 return freeze({prepare,observe,snapshot,dispose});
}
