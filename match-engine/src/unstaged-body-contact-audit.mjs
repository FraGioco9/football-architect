// #628 M11 — audit-only survey of the UNSTAGED original 22-player mover.
// No scripted player positions, target overrides, contact fabrication,
// authoritative body response or football match outcomes.
import {createEngine,FIXED_DT} from './core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_VERSION,
 PLAYER_MAX_SPEED_MPS,PLAYER_MIN_SEPARATION_M,PLAYER_PITCH,
 PLAYER_RADIUS_M} from './player-movement.mjs';

const freeze=o=>Object.freeze(o);
const state=(id,x,y)=>freeze({id,x,y});
export const M11_BALL_STARTS=freeze([
 state('centre',0,0),
 state('middle-halfspace',9,12),
 state('middle-wide',0,21),
 state('attacking-third',27,0),
 state('attacking-halfspace',27,12),
 state('attacking-wing',37,22),
 state('attacking-box',43,6),
 state('defending-third',-27,0),
 state('defending-halfspace',-27,-12),
 state('defending-box',-43,6),
 state('near-center-recovery',-9,-12),
 state('high-wide-recovery',-37,-22)
]);
const MAX_TICKS=240;
const finite=Number.isFinite;
const pair=(a,b)=>[a,b].sort().join('|');
const positionWithinPitch=p=>Math.abs(p.x)<=PLAYER_PITCH.lengthM/2-
 PLAYER_RADIUS_M+1e-8&&
 Math.abs(p.y)<=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M+1e-8;

function closestPair(actors,{opposingOnly=false}={}){
 let min=null;
 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
  const a=actors[i],b=actors[j];
  if(opposingOnly&&a.team===b.team)continue;
  const gap=Math.hypot(a.position.x-b.position.x,
   a.position.y-b.position.y);
  const label=pair(a.id,b.id);
  if(!min||gap<min.gapM-1e-10||
    (Math.abs(gap-min.gapM)<=1e-10&&label<min.pair))
   min=freeze({pair:label,gapM:gap,opposing:a.team!==b.team});
 }
 return min;
}

// A *read-only admissibility screen*, not a mover mutation or accepted
// football collision. Only a true active native pair is eligible; all 22
// positions must still respect 0.98m and <=7m/s from the previous sample.
// No synthetic pair may be introduced by this function.
export function screenNativeBodyResponse(priorFrame,currentFrame,body){
 if(!priorFrame||!currentFrame||!body||
  currentFrame.tick!==body.tick||
  priorFrame.tick!==currentFrame.tick-1||
  currentFrame.version!==PLAYER_VERSION||
  priorFrame.version!==PLAYER_VERSION||
  body.sameOriginalRapierBallWorld!==true||
  body.controlledEncounter!==false||
  body.physicalActors?.length!==22||
  !Array.isArray(body.activePairs)||
  !Array.isArray(body.events)||
  body.collisionColliderRadiusM!==PLAYER_MIN_SEPARATION_M/2||
  body.physicalPositionsFedBackIntoMover!==false||
  body.appliedMoverResponses!==0||
  priorFrame.players?.length!==22||currentFrame.players?.length!==22)
  throw new TypeError('M11 requires original unstaged same-tick physical source');
 const prior=priorFrame.players,current=currentFrame.players;
 const idMap=new Map();
 for(let i=0;i<22;i++){
  const a=prior[i],b=current[i],c=body.physicalActors[i];
  if(!a||!b||!c||a.id!==INITIAL_PLAYERS[i].id||
     b.id!==a.id||c.id!==b.id||c.team!==b.team||
     ![a.x,a.y,b.x,b.y,c.position?.x,c.position?.y].every(finite))
   throw new TypeError('M11 requires 22 original ordered physical players');
  idMap.set(b.id,i);
 }
 const activeIds=new Set();
 for(const label of body.activePairs){
  if(typeof label!=='string')throw new TypeError('Native pair must be original ID string');
  const ids=label.split('|');
  if(ids.length!==2||ids[0]===ids[1]||
   ids.slice().sort().join('|')!==label||
   !ids.every(id=>idMap.has(id)))
   throw new TypeError('M11 native active pair not in original 22');
  const authenticStart=body.events.some(e=>
   e.pair===label&&e.type==='rapier-body-start'&&
   e.source==='native-rapier-collision-event'&&
   Number.isSafeInteger(e.tick)&&e.tick>0&&e.tick<=body.tick);
  if(!authenticStart||body.actualNativeStarts<1)
   throw new TypeError('M11 native pair requires a preceding real Rapier START');
  ids.forEach(id=>activeIds.add(id));
 }
 if(!activeIds.size)return freeze({
  evaluated:false,admissible:false,reason:'no-native-active-pair',
  pairs:freeze([]),minCandidateGapM:null
 });
 const candidates=current.map((p,i)=>activeIds.has(p.id)?
  body.physicalActors[i].position:p);
 let minCandidateGapM=Infinity;
 for(let i=0;i<22;i++){
  const c=candidates[i],old=prior[i];
  if(!positionWithinPitch(c)||
     Math.hypot(c.x-old.x,c.y-old.y)>
      PLAYER_MAX_SPEED_MPS*FIXED_DT+1e-7)
   return freeze({
    evaluated:true,admissible:false,reason:'physical-speed-or-pitch',
    pairs:freeze([...body.activePairs]),minCandidateGapM:null
   });
  for(let j=i+1;j<22;j++)
   minCandidateGapM=Math.min(minCandidateGapM,
    Math.hypot(c.x-candidates[j].x,c.y-candidates[j].y));
 }
 if(minCandidateGapM<PLAYER_MIN_SEPARATION_M-1e-8)
  return freeze({
   evaluated:true,admissible:false,reason:'canonical-0.98m-separation',
   pairs:freeze([...body.activePairs]),minCandidateGapM
  });
 return freeze({
  evaluated:true,admissible:true,reason:'read-only-physically-admissible',
  pairs:freeze([...body.activePairs]),minCandidateGapM
 });
}

