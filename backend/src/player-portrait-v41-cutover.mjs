/** #646 — PURE, opt-in preparation of 23 V3 -> V4.1 portrait replacements.
 * Absolutely no database client, network, filesystem access or side effects.
 * Caller MUST supply independently verified frozen INITIAL physical attributes.
 * Never substitute CURRENT mutable gameplay attributes.
 * No SQL emitted for a partial or ambiguous 23-player source set.
 */
import {
 buildDiverseV4PortraitSnapshotForPlayer,
 renderDiverseV4PortraitPromptFromSnapshot
} from './player-portrait-diversity-v41.mjs';

const TARGET_ROWS=[
 [44,'Giacinto Lello','sturdy','46163acf3ae85a04'],
 [45,'Paolo Andrian','muscular','62dfab1eb9a0156a'],
 [46,'Gennaro Cassola','average-fit','28858299f2a27664'],
 [47,'Matthew Tiamiyu','average-fit','cd5632866931fc36'],
 [48,'Patrizio Cimmini','lean-fit','9dafd2c35104e401'],
 [49,'Gianfranco Patry','lean-fit','243e072c6cd86198'],
 [50,'Severino Cerboni','sturdy','64856e8445673fc1'],
 [51,'Giampiero Caione','sturdy','ba69d6d23d2065c6'],
 [52,'Emilio Rigotto','average-fit','5dacb214b01ccbb6'],
 [53,'Paolo Lacasa','average-fit','5a1bae96432df5f4'],
 [54,'Massimo Bottineri','average-fit','9ed4ab37138bc09a'],
 [55,'Mario Bodi','average-fit','518256f221ccf658'],
 [56,'Ferdinando Guerriero','average-fit','2e29062272c334fe'],
 [57,'Gianni Cusenza','lean-fit','1ea0d00b0b56b3ed'],
 [58,'Antonio Simplici','average-fit','a66b2605ebc6f133'],
 [59,'Andrea Cusenza','lean-fit','017ce26b3046699d'],
 [60,'Enrico Pasi','sturdy','1a64070f9f1578a8'],
 [61,'Emanuele Pizzica','average-fit','58f0516ad0b2cfdf'],
 [62,'Angelo Mazzuca','average-fit','a00e0e83a582feb0'],
 [63,'Fiorenzo Colarusso','average-fit','c580a3526d483791'],
 [98,'Arthur Kiesel','lean-fit','1a25525aa385aac5'],
 [145,'Steven Sellen','sturdy','59c1cc5a389a8fe6'],
 [148,'Craig Leaman','lean-fit','59756ee2a93dab36']
];
export const V41_REPLACEMENT_TARGETS=Object.freeze(TARGET_ROWS.map(
 ([id,name,body_profile,appearance_fingerprint])=>Object.freeze({
  id,name,body_profile,appearance_fingerprint,
  asset_key:'assets/players/portraits/'+id+'.webp'
 })
));

const exactly=(value,reason)=>{if(!value)throw new TypeError('v41_cutover_'+reason);};
const parse=(value,reason)=>{
 try{const obj=typeof value==='string'?JSON.parse(value):value;
  exactly(obj&&typeof obj==='object'&&!Array.isArray(obj),reason);return obj;
 }catch{throw new TypeError('v41_cutover_'+reason);}
};
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const keyMap=(rows,idKey,label)=>{
 exactly(Array.isArray(rows)&&rows.length===V41_REPLACEMENT_TARGETS.length,label+'_count');
 const map=new Map();
 for(const row of rows){
  const id=Number(row?.[idKey]);
  exactly(Number.isSafeInteger(id)&&id>0&&!map.has(id),label+'_unique_ids');
  map.set(id,row);
 }
 return map;
};
export function verifyV41PortraitManifest(manifest){
 exactly(manifest&&typeof manifest==='object'&&!Array.isArray(manifest),'manifest');
 exactly(Array.isArray(manifest.missing_ids)&&manifest.missing_ids.length===0,'manifest_missing');
 const byId=keyMap(manifest.entries,'player_id','manifest');
 for(const target of V41_REPLACEMENT_TARGETS){
  const item=byId.get(target.id);
  exactly(item&&item.webp_path===target.asset_key,'manifest_asset_'+target.id);
  exactly(/^[a-f0-9]{64}$/.test(item.webp_sha256),'manifest_sha_'+target.id);
  exactly(item.webp_dimensions==='320x362'&&item.webp_rgba===true&&item.webp_lossless===true,
   'manifest_format_'+target.id);
 }
 return true;
}

