/** Expired, uncommitted player previews only; committed batches are FK parents. */
import type {Database,Statement} from './database.ts';
export const PREVIEW_RETENTION_CRON='15 * * * *';
export const PREVIEW_RETENTION_BATCH_LIMIT=250;
export function expiredPlayerPreviewDelete(db:Database,now:number,limit=PREVIEW_RETENTION_BATCH_LIMIT):Statement{
 if(!Number.isSafeInteger(now)||now<=0||!Number.isSafeInteger(limit)||limit<1||limit>1000)
  throw new RangeError('invalid_preview_retention_bounds');
 // Guard both the subquery and DELETE against a raced status change.
 return db.prepare(`DELETE FROM player_generation_drafts
  WHERE status='preview' AND expires_at<=? AND id IN (
   SELECT id FROM player_generation_drafts WHERE status='preview' AND expires_at<=?
   ORDER BY expires_at,id LIMIT ?
  )`).bind(now,now,limit);
}
export async function pruneExpiredPlayerPreviews(db:Database,now:number,limit=PREVIEW_RETENTION_BATCH_LIMIT){
 const result=await expiredPlayerPreviewDelete(db,now,limit).run();
 return result.meta.changes;
}
