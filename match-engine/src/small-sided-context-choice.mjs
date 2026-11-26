// #628 LAB-VAR-02: a PURE, evidence-only contextual choice for a REAL
// existing one-shoe Rapier contact in the five small-sided exercises.
// This never creates a contact, moves a player, chooses a final match outcome
// or applies an impulse. It uses live source geometry; the private existing
// Rapier contact executor remains the sole authority to apply physical kicks.
import {getSmallSidedScenario,SMALL_SIDED_VARIANT_COUNT}
 from './small-sided-lab-scenarios.mjs';

export const SMALL_SIDED_CONTEXT_CHOICE_VERSION=
 'me-628-live-situation-seeded-choice-v1';
const freeze=Object.freeze;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function deterministicFraction(key){
 let h=2166136261;
 for(const char of key)h=Math.imul(h^char.charCodeAt(0),16777619)>>>0;
 return h/4294967296;
}
export function chooseSmallSidedContextAction({
 situationId,variantIndex,tick,actorId,team,attackingSide,
 goalDistanceM,nearestOpponentM,shotLaneClearanceM=null,
 passLaneClearanceM=null,recipientOpponentGapM=null,passForwardM=null,
 canShoot=false,canPass=false,canCarry=false,collective=false
}={}){
 getSmallSidedScenario(situationId); // only five declared exercises
 if(typeof collective!=='boolean'||(collective&&situationId!=='overload-2v1')||
    !Number.isSafeInteger(variantIndex)||variantIndex<(collective?0:1)||
    variantIndex>=SMALL_SIDED_VARIANT_COUNT||
    !Number.isSafeInteger(tick)||tick<1||
    !['home','away'].includes(team)||team!==attackingSide||
    !new RegExp('^'+team+'-([1-9]|10|11)$').test(actorId)||
    !finite(goalDistanceM)||goalDistanceM<0||goalDistanceM>105||
    !finite(nearestOpponentM)||nearestOpponentM<0||nearestOpponentM>150||
    [canShoot,canPass,canCarry].some(x=>typeof x!=='boolean')||
    (canShoot&&(!finite(shotLaneClearanceM)||shotLaneClearanceM<2.4))||
    (canPass&&(!finite(passLaneClearanceM)||passLaneClearanceM<1.9||
      !finite(recipientOpponentGapM)||recipientOpponentGapM<1.6||
      !finite(passForwardM)||passForwardM< -3)))
  throw new TypeError('Only live bounded attacking-side geometry and seeded variants allowed');
 // Scores are contextual weights, NOT a forced action rotation or a claim
 // of shot completion/pass reception/dribble success. If an affordance is
 // blocked, its weight is exactly zero and cannot be chosen.
 const pressure=nearestOpponentM<3;
 const weights=freeze({
  shot:canShoot?
   clamp(1.4+(35-clamp(goalDistanceM,0,35))*0.055+
    clamp(shotLaneClearanceM-2.4,0,6)*0.18-(pressure?0.75:0),
    0.35,5):0,
  pass:canPass?
   clamp(1.35+clamp(passLaneClearanceM-1.9,0,8)*0.15+
    clamp(recipientOpponentGapM-1.6,0,12)*0.065+
    clamp(passForwardM,0,16)*0.035+(pressure?0.8:0),
    0.35,5):0,
  carry:canCarry?
   clamp(1.15+clamp(nearestOpponentM-1.2,0,12)*0.11+
    (goalDistanceM>9?0.5:0)-(nearestOpponentM<2?0.7:0),
    0.3,4):0
 });
 const total=weights.shot+weights.pass+weights.carry;
 if(total<=0)return null; // caller retains the verified legacy fallback
 // Team independent: identical mirrored HOME/AWAY geometry and physical
 // tick produce the same choice for corresponding shirt numbers.
 const number=actorId.slice(actorId.indexOf('-')+1);
 const sample=collective?null:deterministicFraction(
  situationId+'|'+variantIndex+'|'+number+'|'+tick);
 const target=sample*total;
 // Collective mode uses the best eligible contextual score, never the
 // shirt number or a forced action distribution. Stable tie order only.
 const selected=collective?['shot','pass','carry'].reduce((best,kind)=>weights[kind]>weights[best]?kind:best):target<weights.shot?'shot':
  target<weights.shot+weights.pass?'pass':'carry';
 return freeze({
  version:SMALL_SIDED_CONTEXT_CHOICE_VERSION,
  selected,weights,sample,
  context:freeze({
   goalDistanceM,nearestOpponentM,shotLaneClearanceM,
   passLaneClearanceM,recipientOpponentGapM,passForwardM,
   underPressure:pressure,canShoot,canPass,canCarry
  }),
  decisionOnly:true, // the executor still requires a real Rapier shoe START
  officialMatchAction:false,officialPossession:false,officialGoal:false,
  noInferredReception:true
 });
}