export function auditUnstagedBodyContacts(RAPIER,{
 stateId='centre',side='home',ticks=180,mode='native',
 movementPolicy='original'
}={}){
 if(!RAPIER||typeof RAPIER.World!=='function'||
  !['home','away'].includes(side)||!['native','off'].includes(mode)||
  !['original','contested-press'].includes(movementPolicy)||
  !Number.isSafeInteger(ticks)||ticks<1||ticks>MAX_TICKS||
  !M11_BALL_STARTS.some(s=>s.id===stateId))
  throw new TypeError('Only bounded original M11 Rapier ball-start audits');
 const selected=M11_BALL_STARTS.find(s=>s.id===stateId);
 const scenario=freeze({preset:'roll',seed:'m11-'+selected.id+'-'+side,
  x:side==='home'?selected.x:-selected.x,y:selected.y,
  z:0,vx:0,vy:0,vz:0});
 const native=mode==='native';
 const engine=createEngine(RAPIER,scenario,native?{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticSharedContactEventsEnabled:true
 }:{});
 // IMPORTANT: there are no mover options or player staging.
 const mover=movementPolicy==='contested-press'?
  createPlayerMovement({researchOpposingPressConvergence:true}):
  createPlayerMovement();
 let actualOpposingContestTicks=0,firstActualOpposingContest=null;
 let activeOpposingPressGapM=Infinity;
 let nearest=null,nearestOpposing=null,lowestCanonicalGapM=Infinity;
 let bodyStarts=0,footStarts=0,firstNativeStart=null;
 let firstAdmissibleResponse=null,screenedResponseFrames=0;
 let genuineSupportTicks=0,genuinePressTicks=0;
 let lowerThan145cmFrames=0;
 try{
  for(let t=1;t<=ticks;t++){
   const before=engine.snapshot(),prior=mover.snapshot();
   const movement=mover.step(before.ball.position);
   const after=engine.step(native?movement:undefined);
   if(after.tick!==t||movement.tick!==t||
      movement.players.length!==22||
      movement.version!==PLAYER_VERSION)
    throw new Error('M11 original canonical 60Hz tick drift');
   for(let i=0;i<22;i++){
    const p=movement.players[i],old=prior.players[i];
    if(p.id!==INITIAL_PLAYERS[i].id||p.team!==old.team||
       !positionWithinPitch(p)||
       Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-7||
       Math.hypot(p.x-old.x,p.y-old.y)>PLAYER_MAX_SPEED_MPS*FIXED_DT+1e-7)
     throw new Error('M11 original 22-player physical motion bound changed');
   }
   for(let i=0;i<22;i++)for(let j=i+1;j<22;j++)
    lowestCanonicalGapM=Math.min(lowestCanonicalGapM,
     Math.hypot(movement.players[i].x-movement.players[j].x,
      movement.players[i].y-movement.players[j].y));
   if(lowestCanonicalGapM<PLAYER_MIN_SEPARATION_M-1e-8)
    throw new Error('M11 original 0.98m canonical collision guard broken');
   if(movement.supports.home||movement.supports.away)genuineSupportTicks++;
   if(movement.pressers.home||movement.pressers.away)genuinePressTicks++;
   if(movementPolicy==='contested-press'){
    const current=movement.originalOpposingPressConvergence;
    if(!current||typeof current.active!=='boolean')
     throw new Error('M12 original observed opposing pressure evidence missing');
    if(current.active){
     if(!firstActualOpposingContest)
      firstActualOpposingContest=freeze({
       tick:t,playerIds:current.playerIds
      });
     actualOpposingContestTicks++;
     activeOpposingPressGapM=Math.min(
      activeOpposingPressGapM,current.opponentGapM);
    }
   }
   if(!native)continue;
   const body=engine.nativePlayerBodySnapshot();
   const shared=engine.sharedNativeContactSnapshot();
   if(body.tick!==t||shared.tick!==t||
      shared.oneNativeEventQueue!==true||
      shared.oneNativeRapierWorld!==true||
      body.physicalActors.length!==22||
      body.controlledEncounter!==false||
      body.physicalPositionsFedBackIntoMover!==false||
      body.appliedMoverResponses!==0||
      shared.genuineBodyStarts!==body.currentTickStarts||
      shared.officialMatchAction!==false||
      shared.officialTackle!==false||
      shared.officialPossession!==false||
      shared.officialResult!==null)
    throw new Error('Only original one-world native event evidence is admissible');
   footStarts+=shared.genuineFootStarts.length;
   const current=closestPair(body.physicalActors);
   const opposing=closestPair(body.physicalActors,{opposingOnly:true});
   if(!nearest||current.gapM<nearest.gapM-1e-10)
    nearest=freeze({...current,tick:t});
   if(!nearestOpposing||opposing.gapM<nearestOpposing.gapM-1e-10)
    nearestOpposing=freeze({...opposing,tick:t});
   if(current.gapM<1.45)lowerThan145cmFrames++;
   if(body.currentTickStarts>0){
    const started=body.events.filter(e=>e.tick===t&&
      e.type==='rapier-body-start'&&
      e.source==='native-rapier-collision-event');
    if(started.length!==body.currentTickStarts)
     throw new Error('No attribution without current native collision START');
    if(!firstNativeStart)
     firstNativeStart=freeze({
      tick:t,pairs:freeze(started.map(x=>x.pair).sort()),
      source:'native-rapier-collision-event'
     });
   }
   if(body.actualNativeStarts!==bodyStarts+body.currentTickStarts)
    throw new Error('Native body START total must equal sourced tick delta');
   bodyStarts=body.actualNativeStarts;
   const candidate=screenNativeBodyResponse(prior,movement,body);
   if(candidate.evaluated){
    screenedResponseFrames++;
    if(candidate.admissible&&!firstAdmissibleResponse)
     firstAdmissibleResponse=freeze({
      tick:t,pairs:candidate.pairs,
      minCandidateGapM:candidate.minCandidateGapM
     });
   }
  }
  return freeze({
   version:'m11-original-unstaged-body-audit-v1',
   stateId,side,mode,ticks,initialBall:freeze({x:scenario.x,y:scenario.y}),
   original22Unstaged:true,oneOriginalRapierBallWorld:true,
   nativePlayerBodiesEnabled:native,oneNativeEventQueue:native,
   bodyCollisionStarts:bodyStarts,
   footCollisionStarts:footStarts,
   firstNativeBodyStart:firstNativeStart,
   nearestPhysicalPair:nearest,nearestOpposingPhysicalPair:nearestOpposing,
   nearestCanonicalGapM:lowestCanonicalGapM,
   nearPhysicalFramesBelow145cm:lowerThan145cmFrames,
   eligibleResponseFrames:screenedResponseFrames,
   firstReadOnlyAdmissibleResponse:firstAdmissibleResponse,
   genuineSupportTicks,genuinePressTicks,
   ...(movementPolicy==='contested-press'?{
    movementPolicy:'contested-press',
    actualOpposingContestTicks,firstActualOpposingContest,
    minActiveOpposingPressGapM:activeOpposingPressGapM===Infinity?
     null:activeOpposingPressGapM
   }:{}),
   actualMoverFeedbackCount:0,
   officialAction:false,officialTackle:false,
   officialPossession:false,officialResult:null
  });
 }finally{engine.dispose();}
}
