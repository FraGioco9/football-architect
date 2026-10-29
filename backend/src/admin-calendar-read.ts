/** Authenticated administrative event projection; no client-side authority. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {proposeAdministrativeMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';
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
 return {world,events,mode:'administrative' as const};
}