/** Input rows are read-only exports; never silently derive initial stats from current player payload.
 * supplied:
 * {manifest,players:[{id,payload_json}], profiles:[{player_id,schema_version,
 *   prompt_version,snapshot_json,status,asset_key,created_at}],
 *  frozen_initial_attributes:{'44':{strength,speed,agility,stamina},...}}
 */
export async function prepareV41PortraitCutover(supplied){
 exactly(supplied&&typeof supplied==='object','input');
 verifyV41PortraitManifest(supplied.manifest);
 const players=keyMap(supplied.players,'id','players');
 const profiles=keyMap(supplied.profiles,'player_id','profiles');
 const initial=supplied.frozen_initial_attributes;
 exactly(initial&&typeof initial==='object'&&!Array.isArray(initial),'frozen_initial');
 exactly(Object.keys(initial).length===V41_REPLACEMENT_TARGETS.length,'frozen_initial_count');
 const result=[];
 for(const target of V41_REPLACEMENT_TARGETS){
  const row=players.get(target.id),current=profiles.get(target.id);
  exactly(row&&current,'missing_'+target.id);
  const person=parse(row.payload_json,'player_payload_'+target.id);
  const old=parse(current.snapshot_json,'old_snapshot_'+target.id);
  exactly(person.display_name===target.name,'player_name_'+target.id);
  exactly(current.schema_version==='player-portraits-v2'&&
   current.prompt_version==='player-portrait-v3'&&
   old.schema_version==='player-portraits-v2'&&
   old.prompt_version==='player-portrait-v3'&&
   old.player_id===target.id,'old_version_'+target.id);
  exactly(current.status==='approved'&&current.asset_key===target.asset_key&&
   Number.isSafeInteger(current.created_at)&&current.created_at>0,'old_approval_'+target.id);
  exactly(old.nationality===person.nationality &&
   (old.secondary_nationality??null)===(person.secondary_nationality??null),
   'nationality_changed_'+target.id);
  const attributes=initial[String(target.id)];
  exactly(attributes&&typeof attributes==='object','missing_initial_'+target.id);
  for(const field of ['strength','speed','agility','stamina'])
   exactly(Number.isInteger(attributes[field])&&attributes[field]>=1&&attributes[field]<=99,
    'invalid_initial_'+field+'_'+target.id);
  const next=await buildDiverseV4PortraitSnapshotForPlayer({
   id:target.id,nationality:old.nationality,
   secondary_nationality:old.secondary_nationality??null,attributes
  });
  exactly(next.appearance_fingerprint===target.appearance_fingerprint&&
   next.body_profile===target.body_profile,'frozen_identity_'+target.id);
  await renderDiverseV4PortraitPromptFromSnapshot(next);
  result.push(Object.freeze({player_id:target.id,name:target.name,
   asset_key:target.asset_key,old_snapshot_json:typeof current.snapshot_json==='string'
    ?current.snapshot_json:JSON.stringify(current.snapshot_json),
   new_snapshot_json:JSON.stringify(next),previous_created_at:current.created_at,
   appearance_fingerprint:next.appearance_fingerprint,body_profile:next.body_profile}));
 }
 return Object.freeze(result);
}

/** SQL preparation only: must be reviewed, executed atomically in one authorised
 * D1 batch AFTER schema migration 0031 and AFTER the release go/no-go.
 * This function does not connect to D1 or apply the output.
 */
