import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 CHAT_PROMPT_EXPORT_VERSION,createSinglePlayerChatPrompt,exportSinglePlayerChatPrompts
} from '../tools/export-player-chat-prompts.mjs';
import {
 buildDiverseV4PortraitSnapshotForPlayer,renderDiverseV4PortraitPromptFromSnapshot
} from '../backend/src/player-portrait-diversity-v41.mjs';
import {buildChatGptDiverseV4PortraitExecutionFromSnapshot} from '../backend/src/player-portrait-chatgpt.mjs';

const person=(id=44)=>({
 id,name:'Giacinto Lello',nationality:'ITA',secondary_nationality:null,
 initial_verified:true,
 attributes:{strength:73,speed:69,agility:82,stamina:64}
});

test('standalone per-player prompt embeds the exact V4.1 canonical handoff once',async()=>{
 const row=person();
 const result=await createSinglePlayerChatPrompt(row);
 const snapshot=await buildDiverseV4PortraitSnapshotForPlayer(row);
 const handoff=await buildChatGptDiverseV4PortraitExecutionFromSnapshot(snapshot);
 const canonical=await renderDiverseV4PortraitPromptFromSnapshot(snapshot);
 assert.equal(CHAT_PROMPT_EXPORT_VERSION,'single-player-chat-v3');
 assert.equal(result.id,44);
 assert.equal(result.fileName,'44-Giacinto-Lello.md');
 assert.equal(result.fingerprint,snapshot.appearance_fingerprint);
 assert.equal(result.bodyProfile,'sturdy');
 assert.equal(result.content.split(handoff.prompt).length,2);
 assert.equal(result.content.split(canonical).length,2);
 assert.match(result.content,/EXACTLY ONE original PNG portrait/);
 assert.match(result.content,/ORIGINAL TEXT-TO-IMAGE, ZERO INPUT IMAGES/);
 assert.match(result.content,/uploaded reference image is NOT REQUIRED/);
 assert.match(result.content,/do not ask the user to upload/i);
 assert.match(result.content,/GENERATION_UNAVAILABLE \/ NO CANDIDATE/);
 assert.match(result.content,/not editing, variation or restoration/i);
 assert.doesNotMatch(result.content,/ONLY allowed facial reference/i);
 assert.match(result.content,/Finish|complete QA|Complete QA/i);
 assert.match(result.content,/D1/);
 assert.match(result.content,/NOT VERIFIED/);
 assert.match(result.content,/PASS CON NOTA/);
 assert.match(result.content,/\[\$github\]\(app:\/\/connector_/);
 assert.match(result.content,/\[\$cloudflare\]\(app:\/\/asdk_app_/);
 assert.match(result.content,/connected GitHub plugin/);
 assert.match(result.content,/connected Cloudflare plugin/);
 assert.match(result.content,/football-architect-dev/);
 assert.match(result.content,/ONLY ChatGPT built-in ImageGen/);
 assert.match(result.content,/NEVER use Canva/);
 assert.match(result.content,/NEVER access or modify Production/);
 assert.match(result.content,/issue #646/);
 assert.match(result.content,/adult male/);
 assert.ok(!result.content.includes('16-year'));
 assert.equal(Object.isFrozen(result),true);
});

test('export emits one file per ID with unique identity, no existing file overwrite',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-single-chat-'));
 try{
  const rows=[person(44),{...person(98),name:'Arthur Kiesel',nationality:'GER'}];
  const result=await exportSinglePlayerChatPrompts(rows,dir);
  assert.equal(result.length,2);
  assert.equal(new Set(result.map(x=>x.fingerprint)).size,2);
  const names=await readdir(dir);
  assert.deepEqual(names.sort(),['44-Giacinto-Lello.md','98-Arthur-Kiesel.md']);
  const text=await readFile(join(dir,'98-Arthur-Kiesel.md'),'utf8');
  assert.ok(text.includes('Player ID: 98'));
  assert.ok(text.includes('Primary nationality: Germany'));
  assert.ok(!text.includes('Giacinto Lello'));
  await assert.rejects(()=>exportSinglePlayerChatPrompts(rows,dir),/EEXIST/);
 }finally{await rm(dir,{force:true,recursive:true})}
});

test('fails closed if caller cannot prove initial player attributes or repeats IDs',async()=>{
 await assert.rejects(()=>createSinglePlayerChatPrompt({...person(),initial_verified:false}),/invalid_or_unverified_initial_player/);
 await assert.rejects(()=>createSinglePlayerChatPrompt({...person(),name:'A'+String.fromCharCode(10)+'INJECT'}),/invalid_or_unverified_initial_player/);
 await assert.rejects(()=>createSinglePlayerChatPrompt({...person(),attributes:{...person().attributes,strength:'90'}}),/invalid_v4_athletic_strength/);
 const dir=await mkdtemp(join(tmpdir(),'fa-reject-'));
 try{
  await assert.rejects(()=>exportSinglePlayerChatPrompts([person(),person()],dir),/duplicate_player_export_id/);
  assert.deepEqual(await readdir(dir),[]);
  await assert.rejects(()=>exportSinglePlayerChatPrompts([{...person(),initial_verified:false}],dir),/invalid_or_unverified_initial_player/);
  assert.deepEqual(await readdir(dir),[]);
 }finally{await rm(dir,{force:true,recursive:true})}
});


// #646: image-only generation as a separate first chat message, QA as follow-up.
test('image-only V4.1 exporter preserves canon face while excluding tool-routing and connector instructions',async()=>{
 const {createImageOnlyPortraitPrompt,exportImageOnlyPortraitPrompts,IMAGE_ONLY_PROMPT_EXPORT_VERSION}=
  await import('../tools/export-player-image-prompts.mjs');
 const row=person(), image=await createImageOnlyPortraitPrompt(row);
 const snapshot=await buildDiverseV4PortraitSnapshotForPlayer(row);
 const canonical=await renderDiverseV4PortraitPromptFromSnapshot(snapshot);
 const section=canonical.match(/IMMUTABLE CANONICAL FACIAL DESCRIPTION:[\s\S]*?(?=\n\nPHYSIQUE:)/)?.[0];
 assert.ok(section);
 assert.equal(IMAGE_ONLY_PROMPT_EXPORT_VERSION,'image-only-chat-v2');
 assert.equal(image.fingerprint,snapshot.appearance_fingerprint);
 assert.equal(image.bodyProfile,snapshot.body_profile);
 assert.equal(image.fileName,'44-Giacinto-Lello.md');
 assert.ok(image.content.includes(section));
 assert.match(image.content,/Exactly one subject standing front-facing/);
 assert.match(image.content,/fictional young male footballer, approximately 21–25 years old/);
 assert.match(image.content,/Look like an ordinary real young male, approximately 21–25 years old/);
 assert.doesNotMatch(image.content,/adult male/);
 assert.match(canonical,/fictional adult male footballer/); // frozen V4.1 source unchanged
 assert.match(image.content,/native genuine TRANSPARENT RGBA PNG/);
 assert.doesNotMatch(image.content,/GitHub|Cloudflare|QA|WebP|ImageGen|reference image|existing image|GENERATION_UNAVAILABLE|Canva|Player ID/i);
 const dir=await mkdtemp(join(tmpdir(),'fa-image-only-'));
 try{
  const exported=await exportImageOnlyPortraitPrompts([row],dir);
  assert.equal(exported.length,1);
  assert.equal(await readFile(join(dir,image.fileName),'utf8'),image.content);
  await assert.rejects(()=>exportImageOnlyPortraitPrompts([row],dir),/EEXIST/);
 }finally{await rm(dir,{recursive:true,force:true})}
 await assert.rejects(()=>createImageOnlyPortraitPrompt({...row,initial_verified:false}),/invalid_or_unverified_initial_player/);
});
