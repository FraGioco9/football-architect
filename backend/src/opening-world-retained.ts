/** #791 private retained-player reconciliation. Read only; no reset, HTTP
 * route or remote mutation. A digest is integrity evidence, NOT authorization.
 * Capture before any approved sporting reset, retaining the private evidence
 * outside the database. The caller must exclude concurrent writers.
 */
import type {AdminSession} from './auth.ts';
import {sessionGuard,abortUnless} from './command-guards.ts';
import type {Database} from './database.ts';
import {openingDigest,readOpeningObservation,fingerprint} from './opening-world-store.ts';
import type {WorldV1} from './types.ts';

const insist=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
async function readHistory(db:Database){
 const counts=await db.prepare(`SELECT (SELECT COUNT(*) FROM player_signed_contracts) AS contracts,
  (SELECT COUNT(*) FROM player_agent_mandates) AS mandates,
  (SELECT COUNT(*) FROM seasons) AS seasons,
  (SELECT COUNT(*) FROM season_archives) AS archives,
  (SELECT COUNT(*) FROM match_lineup_result_receipts) AS receipts`).first<{contracts:number;mandates:number;seasons:number;archives:number;receipts:number}>();
 insist(counts&&counts.contracts===0&&counts.mandates===0,'retained player rights require reconciliation');
 const references=(await db.prepare(`SELECT p.id,COUNT(DISTINCT r.public_match_id) AS receiptCount
  FROM match_lineup_result_receipts r CROSS JOIN json_each(r.receipt_json,'$.result.playerIdentities') j
  JOIN generated_players p ON p.id=json_extract(j.value,'$.playerId')
  GROUP BY p.id ORDER BY p.id`).all<{id:number;receiptCount:number}>()).results;
 return {counts,references};
}
function records(observed:Awaited<ReturnType<typeof readOpeningObservation>>){
 return observed.rawRows.map((r,i)=>({id:r.id,fingerprint:observed.rows[i].fingerprint,
  originalGeneration:r.world_generation,originalEntrySeason:r.entry_season}));
}
type RetainedPayload={schema:'opening-retained-before-reset-v1';world:WorldV1;idHighWater:number;
 players:ReturnType<typeof records>;history:Awaited<ReturnType<typeof readHistory>>};
export type RetainedEvidence=RetainedPayload&{digest:string};

export async function captureRetainedOpeningEvidence(db:Database):Promise<RetainedEvidence>{
 const before=await readOpeningObservation(db);
 insist(before.world.seasonNumber>0,'retained evidence requires pre-reset sporting world');
 const history=await readHistory(db),after=await readOpeningObservation(db),historyAfter=await readHistory(db);
 insist(same(before.world,after.world)&&before.idHighWater===after.idHighWater&&same(records(before),records(after))&&same(history,historyAfter),'retained evidence changed');
 const payload:RetainedPayload={schema:'opening-retained-before-reset-v1',world:before.world,idHighWater:before.idHighWater,players:records(before),history};
 return {...payload,digest:await openingDigest(payload)};
}

/** Verify against the existing audited sporting reset; never change provenance.
 * This is a preservation report, not an opening inventory certificate, and
 * cannot authorize allocation, waive eligibility, or certify actual minutes.
 */
export async function verifyRetainedOpeningEvidence(db:Database,evidence:RetainedEvidence,resetOperationId:string){
 const {digest,...payload}=evidence;
 insist(payload.schema==='opening-retained-before-reset-v1'&&payload.world.seasonNumber>0&&await openingDigest(payload)===digest,'invalid retained evidence digest');
 const observed=await readOpeningObservation(db),w=observed.world;
 insist(w.generation!==payload.world.generation&&w.seasonNumber===0&&w.day===0&&w.revision===0&&w.phase==='unstarted','retained reconciliation requires fresh reset world');
 const audit=await db.prepare(`SELECT generation,expected_revision,resulting_revision,outcome_json
  FROM admin_operations WHERE id=? AND command='reset-world-v1'`).bind(resetOperationId).first<{generation:string;expected_revision:number;resulting_revision:number;outcome_json:string}>();
 insist(audit&&audit.generation===payload.world.generation&&audit.expected_revision===payload.world.revision&&audit.resulting_revision===payload.world.revision+1,'retained reset audit mismatch');
 const outcome=JSON.parse(audit!.outcome_json);
 insist(outcome.operationId===resetOperationId&&same(outcome.world,w),'retained reset outcome mismatch');
 const history=await readHistory(db);
 insist(history.counts?.seasons===0&&history.counts.archives===0&&history.counts.receipts===0&&history.references.length===0,'retained sporting history not cleared');
 insist(observed.idHighWater===payload.idHighWater&&observed.rawRows.length===payload.players.length,'retained player records changed');
 let original=0,rebased=0;
 for(const [i,row] of observed.rawRows.entries()){
  const old=payload.players[i];
  insist(row.id===old.id,'retained player ID changed');
  if(row.world_generation===w.generation&&row.entry_season===0)rebased++;
  else if(row.world_generation===old.originalGeneration&&row.entry_season===old.originalEntrySeason)original++;
  else throw Error('unexpected retained metadata');
  insist((await fingerprint({...row,world_generation:old.originalGeneration,entry_season:old.originalEntrySeason})).fingerprint===old.fingerprint,'retained permanent data changed');
 }
 insist(original===0||rebased===0,'partial retained reconciliation');
 const after=await readOpeningObservation(db),historyAfter=await readHistory(db);
 insist(same(after.world,w)&&after.idHighWater===observed.idHighWater&&same(records(after),records(observed))&&same(history,historyAfter),'retained reconciliation changed');
 return {schema:'opening-retained-preservation-v1' as const,sourceDigest:digest,resetOperationId,
  worldGeneration:w.generation,preservedPlayers:payload.players.length,
  previouslyReferencedPlayers:payload.history.references.length,metadataRebased:original===0,eligibleForAutomaticReuse:false as const};
}

