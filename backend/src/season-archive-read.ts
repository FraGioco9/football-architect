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
 for(const record of summaries){
  const base=bySeason.get(record.season_number);
  if(!base||base.generation!==record.generation||base.archive_hash!==record.archive_hash||!/^[a-f0-9]{64}$/.test(record.summary_hash))throw new ApiError(422,'archive_invalid');
  let summary:unknown;try{summary=JSON.parse(record.summary_json)}catch{throw new ApiError(422,'archive_invalid')}
  if(await canonicalHash(summary)!==record.summary_hash)throw new ApiError(422,'archive_invalid');
 }
 return {world,archives:rows.map(row=>({seasonNumber:row.season_number,calendarHash:row.calendar_hash,resultsHash:row.results_hash,knockoutHash:row.knockout_hash,archiveHash:row.archive_hash,resultsCount:row.results_count,daysCount:row.days_count,tiesCount:row.ties_count,closedAt:row.created_at,hasSportingSummary:summaries.some(x=>x.season_number===row.season_number)}))};
}
