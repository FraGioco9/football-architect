import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {preparePlayerPortraitV42} from '../tools/prepare-player-portrait-v42.mjs';
import {buildV42CutoverStagingSql} from '../tools/prepare-player-portrait-v42-cutover.mjs';

const original=[
 {first_name:'Matthew',last_name:'Tiamiyu',display_name:'Matthew Tiamiyu',
  nationality:'ITA',secondary_nationality:'NGA',attributes:{strength:35,speed:46,agility:70,stamina:37}},
 {first_name:'Giacinto',last_name:'Lello',display_name:'Giacinto Lello',
  nationality:'ITA',secondary_nationality:null,attributes:{strength:73,speed:58,agility:62,stamina:68}}
];
const record=(p,i)=>({id:47+i,matches:1,original_json:JSON.stringify(p),
 payload_json:JSON.stringify({...p,id:47+i})});
async function prepared(){return preparePlayerPortraitV42(original.map(record),2);}
const args=p=>({expectedCount:2,expectedManifest:p.fingerprint_manifest_sha256});

test('frozen 2-player V4.2 package emits identity-only SQL without image requirements',async()=>{
 const p=await prepared();
 const a=await buildV42CutoverStagingSql(p,args(p));
 const b=await buildV42CutoverStagingSql({...p,snapshots:[...p.snapshots].reverse()},args(p));
 assert.deepEqual(a,b,'output order must be deterministic');
 assert.equal(a.count,2);
 assert.equal(a.manifest_sha256,p.fingerprint_manifest_sha256);
 assert.match(a.sql,/CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_candidates/);
 assert.match(a.sql,/CREATE UNIQUE INDEX IF NOT EXISTS player_portrait_v42_candidate_fingerprints/);
 assert.match(a.sql,/INSERT INTO player_portrait_v42_cutover_candidates\(player_id,snapshot_json\)/);
 assert.doesNotMatch(a.sql,/DROP TABLE|asset_key|image_sha256|approved|player-portrait-v3|player-portrait-v4\.1/);
 assert.ok(p.snapshots.every(s=>a.sql.includes(JSON.stringify(s))));
});

test('unverified or incomplete identity manifest fails before staging',async()=>{
 const p=await prepared(),options=args(p);
 for(const bad of [
  {...p,count:1},
  {...p,snapshots:p.snapshots.slice(0,1)},
  {...p,snapshots:[p.snapshots[0],p.snapshots[0]]},
  {...p,snapshots:[{...p.snapshots[0],player_id:0},p.snapshots[1]]},
  {...p,snapshots:[{...p.snapshots[0],prompt_version:'player-portrait-v4.1'},p.snapshots[1]]},
  {...p,snapshots:[{...p.snapshots[0],appearance_fingerprint:'0000000000000000'},p.snapshots[1]]}
 ])await assert.rejects(buildV42CutoverStagingSql(bad,options),
  /invalid_v42_prepared_package|invalid_or_duplicate_v42_identity|noncanonical_v42_portrait_snapshot|v42_manifest_digest_mismatch/);
 await assert.rejects(buildV42CutoverStagingSql(p,{...options,expectedCount:3}),
  /invalid_v42_prepared_package/);
 await assert.rejects(buildV42CutoverStagingSql(p,{...options,expectedManifest:'0'.repeat(64)}),
  /v42_manifest_digest_mismatch/);
});

test('identity-only staging utility never reads prior faces or writes to D1',async()=>{
 const src=await readFile(new URL('../tools/prepare-player-portrait-v42-cutover.mjs',import.meta.url),'utf8');
 for(const forbidden of [/cloudflare\.request/,/\.batch\s*\(/,/\.prepare\s*\(/,
  /fetch\s*\(/,/child_process/,/\.exec\s*\(/,/image_sha256/,/\.webp/,/old_snapshot/])
  assert.doesNotMatch(src,forbidden);
});
