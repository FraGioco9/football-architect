/** SIM03.02/.04/.05: opt-in per-formation, per-slot role editor. No legacy save migration. */
import {FORMATIONS,clamp} from './rules.js';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {availableRoles,defaultRole,validateRoleChoice} from '../addons/domain/player-roles.mjs';
import {assessRoleFit} from '../addons/domain/player-role-fit.mjs';
import {suggestAiRolePlan} from '../addons/domain/player-role-plan.mjs';
const fail=code=>{throw Error(`SIM03_${code}`)};
const dutyFor=position=>position==='GK'||['CB','RB','LB','CDM'].includes(position)?'defend':['ST','RW','LW'].includes(position)?'attack':'support';
export const careerRolesEnabled=w=>w?.advancedV1?.roleEditorV1?.schemaVersion===1&&w.advancedV1.roleEditorV1.enabled===true;
const state=w=>{if(!careerRolesEnabled(w))fail('INACTIVE');return w.advancedV1.roleEditorV1;};
export const defaultSlot=(formation,index)=>{
 const slot=FORMATIONS[formation]?.[index];if(!slot)fail('SLOT');
 const position=toAddonPosition(slot.p);
 return {role:defaultRole(position),duty:dutyFor(position)};
};
export function careerSlotRole(w,index,formation=w.formation){
 const standard=defaultSlot(formation,index);
 if(!careerRolesEnabled(w))return standard;
 return w.advancedV1.roleEditorV1.formations[formation]?.[index]??standard;
}
export function enableCareerRoles(w){
 if(w?.advancedV1?.enabled!==true)fail('ADVANCED_REQUIRED');
 if(careerRolesEnabled(w))return w;
 if(w.advancedV1.roleEditorV1!==undefined)fail('SCHEMA');
 const current=FORMATIONS[w.formation].map((slot,i)=>{
   const playerId=w.lineup[i],pos=toAddonPosition(slot.p),legacy=w.advancedV1.roles[String(playerId)];
   try{validateRoleChoice(pos,legacy?.role,legacy?.duty);return {role:legacy.role,duty:legacy.duty};}
   catch{return defaultSlot(w.formation,i);}
 });
 w.advancedV1.roleEditorV1={schemaVersion:1,enabled:true,revision:0,formations:{[w.formation]:current}};
 return w;
}
export function setCareerSlotRole(w,{formation=w.formation,index,role,duty,expectedRevision}={}){
 const s=state(w);if(formation!==w.formation||!Number.isSafeInteger(index)||index<0||index>=11)fail('SLOT');
 if(expectedRevision!==undefined&&expectedRevision!==s.revision)fail('REVISION_CONFLICT');
 const pos=toAddonPosition(FORMATIONS[formation][index].p),before=careerSlotRole(w,index,formation);
 validateRoleChoice(pos,role??before.role,duty??before.duty);
 const formations=structuredClone(s.formations);
 if(!formations[formation])formations[formation]=FORMATIONS[formation].map((_,i)=>defaultSlot(formation,i));
 formations[formation][index]={role:role??before.role,duty:duty??before.duty};
 w.advancedV1.roleEditorV1={...s,formations,revision:s.revision+1};
 return w.advancedV1.roleEditorV1;
}
export function resetCareerRoleFormation(w,formation=w.formation){
 const s=state(w);if(!Object.hasOwn(FORMATIONS,formation)||formation!==w.formation)fail('FORMATION');
 w.advancedV1.roleEditorV1={...s,revision:s.revision+1,formations:{...s.formations,[formation]:FORMATIONS[formation].map((_,i)=>defaultSlot(formation,i))}};
 return w.advancedV1.roleEditorV1;
}
export function assessCareerSlotRole(w,index,{formation=w.formation,player}={}){
 const p=player??w.players.find(x=>x.id===w.lineup[index]);if(!p?.attributeProfile)return null;
 const pos=toAddonPosition(FORMATIONS[formation]?.[index]?.p),choice=careerSlotRole(w,index,formation);
 return assessRoleFit({...p,position:toAddonPosition(p.position)},p.attributeProfile,{position:pos,...choice});
}
export function buildAIRolePlan(formation,slots,players){
 const publicProfiles=players.map(p=>({...p,position:toAddonPosition(p.position),attributeProfile:p.attributeProfile}));
 return suggestAiRolePlan(formation,slots,publicProfiles);
}
export function validateCareerRoles(w){
 if(w?.advancedV1?.roleEditorV1===undefined)return true;
 if(!careerRolesEnabled(w))return false;
 const s=w.advancedV1.roleEditorV1;
 if(!Number.isSafeInteger(s.revision)||s.revision<0||!s.formations||typeof s.formations!=='object'||Array.isArray(s.formations))return false;
 try{for(const [formation,rows] of Object.entries(s.formations)){
   if(!Object.hasOwn(FORMATIONS,formation)||!Array.isArray(rows)||rows.length!==11)return false;
   for(let index=0;index<11;index++){
     const row=rows[index];if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['role','duty'].includes(k)))return false;
     validateRoleChoice(toAddonPosition(FORMATIONS[formation][index].p),row.role,row.duty);
   }
 }return true;}catch{return false;}
}
