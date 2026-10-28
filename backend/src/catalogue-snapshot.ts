import {validateSeasonOneBindings} from '../catalogues/season-one-selection.mjs';
import {ApiError} from './errors.ts';
import {hashText} from './auth.ts';

type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
export interface CanonicalCatalogue {
 readonly clubIds:readonly string[];
 readonly competitions:readonly {id:string;rulesVersion:string;rules:Json}[];
}
export interface SnapshotBinding {readonly competitionId:string;readonly rulesVersion:string;readonly clubIds:readonly string[]}
export type ApprovedSnapshot = Readonly<{
 manifestVersion:1;approvalReference:string;participantsHash:string;rulesHash:string;bindings:readonly SnapshotBinding[];
}>;
const validated=new WeakSet<object>();
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const competitionIds=[...countries.flatMap(c=>[`${c}-1`,`${c}-2`]),'int-1','int-2'];
const fail=():never=>{throw new ApiError(422,'catalogue_not_approved')};
const version=(id:string)=>id.startsWith('int-')?'international-int24-v1':id.endsWith('-1')?'domestic-top-v1':'domestic-second-v1';
function canonical(value:unknown):string {
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return fail();
}
const freeze=<T>(value:T):T=>{
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value;
};
/** Season 1 owner-approved selection only; later seasons use qualified sporting outcomes. */
export function validateSeasonOneParticipants(bindings:readonly SnapshotBinding[]):void {
 try{validateSeasonOneBindings(bindings)}catch{return fail()}
}

/** Both arguments are server-owned. A manifest never supplies its own canonical catalogue. */
export async function snapshotHashes(bindings:readonly SnapshotBinding[],catalogue:CanonicalCatalogue){
 const ordered=[...bindings].sort((a,b)=>a.competitionId<b.competitionId?-1:a.competitionId>b.competitionId?1:0);
 return {
  participantsHash:await hashText(canonical(ordered.map(b=>({competitionId:b.competitionId,clubIds:[...b.clubIds].sort()})))),
  rulesHash:await hashText(canonical([...catalogue.competitions].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)))
 };
}
/** Validate and copy immutable approval bytes against trusted canonical identities/full rules. */
export async function validateApprovedSnapshot(input:unknown,catalogue:CanonicalCatalogue):Promise<ApprovedSnapshot>{
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))return fail();
  const m=input as ApprovedSnapshot;
  if(Object.keys(m).sort().join(',')!=='approvalReference,bindings,manifestVersion,participantsHash,rulesHash'||
   m.manifestVersion!==1||typeof m.approvalReference!=='string'||m.approvalReference.length<8||m.approvalReference.length>256||/[\x00-\x1f\x7f]/.test(m.approvalReference)||
   !/^[a-f0-9]{64}$/.test(m.participantsHash)||!/^[a-f0-9]{64}$/.test(m.rulesHash)||!Array.isArray(m.bindings)||m.bindings.length!==18)return fail();
  const expectedClubs=countries.flatMap(c=>Array.from({length:40},(_,i)=>`${c}-${i+1}`));
  if(!Array.isArray(catalogue.clubIds)||catalogue.clubIds.length!==320||new Set(catalogue.clubIds).size!==320||expectedClubs.some(id=>!catalogue.clubIds.includes(id)))return fail();
  if(!Array.isArray(catalogue.competitions)||catalogue.competitions.length!==18||new Set(catalogue.competitions.map(c=>c.id)).size!==18)return fail();
  for(const c of catalogue.competitions)if(!competitionIds.includes(c.id)||c.rulesVersion!==version(c.id)||!c.rules||typeof c.rules!=='object'||Array.isArray(c.rules))return fail();
  const seen=new Set<string>(),cupClubs=new Set<string>(),domesticClubs=new Set<string>();
  for(const b of m.bindings){
   if(!b||Object.keys(b).sort().join(',')!=='clubIds,competitionId,rulesVersion'||!competitionIds.includes(b.competitionId)||seen.has(b.competitionId)||b.rulesVersion!==version(b.competitionId)||!Array.isArray(b.clubIds))return fail();
   seen.add(b.competitionId);
   const international=b.competitionId.startsWith('int-');
   if(b.clubIds.length!==(international?24:16)||new Set(b.clubIds).size!==b.clubIds.length||b.clubIds.some((id:string)=>!catalogue.clubIds.includes(id)))return fail();
   if(international){
    for(const c of countries)if(b.clubIds.filter((id:string)=>id.startsWith(c+'-')).length!==3)return fail();
    for(const id of b.clubIds){if(cupClubs.has(id))return fail();cupClubs.add(id)}
   }else{
    const country=b.competitionId.split('-')[0];
    for(const id of b.clubIds){
     if(!id.startsWith(country+'-')||domesticClubs.has(id))return fail();
     domesticClubs.add(id);
    }
   }
  }
  if([...cupClubs].some(id=>!domesticClubs.has(id)))return fail();
  const hashes=await snapshotHashes(m.bindings,catalogue);
  if(hashes.participantsHash!==m.participantsHash||hashes.rulesHash!==m.rulesHash)return fail();
  const result=freeze(JSON.parse(canonical(m)) as ApprovedSnapshot);
  validated.add(result);return result;
 }catch{return fail()}
}
export function requireApprovedSnapshot(snapshot:ApprovedSnapshot|null):ApprovedSnapshot{
 if(!snapshot||!validated.has(snapshot))return fail();return snapshot;
}
/** No production manifest is approved. Test catalogues are never imported here. */
export function loadApprovedSnapshot():ApprovedSnapshot|null{return null}

/** Complete Season 1 approval path: exact selection AND independently trusted full rule/hash validation.
 * This does not load/approve production input; loadApprovedSnapshot remains null.
 */
export async function validateApprovedSeasonOneSnapshot(input:unknown,catalogue:CanonicalCatalogue):Promise<ApprovedSnapshot>{
 validateSeasonOneParticipants((input as ApprovedSnapshot|null)?.bindings as readonly SnapshotBinding[]);
 return validateApprovedSnapshot(input,catalogue);
}
