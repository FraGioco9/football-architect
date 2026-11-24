// #628 M18 — expanded PRE-TICK-ZERO REAL BALL conditions ONLY.
// All 22 original players + autonomous decisions and Rapier colliders stay fixed.
import {auditNaturalNativeFeedback}
 from './natural-native-feedback-audit-m14.mjs';
import {INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,PLAYER_MIN_SEPARATION_M}
 from './player-movement.mjs';
import {FIXED_DT} from './core.mjs';

const freeze=Object.freeze;
const xs=freeze([-12,-6,0,6,12]);
const ys=freeze([-18,-9,0,9,18]);
export const M18_ORIGINAL_BALL_POSITIONS=freeze(xs.flatMap(x=>
 ys.map(y=>freeze({id:'centre-x'+x+'-y'+y,x,y}))
));
export const M18_ORIGINAL_BALL_VELOCITIES=freeze([
 freeze({id:'forward-68',vx:6.8,vy:0}),
 freeze({id:'reverse-68',vx:-6.8,vy:0}),
 freeze({id:'north-68',vx:0,vy:6.8}),
 freeze({id:'south-68',vx:0,vy:-6.8}),
 freeze({id:'diagonal-south',vx:4.8,vy:-4.8}),
 freeze({id:'reverse-diagonal-north',vx:-4.8,vy:4.8})
]);
const byPosition=new Map(M18_ORIGINAL_BALL_POSITIONS.map(x=>[x.id,x]));
const byVelocity=new Map(M18_ORIGINAL_BALL_VELOCITIES.map(x=>[x.id,x]));
const validSelection=(ids,allowed)=>Array.isArray(ids)&&ids.length>0&&
 new Set(ids).size===ids.length&&
 ids.every(id=>typeof id==='string'&&allowed.has(id));
const pairKey=r=>[r.positionId,r.velocityId,r.side].join('/');
const sourceKey=r=>pairKey(r)+'/'+r.mode;
const originalIds=new Set(INITIAL_PLAYERS.map(p=>p.id));
const originalPair=label=>{
 if(typeof label!=='string')return false;
 const ids=label.split('|');
 return ids.length===2&&ids[0]<ids[1]&&
  ids.every(id=>originalIds.has(id));
};
const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<=1e-10;

function verifySourceRow(r,ticks){
 const p=byPosition.get(r.positionId),v=byVelocity.get(r.velocityId);
 if(!p||!v||!['home','away'].includes(r.side)||
    !['feedback','observe'].includes(r.mode)||
    r.stateId!=='centre'||r.ticks!==ticks||
    r.ballStartSource!=='m18-original-ball-only-before-tick-zero'||
    !r.ballStartLocal||r.ballStartLocal.x!==p.x||
    r.ballStartLocal.y!==p.y||
    !r.initialBall||!near(r.initialBall.x,(r.side==='home'?1:-1)*p.x)||
    !near(r.initialBall.y,p.y)||
    !near(r.initialBall.vx,(r.side==='home'?1:-1)*v.vx)||
    !near(r.initialBall.vy,v.vy)||
    r.initialRollingFraction!==1||
    r.original22Unstaged!==true||r.sameRapierWorld!==true||
    r.singleNativeEventQueue!==true||
    r.nativeColliderRadiusM!==PLAYER_MIN_SEPARATION_M/2||
    r.fullShapeTicks!==ticks||
    r.matchAuthority!==false||r.officialTackle!==false||
    r.officialInterception!==false||r.officialPossession!==false||
    r.officialResult!==null||
    !Number.isFinite(r.minimumCanonicalGapM)||
    r.minimumCanonicalGapM<PLAYER_MIN_SEPARATION_M-1e-8||
    !Number.isFinite(r.peakCanonicalSpeedMps)||
    r.peakCanonicalSpeedMps>PLAYER_MAX_SPEED_MPS+1e-7||
    (r.mode==='feedback'&&r.shoeBodyHandoff!=='bounded')||
    (r.mode==='observe'&&(r.shoeBodyHandoff!=='observe-only'||
      r.acceptedNativeResponses!==0||r.firstAppliedFeedback!==null))||
    !Array.isArray(r.realBodyPairs)||
    !r.realBodyPairs.every(originalPair)||
    !Number.isSafeInteger(r.nativeBodyStarts)||
    !Number.isSafeInteger(r.nativeBodyEnds)||
    r.nativeBodyStarts<0||r.nativeBodyEnds<0||
    r.nativeBodyEnds>r.nativeBodyStarts||
    !Number.isSafeInteger(r.maxSimultaneousBodyPairs)||
    !Number.isSafeInteger(r.simultaneousBodyPairTicks)||
    r.maxSimultaneousBodyPairs<0||
    r.simultaneousBodyPairTicks<0||
    r.simultaneousBodyPairTicks>ticks)
  throw new TypeError('M18 original Rapier source/kinematics/controls corrupted');
 if(r.maxSimultaneousBodyPairs<2){
  if(r.firstSimultaneousBodyPairs!==null||
     r.simultaneousBodyPairTicks!==0)
   throw new TypeError('M18 may not promote contacts across different ticks');
 }else{
  const w=r.firstSimultaneousBodyPairs;
  if(!w||!Number.isSafeInteger(w.tick)||
     w.tick<1||w.tick>ticks||r.simultaneousBodyPairTicks<1||
     !Array.isArray(w.pairs)||w.pairs.length<2||
     w.pairs.length>r.maxSimultaneousBodyPairs||
     new Set(w.pairs).size!==w.pairs.length||
     !w.pairs.every(q=>originalPair(q)&&r.realBodyPairs.includes(q)))
   throw new TypeError('M18 requires two genuine same-tick active Rapier pair IDs');
 }
}

