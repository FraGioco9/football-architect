import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {appearanceTraitsForPlayerId,buildPortraitSpecificationForPlayer} from '../tools/players-portrait-profiles.mjs';
import {classifyAthleticBody} from '../tools/players-portrait-body.mjs';
import {compilePortraitPrompts,appendCommittedPlayers,assertExistingPromptsUnchanged} from '../tools/build-player-portrait-prompts.mjs';

const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const fixtures=[
 {id:44,display_name:'Giacinto Lello',nationality:'ITA',secondary_nationality:null,attributes:{strength:73,speed:69,agility:82,stamina:64}},
 {id:98,display_name:'Arthur Kiesel',nationality:'GER',secondary_nationality:null,attributes:{strength:51,speed:77,agility:57,stamina:78}},
 {id:145,display_name:'Steven Sellen',nationality:'ENG',secondary_nationality:null,attributes:{strength:77,speed:68,agility:67,stamina:61}}
];
const input=()=>({players:fixtures.map(p=>({...p,attributes:{...p.attributes}}))});

test('#629 approved three real player profiles match canonical ID-seeded traits and DEV physical classification',async()=>{
 const manifest=JSON.parse(await read('data/players/portrait-manifest.json'));
 assert.deepEqual(Object.keys(manifest.players),['44','98','145']);
 assert.equal(manifest.schema_version,'player-portraits-v2');
 assert.equal(manifest.prompt_version,'player-portrait-v3');
 for(const player of fixtures){
  const spec=buildPortraitSpecificationForPlayer(player),entry=manifest.players[player.id];
  assert.equal(entry.player_id,player.id);
  assert.equal(entry.display_name,player.display_name);
  assert.equal(entry.nationality,player.nationality);
  assert.equal(entry.secondary_nationality,null);
  assert.equal(entry.status,'approved');
  assert.equal(entry.portrait_asset,`assets/players/portraits/${player.id}.webp`);
  assert.deepEqual(entry.appearance_traits,appearanceTraitsForPlayerId(player.id));
  for(const prop of ['appearance_fingerprint','appearance_profile','body_profile','body_conditioning'])
   assert.equal(entry[prop],spec[prop],prop+' '+player.id);
  assert.deepEqual({body_profile:entry.body_profile,body_conditioning:entry.body_conditioning},classifyAthleticBody(player.attributes));
  assert.equal(entry.body_profile,({44:'balanced-athletic',98:'lean-athletic',145:'power-athletic'})[player.id]);
  for(const key of ['attributes','strength','speed','stamina','agility','development_aptitude','initial_age','age','height_cm'])
   assert.ok(!(key in entry),key+' must not leak into repository manifest');
 }
});

test('#629 canonical V3 template regenerates byte-for-byte the stored AI prompts',async()=>{
 const manifest=JSON.parse(await read('data/players/portrait-manifest.json'));
 const text=await read('data/players/portrait-templates/v3.txt');
 const actual=await read('data/players/portrait-prompts.json');
 const compiled=compilePortraitPrompts(manifest,text);
 assert.equal(JSON.stringify(compiled,null,2)+'\n',actual);
 for(const player of fixtures){
  const prompt=compiled.players[String(player.id)].portrait_prompt;
  assert.equal(prompt,buildPortraitSpecificationForPlayer(player).portrait_prompt);
  assert.match(prompt,/exactly ONE individual portrait/);
  assert.match(prompt,/GENUINELY TRANSPARENT BACKGROUND WITH ALPHA CHANNEL/);
  assert.match(prompt,/completely plain pure-white short-sleeved football jersey/);
  assert.ok(!prompt.includes('development_aptitude'));
  assert.ok(!prompt.includes('Strength:'));
 }
 // Exercise the CLI on the committed source files, not just in-memory tests.
 const output=execFileSync(process.execPath,['tools/build-player-portrait-prompts.mjs','--check'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
 assert.match(output,/3 entries, check OK/);
});

test('#629 future committed players are appended without changing approved portrait identities',async()=>{
 const manifest=JSON.parse(await read('data/players/portrait-manifest.json'));
 const template=await read('data/players/portrait-templates/v3.txt');
 const previous=compilePortraitPrompts(manifest,template);
 const imported={id:194,display_name:'Synthetic example',nationality:'ITA',secondary_nationality:'BRA',
  attributes:{strength:85,speed:52,agility:48,stamina:81}};
 const extended=appendCommittedPlayers(manifest,{players:[...input().players,imported]});
 assert.deepEqual(Object.keys(extended.players),['44','98','145','194']);
 assert.equal(extended.players['194'].status,'pending');
 assert.equal(extended.players['194'].portrait_asset,null);
 assert.equal(extended.players['194'].body_profile,'power-athletic');
 assert.equal(extended.players['194'].body_conditioning,'endurance');
 const next=compilePortraitPrompts(extended,template);
 assertExistingPromptsUnchanged(previous,next);
 assert.match(next.players['194'].portrait_prompt,/Primary nationality: Italy\. Secondary nationality: Brazil\./);
 assert.deepEqual(extended.players['44'],manifest.players['44'],'old approved photos are frozen');
 assert.deepEqual(appendCommittedPlayers(extended,{players:[imported]}),extended,'repeated sync is idempotent');
 const modified={...imported,attributes:{strength:24,speed:90,agility:90,stamina:12},nationality:'BRA'};
 assert.deepEqual(appendCommittedPlayers(extended,{players:[modified]}),extended,'later progression cannot change a frozen portrait');
});

test('#629 rejects tampered faces, changed approved prompts, duplicate IDs and unsafe non-public data',async()=>{
 const manifest=JSON.parse(await read('data/players/portrait-manifest.json'));
 const template=await read('data/players/portrait-templates/v3.txt');
 const previous=compilePortraitPrompts(manifest,template);
 const changed=structuredClone(manifest);
 changed.players['44'].appearance_traits.eyes='red eyes';
 assert.throws(()=>compilePortraitPrompts(changed,template),/noncanonical_portrait_traits/);
 const changedFingerprint=structuredClone(manifest);
 changedFingerprint.players['98'].appearance_fingerprint='invalid';
 assert.throws(()=>compilePortraitPrompts(changedFingerprint,template),/noncanonical_appearance_entry/);
 const changedAsset=structuredClone(manifest);
 changedAsset.players['145'].portrait_asset='assets/players/portraits/44.webp';
 assert.throws(()=>compilePortraitPrompts(changedAsset,template),/invalid_approved_portrait_asset/);
 const changedBody=structuredClone(previous);
 changedBody.players['98'].body_conditioning='subtle';
 assert.throws(()=>assertExistingPromptsUnchanged(previous,changedBody),/immutable_98/);
 assert.throws(()=>compilePortraitPrompts(manifest,template.replace('pure-white','pure-blue')),/portrait_template_v3_drift/);
 const d={id:194,display_name:'Synthetic example',nationality:'ITA',secondary_nationality:null,
  attributes:{strength:53,speed:61,agility:62,stamina:78}};
 assert.throws(()=>appendCommittedPlayers(manifest,{players:[d,d]}),/duplicate_committed_player/);
 assert.throws(()=>appendCommittedPlayers(manifest,{players:[{...d,preview_id:'trial-0001'}]}),/invalid_public_committed_player/);
 assert.throws(()=>appendCommittedPlayers(manifest,{players:[{...d,development_aptitude:99}]}),/invalid_public_committed_player/);
 assert.throws(()=>appendCommittedPlayers(manifest,{players:[{...d,attributes:{...d.attributes,vision:99}}]}),/invalid_public_committed_player/);
});
