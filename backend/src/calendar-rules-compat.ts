/** Versioned calendar placement is separate from permanent sporting division rules.
 * Season-1 legacy approval intentionally reconstructs the frozen rules bytes;
 * this is not permission to reinterpret or rewrite an existing approval hash.
 */
import mappings from '../../data/calendar-rules.json' with {type:'json'};
import {ApiError} from './errors.ts';
type Phase={id:string;calendarEvents?:readonly string[];[key:string]:unknown};
type Division={id:string;rules:{phases:readonly Phase[];[key:string]:unknown};[key:string]:unknown};
const fail=():never=>{throw new ApiError(422,'calendar_invalid')};
export function legacySeasonOneRules<T extends Division>(divisions:readonly T[]):T[]{
 const items=mappings.domesticPhases;
 if(mappings.schemaVersion!==1||mappings.model!=='WORLD-TIME-QA-06'||items.length!==divisions.reduce((n,d)=>n+d.rules.phases.length,0))return fail();
 const seen=new Set<string>();
 return divisions.map(division=>({...division,rules:{...division.rules,phases:division.rules.phases.map(phase=>{
  const key=division.id+':'+phase.id,entry=items.find(v=>v.competitionId===division.id&&v.phaseId===phase.id);
  if(!entry||seen.has(key)||'calendarEvents' in phase||!Array.isArray(entry.markers)||entry.markers.length===0||
     entry.markers.some(m=>!/^N(?:0[1-9]|[12][0-9]|3[0-3])$/.test(m)))return fail();
  seen.add(key);
  return {...phase,calendarEvents:[...entry.markers]};
 })}})) as T[];
}
export function assertCalendarMappings(divisions:readonly Division[]):void{
 const restored=legacySeasonOneRules(divisions);
 for(const division of restored)for(const phase of division.rules.phases){
  if(phase.id==='league'&&phase.calendarEvents?.length!==30)return fail();
  if(phase.id==='playout'&&phase.calendarEvents?.join(',')!=='N31,N32')return fail();
  if(phase.id==='promotionPlayoffs'&&phase.calendarEvents?.join(',')!=='N31,N32,N33')return fail();
 }
}
