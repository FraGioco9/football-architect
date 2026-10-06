/** SIM03.04 — a non-destructive role assignment per pitch slot. */
import {canonicalPosition} from './player-ratings.mjs';
import {ROLE_BY_ID,ROLE_DUTIES,defaultRole,validateRoleChoice,ROLE_SCHEMA,availableRoles} from './player-roles.mjs';
import {assessRoleFit} from './player-role-fit.mjs';
const bad=code=>{throw new Error(`SIM03_${code}`)};
const validId=id=>(typeof id==='string'&&id.trim()!=='')||(Number.isSafeInteger(id)&&id>0);
const clone=v=>structuredClone(v);
function defaultDuty(position){const pos=canonicalPosition(position);return pos==='GK'||['CB','RB','LB','RWB','LWB','CDM'].includes(pos)?'defend':['ST','CF','RW','LW'].includes(pos)?'attack':'support';}
export function validateRolePlan(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||plan.schemaVersion!==ROLE_SCHEMA)bad('PLAN_SCHEMA');
 if(typeof plan.formation!=='string'||plan.formation.trim().length===0)bad('FORMATION');
 if(!Array.isArray(plan.assignments)||plan.assignments.length!==11)bad('XI');
 if(!Number.isSafeInteger(plan.revision)||plan.revision<0)bad('REVISION');
 const seenSlots=new Set(),seenPlayers=new Set();let gk=0;
 for(const a of plan.assignments){
   if(!a||!validId(a.slotId)||!validId(a.playerId))bad('IDENTITY');
   const slot=String(a.slotId),pid=String(a.playerId);
   if(seenSlots.has(slot)||seenPlayers.has(pid))bad('DUPLICATE');
   seenSlots.add(slot);seenPlayers.add(pid);
   const pos=canonicalPosition(a.position);
   validateRoleChoice(pos,a.role,a.duty);
   if(pos==='GK')gk++;
   if(a.fit!==undefined&&(!Number.isInteger(a.fit)||a.fit<1||a.fit>100))bad('FIT');
 }
 if(gk!==1)bad('GOALKEEPER');
 return true;
}
export function createRolePlan(formation,slots){
 if(!Array.isArray(slots))bad('SLOTS');
 const plan={schemaVersion:ROLE_SCHEMA,formation,revision:0,assignments:slots.map(slot=>({slotId:slot.slotId,playerId:slot.playerId,position:canonicalPosition(slot.position),role:slot.role??defaultRole(slot.position),duty:slot.duty??defaultDuty(slot.position),...(slot.fit!==undefined?{fit:slot.fit}:{})}))};
 validateRolePlan(plan);return plan;
}
export function updateRolePlan(plan,{slotId,role,duty,expectedRevision=plan.revision}){
 validateRolePlan(plan);if(plan.revision!==expectedRevision)bad('REVISION_CONFLICT');
 const entry=plan.assignments.find(a=>String(a.slotId)===String(slotId));if(!entry)bad('SLOT');
 validateRoleChoice(entry.position,role??entry.role,duty??entry.duty);
 const next=clone(plan),change=next.assignments.find(a=>String(a.slotId)===String(slotId));
 change.role=role??change.role;change.duty=duty??change.duty;next.revision++;
 return next;
}
export function resetRolePlan(plan){validateRolePlan(plan);return {...clone(plan),revision:plan.revision+1,assignments:plan.assignments.map(a=>({...a,role:defaultRole(a.position),duty:defaultDuty(a.position)}))};}
export function rolePlanFromLegacy(formation,slots){return createRolePlan(formation,slots);}
/** AI only sees playable positions and observed attributes, never hidden potential. */
export function suggestAiRolePlan(formation,slots,players=[]){
 const playerMap=new Map(players.map(p=>[String(p.id),p]));
 const updated=slots.map(slot=>{
   const pos=canonicalPosition(slot.position),player=playerMap.get(String(slot.playerId));
   if(!player||!player.attributeProfile)return {...slot,role:defaultRole(pos)};
   let best=null;
   const duties=pos==='GK'?['defend']:ROLE_DUTIES;
   for(const role of availableRoles(pos))for(const duty of duties){
     const fit=assessRoleFit(player,player.attributeProfile,{position:pos,role:role.id,duty});
     if(!best||fit.overall>best.fit.overall || (fit.overall===best.fit.overall&&role.id<best.role))best={role:role.id,duty,fit};
   }
   return {...slot,role:best.role,duty:best.duty,fit:best.fit.overall};
 });return createRolePlan(formation,updated);
}
