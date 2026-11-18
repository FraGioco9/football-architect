/**
 * Builds a V4.2-only D1 STAGING script from owner-QA-approved NEW WebP assets.
 * OFFLINE ONLY. Does not execute SQL, mutate D1, publish assets or back up
 * any previous portrait identity. Migration 0033 performs the final swap.
 */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderFamilyV42PortraitPromptFromSnapshot}
 from '../backend/src/player-portrait-family-v42.mjs';

export const V42_IMAGE_QA_FORMAT='player-portraits-v42-image-qa-v1';
const SHA=x=>createHash('sha256').update(x).digest('hex');
const validHash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sqlQuote=x=>"'"+x.replaceAll("'","''")+"'";
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
function validateWebpHeader(data){
 if(data.length<30||data.toString('ascii',0,4)!=='RIFF'||
    data.readUInt32LE(4)+8!==data.length||
    data.toString('ascii',8,12)!=='WEBP')
  throw new TypeError('invalid_v42_webp');
 // Alpha + 320x362 framing must be present. For an extended VP8X header,
 // the alpha feature flag guarantees an alpha-capable WebP image.
 if(data.toString('ascii',12,16)==='VP8X'){
  const width=1+data.readUIntLE(24,3),height=1+data.readUIntLE(27,3);
  if(width!==320||height!==362||(data[20]&0x10)===0)
   throw new TypeError('invalid_v42_webp_alpha_or_dimensions');
 }else if(data.toString('ascii',12,16)==='VP8L'){
  if(data[20]!==0x2f)throw new TypeError('invalid_v42_webp');
  const width=1+((data[21]|(data[22]<<8))&0x3fff);
  const height=1+((data[22]>>6)|(data[23]<<2)|((data[24]&0x0f)<<10));
  const hasAlpha=(data[24]&0x10)!==0;
  if(width!==320||height!==362||!hasAlpha)
   throw new TypeError('invalid_v42_webp_alpha_or_dimensions');
 }else{
  // VP8 (lossy, no VP8X alpha) is never acceptable for transparent portraits.
  throw new TypeError('invalid_v42_webp_alpha_or_dimensions');
 }
}
export async function buildV42CutoverStagingSql(prepared,qa,assetsRoot,
 {expectedCount,expectedManifest}={}){
 if(!obj(prepared)||prepared.format!=='player-portraits-v42-prepared-v1'||
    prepared.prompt_version!=='player-portrait-v4.2'||
    !Number.isSafeInteger(expectedCount)||expectedCount<1||
    prepared.count!==expectedCount||
    !Array.isArray(prepared.snapshots)||prepared.snapshots.length!==expectedCount||
    !validHash(expectedManifest))
  throw new TypeError('invalid_v42_prepared_package');
 if(!obj(qa)||qa.format!==V42_IMAGE_QA_FORMAT||
    !Array.isArray(qa.images)||qa.images.length!==expectedCount)
  throw new TypeError('invalid_v42_image_qa_package');
 const ss=[...prepared.snapshots].sort((a,b)=>a.player_id-b.player_id);
 const manifest=ss.map(s=>[s.player_id,s.appearance_fingerprint,
  s.family_background,s.body_profile,s.appearance_traits?.complexion]);
 const digest=SHA(JSON.stringify(manifest));
 if(digest!==expectedManifest||prepared.fingerprint_manifest_sha256!==digest)
  throw new TypeError('v42_manifest_digest_mismatch');
 const images=new Map();
 for(const row of qa.images){
  if(!obj(row)||!Number.isSafeInteger(row.player_id)||row.player_id<1||
     row.approved!==true||!validHash(row.sha256)||
     !/^[a-f0-9]{16}$/.test(row.appearance_fingerprint??'')||
     images.has(row.player_id))
   throw new TypeError('unapproved_or_duplicate_v42_image');
  images.set(row.player_id,row);
 }
 const ids=new Set(),fps=new Set(),tuples=[];
 for(const s of ss){
  if(!obj(s)||!Number.isSafeInteger(s.player_id)||s.player_id<1||
     ids.has(s.player_id)||fps.has(s.appearance_fingerprint)||
     s.schema_version!=='player-portraits-v5'||
     s.prompt_version!=='player-portrait-v4.2')
   throw new TypeError('invalid_or_duplicate_v42_identity');
  ids.add(s.player_id);fps.add(s.appearance_fingerprint);
  // Full canonical replay checks family casting, hair, body, fingerprint and ID.
  await renderFamilyV42PortraitPromptFromSnapshot(s);
  const entry=images.get(s.player_id);
  if(!entry||entry.appearance_fingerprint!==s.appearance_fingerprint)
   throw new TypeError('v42_image_identity_mismatch');
  const assetKey='assets/players/portraits/'+s.player_id+'.webp';
  const bytes=await readFile(join(resolve(assetsRoot),assetKey));
  validateWebpHeader(bytes);
  if(SHA(bytes)!==entry.sha256)
   throw new TypeError('v42_image_bytes_not_approved');
  tuples.push('('+s.player_id+','+sqlQuote(JSON.stringify(s))+','+
   sqlQuote(assetKey)+','+sqlQuote(entry.sha256)+')');
 }
 // All candidate rows are NEW V4.2 identities. No old portrait profiles read.
 // Failed partial staging is harmless: migration 0033 explicitly checks 1:1 set.
 const migration=await readFile(new URL('../backend/migrations/0033_portrait_v42_replacement.sql',import.meta.url),'utf8');
 const begin=migration.indexOf('CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_candidates');
 const end=migration.indexOf('CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_guard');
 if(begin<0||end<=begin)throw new Error('missing_v42_staging_schema');
 const ddl=migration.slice(begin,end).trim();
 const sql=['-- OWNER-AUTHORISED STAGING ONLY: NEVER RUN WITHOUT EXPLICIT APPROVAL.',
  '-- V4.2 sole version; NO old portrait rows, backups, migration or image upload.',
  '-- New assets independently QA-approved. Manifest SHA-256: '+digest,
  ddl];
 // Small bounded INSERT statements, safe for D1 query-size limits.
 for(let i=0;i<tuples.length;i+=10)
  sql.push('INSERT INTO player_portrait_v42_cutover_candidates'+
   '(player_id,snapshot_json,asset_key,image_sha256) VALUES\n'+
   tuples.slice(i,i+10).join(',\n')+';');
 return Object.freeze({count:ss.length,manifest_sha256:digest,
  sql:sql.join('\n\n')+'\n'});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const readArg=key=>{const at=args.indexOf(key);return at<0?null:args[at+1]};
 const input=readArg('--snapshots'),qaPath=readArg('--image-qa'),
  root=readArg('--assets-root'),out=readArg('--out'),
  expectedCount=Number(readArg('--expected-count')),
  expectedManifest=readArg('--expected-manifest');
 if(args.length!==12||!input||!qaPath||!root||!out||
    !Number.isSafeInteger(expectedCount)||expectedCount<1||!validHash(expectedManifest)){
  console.error('Usage: node tools/prepare-player-portrait-v42-cutover.mjs --snapshots private-v42-snapshots.json --image-qa approved-v42-images.json --assets-root . --out private-v42-stage.sql --expected-count 150 --expected-manifest <64-char sha256>');
  process.exitCode=2;
 }else try{
  const [prepared,qa]=await Promise.all([input,qaPath].map(async x=>JSON.parse(await readFile(x,'utf8'))));
  const staged=await buildV42CutoverStagingSql(prepared,qa,root,{expectedCount,expectedManifest});
  await writeFile(out,staged.sql,{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({status:'PASS',count:staged.count,
   manifest_sha256:staged.manifest_sha256,output:resolve(out)}));
 }catch(e){
  console.error(JSON.stringify({status:'FAIL',error:e.message}));
  process.exitCode=1;
 }
}
