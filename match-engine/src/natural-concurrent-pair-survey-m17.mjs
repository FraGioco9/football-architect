// #628 M17 — read-only classification of the genuine M15 START/END ledger.
// The sole event producer remains the SAME original 22-player Rapier World.
// Never infer collision from proximity, counts on different ticks, or shoes.
import {M11_BALL_STARTS} from './unstaged-body-contact-audit.mjs';
import {M15_ORIGINAL_BALL_MOTIONS}
 from './moving-ball-multipair-audit-m15.mjs';

const freeze=Object.freeze;
const originalStates=new Set(M11_BALL_STARTS.map(s=>s.id));
const originalVelocities=new Set(M15_ORIGINAL_BALL_MOTIONS.map(s=>s.id));
const key=p=>[p.stateId,p.velocityId,p.side].join(':');
const allPositions=freeze([...originalStates]);
const allVelocities=freeze([...originalVelocities]);

function strictPairWitness(p){
 const witness=p.firstSimultaneousBodyPairs;
 if(p.maxSimultaneousBodyPairs<2)
  return witness===null&&p.simultaneousBodyPairTicks===0;
 if(!witness||!Number.isSafeInteger(witness.tick)||
    witness.tick<1||witness.tick>p.ticks||
    !Array.isArray(witness.pairs)||witness.pairs.length<2||
    new Set(witness.pairs).size!==witness.pairs.length||
    p.simultaneousBodyPairTicks<1)
  return false;
 const actualIds=new Set(Array.from({length:22},(_,i)=>[
  'home','away'][Math.floor(i/11)]+'-'+((i%11)+1)));
 return witness.pairs.every(pair=>{
  const ids=pair.split('|');
  return ids.length===2&&ids[0]<ids[1]&&
   ids.every(id=>actualIds.has(id))&&p.realBodyPairs.includes(pair);
 });
}

