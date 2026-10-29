/** Archived season metadata is read-only and never re-simulated on request. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
interface ArchiveRow{season_number:number;generation:string;calendar_hash:string;results_hash:string;knockout_hash:string;archive_hash:string;results_count:number;days_count:number;ties_count:number;created_at:number}
export async function readSeasonArchives(db:Database){
 const world=await readWorld(db);
 const rows=(await db.prepare('SELECT season_number,generation,calendar_hash,results_hash,knockout_hash,archive_hash,results_count,days_count,ties_count,created_at FROM season_archives ORDER BY season_number DESC').all<ArchiveRow>()).results;
 const seen=new Set<number>();
 for(const row of rows){
  if(!Number.isSafeInteger(row.season_number)||row.season_number<1||row.season_number>world.seasonNumber||seen.has(row.season_number)||
    row.generation!==world.generation||!([row.calendar_hash,row.results_hash,row.knockout_hash,row.archive_hash].every(x=>/^[a-f0-9]{64}$/.test(x)))||
    row.results_count!==4082||row.days_count!==56||row.ties_count!==54||!Number.isSafeInteger(row.created_at)||row.created_at<=0)
   throw new ApiError(422,'archive_invalid');
  seen.add(row.season_number);
 }
 const summaries=(await db.prepare('SELECT season_number,generation,archive_hash,summary_hash,summary_json FROM season_archive_summaries ORDER BY season_number DESC').all<{season_number:number;generation:string;archive_hash:string;summary_hash:string;summary_json:string}>()).results;
 const bySeason=new Map(rows.map(row=>[row.season_number,row]));
 const summaryBySeason=new Map<number,unknown>();
 for(const record of summaries){
  const base=bySeason.get(record.season_number);
  if(!base||base.generation!==record.generation||base.archive_hash!==record.archive_hash||!/^[a-f0-9]{64}$/.test(record.summary_hash))throw new ApiError(422,'archive_invalid');
  let summary:unknown;try{summary=JSON.parse(record.summary_json)}catch{throw new ApiError(422,'archive_invalid')}
  if(await canonicalHash(summary)!==record.summary_hash)throw new ApiError(422,'archive_invalid');
  summaryBySeason.set(record.season_number,summary);
 }
 return {world,archives:rows.map(row=>({seasonNumber:row.season_number,calendarHash:row.calendar_hash,resultsHash:row.results_hash,knockoutHash:row.knockout_hash,archiveHash:row.archive_hash,resultsCount:row.results_count,daysCount:row.days_count,tiesCount:row.ties_count,closedAt:row.created_at,hasSportingSummary:summaryBySeason.has(row.season_number)}))};
}

/** History-facing read of finalized sporting metadata; never simulates on read.
 * An archive is available only after its independent closing event completes.
 */
export async function readClosedSeasonHistory(db:Database,seasonNumber:number){
 if(!Number.isSafeInteger(seasonNumber)||seasonNumber<1)throw new ApiError(422,'archive_invalid');
 const {world,archives}=await readSeasonArchives(db);
 const archive=archives.find(a=>a.seasonNumber===seasonNumber);
 if(!archive||!archive.hasSportingSummary)throw new ApiError(404,'archive_unavailable');
 if(seasonNumber===world.seasonNumber&&world.phase!=='closed')throw new ApiError(409,'archive_prerequisites');
 const closure=await db.prepare("SELECT status,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id='season:close' AND kind='close-season'").bind(seasonNumber).first<{status:string;receipt_hash:string|null}>();
 if(!closure||closure.status!=='completed'||closure.receipt_hash!==archive.archiveHash)throw new ApiError(409,'archive_prerequisites');
 const row=await db.prepare('SELECT generation,archive_hash,summary_hash,summary_json FROM season_archive_summaries WHERE season_number=?').bind(seasonNumber).first<{generation:string;archive_hash:string;summary_hash:string;summary_json:string}>();
 if(!row||row.generation!==world.generation||row.archive_hash!==archive.archiveHash)throw new ApiError(422,'archive_invalid');
 let summary:unknown;try{summary=JSON.parse(row.summary_json)}catch{throw new ApiError(422,'archive_invalid')}
 if(await canonicalHash(summary)!==row.summary_hash)throw new ApiError(422,'archive_invalid');
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision||after.seasonNumber!==world.seasonNumber||after.phase!==world.phase||after.day!==world.day)throw new ApiError(409,'stale_world');
 return {seasonNumber,archiveHash:archive.archiveHash,summary};
}
