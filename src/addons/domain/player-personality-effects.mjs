/** PLY02.02: deterministic, explainable, opt-in projections for four systems.
 * No official morale/contract/training/fixture writes.
 */
import {validatePersonality,clamp} from './player-personality.mjs';
const number=(v,name,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error(`PLY02_${name}`);return v;};
const round=(v)=>Math.round(v*1000)/1000;
export const PERSONALITY_EVENTS=Object.freeze(['win','loss','bench','played','coach_praise','coach_criticism','training','contract_offer','transfer_rejected','coach_change','contract_promise']);
export function evaluatePersonalityEffects(profile,{morale=50,playingTime=50,clubLevel=50,offeredRaise=0}={}){
 validatePersonality(profile);
 number(morale,'MORALE',0,100);number(playingTime,'PLAYING_TIME',0,100);number(clubLevel,'CLUB_LEVEL',0,100);number(offeredRaise,'RAISE',-100,300);
 const {professionalism:p,ambition:a,loyalty:l,determination:d,temperament:t,adaptability:ad}=profile.traits;
 const factors={
  consistency:round(clamp(1+(d-50)*0.0016+(p-50)*0.0014-(t-50)*0.0005,0.82,1.18)),
  training:round(clamp(1+(p-50)*0.0018+(d-50)*0.0012,0.85,1.15)),
  moraleResilience:round(clamp(1+(d-50)*0.0018+(ad-50)*0.0015-(t-50)*0.0006,0.85,1.15)),
  adaptation:round(clamp(1+(ad-50)*0.002,0.90,1.10)),
 };
 const contractInterest=round(clamp(50+(l-50)*0.22-(a-50)*0.16+(morale-50)*0.14+(playingTime-50)*0.08+(clubLevel-50)*0.1+offeredRaise*0.09,0,100));
 return {factors,contractInterest,explanation:{consistency:['determination','professionalism','temperament'],training:['professionalism','determination'],moraleResilience:['determination','adaptability','temperament'],adaptation:['adaptability'],contractInterest:['loyalty','ambition','morale','playingTime','clubLevel','offeredRaise']}};
}
/** Reasoned morale response in -8..8 per trigger; no global RNG, no side effects. */
export function eventResponse(profile,type,{importance=1}={}){
 validatePersonality(profile);
 if(!PERSONALITY_EVENTS.includes(type))throw new Error('PLY02_UNKNOWN_EVENT');
 number(importance,'IMPORTANCE',0,2);
 const {professionalism:p,ambition:a,loyalty:l,determination:d,temperament:t,adaptability:ad}=profile.traits;
 const effects={
  win:3+(d-50)*0.025,
  loss:-3+(d-50)*0.018-(t-50)*0.03,
  bench:-2-(a-50)*0.045+(p-50)*0.012,
  played:1.5+(a-50)*0.015,
  coach_praise:3+(d-50)*0.02,
  coach_criticism:-2-(t-50)*0.04+(p-50)*0.024,
  training:0.8+(p-50)*0.016,
  contract_offer:1.5+(l-50)*0.018,
  transfer_rejected:-2-(a-50)*0.035+(l-50)*0.016+(ad-50)*0.014,
  coach_change:0,contract_promise:0,
 };
 const raw=effects[type]*importance;
 return {moraleDelta:round(clamp(raw,-8,8)),drivers:{
  win:['determination'],loss:['determination','temperament'],bench:['ambition','professionalism'],played:['ambition'],coach_praise:['determination'],coach_criticism:['temperament','professionalism'],training:['professionalism'],contract_offer:['loyalty'],transfer_rejected:['ambition','loyalty','adaptability'],coach_change:['coach_change'],contract_promise:['contract_promise'],
 }[type]};
}
