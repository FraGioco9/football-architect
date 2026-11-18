/**
 * Offline V4.2-only portrait identity preparation.
 * Reads a JSON export of permanent players and their original generation drafts.
 * Produces exclusively new V4.2 snapshots; never reads historic portrait profiles,
 * touches D1, generates images or retains prior identity backups.
 */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildFamilyV42PortraitSnapshotForPlayer,
 renderFamilyV42PortraitPromptFromSnapshot} from '../backend/src/player-portrait-family-v42.mjs';
import {resolveCatalogueNameOrigins} from '../backend/src/player-portrait-name-origins.mjs';

export const V42_PREPARATION_FORMAT='player-portraits-v42-prepared-v1';
const SHA=x=>createHash('sha256').update(x).digest('hex');
const decoded=x=>typeof x==='string'?JSON.parse(x):x;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ORIGINAL_IDENTITY_KEYS=Object.freeze([
 'first_name','last_name','display_name','nationality','secondary_nationality',
 'initial_age','height_cm','preferred_foot'
]);
function validateSource(record){
 if(!object(record)||!Number.isSafeInteger(record.id)||record.id<1||
    record.matches!==1)throw new TypeError('unverified_v42_player');
 const current=decoded(record.payload_json),original=decoded(record.original_json);
 if(!object(current)||!object(original)||('id' in original)||
    (current.id!==undefined&&current.id!==record.id))
  throw new TypeError('invalid_v42_source_payload');
 // Never reseed from evolving age, current attributes, position or career status.
 // Immutable identity fields must still match the original committed draft.
 for(const key of ORIGINAL_IDENTITY_KEYS){
  if(JSON.stringify(current[key]??null)!==JSON.stringify(original[key]??null))
   throw new TypeError('original_initial_identity_mismatch');
 }
 if(typeof original.first_name!=='string'||!original.first_name||
    typeof original.last_name!=='string'||!original.last_name||
    original.display_name!==original.first_name+' '+original.last_name)
  throw new TypeError('invalid_v42_initial_name');
 return {...original,id:record.id,
  name_origins:resolveCatalogueNameOrigins(original)};
}
/** Build a pure offline V4.2-only package from the verified original records. */
export async function preparePlayerPortraitV42(rows,expectedCount){
 if(!Array.isArray(rows)||!Number.isSafeInteger(expectedCount)||expectedCount<1||
    rows.length!==expectedCount)throw new TypeError('invalid_v42_source_count');
 const ids=new Set(),fingerprints=new Set(),snapshots=[],manifest=[];
 for(const row of [...rows].sort((a,b)=>a.id-b.id)){
  const player=validateSource(row);
  if(ids.has(player.id))throw new TypeError('duplicate_v42_player_id');
  ids.add(player.id);
  const snapshot=await buildFamilyV42PortraitSnapshotForPlayer(player);
  await renderFamilyV42PortraitPromptFromSnapshot(snapshot);
  if(snapshot.schema_version!=='player-portraits-v5'||
     snapshot.prompt_version!=='player-portrait-v4.2'||
     fingerprints.has(snapshot.appearance_fingerprint))
   throw new TypeError('invalid_v42_snapshot_or_duplicate_face');
  fingerprints.add(snapshot.appearance_fingerprint);
  snapshots.push(snapshot);
  manifest.push([snapshot.player_id,snapshot.appearance_fingerprint,
   snapshot.family_background,snapshot.body_profile,snapshot.appearance_traits.complexion]);
 }
 return {
  format:V42_PREPARATION_FORMAT,prompt_version:'player-portrait-v4.2',
  count:snapshots.length,
  fingerprint_manifest_sha256:SHA(JSON.stringify(manifest)),
  snapshots
 };
}
export function rowsFromD1Export(data){
 // Both "wrangler ... --json" and direct D1 REST response envelopes supported.
 const rows=Array.isArray(data)?
  (data.length===1&&Array.isArray(data[0]?.results)?data[0].results:data):
  Array.isArray(data?.results)?data.results:
  Array.isArray(data?.result?.[0]?.results)?data.result[0].results:
  Array.isArray(data?.[0]?.results)?data[0].results:null;
 if(!Array.isArray(rows))throw new TypeError('invalid_v42_d1_export');
 return rows;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=name=>args.indexOf(name);
 const i=arg('--input'),o=arg('--out'),c=arg('--expected-count'),h=arg('--expected-manifest');
 if(args.length!==8||i<0||o<0||c<0||h<0||
    !args[i+1]||!args[o+1]||!/^[1-9]\d*$/.test(args[c+1]??'')||
    !/^[0-9a-f]{64}$/.test(args[h+1]??'')){
  console.error('Usage: node tools/prepare-player-portrait-v42.mjs --input verified-D1-export.json --out private-v42-snapshots.json --expected-count 150 --expected-manifest <audit-sha256>');
  process.exitCode=2;
 }else try{
  const raw=JSON.parse(await readFile(args[i+1],'utf8'));
  const result=await preparePlayerPortraitV42(rowsFromD1Export(raw),Number(args[c+1]));
  if(result.fingerprint_manifest_sha256!==args[h+1])
   throw new Error('v42_audit_manifest_mismatch');
  await writeFile(args[o+1],JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({status:'PASS',format:result.format,count:result.count,
   manifest_sha256:result.fingerprint_manifest_sha256,output:resolve(args[o+1])}));
 }catch(error){
  console.error(JSON.stringify({status:'FAIL',error:error.message}));
  process.exitCode=1;
 }
}