export function renderV41PortraitCutoverSQL(plan){
 exactly(Array.isArray(plan)&&plan.length===23,'plan_count');
 const seen=new Set();
 const lines=[
  '-- GENERATED OFFLINE. Never run without a separate release/remote-D1 authorisation.',
  '-- Requires 0031_portrait_v41_replacement.sql and an atomic database batch.',
  '-- Abort if ANY statement has unexpected affected-row count or any guard fails.'
 ];
 for(const item of plan){
  const target=V41_REPLACEMENT_TARGETS.find(t=>t.id===item?.player_id);
  exactly(target&&!seen.has(item.player_id)&&item.asset_key===target.asset_key&&
   item.appearance_fingerprint===target.appearance_fingerprint,'plan_target');
  seen.add(item.player_id);
  const id=item.player_id,old=quote(item.old_snapshot_json),next=quote(item.new_snapshot_json);
  const asset=quote(target.asset_key);
  lines.push('-- Player #'+id+' — '+target.name);
  lines.push('INSERT INTO player_portrait_v3_replacement_backup (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)'+
   ' SELECT player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at FROM player_portrait_profiles'+
   ' WHERE player_id='+id+' AND schema_version='+quote('player-portraits-v2')+
   ' AND prompt_version='+quote('player-portrait-v3')+' AND status='+quote('approved')+
   ' AND asset_key='+asset+' AND snapshot_json='+old+
   ' AND NOT EXISTS (SELECT 1 FROM player_portrait_v3_replacement_backup WHERE player_id='+id+');');
  lines.push('UPDATE player_portrait_profiles SET schema_version='+quote('player-portraits-v4')+
   ',prompt_version='+quote('player-portrait-v4.1')+',snapshot_json='+next+
   ' WHERE player_id='+id+' AND schema_version='+quote('player-portraits-v2')+
   ' AND prompt_version='+quote('player-portrait-v3')+' AND status='+quote('approved')+
   ' AND asset_key='+asset+' AND snapshot_json='+old+
   ' AND EXISTS (SELECT 1 FROM player_portrait_v3_replacement_backup b WHERE b.player_id='+id+
   ' AND b.snapshot_json='+old+');');
 }
 lines.push('SELECT player_id,schema_version,prompt_version,status,asset_key,'+
  "json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint"+
  ' FROM player_portrait_profiles WHERE player_id IN ('+
  V41_REPLACEMENT_TARGETS.map(t=>t.id).join(',')+') ORDER BY player_id;');
 return lines.join('\n\n')+'\n';
}

export function renderV41PortraitRollbackSQL(plan){
 exactly(Array.isArray(plan)&&plan.length===23,'rollback_plan_count');
 const lines=[
  '-- MANUAL ROLLBACK, separate owner authorisation required. Revert WebP Git changes too.',
  '-- Execute atomically ONLY after examining all 23 backup rows.'
 ];
 for(const item of plan){
  const target=V41_REPLACEMENT_TARGETS.find(t=>t.id===item?.player_id);
  exactly(target&&item.appearance_fingerprint===target.appearance_fingerprint,
   'rollback_target');
  const id=item.player_id;
  const base='(SELECT b.';
  lines.push('UPDATE player_portrait_profiles SET '+
   ['schema_version','prompt_version','snapshot_json','status','asset_key','created_at']
    .map(f=>f+'='+base+f+' FROM player_portrait_v3_replacement_backup b WHERE b.player_id='+id+')')
    .join(',')+
   " WHERE player_id="+id+
   " AND schema_version='player-portraits-v4' AND prompt_version='player-portrait-v4.1'"+
   " AND json_extract(snapshot_json,'$.appearance_fingerprint')="+
   quote(target.appearance_fingerprint)+
   ' AND EXISTS (SELECT 1 FROM player_portrait_v3_replacement_backup b WHERE b.player_id='+id+');');
 }
 return lines.join('\n\n')+'\n';
}
