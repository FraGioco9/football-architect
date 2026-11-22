/**
 * ASSETS-URL-01: offline, target-specific V4.2 portrait publication fence.
 *
 * A numeric WebP in git is not publication permission. The versioned release
 * manifest MUST be independently reviewed against the V4.2 identity/approval
 * registry. Its exact SHA-256 must then be pinned by the trusted release
 * process OUTSIDE the same source tree. Source files, DEV approval and a
 * self-declared manifest are not authorization for Production.
 *
 * DEV may reuse the immutable already-owner-approved #722/PR #730 snapshot;
 * new portraits and Production still require the independent target gate.
 * Never read D1, an HTTP API or a mutable "latest" approval at build time.
 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {approvedDevPortraitSha256} from './approved-dev-portraits.mjs';

export const PORTRAIT_RELEASE_SCHEMA='player-portraits-v42-release-v1';
const DIGEST=/^[a-f0-9]{64}$/;
const FINGERPRINT=/^[a-f0-9]{16}$/;
const targets=new Set(['dev-preview','production']);
const manifestKeys=['approvalRegistrySha256','identitySchema','portraits','promptVersion','schema','target'].sort().join(',');
const entryKeys=['appearanceFingerprint','approvalReceiptSha256','identitySnapshotSha256','imageSha256','playerId'].sort().join(',');
const keysEqual=(value,expected)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).sort().join(',')===expected;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const regularFile=path=>existsSync(path)&&lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink();

/**
 * An expected manifest hash must come from independently approved deployment
 * configuration, NOT be calculated automatically from the repository.
 */
export function approvedPortraitPaths(sourceRoot,{target='unreleased',expectedManifestSha256=null}={}){
 if(target==='unreleased'){
  if(expectedManifestSha256!==null)throw Error('Portrait release cannot target unreleased');
  return new Set();
 }
 if(!targets.has(target))throw Error('Unknown portrait release target');
 if(target==='dev-preview'&&expectedManifestSha256===null){
  // Reuse the 26 approved/published DEV faces; never infer approval from new files.
  // Snapshot hash integrity fails closed if any previously approved file drifts.
  const files=new Set();
  for(const [id,sha] of Object.entries(approvedDevPortraitSha256)){
   const path='assets/players/portraits/'+id+'.webp';
   const full=join(sourceRoot,path);
   if(!regularFile(full))throw Error('Approved DEV portrait missing or unsafe: '+path);
   const bytes=readFileSync(full);
   if(bytes.length<12||bytes.toString('ascii',0,4)!=='RIFF'||
      bytes.toString('ascii',8,12)!=='WEBP'||digest(bytes)!==sha)
    throw Error('Approved DEV portrait hash mismatch: '+path);
   files.add(path);
  }
  return files;
 }
 if(expectedManifestSha256===null)return new Set();
 if(typeof expectedManifestSha256!=='string'||!DIGEST.test(expectedManifestSha256))
  throw Error('Invalid externally pinned portrait release digest');
 const file=join(sourceRoot,'release-manifests','player-portraits-v42-'+target+'.json');
 if(!regularFile(file))throw Error('Independently reviewed portrait release manifest missing or unsafe');
 const raw=readFileSync(file);
 if(digest(raw)!==expectedManifestSha256)throw Error('Portrait release manifest digest mismatch');
 const manifest=JSON.parse(raw.toString('utf8'));
 if(!keysEqual(manifest,manifestKeys)||manifest.schema!==PORTRAIT_RELEASE_SCHEMA||
    manifest.target!==target||manifest.identitySchema!=='player-portraits-v5'||
    manifest.promptVersion!=='player-portrait-v4.2'||!DIGEST.test(manifest.approvalRegistrySha256)||
    !Array.isArray(manifest.portraits)||manifest.portraits.length>10000)
  throw Error('Invalid target-specific V4.2 portrait release manifest');
 const paths=new Set();let previous=0;
 for(const entry of manifest.portraits){
  if(!keysEqual(entry,entryKeys)||!Number.isSafeInteger(entry.playerId)||entry.playerId<=previous||
     !FINGERPRINT.test(entry.appearanceFingerprint)||!DIGEST.test(entry.identitySnapshotSha256)||
     !DIGEST.test(entry.imageSha256)||!DIGEST.test(entry.approvalReceiptSha256))
   throw Error('Invalid, unordered or duplicate V4.2 portrait release entry');
  previous=entry.playerId;
  const path='assets/players/portraits/'+entry.playerId+'.webp';
  const full=join(sourceRoot,path);
  if(!regularFile(full))throw Error('Approved portrait missing or unsafe: '+path);
  const bytes=readFileSync(full);
  if(bytes.length<12||bytes.toString('ascii',0,4)!=='RIFF'||
     bytes.toString('ascii',8,12)!=='WEBP'||digest(bytes)!==entry.imageSha256)
   throw Error('V4.2 portrait image integrity mismatch: '+path);
  paths.add(path);
 }
 return paths;
}
