/** PLY02.04 — scouting estimates. Only returns authorized public labels/ranges.
 * Never returns internal profile, seed, or raw hidden trait values at partial knowledge.
 */
import {TRAITS,validatePersonality,fnv,seeded,clamp,describeTrait} from './player-personality.mjs';
const locale=l=>String(l).toLowerCase().startsWith('en')?'en':'it';
export function scoutPersonality(profile,{knowledge=0,seed=0,viewerId='',lang='it'}={}){
 validatePersonality(profile);
 if(!Number.isInteger(knowledge)||knowledge<0||knowledge>100)throw new Error('PLY02_KNOWLEDGE');
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('PLY02_SCOUT_SEED');
 const l=locale(lang);const labels={it:{unknown:'Non ancora osservato',limited:'Prime impressioni',estimated:'Stima dello scout',confirmed:'Osservazione approfondita'},en:{unknown:'Not yet observed',limited:'Early impressions',estimated:'Scout estimate',confirmed:'Thoroughly observed'}};
 const traits=TRAITS.map(def=>{
  const base={key:def.key,label:def.label[l]};
  if(knowledge<15)return {...base,visibility:'hidden',status:labels[l].unknown,description:null};
  const v=profile.traits[def.key];
  const rng=seeded(fnv(`scout|${seed}|${String(viewerId)}|${def.key}`));
  if(knowledge<40){const fuzzy=clamp(v+(rng()-0.5)*38,1,100);return {...base,visibility:'descriptive',status:labels[l].limited,description:describeTrait(def.key,Math.round(fuzzy),l)};}
  if(knowledge<95){
   const spread=knowledge<70?24:12;
   const deviation=(rng()-0.5)*spread*1.4;
   const center=clamp(Math.round(v+deviation),1,100);
   const low=clamp(center-spread,1,100),high=clamp(center+spread,1,100);
   return {...base,visibility:'estimated',status:labels[l].estimated,description:describeTrait(def.key,center,l),range:[low,high]};
  }
  return {...base,visibility:'known',status:labels[l].confirmed,value:v,description:describeTrait(def.key,v,l)};
 });
 return {knowledge,traits};
}
