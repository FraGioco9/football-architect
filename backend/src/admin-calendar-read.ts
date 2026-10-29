/** Authenticated administrative event projection; no client-side authority. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {dueAdministrativeMilestones,proposeAdministrativeMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';
type Row={event_id:string;kind:AdministrativeMilestone['kind'];scope:string;scheduled_day:number;event_order:number;status:AdministrativeMilestone['status'];completed_at:number|null;receipt_hash:string|null};
export async function readAdministrativeCalendar(db:Database){
 const world=await readWorld(db);
 if(world.seasonNumber===0)return {world,events:[],mode:'uninitialized' as const};
 const rows=(await db.prepare('SELECT event_id,kind,scope,scheduled_day,event_order,status,completed_at,receipt_hash FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(world.seasonNumber).all<Row>()).results;
 if(rows.length===0)return {world,events:[],mode:'legacy' as const};
 const prototype=proposeAdministrativeMilestones();
 if(rows.length!==prototype.length||rows.some(r=>!prototype.some(x=>x.id===r.event_id&&x.kind===r.kind&&x.scope===r.scope)))throw new ApiError(422,'calendar_event_invalid');
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
 if(world.day<56)dueAdministrativeMilestones(events,Math.max(1,world.day));
 const pending=events.filter(e=>e.status==='scheduled').sort((a,b)=>a.day-b.day||a.order-b.order);
 const next=pending[0]??null;
 const blocked=next!==null&&next.day<world.day;
 const published=events.some(e=>e.id==='international:calendar'&&e.status==='completed');
 const calendar=published?await db.prepare('SELECT calendar_hash FROM season_calendars WHERE season_number=?').bind(world.seasonNumber).first<{calendar_hash:string}>():null;
 const sporting=published&&!!calendar;
 const counts=sporting?await db.prepare('SELECT (SELECT count(*) FROM season_day_outcomes WHERE season_number=?) AS days, (SELECT count(*) FROM season_knockout_ties WHERE season_number=?) AS ties, (SELECT count(*) FROM season_archives WHERE season_number=?) AS archives').bind(world.seasonNumber,world.seasonNumber,world.seasonNumber).first<{days:number;ties:number;archives:number}>():null;
 const closure={days:counts?.days??0,ties:counts?.ties??0,archived:(counts?.archives??0)>0,
  ready:world.phase==='active'&&world.day===56&&pending.length===0&&counts?.days===56&&counts?.ties===54&&counts?.archives===0};
 return {world,events,mode:sporting?'sporting' as const:'administrative' as const,closure,
  nextEvent:next?{id:next.id,kind:next.kind,day:next.day,order:next.order,ready:world.phase==='active'&&!blocked&&next.day===world.day}:null,
  remaining:pending.length,blocked};

}
