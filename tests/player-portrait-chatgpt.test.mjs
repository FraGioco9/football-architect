import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {
 buildPortraitSnapshotForPlayer,renderPortraitPromptFromSnapshot
} from '../backend/src/player-portrait-core.mjs';
import {
 buildChatGptPortraitExecutionFromSnapshot,CHATGPT_PORTRAIT_TOOL_OPTIONS,
 CHATGPT_PORTRAIT_EXECUTION_VERSION
} from '../backend/src/player-portrait-chatgpt.mjs';

const specimen=id=>({
 id,nationality:id===124?'GER':id===148?'ENG':'ITA',
 secondary_nationality:id===47?'NGA':id===49?'FRA':null,
 attributes:{strength:75,speed:60,agility:70,stamina:65},
 display_name:'NEVER INCLUDE PLAYER NAME',
 age:18,height_cm:184,primary_position:'CB'
});

test('ChatGPT adapter embeds the complete immutable V3 canonical prompt verbatim',async()=>{
 const snapshot=await buildPortraitSnapshotForPlayer(specimen(45));
 const canonical=await renderPortraitPromptFromSnapshot(snapshot);
 const request=await buildChatGptPortraitExecutionFromSnapshot(snapshot);
 assert.equal(request.playerId,45);
 assert.equal(request.portraitPromptVersion,'player-portrait-v3');
 assert.equal(request.executionVersion,CHATGPT_PORTRAIT_EXECUTION_VERSION);
 assert.equal(request.renderer,'chatgpt-image-generation');
 assert.ok(request.prompt.includes(canonical));
 assert.equal(request.prompt.split(canonical).length,2,'canonical prompt must occur exactly once');
 assert.ok(request.prompt.includes('--- CANONICAL V3 PROMPT (VERBATIM) ---'));
 assert.match(request.prompt,/NO.*text|no text/i);
 assert.match(request.prompt,/exactly ONE/i);
 assert.match(request.prompt,/transparent/i);
 assert.match(request.prompt,/3:4/);
 assert.match(request.prompt,/HIPS/);
 assert.ok(!request.prompt.includes('NEVER INCLUDE PLAYER NAME'));
 assert.ok(!request.prompt.includes('184'));
 assert.ok(!request.prompt.includes('CB'));
});

test('tool options request native transparency and never request a multi-image batch',async()=>{
 const snapshot=await buildPortraitSnapshotForPlayer(specimen(47));
 const request=await buildChatGptPortraitExecutionFromSnapshot(snapshot);
 assert.deepEqual(request.toolOptions,{transparent_background:true});
 assert.equal(request.toolOptions,CHATGPT_PORTRAIT_TOOL_OPTIONS);
 assert.equal(request.onePlayerPerInvocation,true);
 assert.equal(request.desiredAspectRatio,'3:4');
 assert.equal(Object.hasOwn(request.toolOptions,'n'),false);
 assert.equal(Object.isFrozen(request),true);
 assert.equal(Object.isFrozen(request.toolOptions),true);
});

test('each permanent player ID yields an independent non-reusable face description',async()=>{
 const ids=[45,47,49,124,148];
 const jobs=await Promise.all(ids.map(async id=>buildChatGptPortraitExecutionFromSnapshot(
  await buildPortraitSnapshotForPlayer(specimen(id))
 )));
 assert.deepEqual(jobs.map(x=>x.playerId),ids);
 assert.equal(new Set(jobs.map(x=>x.prompt)).size,5);
 for(const job of jobs){
  assert.match(job.prompt,/Do not infer physical appearance from citizenship/);
  assert.match(job.prompt,/do not.*previous|Never substitute.*previous/i);
 }
});

test('tampered/unsupported snapshot rejects before returning any execution prompt',async()=>{
 const snapshot=await buildPortraitSnapshotForPlayer(specimen(49));
 await assert.rejects(
  ()=>buildChatGptPortraitExecutionFromSnapshot({...snapshot,prompt_version:'player-portrait-v4'}),
  /invalid_portrait_version/
 );
 await assert.rejects(
  ()=>buildChatGptPortraitExecutionFromSnapshot({...snapshot,appearance_traits:{...snapshot.appearance_traits,face:'INJECT'}}),
  /noncanonical_appearance_snapshot/
 );
 await assert.rejects(
  ()=>buildChatGptPortraitExecutionFromSnapshot({...snapshot,body_profile:'bodybuilder'}),
  /invalid_body_profile/
 );
});

test('adapter remains pure: no image API, D1, upload, runtime mutation or file exporter',async()=>{
 const source=await readFile(new URL('../backend/src/player-portrait-chatgpt.mjs',import.meta.url),'utf8');
 for(const forbidden of [/\bfetch\s*\(/,/\.run\s*\(/,/\.prepare\s*\(/,/\.put\s*\(/, /writeFile\s*\(/, /node:/]){
  assert.doesNotMatch(source,forbidden);
 }
});
