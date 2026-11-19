/**
 * V4.2-only IDENTITY staging. Builds offline SQL from 100% canonical frozen
 * snapshots. Never needs images, old profiles or remote D1 access.
 * Emitted SQL is NOT executed. Migration 0033 performs the guarded swap
 * to PENDING V4.2 rows with NULL asset references.
 */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderFamilyV42PortraitPromptFromSnapshot}
 from '../backend/src/player-portrait-family-v42.mjs';

const SHA=x=>createHash('sha256').update(x).digest('hex');
const validHash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const sqlQuote=x=>"'"+x.replaceAll("'","''")+"'";
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

/** Throws before emitting ANY SQL if source/count/hash/identity is wrong. */
export async function buildV42CutoverStagingSql(prepared,{expectedCount,expectedManifest}={}){
 if(!object(prepared)||prepared.format!=='player-portraits-v42-prepared-v1'||
    prepared.prompt_version!=='player-portrait-v4.2'||
    !Number.isSafeInteger(expectedCount)||expectedCount<1||
    prepared.count!==expectedCount||
    !Array.isArray(prepared.snapshots)||prepared.snapshots.length!==expectedCount||
    !validHash(expectedManifest))
  throw new TypeError('invalid_v42_prepared_package');
 const snapshots=[...prepared.snapshots].sort((a,b)=>a.player_id-b.player_id);
 const ids=new Set(),fingerprints=new Set(),manifest=[],tuples=[];
 for(const snapshot of snapshots){
  if(!object(snapshot)||!Number.isSafeInteger(snapshot.player_id)||snapshot.player_id<1||
     snapshot.schema_version!=='player-portraits-v5'||
     snapshot.prompt_version!=='player-portrait-v4.2'||
     !/^[a-f0-9]{16}$/.test(snapshot.appearance_fingerprint??'')||
     ids.has(snapshot.player_id)||fingerprints.has(snapshot.appearance_fingerprint))
   throw new TypeError('invalid_or_duplicate_v42_identity');
  ids.add(snapshot.player_id);
  fingerprints.add(snapshot.appearance_fingerprint);
  // Canonical renderer validates full snapshot integrity, including frozen
  // player ID, family/background and appearance fingerprint.
  await renderFamilyV42PortraitPromptFromSnapshot(snapshot);
  manifest.push([snapshot.player_id,snapshot.appearance_fingerprint,
   snapshot.family_background,snapshot.body_profile,snapshot.appearance_traits?.complexion]);
  tuples.push('('+snapshot.player_id+','+sqlQuote(JSON.stringify(snapshot))+')');
 }
 const digest=SHA(JSON.stringify(manifest));
 if(digest!==expectedManifest||prepared.fingerprint_manifest_sha256!==digest)
  throw new TypeError('v42_manifest_digest_mismatch');
 const migration=await readFile(new URL('../backend/migrations/0033_portrait_v42_replacement.sql',import.meta.url),'utf8');
 const begin=migration.indexOf('CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_candidates');
 const end=migration.indexOf('CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_guard');
 if(begin<0||end<=begin)throw new Error('missing_v42_staging_schema');
 const ddl=migration.slice(begin,end).trim();
 const lines=[
  '-- PRIVATE V4.2 IDENTITY STAGING ONLY; owner-authorised remote execution required.',
  '-- ALL profiles are pending; image generation and approval occur AFTER merge.',
  '-- No previous portrait identity, asset, backup, image hash or published status.',
  '-- Exact manifest SHA-256: '+digest,
  ddl
 ];
 for(let i=0;i<tuples.length;i+=10)
  lines.push('INSERT INTO player_portrait_v42_cutover_candidates'+
   '(player_id,snapshot_json) VALUES\n'+tuples.slice(i,i+10).join(',\n')+';');
 return Object.freeze({count:snapshots.length,manifest_sha256:digest,
  sql:lines.join('\n\n')+'\n'});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const arg=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
 const input=arg('--snapshots'),out=arg('--out'),
  expectedCount=Number(arg('--expected-count')),
  expectedManifest=arg('--expected-manifest');
 if(args.length!==8||!input||!out||
    !Number.isSafeInteger(expectedCount)||expectedCount<1||
    !validHash(expectedManifest)){
  console.error('Usage: node tools/prepare-player-portrait-v42-cutover.mjs --snapshots private-v42-snapshots.json --out private-v42-stage.sql --expected-count 150 --expected-manifest <manifest-sha256>');
  process.exitCode=2;
 }else try{
  const prepared=JSON.parse(await readFile(input,'utf8'));
  const staged=await buildV42CutoverStagingSql(prepared,{expectedCount,expectedManifest});
  await writeFile(out,staged.sql,{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({status:'PASS',count:staged.count,
   manifest_sha256:staged.manifest_sha256,output:resolve(out)}));
 }catch(e){
  console.error(JSON.stringify({status:'FAIL',error:e.message}));
  process.exitCode=1;
 }
}
