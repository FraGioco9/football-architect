/** Fail-closed execution planner for administrative calendar milestones.
 * An event can be completed only after its exact persisted prerequisites.
 * Generators/draws require their own atomic sporting artifact commands;
 * this policy must never mark them complete without such an outcome.
 */
import {ApiError} from './errors.ts';
import {dueAdministrativeMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';
export type AdminEventAction='confirm-domestic-entrants'|'confirm-international-entrants'|'generate-domestic-calendar'|'draw-international'|'generate-international-calendar';
export type EventExecution=Readonly<{event:AdministrativeMilestone;requiresArtifact:boolean}>;
const dependencies:Record<AdminEventAction,readonly AdminEventAction[]>={
 'confirm-domestic-entrants':[],
 'confirm-international-entrants':[],
 'generate-domestic-calendar':['confirm-domestic-entrants'],
 'draw-international':['confirm-international-entrants'],
 'generate-international-calendar':['draw-international'],
};
export function planDueAdministrativeEvents(events:readonly AdministrativeMilestone[],day:number,previousDay:number):readonly EventExecution[]{
 if(!Number.isSafeInteger(previousDay)||previousDay<0||previousDay>=day)
  throw new ApiError(422,'invalid_calendar_event');
 const due=dueAdministrativeMilestones(events,day);
 if(events.some(e=>e.day<day&&e.status!=='completed'))
  throw new ApiError(409,'calendar_event_prerequisites');
 const completed=new Set(events.filter(e=>e.status==='completed').map(e=>e.scope+':'+e.kind));
 const plan:EventExecution[]=[];
 for(const event of due){
  if(dependencies[event.kind].some(kind=>!completed.has(event.scope+':'+kind)))
   throw new ApiError(409,'calendar_event_prerequisites');
  const requiresArtifact=!event.kind.startsWith('confirm-');
  plan.push(Object.freeze({event,requiresArtifact}));
  // Do not pretend the output of a fixture/draw generator exists.
  // An actual executor must commit receipts and artifacts before advancing.
  if(requiresArtifact)break;
  completed.add(event.scope+':'+event.kind);
 }
 return Object.freeze(plan);
}
