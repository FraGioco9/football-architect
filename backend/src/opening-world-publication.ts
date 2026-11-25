/** #791: an unsealed population is never a public roster. Read-only. */
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {abortUnless} from './atomic-guard.ts';
async function hasView(db:Database,name:string){
 return !!await db.prepare("SELECT 1 FROM sqlite_schema WHERE type='view' AND name=?").bind(name).first();
}
export async function assertOpeningPublished(db:Database){
 if(await hasView(db,'opening_world_staging')&&await db.prepare('SELECT 1 FROM opening_world_staging LIMIT 1').first())
  throw new ApiError(503,'opening_world_unavailable');
}
/** A certified new economic world cannot prepare Season 1 without publication.
 * Old unfunded sporting test worlds remain unaffected. Same-batch predicate. */
export async function openingSeasonPreparationGuard(db:Database,generation:string){
 if(!await hasView(db,'economic_genesis_status'))return [];
 if(!await hasView(db,'opening_world_staging')){
  return [abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_genesis_status WHERE generation=?)',[generation])];
 }
 return [abortUnless(db,"SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_genesis_status WHERE generation=?) OR EXISTS(SELECT 1 FROM opening_world_runs WHERE world_generation=? AND batch_index=256)",[generation,generation])];
}