// The input already passed auditNaturalNativeFeedback's independent same-
// tick ledger check against Rapier events; this extra classifier may only
// accept a complete paired M15 source, not a second event producer.
export function summarizeOriginalConcurrentPairSurvey(matrix){
 if(!matrix||matrix.version!==
    'm15-moving-ball-authentic-native-multipair-search-v1'||
    matrix.handoffPolicy!=='bounded'||!Array.isArray(matrix.rows)||
    !Array.isArray(matrix.blocked)||matrix.runs!==matrix.rows.length+
     matrix.blocked.length)
  throw new TypeError('M17 requires bounded real Rapier M15 source matrix');
 const rows=matrix.rows;
 const seen=new Set();
 const feedback=new Map(),controls=new Map();
 for(const p of rows){
  if(!originalStates.has(p.stateId)||
     !originalVelocities.has(p.velocityId)||
     !['home','away'].includes(p.side)||
     !['feedback','observe'].includes(p.mode)||
     !Number.isSafeInteger(p.ticks)||p.ticks<1||p.ticks>240||
     p.original22Unstaged!==true||p.sameRapierWorld!==true||
     p.singleNativeEventQueue!==true||
     p.nativeColliderRadiusM!==0.49||
     p.initialRollingFraction!==1||
     p.fullShapeTicks!==p.ticks||
     p.matchAuthority!==false||p.officialTackle!==false||
     p.officialInterception!==false||p.officialPossession!==false||
     p.officialResult!==null||
     !Number.isFinite(p.minimumCanonicalGapM)||
     p.minimumCanonicalGapM<0.98-1e-8||
     !Number.isFinite(p.peakCanonicalSpeedMps)||
     p.peakCanonicalSpeedMps>7+1e-7||
     !strictPairWitness(p))
   throw new TypeError('M17 requires intact original 60Hz native-source and pair witnesses');
  const identity=key(p),rowKey=identity+':'+p.mode;
  if(seen.has(rowKey))
   throw new TypeError('M17 original source case may not appear twice');
  seen.add(rowKey);
  (p.mode==='feedback'?feedback:controls).set(identity,p);
  if(p.mode==='observe'&&(p.acceptedNativeResponses!==0||
     p.firstAppliedFeedback!==null))
   throw new TypeError('M17 negative native observer must never mutate player');
 }
 const positives=[];
 for(const [identity,p] of feedback){
  const control=controls.get(identity);
  if(!control||
     JSON.stringify(p.initialBall)!==JSON.stringify(control.initialBall)||
     p.ticks!==control.ticks||
     p.shoeBodyHandoff!=='bounded'||
     control.shoeBodyHandoff!=='observe-only')
   throw new TypeError('M17 requires complete mirrored physical/control pair');
  if(p.firstSimultaneousBodyPairs!==null)
   positives.push(freeze({
    stateId:p.stateId,velocityId:p.velocityId,side:p.side,
    tick:p.firstSimultaneousBodyPairs.tick,
    nativePairs:freeze([...p.firstSimultaneousBodyPairs.pairs]),
    source:'same-original-rapier-body-start-end-ledger',
    confirmedSameTick:true
   }));
 }
 for(const identity of controls.keys())
  if(!feedback.has(identity))
   throw new TypeError('M17 requires a genuine feedback twin for each observer');
 const summary=freeze({
  version:'m17-exhaustive-original-native-pair-survey-v1',
  originalTerritories:matrix.originalTerritories,
  originalRollingProfiles:matrix.originalRollingProfiles,
  sourceTicksPerRun:matrix.ticksPerRun,
  fullOriginalTerritoryCoverage:
   new Set(rows.map(p=>p.stateId)).size===allPositions.length,
  fullOriginalVelocityCoverage:
   new Set(rows.map(p=>p.velocityId)).size===allVelocities.length,
  requestedRuns:matrix.runs,completedRuns:matrix.completedRuns,
  blockedRuns:matrix.blockedRuns,
  completeFeedbackControlPairs:feedback.size,
  realFeedbackNativeStarts:matrix.feedbackNativeBodyStarts,
  realFeedbackShoeStarts:matrix.feedbackNativeShoeStarts,
  acceptedCanonicalCorrections:matrix.actualCanonicalResponses,
  negativeControlCorrections:matrix.controlsCanonicalResponses,
  largestSameTickNativePairCount:matrix.maximumSimultaneousNativeBodyPairs,
  genuineMultiPairGatePassed:positives.length>0,
  simultaneousNativeWitnesses:freeze(positives),
  firstSimultaneousNativeWitness:positives[0]??null,
  allOriginal22Players:true,oneNativeWorldAndQueue:true,
  matchAuthority:false,
  cases:freeze(rows.map(p=>freeze({
   stateId:p.stateId,velocityId:p.velocityId,
   side:p.side,mode:p.mode,ticks:p.ticks,
   realBodyStarts:p.nativeBodyStarts,realBodyEnds:p.nativeBodyEnds,
   realShoeStarts:p.nativeShoeStarts,
   acceptedNativeResponses:p.acceptedNativeResponses,
   maxSameTickNativePairs:p.maxSimultaneousBodyPairs,
   firstNativeMultiPair:p.firstSimultaneousBodyPairs,
   validMinSeparationM:p.minimumCanonicalGapM,
   maxPlayerSpeedMps:p.peakCanonicalSpeedMps,
   physicsShoeHandoff:p.sourceBoundShoeHandoff
  }))),
  uncompletedCases:freeze(matrix.blocked.map(p=>freeze({
   stateId:p.stateId,velocityId:p.velocityId,side:p.side,
   mode:p.mode,blockedAtTick:p.blockedAtTick,reason:p.reason
  })))
 });
 if(summary.genuineMultiPairGatePassed!==matrix.trueMultiPairContactObserved||
    summary.negativeControlCorrections!==0)
  throw new TypeError('M17 cannot promote observational or inferred collision');
 return summary;
}
