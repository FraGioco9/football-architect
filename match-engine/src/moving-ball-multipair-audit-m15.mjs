// #628 M15 — authentic multi-pair research: vary only the initial rolling
// ball trajectory. No player staging, invented native events or collider gain.
import {auditNaturalNativeFeedback} from './natural-native-feedback-audit-m14.mjs';
import {M11_BALL_STARTS} from './unstaged-body-contact-audit.mjs';

const freeze=Object.freeze;
const motions=freeze([
 freeze({id:'forward-roll',vx:4,vy:0}),
 freeze({id:'reverse-roll',vx:-4,vy:0}),
 freeze({id:'diagonal-roll',vx:3.6,vy:2.4}),
 freeze({id:'crossfield-roll',vx:0,vy:4.8})
]);
export const M15_ORIGINAL_BALL_MOTIONS=motions;
const byMotion=new Map(motions.map(x=>[x.id,x]));
const originalStates=new Set(M11_BALL_STARTS.map(x=>x.id));
const DEFAULT_STATES=freeze(M11_BALL_STARTS.map(x=>x.id));
const DEFAULT_MOTIONS=freeze(motions.map(x=>x.id));
function validateSelection(x,known){
 return Array.isArray(x)&&x.length>0&&
  x.every(id=>typeof id==='string'&&known.has(id))&&
  new Set(x).size===x.length;
}

// Every run keeps one real Rapier World, all 22 original players, real body
// and shoe events, and the same source-driven autonomous press. The paired
// observe-only run can have a different later trajectory because feedback
// changes genuine next-frame positions; NEVER require equal contact counts.
export function auditMovingBallMultiPairMatrix(RAPIER,{
 stateIds=DEFAULT_STATES,velocityIds=DEFAULT_MOTIONS,ticks=225
}={}){
 if(!RAPIER||typeof RAPIER.World!=='function'||
    !validateSelection(stateIds,originalStates)||
    !validateSelection(velocityIds,byMotion)||
    !Number.isSafeInteger(ticks)||ticks<1||ticks>240)
  throw new TypeError('M15 requires original bounded states and rolling velocities');
 const rows=[];
 for(const stateId of stateIds)for(const velocityId of velocityIds){
  const motion=byMotion.get(velocityId);
  for(const side of ['home','away'])for(const mode of ['feedback','observe']){
   const audit=auditNaturalNativeFeedback(RAPIER,{
    stateId,side,mode,ticks,initialBallVelocity:{vx:motion.vx,vy:motion.vy}
   });
   rows.push(freeze({...audit,velocityId}));
  }
 }
 const positive=rows.filter(x=>x.mode==='feedback');
 const negative=rows.filter(x=>x.mode==='observe');
 for(const p of positive){
  const n=negative.find(x=>x.stateId===p.stateId&&
   x.side===p.side&&x.velocityId===p.velocityId);
  if(!n||JSON.stringify(n.initialBall)!==JSON.stringify(p.initialBall)||
     n.initialRollingFraction!==1||p.initialRollingFraction!==1||
     !p.original22Unstaged||!n.original22Unstaged||
     !p.singleNativeEventQueue||!n.singleNativeEventQueue||
     p.matchAuthority||n.matchAuthority||
     n.acceptedNativeResponses!==0||
     n.firstAppliedFeedback!==null)
   throw new Error('M15 paired original Rapier source/negative-control violated');
 }
 const multiple=positive.filter(x=>x.firstSimultaneousBodyPairs!==null);
 const first=multiple[0]??null;
 return freeze({
  version:'m15-moving-ball-authentic-native-multipair-search-v1',
  originalTerritories:stateIds.length,originalRollingProfiles:velocityIds.length,
  runs:rows.length,ticksPerRun:ticks,rows:freeze(rows),
  feedbackNativeBodyStarts:positive.reduce((n,x)=>n+x.nativeBodyStarts,0),
  feedbackNativeShoeStarts:positive.reduce((n,x)=>n+x.nativeShoeStarts,0),
  actualCanonicalResponses:positive.reduce((n,x)=>n+x.acceptedNativeResponses,0),
  controlsCanonicalResponses:negative.reduce((n,x)=>n+x.acceptedNativeResponses,0),
  maximumSimultaneousNativeBodyPairs:Math.max(
   ...positive.map(x=>x.maxSimultaneousBodyPairs)),
  trueMultiPairContactObserved:multiple.length>0,
  realMultiPairFeedbackRuns:multiple.length,
  firstRealMultiPairEvidence:first?freeze({
   stateId:first.stateId,velocityId:first.velocityId,side:first.side,
   ...first.firstSimultaneousBodyPairs
  }):null,
  allPlayersOriginal:true,matchAuthority:false
 });
}
