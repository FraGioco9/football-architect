/** #791 private retained-player reconciliation. Read only; no reset, HTTP
 * route or remote mutation. A digest is integrity evidence, NOT authorization.
 * Capture before any approved sporting reset, retaining the private evidence
 * outside the database. The caller must exclude concurrent writers.
 */
import type {Database} from './database.ts';
import {openingDigest,readOpeningObservation} from './opening-world-store.ts';
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
 insist(observed.idHighWater===payload.idHighWater&&same(records(observed),payload.players),'retained player records changed');
 const after=await readOpeningObservation(db),historyAfter=await readHistory(db);
 insist(same(after.world,w)&&after.idHighWater===observed.idHighWater&&same(records(after),records(observed))&&same(history,historyAfter),'retained reconciliation changed');
 return {schema:'opening-retained-preservation-v1' as const,sourceDigest:digest,resetOperationId,
  worldGeneration:w.generation,preservedPlayers:payload.players.length,
  previouslyReferencedPlayers:payload.history.references.length,eligibleForAutomaticReuse:false as const};
}
