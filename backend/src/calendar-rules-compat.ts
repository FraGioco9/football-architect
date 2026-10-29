/** Single timing authority: assets/world-calendar-model.js.
 * Reconstruct frozen Season1 rule markers only at legacy validation/knockout boundary.
 * No independent marker mapping catalogue is maintained or trusted.
 */
import calendarModel from '../../assets/world-calendar-model.js';
import {ApiError} from './errors.ts';
type Phase={id:string;calendarEvents?:readonly string[];[key:string]:unknown};
type Division={id:string;rules:{phases:readonly Phase[];[key:string]:unknown};[key:string]:unknown};
const fail=():never=>{throw new ApiError(422,'calendar_invalid')};
function placements(){
 const calendar=calendarModel.createSeason(1);
 if(calendar.schemaVersion!==1||calendar.model!=='WORLD-TIME-QA-06'||calendar.days.length!==56)return fail();
 const national=calendar.days.flatMap(day=>day.events.filter(event=>event.family==='national'));
 if(national.length!==33||new Set(national.map(x=>x.marker)).size!==33)return fail();
 const placements=new Map<string,string[]>();
 for(const event of national){
  if(event.marker!=='N'+String(event.round).padStart(2,'0')||!Number.isInteger(event.round)||event.round<1||event.round>33)return fail();
  for(const competitionId of event.competitionIds){
   if(!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(competitionId))return fail();
   // N33 occurs in the world calendar but only second-tier finals use that slot.
   if(event.round===33&&competitionId.endsWith('-1'))continue;
   const kind=event.round<=30?'league':competitionId.endsWith('-1')?'playout':'promotionPlayoffs';
   const key=competitionId+':'+kind;
   const markers=placements.get(key)??[];
   markers.push(event.marker);
   placements.set(key,markers);
  }
 }
 if(placements.size!==32)return fail();
 return placements;
}
export function legacySeasonOneRules<T extends Division>(divisions:readonly T[]):T[]{
 const map=placements(),seen=new Set<string>();
 if(divisions.length!==16||divisions.reduce((n,d)=>n+d.rules.phases.length,0)!==32)return fail();
 const restored=divisions.map(division=>({...division,rules:{...division.rules,phases:division.rules.phases.map(phase=>{
  const key=division.id+':'+phase.id,markers=map.get(key);
  if(!markers||seen.has(key)||'calendarEvents' in phase||!Array.isArray(markers))return fail();
  seen.add(key);
  return {...phase,calendarEvents:[...markers]};
 })}})) as T[];
 if(seen.size!==map.size)return fail();
 return restored;
}
export function assertCalendarMappings(divisions:readonly Division[]):void{
 const restored=legacySeasonOneRules(divisions);
 for(const division of restored)for(const phase of division.rules.phases){
  const expected=phase.id==='league'?30:phase.id==='playout'?2:phase.id==='promotionPlayoffs'?3:0;
  if(!expected||phase.calendarEvents?.length!==expected)return fail();
 }
}
