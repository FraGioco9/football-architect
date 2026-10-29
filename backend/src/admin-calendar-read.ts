/** Authenticated administrative event projection; no client-side authority. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {dueAdministrativeMilestones,proposeAdministrativeMilestones,proposeEndSeasonMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';
type Row={event_id:string;kind:AdministrativeMilestone['kind'];scope:string;scheduled_day:number;event_order:number;status:AdministrativeMilestone['status'];completed_at:number|null;receipt_hash:string|null};
/** Read receipts for an explicitly selected source season, even after the active
 * world pointer advances. Callers must authenticate before exposing this data.
 * The existing active-world API continues to use the current season only.
 */
export async function readSeasonAdministrativeEventRows(db:Database,seasonNumber:number){
 if(!Number.isSafeInteger(seasonNumber)||seasonNumber<1)throw new ApiError(422,'invalid_calendar_event');
 const world=await readWorld(db);
 if(seasonNumber>world.seasonNumber)throw new ApiError(409,'calendar_event_prerequisites');
 return (await db.prepare('SELECT event_id,kind,scope,scheduled_day,event_order,status,completed_at,receipt_hash FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(seasonNumber).all<Row>()).results;
}
export async function readAdministrativeCalendar(db:Database){
 const world=await readWorld(db);
 if(world.seasonNumber===0)return {world,events:[],mode:'uninitialized' as const};
 const rows=(await db.prepare('SELECT event_id,kind,scope,scheduled_day,event_order,status,completed_at,receipt_hash FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(world.seasonNumber).all<Row>()).results;

 const legacy=proposeAdministrativeMilestones();
 const expanded=[...legacy,...proposeEndSeasonMilestones()];
 const identityMatches=(expected:readonly AdministrativeMilestone[])=>rows.length===expected.length&&rows.every(r=>expected.some(x=>x.id===r.event_id&&x.kind===r.kind&&x.scope===r.scope));
 // Existing five-event seasons stay readable; newly enrolled seasons must have
 // the complete eight-event identity set. Partial terminal enrolment fails closed.
 if(rows.length!==0&&!identityMatches(legacy)&&!identityMatches(expanded))throw new ApiError(422,'calendar_event_invalid');
 const events=rows.map(r=>({
  id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,
  status:r.status,completedAt:r.completed_at,
  // Receipt payload remains server-side; expose only presence for UI status.
  hasReceipt:r.receipt_hash!==null,
 }));
 for(const event of events){
  if((event.status==='completed')!==(event.completedAt!==null&&event.hasReceipt))throw new ApiError(422,'calendar_event_invalid');
 }
 // Revalidate ordering/dependencies even for rows modified outside the command boundary.
 if(rows.length)dueAdministrativeMilestones(events,Math.max(1,world.day));
 const pending=events.filter(e=>e.status==='scheduled').sort((a,b)=>a.day-b.day||a.order-b.order);
 const next=pending[0]??null;
 const blocked=next!==null&&next.day<world.day;
 const published=rows.length===0||events.some(e=>e.id==='international:calendar'&&e.status==='completed');
 const calendar=published?await db.prepare('SELECT calendar_hash FROM season_calendars WHERE season_number=?').bind(world.seasonNumber).first<{calendar_hash:string}>():null;
 const sporting=published&&!!calendar;
 const counts=sporting?await db.prepare('SELECT (SELECT count(*) FROM season_day_outcomes WHERE season_number=?) AS days, (SELECT count(*) FROM season_knockout_ties WHERE season_number=?) AS ties, (SELECT count(*) FROM season_archives WHERE season_number=?) AS archives').bind(world.seasonNumber,world.seasonNumber,world.seasonNumber).first<{days:number;ties:number;archives:number}>():null;
 const closure={days:counts?.days??0,ties:counts?.ties??0,archived:(counts?.archives??0)>0,
  ready:world.phase==='active'&&world.day===56&&pending.every(e=>e.scope==='season')&&counts?.days===56&&counts?.ties===54&&counts?.archives===0};
 return {world,events,mode:rows.length===0&&world.phase==='preparing'?'legacy' as const:sporting?'sporting' as const:rows.length===0?'legacy' as const:'administrative' as const,closure,calendarReady:!!calendar,
  nextEvent:next?{id:next.id,kind:next.kind,day:next.day,order:next.order,ready:!blocked&&next.day===world.day&&(world.phase==='active'||world.phase==='closed'&&next.id==='season:next-prepare')}:null,
  remaining:pending.length,blocked};

}
