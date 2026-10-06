/** SIM02.04-06: authoritative, opt-in tactics for the existing advanced career. */
import {BUILT_IN_STYLES,validateTactics} from '../addons/domain/team-tactics.mjs';
import {createTacticBook,addTacticPreset,duplicateTacticPreset,updateTacticPreset,removeTacticPreset,presetTactics,restoreTacticBook} from '../addons/domain/team-tactics-presets.mjs';
import {expectedNextMatch} from './career-matchday.js';
const fail=code=>{throw new Error(`SIM02_${code}`);};
const active=w=>w?.advancedV1?.tacticPlannerV1?.schemaVersion===1 && w.advancedV1.tacticPlannerV1.enabled===true;
export const careerTacticsEnabled=active;
export function enableCareerTactics(w){
  if(w?.advancedV1?.enabled!==true)fail('ADVANCED_REQUIRED');
  if(active(w))return w;
  if(w.advancedV1.tacticPlannerV1!==undefined)fail('SCHEMA');
  w.advancedV1.tacticPlannerV1={schemaVersion:1,enabled:true,book:createTacticBook(),plans:[],selectedId:null,revision:0};
  return w;
}
const state=w=>{if(!active(w))fail('INACTIVE');return w.advancedV1.tacticPlannerV1;};
const update=(w,fn)=>{
  const s=state(w);const next=structuredClone(s);fn(next);
  next.revision++;w.advancedV1.tacticPlannerV1=next;return next;
};
export function saveCareerTacticPreset(w,name){
  return update(w,s=>{s.book=addTacticPreset(s.book,{name,tactics:w.advancedV1.tactics});s.selectedId=s.book.presets.at(-1).id;});
}
export function duplicateCareerTacticPreset(w,id,name){
  return update(w,s=>{s.book=duplicateTacticPreset(s.book,id,name);s.selectedId=s.book.presets.at(-1).id;});
}
export function editCareerTacticPreset(w,id,{name,tactics}){
  return update(w,s=>{s.book=updateTacticPreset(s.book,id,{name,tactics});});
}
export function deleteCareerTacticPreset(w,id){
  return update(w,s=>{s.book=removeTacticPreset(s.book,id);if(s.selectedId===id)s.selectedId=null;});
}
export function applyCareerTacticPreset(w,id){
  const selected=presetTactics(state(w).book,id);
  validateTactics(selected);
  update(w,s=>{s.selectedId=id;});
  w.advancedV1.tactics=selected;
  w.advancedV1.style=Object.hasOwn(BUILT_IN_STYLES,id)?id:'custom';
  return selected;
}
export function planCareerTacticChange(w,{minute,presetId='current'}){
  if(![45,60,75].includes(minute))fail('MINUTE');
  const match=expectedNextMatch(w);if(!match||match.result)fail('NO_NEXT_MATCH');
  const next=presetId==='current'?structuredClone(w.advancedV1.tactics):presetTactics(state(w).book,presetId);
  validateTactics(next);
  return update(w,s=>{
    const plans=s.plans.filter(p=>p.matchId===match.id&&p.teamId===w.clubId&&p.minute!==minute);
    if(plans.length>=3)fail('PLAN_LIMIT');
    plans.push({matchId:match.id,teamId:w.clubId,minute,presetId,tactics:next});
    s.plans=plans.sort((a,b)=>a.minute-b.minute);
  });
}
export function cancelCareerTacticChange(w,index){
  return update(w,s=>{
    if(!Number.isSafeInteger(index)||index<0||index>=s.plans.length)fail('PLAN_INDEX');
    s.plans.splice(index,1);
  });
}
export function clearCareerTacticPlans(w){if(active(w)){w.advancedV1.tacticPlannerV1.plans=[];w.advancedV1.tacticPlannerV1.revision++;}}
export function validateCareerTactics(w){
  if(w?.advancedV1?.tacticPlannerV1===undefined)return true;
  const s=w.advancedV1.tacticPlannerV1;
  if(!active(w)||!Array.isArray(s.plans)||s.plans.length>3||!Number.isSafeInteger(s.revision)||s.revision<0)return false;
  try{
    restoreTacticBook(s.book);
    if(s.selectedId!==null && !Object.hasOwn(BUILT_IN_STYLES,s.selectedId)&&!s.book.presets.some(p=>p.id===s.selectedId))return false;
    const seen=new Set();
    for(const p of s.plans){
      if(typeof p.matchId!=='string'&&typeof p.matchId!=='number')return false;
      if(![45,60,75].includes(p.minute)||p.teamId!==w.clubId||typeof p.presetId!=='string'||seen.has(p.minute))return false;
      seen.add(p.minute);validateTactics(p.tactics);
    }
    for(const round of w.fixtures??[])for(const match of round.matches??[]){
      const changes=match.result?.advancedV1?.tacticalChanges;
      if(changes===undefined)continue;
      if(!Array.isArray(changes)||changes.length>3)return false;
      const used=new Set();
      for(const change of changes){
        if(![45,60,75].includes(change.minute)||!([match.home,match.away].includes(change.teamId))||used.has(change.minute)||typeof change.presetId!=='string')return false;
        used.add(change.minute);validateTactics(change.tactics);
        if(match.home!==change.teamId&&match.away!==change.teamId)return false;
      }
    }
    return true;
  }catch{return false;}
}
