/** #788: narrow pre-activation sporting reset; no independent destructive domains. */
import type {Database,Statement} from './database.ts';
import type {AdminSession} from './auth.ts';
import {ApiError} from './errors.ts';
import {abortUnless,sessionGuard} from './command-guards.ts';
import {previewAdminReset} from './admin-inspection.ts';
import {captureRetainedOpeningEvidence,retainedCatalogueGuards} from './opening-world-retained.ts';
import {openingDigest,readOpeningObservation} from './opening-world-store.ts';
import {resetWorld} from './reset-world-command.ts';

const tables=['economic_control','economic_transactions','economic_holds','economic_hold_releases','player_signed_contracts','player_agent_mandates','opening_world_runs','payroll_runs','payroll_claims','payroll_allocations','payroll_run_milestones','payroll_payment_receipts'] as const;
// Even partial genesis, an unfinished opening run, or earned obligations require
// a separately approved recovery protocol. Provisioned empty accounts are retained.
const noPermanentActivity=`SELECT 1 WHERE ${tables.map(t=>'NOT EXISTS(SELECT 1 FROM '+t+')').join(' AND ')}
 AND NOT EXISTS(SELECT 1 FROM economic_policy_versions WHERE json_extract(rules_json,'$.genesisGeneration') IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM season_admin_events WHERE kind='settle-rewards' AND status='completed')`;
function readGuard(db:Database,session:AdminSession){
 if(!session.unified)throw new ApiError(403,'permission_denied');
 return abortUnless(db,"SELECT 1 FROM account_permissions WHERE account_id=? AND permission='admin.world.read'",[session.unified.playerId]);
}
const access=(db:Database,session:AdminSession,now:number)=>[sessionGuard(db,session,now),readGuard(db,session)];
const blocked=()=>new ApiError(409,'reset_prerequisites');
async function sign(session:AdminSession,value:unknown){
 // The session token digest is server-side only. Bind the exact snapshot to the
 // live session rather than accept a client-generated unkeyed digest.
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(session.digest),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
async function inspect(db:Database,session:AdminSession,now:number){
 const base=await previewAdminReset(db,access(db,session,now),['sporting']);
 if(base.world.seasonNumber===0||!['preparing','active','closed'].includes(base.world.phase))throw blocked();
 if(base.blockers.some(b=>!['preview_only','sporting_history_protected'].includes(b)))throw blocked();
 // Missing required migration tables fail closed, as does any permanent activity.
 if(!(await db.prepare(noPermanentActivity).first()))throw blocked();
 const evidence=await captureRetainedOpeningEvidence(db);
 const observed=await readOpeningObservation(db);
 if(JSON.stringify(evidence.world)!==JSON.stringify(base.world)||JSON.stringify(observed.world)!==JSON.stringify(base.world)
  ||observed.idHighWater!==evidence.idHighWater||observed.rows.length!==evidence.players.length
  ||observed.rows.some((r,i)=>r.id!==evidence.players[i].id||r.fingerprint!==evidence.players[i].fingerprint))throw blocked();
 const licenseRows=(await db.prepare('SELECT club_key,account_id,version FROM club_license_state ORDER BY club_key').all<{club_key:string;account_id:string|null;version:number}>()).results;
 const licensedClubs=licenseRows.filter(r=>r.account_id!==null).map(r=>r.club_key);
 const snapshot=await openingDigest({world:base.world,counts:base.counts,abandonedPreviewDrafts:base.abandonedPreviewDrafts,evidence:evidence.digest,licenseRows});
 return {base,evidence,observed,licenseRows,licensedClubs,snapshot};
}
export async function prepareSportingReset(db:Database,session:AdminSession,now:number){
 const state=await inspect(db,session,now);
 const expiresAt=now+300;
 const previewToken=await sign(session,{scope:'sporting',snapshot:state.snapshot,expiresAt});
 return {...state.base,blockers:[],executable:true as const,confirmation:'RESET SEASON 0',expiresAt,previewToken,
  retainedEvidence:state.evidence,assignedLicenses:state.licensedClubs.length,licensedClubs:state.licensedClubs};
}
export async function executeSportingReset(db:Database,session:AdminSession,input:unknown,key:string,now:number){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='confirmation,expectedGeneration,expectedRevision,expiresAt,previewToken')throw new ApiError(422,'reset_confirmation_required');
 const v=input as {confirmation:unknown;expectedGeneration:unknown;expectedRevision:unknown;expiresAt:number;previewToken:string};
 if(v.confirmation!=='RESET SEASON 0'||typeof v.previewToken!=='string'||!Number.isSafeInteger(v.expiresAt)||v.expiresAt<now||v.expiresAt>now+300)throw new ApiError(409,'stale_reset_preview');
 const state=await inspect(db,session,now);
 if(v.expectedGeneration!==state.base.world.generation||v.expectedRevision!==state.base.world.revision||v.previewToken!==await sign(session,{scope:'sporting',snapshot:state.snapshot,expiresAt:v.expiresAt}))throw new ApiError(409,'stale_reset_preview');
 const guards:Statement[]=[readGuard(db,session),abortUnless(db,noPermanentActivity,[]),...retainedCatalogueGuards(db,state.observed),
  abortUnless(db,`SELECT 1 WHERE (SELECT COUNT(*) FROM club_license_state)=?
  AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(
  SELECT 1 FROM club_license_state l WHERE l.club_key IS json_extract(j.value,'$.club_key')
  AND l.account_id IS json_extract(j.value,'$.account_id') AND l.version IS json_extract(j.value,'$.version')))`,[state.licenseRows.length,JSON.stringify(state.licenseRows)]),
  abortUnless(db,"SELECT 1 WHERE (SELECT COUNT(*) FROM player_generation_drafts WHERE status='preview')=?",[state.base.abandonedPreviewDrafts])];
 // Protect the exact inventory observed in the approved preview. All table
 // identifiers originate from the canonical allowlisted inspection function.
 for(const [table,count] of Object.entries(state.base.counts))if(count!==null)guards.push(abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM '+table+')=?',[count]));
 return resetWorld(db,session,{confirmation:'RESET SEASON 0',expectedGeneration:state.base.world.generation,expectedRevision:state.base.world.revision},key,now,guards);
}
