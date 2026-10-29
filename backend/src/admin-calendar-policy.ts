/** ADMIN-WORLD-01: pure scheduling policy for future administrative milestones.
 * No database writes, no fixtures and no DEV world-clock authority here.
 * A protected D1 command must enforce expected world revision and persist receipts.
 */
import {ApiError} from './errors.ts';
export type MilestoneKind='confirm-domestic-entrants'|'confirm-international-entrants'|'generate-domestic-calendar'|'draw-international'|'generate-international-calendar';
export type MilestoneStatus='scheduled'|'completed';
export interface AdministrativeMilestone {
 readonly id:string;readonly kind:MilestoneKind;readonly scope:string;
 readonly day:number;readonly order:number;readonly status:MilestoneStatus;
}
const kinds:readonly MilestoneKind[]=['confirm-domestic-entrants','confirm-international-entrants','generate-domestic-calendar','draw-international','generate-international-calendar'];
const requirements:Record<MilestoneKind,readonly MilestoneKind[]>={
 'confirm-domestic-entrants':[],
 'confirm-international-entrants':[],
 'generate-domestic-calendar':['confirm-domestic-entrants'],
 'draw-international':['confirm-international-entrants'],
 'generate-international-calendar':['draw-international'],
};
const invalid=():never=>{throw new ApiError(422,'invalid_calendar_event')};
const blocked=():never=>{throw new ApiError(409,'calendar_event_prerequisites')};
const key=(e:AdministrativeMilestone)=>e.day*10000+e.order;
function validate(events:readonly AdministrativeMilestone[]):void {
 if(!Array.isArray(events)||events.length===0||events.length>256)invalid();
 const ids=new Set<string>(),positions=new Set<string>(),scopes=new Set<string>();
 for(const e of events){
  if(!e||typeof e!=='object'||!/^[-a-z0-9:]{3,120}$/.test(e.id)||
   !kinds.includes(e.kind)||!/^[-a-z0-9]{2,64}$/.test(e.scope)||
   !Number.isSafeInteger(e.day)||e.day<1||e.day>56||
   !Number.isSafeInteger(e.order)||e.order<0||e.order>9999||
   !['scheduled','completed'].includes(e.status))invalid();
  const identity=e.scope+':'+e.kind;
  const position=e.day+':'+e.order;
  if(ids.has(e.id)||positions.has(position)||scopes.has(identity))invalid();
  ids.add(e.id);positions.add(position);scopes.add(identity);
 }
 for(const e of events)for(const kind of requirements[e.kind]){
  const prerequisite=events.find(p=>p.scope===e.scope&&p.kind===kind);
  if(!prerequisite||key(prerequisite)>=key(e))blocked();
 }
}
export function rescheduleAdministrativeMilestone(
 events:readonly AdministrativeMilestone[],id:string,day:number,order:number,currentDay:number,
):readonly AdministrativeMilestone[]{
 validate(events);
 if(!Number.isSafeInteger(currentDay)||currentDay<0||currentDay>56||
  !Number.isSafeInteger(day)||day<1||day>56||
  !Number.isSafeInteger(order)||order<0||order>9999)invalid();
 const original=events.find(e=>e.id===id);
 if(!original)invalid();
 if(original.status==='completed'||original.day<=currentDay||day<=currentDay)blocked();
 const next=events.map(e=>e.id===id?{...e,day,order}:e);
 validate(next);
 return Object.freeze(next.map(e=>Object.freeze(e)));
}
export function dueAdministrativeMilestones(events:readonly AdministrativeMilestone[],day:number):readonly AdministrativeMilestone[]{
 validate(events);
 if(!Number.isSafeInteger(day)||day<1||day>56)invalid();
 return Object.freeze(events.filter(e=>e.day===day&&e.status==='scheduled').sort((a,b)=>a.order-b.order));
}
