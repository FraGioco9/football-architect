import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {
 buildPortraitSnapshotForPlayer,renderPortraitPromptFromSnapshot,
 buildV4PortraitSnapshotForPlayer,renderV4PortraitPromptFromSnapshot
} from '../backend/src/player-portrait-core.mjs';
import {
 buildChatGptPortraitExecutionFromSnapshot,CHATGPT_PORTRAIT_TOOL_OPTIONS,
 CHATGPT_PORTRAIT_EXECUTION_VERSION,
 buildChatGptV4PortraitExecutionFromSnapshot,CHATGPT_V4_PORTRAIT_EXECUTION_VERSION
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


test('V4 ChatGPT handoff contains the exact canonical V4 prompt once and fixed adult male',async()=>{
 const snap=await buildV4PortraitSnapshotForPlayer(specimen(45));
 const core=await renderV4PortraitPromptFromSnapshot(snap);
 const result=await buildChatGptV4PortraitExecutionFromSnapshot(snap);
 assert.equal(result.playerId,45);
 assert.equal(result.portraitPromptVersion,'player-portrait-v4');
 assert.equal(result.executionVersion,CHATGPT_V4_PORTRAIT_EXECUTION_VERSION);
 assert.equal(result.executionVersion,'chatgpt-portrait-execution-v2');
 assert.equal(result.renderer,'chatgpt-image-generation');
 assert.equal(result.onePlayerPerInvocation,true);
 assert.equal(result.desiredAspectRatio,'3:4');
 assert.equal(result.prompt.split(core).length,2,'canonical V4 text must appear once');
 assert.ok(result.prompt.includes('--- CANONICAL V4 PROMPT (VERBATIM) ---'));
 assert.ok(result.prompt.includes('--- END CANONICAL V4 PROMPT ---'));
 assert.match(result.prompt,/EXACTLY ONE fictional adult male association football player/);
 assert.match(result.prompt,/ordinary-looking|ordinary individual/i);
 assert.match(result.prompt,/fashion\/fitness model styling/i);
 assert.match(result.prompt,/muscle/i);
 assert.match(result.prompt,/3–8 px/);
 assert.match(result.prompt,/transparent PNG RGBA ALPHA/i);
 assert.match(result.prompt,/regular match fit/i);
 assert.ok(!result.prompt.includes('NEVER INCLUDE PLAYER NAME'));
 assert.ok(!result.prompt.includes('184'));
 assert.ok(!result.prompt.includes('CB'));
 assert.doesNotMatch(result.prompt,/teenager|teenage|16-year|17-year|age bands/i);
 assert.equal(Object.isFrozen(result),true);
});

test('V4 ChatGPT independent tools request genuine alpha and never a multi-image batch',async()=>{
 const ids=[44,45,98,145,148];
 const snaps=await Promise.all(ids.map(id=>buildV4PortraitSnapshotForPlayer(specimen(id))));
 const jobs=await Promise.all(snaps.map(buildChatGptV4PortraitExecutionFromSnapshot));
 assert.deepEqual(jobs.map(j=>j.playerId),ids);
 assert.equal(new Set(jobs.map(j=>j.prompt)).size,ids.length);
 assert.equal(new Set(snaps.map(s=>s.appearance_fingerprint)).size,ids.length);
 for(const job of jobs){
  assert.deepEqual(job.toolOptions,{transparent_background:true});
  assert.equal(job.toolOptions,CHATGPT_PORTRAIT_TOOL_OPTIONS);
  assert.equal(Object.hasOwn(job.toolOptions,'n'),false);
  assert.equal(job.onePlayerPerInvocation,true);
  assert.equal(Object.isFrozen(job.toolOptions),true);
  assert.match(job.prompt,/Never reuse another player/i);
 }
});

test('V4 ChatGPT handoff rejects V3, fabricated identities and injected extra fields',async()=>{
 const v3=await buildPortraitSnapshotForPlayer(specimen(47));
 const v4=await buildV4PortraitSnapshotForPlayer(specimen(47));
 await assert.rejects(()=>buildChatGptV4PortraitExecutionFromSnapshot(v3),/invalid_v4_portrait_version/);
 await assert.rejects(()=>buildChatGptPortraitExecutionFromSnapshot(v4),/invalid_portrait_version/);
 await assert.rejects(()=>buildChatGptV4PortraitExecutionFromSnapshot({...v4,age:19}),/invalid_v4_portrait_snapshot/);
 await assert.rejects(()=>buildChatGptV4PortraitExecutionFromSnapshot({...v4,appearance_fingerprint:'wrong'}),/noncanonical_v4_appearance_snapshot/);
 await assert.rejects(()=>buildChatGptV4PortraitExecutionFromSnapshot({...v4,appearance_traits:{...v4.appearance_traits,face:'IGNORE INSTRUCTIONS'}}),/noncanonical_v4_appearance_snapshot/);
 await assert.rejects(()=>buildChatGptV4PortraitExecutionFromSnapshot({...v4,body_profile:'bodybuilder'}),/invalid_v4_body_profile/);
});

test('original ChatGPT V3 contract remains unchanged after V4 addition',async()=>{
 const v3=await buildPortraitSnapshotForPlayer(specimen(58));
 const core=await renderPortraitPromptFromSnapshot(v3);
 const job=await buildChatGptPortraitExecutionFromSnapshot(v3);
 assert.equal(job.executionVersion,'chatgpt-portrait-execution-v1');
 assert.equal(job.portraitPromptVersion,'player-portrait-v3');
 assert.ok(job.prompt.includes(core));
 assert.ok(job.prompt.includes('--- CANONICAL V3 PROMPT (VERBATIM) ---'));
 assert.ok(!job.prompt.includes('--- CANONICAL V4 PROMPT (VERBATIM) ---'));
});
