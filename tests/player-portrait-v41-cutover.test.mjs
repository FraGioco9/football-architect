import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 V41_REPLACEMENT_TARGETS,verifyV41PortraitManifest,
 prepareV41PortraitCutover,renderV41PortraitCutoverSQL,renderV41PortraitRollbackSQL
} from '../backend/src/player-portrait-v41-cutover.mjs';

const manifest=JSON.parse(readFileSync(new URL(
 '../docs/portrait-v41-integration-batch-2026-11-17.json',import.meta.url),'utf8'));

const stats=body=>{
 switch(body){
  case 'muscular':return {strength:90,speed:40,agility:40,stamina:50};
  case 'sturdy':return {strength:76,speed:52,agility:52,stamina:50};
  case 'lean-fit':return {strength:60,speed:80,agility:80,stamina:50};
  case 'average-fit':return {strength:60,speed:55,agility:55,stamina:50};
  default:throw new Error('unknown test body');
 }
};
const fixture=()=>({
 manifest,
 players:V41_REPLACEMENT_TARGETS.map(t=>({
  id:t.id,payload_json:JSON.stringify({display_name:t.name,nationality:'ITA',
   secondary_nationality:null,attributes:{strength:1,speed:1,agility:1,stamina:1}})
 })),
 profiles:V41_REPLACEMENT_TARGETS.map(t=>({
  player_id:t.id,schema_version:'player-portraits-v2',
  prompt_version:'player-portrait-v3',
  snapshot_json:JSON.stringify({
   schema_version:'player-portraits-v2',prompt_version:'player-portrait-v3',
   player_id:t.id,nationality:'ITA',secondary_nationality:null,
   appearance_fingerprint:'old_v3_fingerprint'
  }),
  status:'approved',asset_key:t.asset_key,created_at:1600000000
 })),
 frozen_initial_attributes:Object.fromEntries(V41_REPLACEMENT_TARGETS.map(t=>[t.id,stats(t.body_profile)]))
});
test('V4.1 replacement manifest is exactly 23 explicit files; no missing/duplicate IDs',()=>{
 assert.equal(V41_REPLACEMENT_TARGETS.length,23);
 assert.equal(verifyV41PortraitManifest(manifest),true);
 assert.deepEqual(V41_REPLACEMENT_TARGETS.map(t=>t.id),
  [...Array.from({length:20},(_,i)=>i+44),98,145,148]);
 const invalid=structuredClone(manifest);
 invalid.entries[0].player_id=999;
 assert.throws(()=>verifyV41PortraitManifest(invalid),/v41_cutover_manifest_asset_/);
});
test('the 23 frozen V4.1 identities replace only the chosen V3 profiles',async()=>{
 const plan=await prepareV41PortraitCutover(fixture());
 assert.equal(plan.length,23);
 for(const row of plan){
  const target=V41_REPLACEMENT_TARGETS.find(x=>x.id===row.player_id);
  const next=JSON.parse(row.new_snapshot_json);
  assert.equal(next.schema_version,'player-portraits-v4');
  assert.equal(next.prompt_version,'player-portrait-v4.1');
  assert.equal(next.appearance_fingerprint,target.appearance_fingerprint);
  assert.equal(next.body_profile,target.body_profile);
  assert.equal(row.asset_key,target.asset_key);
  assert.ok(!('attributes' in next));
 }
 const sql=renderV41PortraitCutoverSQL(plan),rollback=renderV41PortraitRollbackSQL(plan);
 assert.equal((sql.match(/INSERT INTO player_portrait_v3_replacement_backup/g)||[]).length,23);
 assert.equal((sql.match(/UPDATE player_portrait_profiles SET/g)||[]).length,23);
 assert.equal((rollback.match(/UPDATE player_portrait_profiles SET/g)||[]).length,23);
 assert.match(sql,/old_snapshot_json|snapshot_json/);
 assert.match(rollback,/appearance_fingerprint/);
 assert.ok(!sql.includes('DELETE FROM generated_players'));
 assert.ok(!sql.includes('DROP TABLE'));
});
test('cutover fails closed for missing frozen initial stats, wrong player and mutable-body mismatch',async()=>{
 const missing=fixture();delete missing.frozen_initial_attributes['45'];
 await assert.rejects(prepareV41PortraitCutover(missing),/v41_cutover_frozen_initial_count/);
 const wrongName=fixture();wrongName.players[0].payload_json=JSON.stringify({display_name:'Different person',nationality:'ITA'});
 await assert.rejects(prepareV41PortraitCutover(wrongName),/v41_cutover_player_name_44/);
 const wrongBody=fixture();wrongBody.frozen_initial_attributes['45']={strength:15,speed:15,agility:15,stamina:15};
 await assert.rejects(prepareV41PortraitCutover(wrongBody),/v41_cutover_frozen_identity_45/);
 const wrongVersion=fixture();wrongVersion.profiles[0].prompt_version='player-portrait-v4';
 await assert.rejects(prepareV41PortraitCutover(wrongVersion),/v41_cutover_old_version_44/);
 const missingProfile=fixture();missingProfile.profiles.pop();
 await assert.rejects(prepareV41PortraitCutover(missingProfile),/v41_cutover_profiles_count/);
});