// M14 independently replayed each current-world native START/END sequence.
// This M18 layer only checks COMPLETE sources and paired real negatives.
export function summarizeExpandedNativePairSource(matrix){
 if(!matrix||matrix.version!=='m18-original-ball-only-source-matrix-v1'||
    !validSelection(matrix.positionIds,byPosition)||
    !validSelection(matrix.velocityIds,byVelocity)||
    !Number.isSafeInteger(matrix.ticks)||matrix.ticks<1||
    matrix.ticks>240||!Array.isArray(matrix.rows)||
    !Array.isArray(matrix.blocked)||
    matrix.runs!==matrix.positionIds.length*
     matrix.velocityIds.length*4||
    matrix.rows.length+matrix.blocked.length!==matrix.runs)
  throw new TypeError('M18 requires complete bounded original ball-only matrix');
 const pos=new Set(matrix.positionIds),vel=new Set(matrix.velocityIds);
 const records=new Set(),feedback=new Map(),controls=new Map();
 for(const r of matrix.rows){
  if(!pos.has(r.positionId)||!vel.has(r.velocityId))
   throw new TypeError('M18 foreign ball start or velocity');
  verifySourceRow(r,matrix.ticks);
  const k=sourceKey(r);
  if(records.has(k))throw new TypeError('M18 duplicate native case');
  records.add(k);
  (r.mode==='feedback'?feedback:controls).set(pairKey(r),r);
 }
 for(const b of matrix.blocked){
  if(!pos.has(b.positionId)||!vel.has(b.velocityId)||
     !['home','away'].includes(b.side)||
     !['feedback','observe'].includes(b.mode)||
     b.reason!=='genuine-physical-shoe-body-mismatch'||
     !Number.isSafeInteger(b.blockedAtTick)||
     b.blockedAtTick<1||b.blockedAtTick>matrix.ticks||
     records.has(sourceKey(b)))
   throw new TypeError('M18 cannot hide a blocked/duplicated physical source');
  records.add(sourceKey(b));
 }
 const pairings=[],witnesses=[];
 for(const [k,p] of feedback){
  const control=controls.get(k);
  if(!control)continue;
  if(JSON.stringify(p.initialBall)!==JSON.stringify(control.initialBall))
   throw new TypeError('M18 feedback vs observer must share exact real ball');
  pairings.push(freeze({positionId:p.positionId,velocityId:p.velocityId,
   side:p.side}));
  if(p.firstSimultaneousBodyPairs){
   witnesses.push(freeze({positionId:p.positionId,
    velocityId:p.velocityId,side:p.side,
    tick:p.firstSimultaneousBodyPairs.tick,
    nativePairs:freeze([...p.firstSimultaneousBodyPairs.pairs]),
    source:'independently-replayed-original-rapier-START-END',
    sameTick:true}));
  }
 }
 const positive=[...feedback.values()];
 const negative=[...controls.values()];
 const complete=matrix.blocked.length===0&&
  feedback.size===matrix.runs/2&&controls.size===matrix.runs/2&&
  pairings.length===matrix.runs/2;
 const totalNegative=negative.reduce((n,r)=>n+r.acceptedNativeResponses,0);
 if(totalNegative!==0)throw new TypeError('M18 negative may not write real response');
 return freeze({
  version:'m18-original-expanded-native-concurrent-pair-evidence-v1',
  originalBallOnly:true,allOriginalPlayersUnstaged:true,
  identicalNativeRapierWorldAndEventQueue:true,matchAuthority:false,
  positions:matrix.positionIds.length,
  rollingProfiles:matrix.velocityIds.length,
  requestedRuns:matrix.runs,completedRuns:matrix.rows.length,
  blockedRuns:matrix.blocked.length,sourceTicksPerRun:matrix.ticks,
  fullPairedCases:pairings.length,completeOriginalSource:complete,
  nativeBodyStarts:positive.reduce((n,r)=>n+r.nativeBodyStarts,0),
  nativeBodyEnds:positive.reduce((n,r)=>n+r.nativeBodyEnds,0),
  nativeShoeStarts:positive.reduce((n,r)=>n+r.nativeShoeStarts,0),
  physicalCorrections:positive.reduce(
   (n,r)=>n+r.acceptedNativeResponses,0),
  controlCorrections:totalNegative,
  peakSameTickNativeBodyPairs:Math.max(0,
   ...positive.map(r=>r.maxSimultaneousBodyPairs)),
  genuineMultiPairGatePassed:complete&&witnesses.length>0,
  positiveSimultaneousNativeWitnesses:freeze(witnesses),
  firstPositiveWitness:witnesses[0]??null,
  cases:freeze(matrix.rows.map(r=>freeze({
   positionId:r.positionId,velocityId:r.velocityId,
   side:r.side,mode:r.mode,ticks:r.ticks,
   ball:freeze({...r.initialBall}),
   trueBodyStarts:r.nativeBodyStarts,
   trueBodyEnds:r.nativeBodyEnds,
   trueShoeStarts:r.nativeShoeStarts,
   acceptedCanonicalCorrections:r.acceptedNativeResponses,
   peakNativeBodyPairs:r.maxSimultaneousBodyPairs,
   firstSameTickNativePairs:r.firstSimultaneousBodyPairs,
   minCanonicalGapM:r.minimumCanonicalGapM,
   maxCanonicalSpeedMps:r.peakCanonicalSpeedMps,
   boundedShoeHandoff:r.sourceBoundShoeHandoff
  }))),
  blocked:freeze(matrix.blocked.map(r=>freeze({...r})))
 });
}

