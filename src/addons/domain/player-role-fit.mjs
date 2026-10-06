/** SIM03.02 — role suitability is explanatory, position rating is never overwritten. */
import {canonicalPosition,familiarityPenalty} from './player-ratings.mjs';
import {validateAttributes} from './player-attributes.mjs';
import {ROLE_BY_ID,validateRoleChoice} from './player-roles.mjs';
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function assessRoleFit(player,attributes,{position=player?.position,role,duty='support'}={}){
 if(!player||typeof player!=='object')throw new Error('SIM03_PLAYER');
 validateAttributes(attributes);
 const target=canonicalPosition(position),natural=canonicalPosition(player.position);
 validateRoleChoice(target,role,duty);
 const spec=ROLE_BY_ID[role],w=spec.weights;
 const performance=Object.entries(w).reduce((s,[key,weight])=>s+attributes.values[key]*weight,0)/Object.values(w).reduce((s,v)=>s+v,0);
 const positionLoss=familiarityPenalty(natural,target);
 // The role-specific profile is smaller than familiarity loss, never punishes natural fit excessively.
 const neutral=Number.isFinite(player.ovr)?player.ovr:(Number.isFinite(player.overall)?player.overall:performance);
 const skillGap=clamp((performance-neutral)*0.18,-5,5);
 const dutyBonus=duty==='attack'?((attributes.values.offBall+attributes.values.workRate)/2-neutral)*0.035:
   duty==='defend'?((attributes.values.defensivePositioning+attributes.values.concentration)/2-neutral)*0.035:0;
 const roleAdjustment=clamp(skillGap+dutyBonus,-6,6);
 const overall=clamp(Math.round(neutral-positionLoss+roleAdjustment),1,100);
 const weaknesses=Object.entries(w).sort((a,b)=>attributes.values[a[0]]-attributes.values[b[0]]).slice(0,2).map(([key])=>key);
 const strengths=Object.entries(w).sort((a,b)=>attributes.values[b[0]]-attributes.values[a[0]]).slice(0,2).map(([key])=>key);
 return Object.freeze({position:target,role,duty,overall,baseOvr:neutral,positionLoss,roleAdjustment:Number(roleAdjustment.toFixed(2)),strengths,weaknesses,explanation:{positionLoss,skillGap:Number(skillGap.toFixed(2)),dutyBonus:Number(dutyBonus.toFixed(2))}});
}
