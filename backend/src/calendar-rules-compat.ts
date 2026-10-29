/** Single timing authority: assets/world-calendar-model.js.
 * Reconstruct frozen Season1 rule markers only at legacy validation/knockout boundary.
 * No independent marker mapping catalogue is maintained or trusted.
 */
import calendarModel from '../../assets/world-calendar-model.js';
import {ApiError} from './errors.ts';
type Phase={id:string;calendarEvents?:readonly string[];[key:string]:unknown};
type Division={id:string;rules:{phases:readonly Phase[];[key:string]:unknown};[key:string]:unknown};
const fail=():never=>{throw new ApiError(422,'calendar_invalid')};
export function legacySeasonOneRules<T extends Division>(divisions:readonly T[]):T[]{
 const seen=new Set<string>();
 if(divisions.length!==16||divisions.reduce((n,d)=>n+d.rules.phases.length,0)!==32)return fail();
 const restored=divisions.map(division=>({...division,rules:{...division.rules,phases:division.rules.phases.map(phase=>{
  const key=division.id+':'+phase.id;
  let markers:string[];try{markers=[...calendarModel.domesticPhaseMarkers(division.id,phase.id)]}catch{return fail()}
  if(!markers||seen.has(key)||'calendarEvents' in phase||!Array.isArray(markers))return fail();
  seen.add(key);
  const {id,type,labelKey,...rest}=phase;
  return {id,type,labelKey,calendarEvents:[...markers],...rest};
 })}})) as T[];
 if(seen.size!==32)return fail();
 return restored;
}
export function assertCalendarMappings(divisions:readonly Division[]):void{
 const restored=legacySeasonOneRules(divisions);
 for(const division of restored)for(const phase of division.rules.phases){
  const expected=phase.id==='league'?30:phase.id==='playout'?2:phase.id==='promotionPlayoffs'?3:0;
  if(!expected||phase.calendarEvents?.length!==expected)return fail();
 }
}
