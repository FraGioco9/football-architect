import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 createImageOnlyPortraitPrompt,exportImageOnlyPortraitPrompts,
 IMAGE_ONLY_PROMPT_EXPORT_VERSION
} from '../tools/export-player-image-prompts.mjs';
import {
 buildFamilyV42PortraitSnapshotForPlayer,renderFamilyV42PortraitPromptFromSnapshot
} from '../backend/src/player-portrait-family-v42.mjs';
import {resolveCatalogueNameOrigins} from '../backend/src/player-portrait-name-origins.mjs';

// Synthetic input: no player-specific real-world IDs or saved portrait candidates.
const fixture=(id=7,name='Sample Footballer')=>({
 id,name,nationality:'ITA',secondary_nationality:null,
 initial_verified:true,attributes:{strength:73,speed:69,agility:82,stamina:64}
});

test('image-only V4.2 exporter preserves canonical identity and contains no QA or connector routing',async()=>{
 const row=fixture();
 const image=await createImageOnlyPortraitPrompt(row);
 const snapshot=await buildFamilyV42PortraitSnapshotForPlayer({...row,name_origins:resolveCatalogueNameOrigins(row)});
 const canonical=await renderFamilyV42PortraitPromptFromSnapshot(snapshot);
 const face=canonical.match(/IMMUTABLE CANONICAL FACIAL DESCRIPTION:[\s\S]*?(?=\n\nPHYSIQUE:)/)?.[0];
 assert.ok(face,'canonical facial text is present');
 assert.equal(IMAGE_ONLY_PROMPT_EXPORT_VERSION,'image-only-chat-v3');
 assert.equal(image.fingerprint,snapshot.appearance_fingerprint);
 assert.equal(image.bodyProfile,snapshot.body_profile);
 assert.equal(image.fileName,'7-Sample-Footballer.md');
 assert.ok(image.content.includes(face));
 assert.match(image.content,/Exactly one subject standing front-facing/);
 assert.match(image.content,/fictional young male footballer, approximately 21–25 years old/);
 assert.match(image.content,/Look like an ordinary real young male, approximately 21–25 years old/);
 assert.match(image.content,/genuine TRANSPARENT RGBA PNG/);
 assert.doesNotMatch(image.content,/GitHub|Cloudflare|QA|WebP|ImageGen|reference image|existing image|GENERATION_UNAVAILABLE|Canva|Player ID/i);
});

test('generic exporter produces independent prompts without overwriting old exports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-portrait-export-'));
 try{
  const rows=[fixture(),fixture(19,'Example Goalkeeper')];
  const created=await exportImageOnlyPortraitPrompts(rows,dir);
  assert.equal(created.length,2);
  assert.equal(new Set(created.map(x=>x.fingerprint)).size,2);
  assert.deepEqual((await readdir(dir)).sort(),['19-Example-Goalkeeper.md','7-Sample-Footballer.md']);
  const candidate=await createImageOnlyPortraitPrompt(rows[1]);
  assert.equal(await readFile(join(dir,candidate.fileName),'utf8'),candidate.content);
  await assert.rejects(()=>exportImageOnlyPortraitPrompts(rows,dir),/EEXIST/);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('portrait exporter rejects unverified, corrupt and repeated player inputs',async()=>{
 await assert.rejects(()=>createImageOnlyPortraitPrompt({...fixture(),initial_verified:false}),/invalid_or_unverified_initial_player/);
 await assert.rejects(()=>createImageOnlyPortraitPrompt({...fixture(),attributes:{...fixture().attributes,strength:'90'}}),/invalid_v4_athletic_strength/);
 await assert.rejects(()=>createImageOnlyPortraitPrompt({...fixture(),name:'Invalid\nNAME'}),/invalid_or_unverified_initial_player/);
 const dir=await mkdtemp(join(tmpdir(),'fa-portrait-export-invalid-'));
 try{
  await assert.rejects(()=>exportImageOnlyPortraitPrompts([fixture(),fixture()],dir),/duplicate_player_export_id/);
  assert.deepEqual(await readdir(dir),[]);
 }finally{await rm(dir,{recursive:true,force:true})}
});
