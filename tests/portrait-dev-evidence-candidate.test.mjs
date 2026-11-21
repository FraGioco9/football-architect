import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {approvedPortraitPaths} from '../tools/portrait-release-gate.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(join(root,path));
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const evidence=JSON.parse(read('docs/portrait-v42-dev-evidence-candidate.json'));
const ids=[...Array.from({length:20},(_,i)=>44+i),93,98,141,145,148,190];

test('#733 DEV candidate: exact 26 V4.2 identity and immutable WebP hashes',()=>{
 assert.equal(evidence.schema,'player-portraits-v42-dev-evidence-candidate-v1');
 assert.equal(evidence.target,'dev-preview');
 assert.equal(evidence.NOT_A_RELEASE_MANIFEST,true);
 assert.equal(evidence.releaseAuthorized,false);
 assert.deepEqual(evidence.devProfileAudit,{total:150,approved:26,pending:124,
  schemaVersion:'player-portraits-v5',promptVersion:'player-portrait-v4.2'});
 assert.deepEqual(evidence.portraits.map(x=>x.playerId),ids);
 assert.equal(new Set(evidence.portraits.map(x=>x.appearanceFingerprint)).size,26);
 assert.equal(new Set(evidence.portraits.map(x=>x.imageSha256)).size,26);
 for(const p of evidence.portraits){
  assert.deepEqual(Object.keys(p).sort(),[
   'playerId','appearanceFingerprint','identitySnapshotSha256','assetPath','imageSha256','gitBlobSha1'].sort());
  assert.match(p.appearanceFingerprint,/^[a-f0-9]{16}$/);
  assert.match(p.identitySnapshotSha256,/^[a-f0-9]{64}$/);
  assert.match(p.gitBlobSha1,/^[a-f0-9]{40}$/);
  assert.equal(p.assetPath,`assets/players/portraits/${p.playerId}.webp`);
  const bytes=read(p.assetPath);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.toString('ascii',12,16),'VP8X');
  assert.equal(1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),320);
  assert.equal(1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16),362);
  assert.ok(bytes[20]&16,'alpha flag required');
  assert.equal(hash(bytes),p.imageSha256);
  const header=Buffer.from(`blob ${bytes.length}\0`);
  assert.equal(hash(Buffer.concat([header,bytes]),'sha1'),p.gitBlobSha1);
 }
 const tuples=evidence.portraits.map(p=>`${p.playerId}|${p.appearanceFingerprint}|${p.identitySnapshotSha256}`).join('\n');
 assert.equal(hash(tuples),evidence.source.devIdentityTupleSha256);
 assert.equal(evidence.source.devIdentityTupleSha256,
  '29029a993424f920f41056f0d37e71c1b806695d8c335eb873cc47460ba3d409');
});

test('#733 DEV evidence candidate must not unlock publication without owner reviewed pin',()=>{
 assert.deepEqual(evidence.releaseEvidenceMissing,[
  'independently-reviewed-per-image-approval-receipts',
  'immutable-reviewed-approval-registry',
  'owner-approved-dev-release-manifest',
  'externally-pinned-dev-release-manifest-sha256']);
 assert.notEqual(evidence.schema,'player-portraits-v42-release-v1');
 assert.equal(Object.hasOwn(evidence,'approvalRegistrySha256'),false);
 assert.equal(approvedPortraitPaths(root,{target:'dev-preview'}).size,0);
});