export function auditExpandedNativePairSource(RAPIER,{
 positionIds=M18_ORIGINAL_BALL_POSITIONS.map(p=>p.id),
 velocityIds=M18_ORIGINAL_BALL_VELOCITIES.map(v=>v.id),
 ticks=240
}={}){
 if(!RAPIER||typeof RAPIER.World!=='function'||
    !validSelection(positionIds,byPosition)||
    !validSelection(velocityIds,byVelocity)||
    !Number.isSafeInteger(ticks)||ticks<1||ticks>240)
  throw new TypeError('M18 only authentic bounded ball-start grid/motion');
 const rows=[],blocked=[];
 for(const positionId of positionIds){
  const pos=byPosition.get(positionId);
  for(const velocityId of velocityIds){
   const velocity=byVelocity.get(velocityId);
   for(const side of ['home','away'])
    for(const mode of ['feedback','observe']){
     try{
      const r=auditNaturalNativeFeedback(RAPIER,{
       stateId:'centre',side,mode,ticks,
       shoeBodyHandoff:'bounded',
       researchBallStart:{x:pos.x,y:pos.y},
       initialBallVelocity:{vx:velocity.vx,vy:velocity.vy}
      });
      rows.push(freeze({...r,positionId,velocityId}));
     }catch(e){
      if(e?.code!=='M15_NATIVE_SHOE_MOTION_BLOCKED')throw e;
      blocked.push(freeze({positionId,velocityId,side,mode,
       reason:'genuine-physical-shoe-body-mismatch',
       blockedAtTick:e.auditTick,
       violations:e.auditViolations}));
     }
    }
  }
 }
 return summarizeExpandedNativePairSource(freeze({
  version:'m18-original-ball-only-source-matrix-v1',
  positionIds:freeze([...positionIds]),
  velocityIds:freeze([...velocityIds]),ticks,
  runs:positionIds.length*velocityIds.length*4,
  rows:freeze(rows),blocked:freeze(blocked)
 }));
}
