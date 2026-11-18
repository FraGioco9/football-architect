import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparePlayerPortraitV42} from '../tools/prepare-player-portrait-v42.mjs';
import {buildV42CutoverStagingSql,V42_IMAGE_QA_FORMAT}
 from '../tools/prepare-player-portrait-v42-cutover.mjs';

const players=[
 {first_name:'Matthew',last_name:'Tiamiyu',display_name:'Matthew Tiamiyu',
  nationality:'ITA',secondary_nationality:'NGA',attributes:{strength:35,speed:46,agility:70,stamina:37}},
 {first_name:'Giacinto',last_name:'Lello',display_name:'Giacinto Lello',
  nationality:'ITA',secondary_nationality:null,attributes:{strength:73,speed:58,agility:62,stamina:68}}
];
const sha=x=>createHash('sha256').update(x).digest('hex');
function alphaWebp(id=0){
 const b=Buffer.alloc(30);
 b.write('RIFF',0,'ascii');b.writeUInt32LE(b.length-8,4);
 b.write('WEBP',8,'ascii');b.write('VP8X',12,'ascii');b.writeUInt32LE(10,16);
 b[20]=0x10; // VP8X alpha feature.
 b[21]=id&0xff; // Distinct synthetic bytes per fixture player.
 b.writeUIntLE(319,24,3);b.writeUIntLE(361,27,3);
 return b;
}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'fa-v42-cutover-'));
 const original=players.map((p,i)=>({
  id:i+47,matches:1,original_json:JSON.stringify(p),
  payload_json:JSON.stringify({...p,id:i+47})
 }));
 const prepared=await preparePlayerPortraitV42(original,2);
 const images=[];
 for(const snap of prepared.snapshots){
  const path=join(root,'assets','players','portraits',snap.player_id+'.webp');
  await mkdir(join(root,'assets','players','portraits'),{recursive:true});
  const bytes=alphaWebp(snap.player_id);await writeFile(path,bytes);
  images.push({player_id:snap.player_id,appearance_fingerprint:snap.appearance_fingerprint,
   approved:true,sha256:sha(bytes)});
 }
 return {root,prepared,qa:{format:V42_IMAGE_QA_FORMAT,images}};
}
test('approved 2-player V4.2 package creates offline staging only',async()=>{
 const x=await fixture();
 try{
  const stage=await buildV42CutoverStagingSql(x.prepared,x.qa,x.root,{
   expectedCount:2,expectedManifest:x.prepared.fingerprint_manifest_sha256
  });
  assert.equal(stage.count,2);
  assert.equal(stage.manifest_sha256,x.prepared.fingerprint_manifest_sha256);
  assert.match(stage.sql,/CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_candidates/);
  assert.match(stage.sql,/INSERT INTO player_portrait_v42_cutover_candidates/);
  assert.match(stage.sql,/player-portrait-v4\.2/);
  assert.doesNotMatch(stage.sql,/DROP TABLE player_portrait_profiles/);
  assert.doesNotMatch(stage.sql,/player-portrait-v4\.1|player-portrait-v3|replacement_backup/);
  for(const s of x.prepared.snapshots)assert.ok(stage.sql.includes(String(s.player_id)));
 }finally{await rm(x.root,{recursive:true,force:true});}
});
test('no staging without all images, owner approval and the exact immutable identities',async()=>{
 const x=await fixture();
 const opts={expectedCount:2,expectedManifest:x.prepared.fingerprint_manifest_sha256};
 try{
  for(const bad of [
   {...x.qa,images:x.qa.images.slice(0,1)},
   {...x.qa,images:[{...x.qa.images[0],approved:false},x.qa.images[1]]},
   {...x.qa,images:[{...x.qa.images[0],appearance_fingerprint:'0'.repeat(16)},x.qa.images[1]]},
   {...x.qa,images:[{...x.qa.images[0],sha256:'f'.repeat(64)},x.qa.images[1]]},
   {...x.qa,images:[x.qa.images[0],x.qa.images[0]]},
   {...x.qa,images:[x.qa.images[0],{...x.qa.images[1],sha256:x.qa.images[0].sha256}]},
  ])await assert.rejects(()=>buildV42CutoverStagingSql(x.prepared,bad,x.root,opts),
   /invalid_v42_image_qa_package|unapproved_or_duplicate_v42_image|v42_image_identity_mismatch|v42_image_bytes_not_approved|duplicate_v42_webp_bytes/);
  await assert.rejects(()=>buildV42CutoverStagingSql(x.prepared,x.qa,x.root,{
   ...opts,expectedManifest:'0'.repeat(64)}),/v42_manifest_digest_mismatch/);
  await assert.rejects(()=>buildV42CutoverStagingSql({...x.prepared,count:3},x.qa,x.root,opts),
   /invalid_v42_prepared_package/);
  const broken={...x.prepared,snapshots:x.prepared.snapshots.map((s,i)=>i===0?{
   ...s,prompt_version:'player-portrait-v4.1'
  }:s)};
  await assert.rejects(()=>buildV42CutoverStagingSql(broken,x.qa,x.root,opts),
   /invalid_or_duplicate_v42_identity|v42_manifest_digest_mismatch/);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
test('two different identities cannot share the exact same WebP bytes',async()=>{
 const x=await fixture(),[a,b]=x.prepared.snapshots;
 const root=join(x.root,'assets','players','portraits');
 try{
  await copyFile(join(root,a.player_id+'.webp'),join(root,b.player_id+'.webp'));
  const qa={...x.qa,images:x.qa.images.map(entry=>({...entry}))};
  const firstHash=x.qa.images.find(x=>x.player_id===a.player_id).sha256;
  const second=qa.images.find(x=>x.player_id===b.player_id);
  second.sha256=firstHash;
  await assert.rejects(()=>buildV42CutoverStagingSql(x.prepared,qa,x.root,{
   expectedCount:2,expectedManifest:x.prepared.fingerprint_manifest_sha256
  }),/duplicate_v42_webp_bytes/);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
test('refuse alpha-less or wrongly sized WebP even if QA hash matches',async()=>{
 const x=await fixture(),s=x.prepared.snapshots[0];
 const asset=join(x.root,'assets','players','portraits',s.player_id+'.webp');
 const opts={expectedCount:2,expectedManifest:x.prepared.fingerprint_manifest_sha256};
 try{
  for(const change of [b=>{b[20]=0},b=>{b.writeUIntLE(320,24,3)},b=>{b.write('NOTW',8,'ascii')}]) {
   const bad=alphaWebp(s.player_id);change(bad);await writeFile(asset,bad);
   const qa={...x.qa,images:x.qa.images.map(row=>row.player_id===s.player_id?{
    ...row,sha256:sha(bad)}:row)};
   await assert.rejects(()=>buildV42CutoverStagingSql(x.prepared,qa,x.root,opts),
    /invalid_v42_webp/);
  }
 }finally{await rm(x.root,{recursive:true,force:true});}
});
test('stage utility cannot mutate remote database or back up earlier portrait identities',async()=>{
 const script=await readFile(new URL('../tools/prepare-player-portrait-v42-cutover.mjs',import.meta.url),'utf8');
 for(const forbidden of [/cloudflare\.request/,/\.batch\s*\(/,/\.prepare\s*\(/,
  /fetch\s*\(/,/child_process/,/\.exec\s*\(/,/\bMath\.random\s*\(/])
  assert.doesNotMatch(script,forbidden);
});
