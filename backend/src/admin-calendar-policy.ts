/** ADMIN-WORLD-01: pure scheduling policy for future administrative milestones.
 * No database writes, no fixtures and no DEV world-clock authority here.
 * A protected D1 command must enforce expected world revision and persist receipts.
 */
import {ApiError} from './errors.ts';
export type MilestoneKind='confirm-domestic-entrants'|'confirm-international-entrants'|'generate-domestic-calendar'|'draw-international'|'generate-international-calendar'|'archive-season'|'close-season'|'prepare-next-season';
export type MilestoneStatus='scheduled'|'completed';
export interface AdministrativeMilestone {
 readonly id:string;readonly kind:MilestoneKind;readonly scope:string;
 readonly day:number;readonly order:number;readonly status:MilestoneStatus;
}
const kinds:readonly MilestoneKind[]=['confirm-domestic-entrants','confirm-international-entrants','generate-domestic-calendar','draw-international','generate-international-calendar','archive-season','close-season','prepare-next-season'];
const requirements:Record<MilestoneKind,readonly MilestoneKind[]>={
 'confirm-domestic-entrants':[],
 'confirm-international-entrants':[],
 'generate-domestic-calendar':['confirm-domestic-entrants'],
 'draw-international':['confirm-international-entrants'],
 'generate-international-calendar':['draw-international'],
 'archive-season':[],
 'close-season':['archive-season'],
 'prepare-next-season':['close-season'],
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
 const finalIds=['season:archive','season:close','season:next-prepare'] as const;
 const finalKinds=['archive-season','close-season','prepare-next-season'] as const;
 const finalEvents=finalIds.map(id=>events.find(e=>e.id===id));
 if(finalEvents.some(Boolean)){
  if(finalEvents.some(e=>!e))blocked();
  for(let i=0;i<finalEvents.length;i++){
   const e=finalEvents[i]!;
   if(e.scope!=='season'||e.kind!==finalKinds[i]||e.day!==56||e.order<8000)blocked();
   if(i>0&&key(finalEvents[i-1]!)>=key(e))blocked();
  }
  if(events.some(e=>e.kind==='archive-season'||e.kind==='close-season'||e.kind==='prepare-next-season')&&events.filter(e=>finalKinds.includes(e.kind as typeof finalKinds[number])).length!==3)blocked();
 }
 const domestic=events.find(e=>e.id==='domestic:calendar'),internationalDraw=events.find(e=>e.id==='international:draw');
 if(domestic&&internationalDraw&&key(domestic)>=key(internationalDraw))blocked();
 for(const e of events)for(const kind of requirements[e.kind]){
  const prerequisite=events.find(p=>p.scope===e.scope&&p.kind===kind);
  if((!prerequisite||key(prerequisite)>=key(e))&&e.scope!=='season')blocked();
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
 if(!original)return invalid();
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

/** Default *proposed* administrative schedule for a newly prepared season.
 * It does not write to D1 and does not replace the approved Season 1 calendar.
 * The authenticated season-preparation executor must persist a validated copy
 * only when its lifecycle no longer assumes that fixtures precede day 1.
 */
export function proposeAdministrativeMilestones():readonly AdministrativeMilestone[]{
 const events:AdministrativeMilestone[]=[
  {id:'domestic:entrants',kind:'confirm-domestic-entrants',scope:'domestic',day:1,order:1,status:'scheduled'},
  {id:'international:entrants',kind:'confirm-international-entrants',scope:'international',day:1,order:2,status:'scheduled'},
  {id:'domestic:calendar',kind:'generate-domestic-calendar',scope:'domestic',day:2,order:1,status:'scheduled'},
  {id:'international:draw',kind:'draw-international',scope:'international',day:3,order:1,status:'scheduled'},
  {id:'international:calendar',kind:'generate-international-calendar',scope:'international',day:3,order:2,status:'scheduled'},
 ];
 validate(events);
 return Object.freeze(events.map(e=>Object.freeze(e)));
}

/** Proposed terminal administrative milestones. These are deliberately NOT added
 * to legacy season initialization until the D1 migration and lifecycle commands
 * are ready, so persisted five-event schedules remain valid in the interim.
 */
export function proposeEndSeasonMilestones():readonly AdministrativeMilestone[]{
 const events:AdministrativeMilestone[]=[
  {id:'season:archive',kind:'archive-season',scope:'season',day:56,order:9000,status:'scheduled'},
  {id:'season:close',kind:'close-season',scope:'season',day:56,order:9100,status:'scheduled'},
  {id:'season:next-prepare',kind:'prepare-next-season',scope:'season',day:56,order:9200,status:'scheduled'},
 ];
 validate([...proposeAdministrativeMilestones(),...events]);
 return Object.freeze(events.map(e=>Object.freeze(e)));
}