/** Pin the canonical retained catalogue, including portrait and valuation rows, in the caller's atomic batch. */
export function retainedCatalogueGuards(db:Database,before:Awaited<ReturnType<typeof readOpeningObservation>>){
 const guards=[abortUnless(db,"SELECT 1 WHERE (SELECT COUNT(*) FROM generated_players)=? AND COALESCE((SELECT seq FROM sqlite_sequence WHERE name='generated_players'),0)=?",[before.rows.length,before.idHighWater])];
 for(let i=0;i<before.rawRows.length;i+=25)guards.push(abortUnless(db,`SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(
 SELECT 1 FROM generated_players p JOIN player_portrait_profiles q ON q.player_id=p.id JOIN player_market_values v ON v.player_id=p.id
 WHERE p.id=json_extract(j.value,'$.id') AND p.batch_id IS json_extract(j.value,'$.batch_id')
 AND p.world_generation IS json_extract(j.value,'$.world_generation') AND p.entry_season IS json_extract(j.value,'$.entry_season')
 AND p.payload_json IS json_extract(j.value,'$.payload_json') AND q.schema_version IS json_extract(j.value,'$.schema_version')
 AND q.prompt_version IS json_extract(j.value,'$.prompt_version') AND q.snapshot_json IS json_extract(j.value,'$.snapshot_json')
 AND q.status IS json_extract(j.value,'$.status') AND q.asset_key IS json_extract(j.value,'$.asset_key')
 AND v.input_revision IS json_extract(j.value,'$.input_revision') AND v.config_version IS json_extract(j.value,'$.config_version')
 AND v.market_value_arc IS json_extract(j.value,'$.market_value_arc')))`,[JSON.stringify(before.rawRows.slice(i,i+25))]));
 return guards;
}

/** B2/G: explicit trusted local operation after audited reset, before staging.
 * The only updates are the two sporting metadata columns. Exact permanent
 * row snapshots, authorization and catalogue size are guarded in one batch. */
export async function rebaseLocalRetainedPlayers(db:Database,session:AdminSession,evidence:RetainedEvidence,resetOperationId:string,now:number){
 const before=await readOpeningObservation(db);
 const proof=await verifyRetainedOpeningEvidence(db,evidence,resetOperationId);
 insist(same(before.rows,(await readOpeningObservation(db)).rows)&&before.world.generation===proof.worldGeneration,'retained catalogue changed');
 const guards=[sessionGuard(db,session,now),abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=0 AND season_number=0 AND day=0 AND phase='unstarted'",[proof.worldGeneration]),
  abortUnless(db,"SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM opening_world_runs WHERE world_generation=? AND batch_index=-1) AND NOT EXISTS(SELECT 1 FROM seasons) AND NOT EXISTS(SELECT 1 FROM season_archives) AND NOT EXISTS(SELECT 1 FROM match_lineup_result_receipts) AND NOT EXISTS(SELECT 1 FROM player_signed_contracts) AND NOT EXISTS(SELECT 1 FROM player_agent_mandates) AND (SELECT COUNT(*) FROM generated_players)=? AND COALESCE((SELECT seq FROM sqlite_sequence WHERE name='generated_players'),0)=?",[proof.worldGeneration,before.rows.length,before.idHighWater])];
 guards.push(...retainedCatalogueGuards(db,before));
 await db.batch([...guards,...(proof.metadataRebased?[]:[db.prepare('UPDATE generated_players SET world_generation=?,entry_season=0').bind(proof.worldGeneration)])]);
 const after=await verifyRetainedOpeningEvidence(db,evidence,resetOperationId);
 insist(after.metadataRebased,'retained rebase incomplete');
 return {...after,alreadyRebased:proof.metadataRebased};
}
