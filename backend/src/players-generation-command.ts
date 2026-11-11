// Admin-only two-phase player generation: server-owned preview, explicit atomic D1 commit.
// All data belongs to the configured Worker DB pool, never browser storage or public account tables.
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import type {AdminSession} from './auth.ts';
import {readWorld} from './world-repository.ts';
import {sessionGuard} from './command-guards.ts';
import {abortUnless} from './atomic-guard.ts';
import {COUNTRIES,ATTRIBUTES,generateTrialWithCatalog,summarize} from './players-generator-core.mjs';
import {loadRuntimePlayerCatalog} from './players-catalog.mjs';

const nationalityCodes=new Set(COUNTRIES.map((c:{code:string})=>c.code));
const roles=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const fields=new Set('count seed firstName lastName primaryNationality secondaryNationality age height preferredFoot primaryPosition allowedPositions secondaryCount secondaryPositions allowedSecondaries developmentAptitude primarySuitability attributes'.split(' '));
const pattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY=86400;
type Data=Record<string,unknown>;
type Draft={id:string;world_generation:string;season_number:number;account_id:string;count:number;seed:string;status:string;expires_at:number;candidates_json:string};
const invalid=()=>new ApiError(422,'invalid_players_generation');
function validateRange(x:unknown,min:number,max:number){
 if(Number.isSafeInteger(x))return (x as number)>=min&&(x as number)<=max;
 return Array.isArray(x)&&x.length===2&&x.every(Number.isSafeInteger)&&x[0]>=min&&x[1]<=max&&x[0]<=x[1];
}
function normalizeOptions(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
 const src=value as Data;
 if(Object.keys(src).some(k=>!fields.has(k)))throw invalid();
 const options:Data={};
 for(const [k,v] of Object.entries(src)){
  if(k==='count'){if(!Number.isInteger(v)||Number(v)<1||Number(v)>1000)throw invalid();}
  else if(k==='seed'){if(typeof v!=='string'||v.length<1||v.length>64||/[\r\n]/.test(v))throw invalid();}
  else if(['firstName','lastName'].includes(k)){if(typeof v!=='string'||!v.trim()||v.length>100||/[\u0000-\u001f]/.test(v)||v!==v.normalize('NFC'))throw invalid();}
  else if(k==='primaryNationality'){if(typeof v!=='string'||!nationalityCodes.has(v))throw invalid();}
  else if(k==='secondaryNationality'){if(v!=='none'&&v!=='automatic'&&!(typeof v==='string'&&nationalityCodes.has(v))&&!(Array.isArray(v)&&v.length>0&&v.length<=50&&new Set(v).size===v.length&&v.every(code=>nationalityCodes.has(code))))throw invalid();}
  else if(k==='preferredFoot'){if(v!=='left'&&v!=='right')throw invalid();}
  else if(k==='primaryPosition'){if(typeof v!=='string'||!roles.has(v))throw invalid();}
  else if(['allowedPositions','secondaryPositions','allowedSecondaries'].includes(k)){
   if(!Array.isArray(v)||!v.length||v.length>(k==='secondaryPositions'?5:14)||v.some(role=>!roles.has(role))||new Set(v).size!==v.length)throw invalid();
  }
  else if(k==='secondaryCount'){if(!Number.isSafeInteger(v)||Number(v)<0||Number(v)>5)throw invalid();}
  else if(k==='attributes'){
   if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(a=>!ATTRIBUTES.includes(a)))throw invalid();
   for(const val of Object.values(v))if(!validateRange(val,1,99))throw invalid();
  }
  else if(['age','height','developmentAptitude','primarySuitability'].includes(k)){
   const bounds=k==='age'?[16,19]:k==='height'?[160,205]:k==='primarySuitability'?[1,90]:[1,99];
   if(!validateRange(v,bounds[0],bounds[1]))throw invalid();
  }
  options[k]=v;
 }
 if(options.primaryNationality&&typeof options.secondaryNationality==='string'&&options.secondaryNationality===options.primaryNationality)throw invalid();
 if(Array.isArray(options.secondaryNationality)&&options.secondaryNationality.includes(options.primaryNationality))throw invalid();
 return options;
}
function playerRecord(candidate:any){
 // Preview has no permanent player ID: D1 allocates it only at approval.
 return {
  first_name:candidate.first_name,last_name:candidate.last_name,display_name:candidate.display_name,
  nationality:candidate.nationality,secondary_nationality:candidate.secondary_nationality,
  initial_age:candidate.initial_age,age:candidate.initial_age,career_status:candidate.career_status,
  height_cm:candidate.height_cm,preferred_foot:candidate.preferred_foot,primary_position:candidate.primary_position,
  secondary_positions:candidate.secondary_positions,attributes:candidate.attributes,development_aptitude:candidate.development_aptitude
 };
}
let catalog:ReturnType<typeof loadRuntimePlayerCatalog>|null=null;
export function safePlayerOptions(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!Object.prototype.hasOwnProperty.call(input,'options'))throw invalid();
 return normalizeOptions((input as Data).options);
}
export async function previewPlayerGeneration(db:Database,session:AdminSession,input:unknown,now:number){
 const requested=safePlayerOptions(input);
 // Auto is a fresh cryptographically random seed per preview, not the CLI's fixed
 // reproducibility fixture. A manually provided seed remains fully deterministic.
 const options={...requested,seed:requested.seed??'fa-auto-'+crypto.randomUUID()};
 const world=await readWorld(db);
 let trial:ReturnType<typeof generateTrialWithCatalog>;
 try{trial=generateTrialWithCatalog(options,catalog??(catalog=loadRuntimePlayerCatalog()));}
 catch{throw invalid();}
 const candidates=trial.candidates.map(playerRecord);
 const snapshot=JSON.stringify(candidates);
 if(snapshot.length>1700000)throw new ApiError(422,'players_generation_too_large');
 const batchId=crypto.randomUUID(),expiresAt=now+3600;
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND season_number=?',[world.generation,world.seasonNumber]),
   db.prepare('INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(batchId,world.generation,world.seasonNumber,session.unified!.playerId,JSON.stringify(options),snapshot,trial.count,trial.seed,now,expiresAt)
  ]);
 }catch{throw new ApiError(503,'players_preview_unavailable');}
 return {draftId:batchId,worldGeneration:world.generation,seasonNumber:world.seasonNumber,
  expiresAt,summary:summarize(trial),candidates:candidates.map((p,i)=>({...p,preview_id:trial.candidates[i].preview_id}))};
}
function parseApproval(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(422,'players_approval_required');
 const data=input as Data;
 if(Object.keys(data).sort().join(',')!=='confirmation,draftId'||data.confirmation!=='GENERATE PLAYERS'||typeof data.draftId!=='string'||!pattern.test(data.draftId))throw new ApiError(422,'players_approval_required');
 return data.draftId;
}
export async function commitPlayerGeneration(db:Database,session:AdminSession,input:unknown,now:number){
 const id=parseApproval(input);
 const draft=await db.prepare('SELECT id,world_generation,season_number,account_id,count,seed,status,expires_at,candidates_json FROM player_generation_drafts WHERE id=? AND account_id=?')
  .bind(id,session.unified!.playerId).first<Draft>();
 if(!draft)throw new ApiError(404,'players_preview_not_found');
 const world=await readWorld(db);
 if(world.generation!==draft.world_generation||world.seasonNumber!==draft.season_number)throw new ApiError(409,'stale_players_preview');
 if(draft.status==='committed'){
  const n=await db.prepare('SELECT COUNT(*) AS n FROM generated_players WHERE batch_id=? AND world_generation=?').bind(id,world.generation).first<{n:number}>();
  if(n?.n!==draft.count)throw new ApiError(503,'players_commit_unavailable');
  // A committed draft is repeatable without a second write.
  return {batchId:id,count:draft.count,alreadyCommitted:true,worldGeneration:world.generation};
 }
 if(draft.status!=='preview'||draft.expires_at<=now)throw new ApiError(409,'players_preview_expired');
 try{
  // One D1 transaction: live session guard + unchanged world/draft + ALL player inserts + status.
  // All approved gameplay fields persist unchanged; D1 adds the permanent positive integer ID.
  const result=await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND season_number=?',[world.generation,world.seasonNumber]),
   abortUnless(db,"SELECT 1 FROM player_generation_drafts WHERE id=? AND account_id=? AND status='preview' AND expires_at>? AND world_generation=? AND season_number=?",
    [id,session.unified!.playerId,now,world.generation,world.seasonNumber]),
   db.prepare(`INSERT INTO generated_players(batch_id,world_generation,entry_season,payload_json,created_at)
    SELECT ?, ?,?,json_remove(j.value,'$.id','$.preview_id'),?
    FROM json_each((SELECT candidates_json FROM player_generation_drafts WHERE id=?)) AS j
    ORDER BY CAST(j.key AS INTEGER)`)
    .bind(id,world.generation,world.seasonNumber,now,id),
   // Keep the allocated integer in the persisted internal JSON within this same D1 transaction.
   db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.id',id) WHERE batch_id=? AND world_generation=?")
    .bind(id,world.generation),
   db.prepare("UPDATE player_generation_drafts SET status='committed',committed_at=? WHERE id=? AND account_id=? AND status='preview'").bind(now,id,session.unified!.playerId)
  ]);
  if(result[3].meta.changes!==draft.count||result[4].meta.changes!==draft.count||result[5].meta.changes!==1)throw Error('Uncommitted player count');
  return {batchId:id,count:draft.count,alreadyCommitted:false,worldGeneration:world.generation};
 }catch{
  // A raced retry may have been committed; read back exact count and return idempotently.
  const row=await db.prepare('SELECT status FROM player_generation_drafts WHERE id=? AND account_id=?').bind(id,session.unified!.playerId).first<{status:string}>();
  if(row?.status==='committed'){
   const n=await db.prepare('SELECT COUNT(*) AS n FROM generated_players WHERE batch_id=?').bind(id).first<{n:number}>();
   if(n?.n===draft.count)return {batchId:id,count:draft.count,alreadyCommitted:true,worldGeneration:world.generation};
  }
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.seasonNumber!==world.seasonNumber)throw new ApiError(409,'stale_players_preview');
  throw new ApiError(503,'players_commit_unavailable');
 }
}
export async function listGeneratedPlayers(db:Database){
 const world=await readWorld(db);
 const rows=await db.prepare('SELECT id,batch_id,entry_season,payload_json FROM generated_players WHERE world_generation=? ORDER BY created_at DESC,id LIMIT 100').bind(world.generation).all<{id:string;batch_id:string;entry_season:number;payload_json:string}>();
 const count=await db.prepare('SELECT COUNT(*) AS n FROM generated_players WHERE world_generation=?').bind(world.generation).first<{n:number}>();
 return {count:count?.n??0,worldGeneration:world.generation,players:rows.results.map(row=>JSON.parse(row.payload_json))};
}
