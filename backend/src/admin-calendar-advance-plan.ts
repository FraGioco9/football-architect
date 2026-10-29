/** Read/plan only. The caller commits these guards and writes with its world CAS and audit. */
import {ApiError} from './errors.ts';
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import {abortUnless} from './command-guards.ts';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {buildInitialSchedule,buildTrustedSeasonSchedule,type InitialSchedule} from './initial-schedule.ts';
import {initialDrawOutcomes} from './initial-draws.ts';
import {dueAdministrativeMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';
import {createProgression,processSportingDay} from './knockout-progression.ts';
import {sportingDayPayload} from './sporting-day-payload.ts';
export interface AdvanceEventRow {
 event_id:string;kind:AdministrativeMilestone['kind'];scope:string;scheduled_day:number;event_order:number;
 status:AdministrativeMilestone['status'];completed_at:number|null;receipt_hash:string|null;
}
interface Stage {
 generation:string;algorithm_version:string;seed:string;participants_hash:string;rules_hash:string;
 fixtures_hash:string;fixtures_json:string;created_at:number;
}
interface Draw {
 competition_id:string;stage_id:string;algorithm_version:string;seed:string;
 outcome_hash:string;outcome_json:string;status:string;created_at:number;
}
function invalid():never{throw new ApiError(422,'calendar_event_prerequisites')}
function blocked():never{throw new ApiError(409,'calendar_event_prerequisites')}
export async function planAdministrativeAdvance(db:Database,world:WorldV1,rows:readonly AdvanceEventRow[],destinationDay:number,now:number){
 const guards:Statement[]=[],writes:Statement[]=[];
 const events=rows.map(r=>({id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,status:r.status}));
 // Validates unique positions, IDs, scopes and all dependency placement, including completed rows.
 dueAdministrativeMilestones(events,Math.max(1,world.day));
 if(events.some(e=>e.scope!=='season'&&e.day>12||e.day<world.day&&e.status!=='completed'))blocked();
 if(rows.some(r=>r.status==='completed'&&(r.scheduled_day>world.day||!r.receipt_hash||!Number.isSafeInteger(r.completed_at)||r.completed_at===null||r.completed_at<=0)||
    r.status==='scheduled'&&(r.completed_at!==null||r.receipt_hash!==null)))invalid();
 const authority=await loadSeasonSnapshotAuthority(db,world),snapshot=authority.snapshot;
 guards.push(...authority.guards);
 const stored=await db.prepare(`SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=${world.seasonNumber}`).first<{generation:string;participants_hash:string;rules_hash:string;snapshot_json:string}>();
 if(!stored||stored.generation!==world.generation||stored.participants_hash!==snapshot.participantsHash||stored.rules_hash!==snapshot.rulesHash||
    await canonicalHash(JSON.parse(stored.snapshot_json))!==await canonicalHash(snapshot))invalid();
 guards.push(abortUnless(db,`SELECT 1 FROM seasons WHERE season_number=${world.seasonNumber} AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?`,
  [stored.generation,stored.participants_hash,stored.rules_hash,stored.snapshot_json]));
 const savedStage=await db.prepare(`SELECT * FROM season_domestic_stages WHERE season_number=${world.seasonNumber}`).first<Stage>();
 const savedDraws=(await db.prepare(`SELECT competition_id,stage_id,algorithm_version,seed,outcome_hash,outcome_json,status,created_at FROM season_draws WHERE season_number=${world.seasonNumber} ORDER BY competition_id`).all<Draw>()).results;
 guards.push(abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_domestic_stages WHERE season_number=${world.seasonNumber})=?`,[savedStage?1:0]));
 if(savedStage)guards.push(abortUnless(db,`SELECT 1 FROM season_domestic_stages WHERE season_number=${world.seasonNumber} AND generation=? AND algorithm_version=? AND seed=? AND participants_hash=? AND rules_hash=? AND fixtures_hash=? AND fixtures_json=? AND created_at=?`,
  [savedStage.generation,savedStage.algorithm_version,savedStage.seed,savedStage.participants_hash,savedStage.rules_hash,savedStage.fixtures_hash,savedStage.fixtures_json,savedStage.created_at]));
 guards.push(abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=${world.seasonNumber})=?`,[savedDraws.length]));
 for(const d of savedDraws)guards.push(abortUnless(db,`SELECT 1 FROM season_draws WHERE season_number=${world.seasonNumber} AND competition_id=? AND stage_id=? AND algorithm_version=? AND seed=? AND outcome_hash=? AND outcome_json=? AND status=? AND created_at=?`,
  [d.competition_id,d.stage_id,d.algorithm_version,d.seed,d.outcome_hash,d.outcome_json,d.status,d.created_at]));
 let stage:Stage|null=null,schedule:InitialSchedule|null=null;
 let draws:Awaited<ReturnType<typeof initialDrawOutcomes>>|null=null;
 let published=false;
 const completed=new Set<string>();
 for(const event of rows){
  const existing=event.status==='completed',due=event.scheduled_day===world.day;
  if(!existing&&!due)continue;
  let receipt:string;
  if(event.kind.startsWith('confirm-')){
   receipt=await canonicalHash({schemaVersion:1,season:world.seasonNumber,generation:world.generation,eventId:event.event_id,kind:event.kind,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash});
  }else if(event.kind==='generate-domestic-calendar'){
   if(!completed.has('domestic:entrants'))blocked();
   if(existing&&!savedStage||!existing&&savedStage)invalid();
   const seed=savedStage?.seed??crypto.randomUUID()+':'+crypto.randomUUID();
   schedule=world.seasonNumber===1?await buildInitialSchedule(snapshot,seed):await buildTrustedSeasonSchedule(snapshot,seed,world.seasonNumber);
   const fixtures=schedule.fixtures.filter(f=>!f.competitionId.startsWith('int-'));
   if(fixtures.length!==3840)invalid();
   const fixturesHash=await canonicalHash(fixtures),fixturesJson=JSON.stringify(fixtures);
   stage={generation:world.generation,algorithm_version:schedule.algorithmVersion,seed,participants_hash:snapshot.participantsHash,rules_hash:snapshot.rulesHash,fixtures_hash:fixturesHash,fixtures_json:fixturesJson,created_at:now};
   if(savedStage&&(savedStage.generation!==stage.generation||savedStage.algorithm_version!==stage.algorithm_version||savedStage.participants_hash!==stage.participants_hash||savedStage.rules_hash!==stage.rules_hash||
      savedStage.fixtures_hash!==fixturesHash||await canonicalHash(JSON.parse(savedStage.fixtures_json))!==fixturesHash))invalid();
   if(!existing)writes.push(db.prepare('INSERT INTO season_domestic_stages VALUES(?,?,?,?,?,?,?,?,?)').bind(world.seasonNumber,stage.generation,stage.algorithm_version,seed,stage.participants_hash,stage.rules_hash,fixturesHash,fixturesJson,now));
   receipt=await canonicalHash({schemaVersion:1,season:world.seasonNumber,generation:world.generation,eventId:event.event_id,fixturesHash,seed,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash});
  }else if(event.kind==='draw-international'){
   if(!stage||!schedule||!completed.has('international:entrants')||!completed.has('domestic:calendar'))blocked();
   draws=await initialDrawOutcomes(schedule,snapshot);
   if(existing){
    if(savedDraws.length!==draws.length)invalid();
    for(let i=0;i<draws.length;i++){
     const d=savedDraws[i],want=draws[i];
     if(d.competition_id!==want.competitionId||d.stage_id!=='league'||d.algorithm_version!==schedule.algorithmVersion||d.seed!==stage.seed||d.status!=='generated'||d.outcome_hash!==want.hash||await canonicalHash(JSON.parse(d.outcome_json))!==want.hash)invalid();
    }
   }else{
    if(savedDraws.length)invalid();
    writes.push(...draws.map(d=>db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(world.seasonNumber,d.competitionId,'league',schedule!.algorithmVersion,stage!.seed,d.hash,d.json,'generated',now)));
   }
   receipt=await canonicalHash({schemaVersion:1,generation:world.generation,season:world.seasonNumber,eventId:event.event_id,domesticHash:stage.fixtures_hash,drawHashes:draws.map(d=>[d.competitionId,d.hash])});
  }else if(event.kind==='generate-international-calendar'){
   if(existing||!stage||!schedule||!draws||!completed.has('international:draw'))blocked();
   const calendarHash=await canonicalHash(schedule);
   receipt=await canonicalHash({schemaVersion:1,generation:world.generation,season:world.seasonNumber,eventId:event.event_id,calendarHash,domesticHash:stage.fixtures_hash,drawHashes:draws.map(d=>d.hash)});
   writes.push(db.prepare('INSERT INTO season_calendars VALUES(?,?,?,?,?,?)').bind(world.seasonNumber,schedule.algorithmVersion,calendarHash,JSON.stringify(schedule),'generated',now));
   // No administrative event may be moved into the sporting portion of the season.
   // All prerequisites have completed before any destination-day match is finalized.
   if(rows.some(r=>r.scope!=='season'&&r.scheduled_day>world.day))blocked();
   const progression=createProgression(snapshot,schedule);
   for(let day=1;day<=destinationDay;day++){
    const processed=await processSportingDay(progression,day);
    const payload=sportingDayPayload(world.seasonNumber,world.generation,day,calendarHash,processed.results);
    for(const plan of processed.newTies)writes.push(db.prepare('INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)').bind(world.seasonNumber,world.generation,plan.competitionId,plan.phaseId,plan.tieId,await canonicalHash(plan),JSON.stringify(plan),now));
    writes.push(db.prepare('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)').bind(world.seasonNumber,world.generation,day,calendarHash,'temporary-score-v1',await canonicalHash(payload),JSON.stringify(payload),now));
   }
   published=true;
  }else return invalid();
  if(existing){if(event.receipt_hash!==receipt)invalid()}
  else writes.push(db.prepare(`UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=${world.seasonNumber} AND event_id=? AND scheduled_day=? AND status='scheduled'`).bind(now,receipt,event.event_id,world.day));
  completed.add(event.event_id);
 }
 // Extra artifacts may not be smuggled in ahead of their owning event.
 if(savedStage&&!stage||savedDraws.length&&!draws)invalid();
 if(destinationDay>12&&!published)blocked();
 return {guards,writes};
}
