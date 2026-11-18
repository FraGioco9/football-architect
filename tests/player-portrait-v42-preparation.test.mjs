import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {preparePlayerPortraitV42,rowsFromD1Export,V42_PREPARATION_FORMAT}
 from '../tools/prepare-player-portrait-v42.mjs';

const first={
 first_name:'Matthew',last_name:'Tiamiyu',display_name:'Matthew Tiamiyu',
 nationality:'ITA',secondary_nationality:'NGA',
 attributes:{strength:35,speed:46,agility:70,stamina:37}
};
const second={
 first_name:'Giacinto',last_name:'Lello',display_name:'Giacinto Lello',
 nationality:'ITA',secondary_nationality:null,
 attributes:{strength:73,speed:58,agility:62,stamina:68}
};
function record(id,original){
 return {id,original_json:JSON.stringify(original),
  payload_json:JSON.stringify({...original,id}),matches:1};
}
test('V4.2 only: snapshots are deterministic and verified from frozen originals',async()=>{
 const rows=[record(47,first),record(44,second)];
 const a=await preparePlayerPortraitV42(rows,2);
 const b=await preparePlayerPortraitV42(rows.slice().reverse(),2);
 assert.deepEqual(a,b,'input order must not change fingerprints or manifest SHA');
 assert.equal(a.format,V42_PREPARATION_FORMAT);
 assert.equal(a.count,2);
 assert.deepEqual(a.snapshots.map(x=>x.player_id),[44,47]);
 assert.ok(a.snapshots.every(x=>x.schema_version==='player-portraits-v5'&&
  x.prompt_version==='player-portrait-v4.2'));
 assert.equal(a.snapshots[1].appearance_fingerprint,'3afeeb55beb39b3b');
 assert.equal(a.snapshots[1].family_background,'NGA');
 assert.equal(a.snapshots[1].appearance_traits.complexion,'medium brown complexion');
 assert.equal(a.snapshots[0].family_background,'ITA');
 assert.ok(!JSON.stringify(a).includes('player-portrait-v4.1'));
 assert.ok(!JSON.stringify(a).includes('player-portrait-v3'));
 assert.ok(!Object.hasOwn(a,'backup'));
 const manifest=a.snapshots.map(s=>[s.player_id,s.appearance_fingerprint,s.family_background,
  s.body_profile,s.appearance_traits.complexion]);
 assert.equal(a.fingerprint_manifest_sha256,
  createHash('sha256').update(JSON.stringify(manifest)).digest('hex'));
});
test('D1 export envelopes use only read-only original generated-player payloads',()=>{
 const row=record(47,first);
 assert.deepEqual(rowsFromD1Export([row]),[row]);
 assert.deepEqual(rowsFromD1Export({results:[row]}),[row]);
 assert.deepEqual(rowsFromD1Export({result:[{results:[row]}]}),[row]);
 assert.deepEqual(rowsFromD1Export([{results:[row]}]),[row]);
 assert.throws(()=>rowsFromD1Export({}),/invalid_v42_d1_export/);
});
test('reject inconsistent draft, changed attributes and ambiguous name matches',async()=>{
 const input=record(47,first);
 const bad=[
  {...input,matches:2},
  {...input,matches:0},
  {...input,payload_json:JSON.stringify({...first,id:47,
   attributes:{...first.attributes,strength:99}})},
  {...input,id:48},
  {...input,original_json:JSON.stringify({...first,id:47})},
  {...input,original_json:'null'}
 ];
 for(const record of bad)
  await assert.rejects(()=>preparePlayerPortraitV42([record],1),
   /unverified_v42_player|invalid_v42_source_payload|original_initial_data_mismatch/);
 await assert.rejects(()=>preparePlayerPortraitV42([input,input],2),
  /duplicate_v42_player_id/);
 await assert.rejects(()=>preparePlayerPortraitV42([input],2),
  /invalid_v42_source_count/);
});
test('offline preparer has no D1 mutation, network or old portrait reads',async()=>{
 const {readFile}=await import('node:fs/promises');
 const script=await readFile(new URL('../tools/prepare-player-portrait-v42.mjs',import.meta.url),'utf8');
 for(const forbidden of [/cloudflare\.request/,/\.prepare\s*\(/,
  /fetch\s*\(/,/\.run\s*\(/, /image_gen/, /old_snapshot/, /previous_identity/])
  assert.doesNotMatch(script,forbidden);
});
