/** PLYR-06.4 — only qualitative, allowlisted projections.
 * Evidence belongs to an observer/club; the profile is PRIVATE engine input.
 * No numeric traits, ranges, confidence, future inference or seed in UI DTO.
 */
import {TRAITS,TRAIT_KEYS,validatePersonality,fnv,describeTrait} from './player-personality.mjs';
const locale=l=>String(l).toLowerCase().startsWith('en')?'en':'it';
const int=n=>Number.isSafeInteger(n)&&n>=0&&n<=12;
export const emptyTraitEvidence=()=>Object.fromEntries(TRAIT_KEYS.map(k=>[k,0]));
export function validateTraitEvidence(evidence){
 if(evidence===null||typeof evidence!=='object'||Array.isArray(evidence)
   ||Object.keys(evidence).length!==TRAIT_KEYS.length||!TRAIT_KEYS.every(k=>int(evidence[k]))
   ||Object.keys(evidence).some(k=>!TRAIT_KEYS.includes(k)))throw Error('PLYR064_EVIDENCE');
 return true;
}
/** Pure, deterministic rotation: repeatable observation IDs are owned by caller.
 * It never generates knowledge from time alone without a recorded opportunity.
 */
export function advanceTraitEvidence(evidence,{observationId,count=1}={}){
 validateTraitEvidence(evidence);
 if(typeof observationId!=='string'||!observationId||observationId.length>256
   ||!Number.isInteger(count)||count<1||count>3)throw Error('PLYR064_OBSERVATION');
 const next={...evidence},start=fnv(observationId)%TRAIT_KEYS.length;
 for(let i=0;i<count;i++){
  const key=TRAIT_KEYS[(start+i)%TRAIT_KEYS.length];
  next[key]=Math.min(12,next[key]+1);
 }
 return next;
}
export function scoutPersonality(profile,{evidence=emptyTraitEvidence(),lang='it'}={}){
 validatePersonality(profile);validateTraitEvidence(evidence);
 const l=locale(lang);
 const labels={
  it:{unknown:'Non osservato',early:'Prime impressioni',observed:'Valutazione indicativa',uncertain:'da confermare'},
  en:{unknown:'Not observed',early:'Early impressions',observed:'Provisional assessment',uncertain:'subject to further observation'}
 }[l];
 return {traits:TRAITS.map(def=>{
  const level=evidence[def.key];
  const base={key:def.key,label:def.label[l]};
  if(level===0)return {...base,visibility:'hidden',status:labels.unknown,description:'—'};
  if(level<3)return {...base,visibility:'early',status:labels.early,description:'—'};
  return {...base,visibility:'descriptive',status:labels.observed,
   description:describeTrait(def.key,profile.traits[def.key],l)+' · '+labels.uncertain};
 })};
}
