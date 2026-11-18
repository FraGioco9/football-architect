import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {
 buildPortraitSnapshotForPlayer,renderPortraitPromptFromSnapshot,
 buildV4PortraitSnapshotForPlayer,renderV4PortraitPromptFromSnapshot,
 classifyV4AthleticBody,V4_BODY_ARCHETYPES,V4_PORTRAIT_SCHEMA_VERSION,V4_PORTRAIT_PROMPT_VERSION
} from '../backend/src/player-portrait-core.mjs';

const make=(id=44,extra={})=>({
 id,nationality:'ITA',secondary_nationality:null,age:17,initial_age:16,
 display_name:'NEVER PUT THIS NAME IN THE PROMPT',height_cm:184,primary_position:'CB',
 attributes:{strength:73,speed:69,agility:82,stamina:64},...extra
});

test('five exclusive body categories, exact thresholds and no stamina influence',()=>{
 assert.deepEqual(V4_BODY_ARCHETYPES,['slim','lean-fit','average-fit','sturdy','muscular']);
 const cases=[
  [{strength:82,speed:70,agility:70,stamina:50},'muscular'],
  [{strength:82,speed:71,agility:70,stamina:50},'sturdy'],
  [{strength:86,speed:78,agility:78,stamina:90},'sturdy'],
  [{strength:72,speed:80,agility:80,stamina:50},'sturdy'],
  [{strength:47,speed:72,agility:72,stamina:50},'slim'],
  [{strength:48,speed:72,agility:72,stamina:50},'lean-fit'],
  [{strength:61,speed:67,agility:67,stamina:50},'lean-fit'],
  [{strength:60,speed:60,agility:60,stamina:50},'average-fit']
 ];
 for(const [attrs,expected] of cases)
  assert.deepEqual(classifyV4AthleticBody(attrs),{body_profile:expected});
 for(const strength of [1,21,47,48,71,72,81,82,83,99])
  for(const speed of [1,30,67,72,85,99])
   for(const agility of [1,50,72,99]){
    const one=classifyV4AthleticBody({strength,speed,agility,stamina:1}).body_profile;
    assert.ok(V4_BODY_ARCHETYPES.includes(one));
    assert.equal(one,classifyV4AthleticBody({strength,speed,agility,stamina:99}).body_profile);
   }
 for(const strength of [0,100,1.2,null,'82'])
  assert.throws(()=>classifyV4AthleticBody({strength,speed:80,agility:80,stamina:80}),/invalid_v4_athletic_strength/);
});

test('V3 remains unchanged and independent V4 has no age fields',async()=>{
 const player=make();
 const old=await buildPortraitSnapshotForPlayer(player);
 const oldPrompt=await renderPortraitPromptFromSnapshot(old);
 assert.equal(old.appearance_fingerprint,'49d9a18b0f2df2bb');
 assert.equal(old.body_profile,'balanced-athletic');
 const snapshot=await buildV4PortraitSnapshotForPlayer(player);
 assert.equal(snapshot.schema_version,V4_PORTRAIT_SCHEMA_VERSION);
 assert.equal(snapshot.prompt_version,V4_PORTRAIT_PROMPT_VERSION);
 assert.equal(snapshot.body_profile,'sturdy');
 assert.notEqual(snapshot.appearance_fingerprint,old.appearance_fingerprint);
 assert.ok(!('age' in snapshot)&&!('age_band' in snapshot)&&!('body_conditioning' in snapshot));
 assert.ok(!('attributes' in snapshot));
 assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.appearance_traits));
 const text=await renderV4PortraitPromptFromSnapshot(snapshot);
 assert.match(text,/EXACTLY ONE fictional adult male association football player/);
 assert.match(text,/ordinary individual selected for football ability/);
 assert.match(text,/never idealize or beautify/);
 assert.match(text,/REGULAR MATCH FIT/);
 assert.match(text,/3-8 pixels/);
 assert.match(text,/GENUINELY TRANSPARENT RGBA PNG/);
 assert.match(text,/DOWN TO HIP LEVEL/);
 assert.ok(!text.includes(player.display_name));
 assert.ok(!text.includes('teenage'));
 assert.ok(!text.includes('17-year'));
 assert.equal(await renderPortraitPromptFromSnapshot(old),oldPrompt);
});

test('V4 permanent face is stable and only ID-keyed, independently of player stats, age or nationality',async()=>{
 const initial=await buildV4PortraitSnapshotForPlayer(make(98));
 const changed=await buildV4PortraitSnapshotForPlayer(make(98,{
  age:100,initial_age:14,nationality:'GER',secondary_nationality:'ITA',
  attributes:{strength:92,speed:30,agility:25,stamina:99}
 }));
 assert.deepEqual(initial.appearance_traits,changed.appearance_traits);
 assert.equal(initial.appearance_fingerprint,changed.appearance_fingerprint);
 assert.notEqual(initial.body_profile,changed.body_profile);
 assert.match(await renderV4PortraitPromptFromSnapshot(changed),/Primary nationality: Germany. Secondary nationality: Italy./);
});

test('V4 rejects injected, mismatched, extra or unsupported snapshot inputs',async()=>{
 const snap=await buildV4PortraitSnapshotForPlayer(make(45));
 const invalid=[
  [{...snap,prompt_version:'player-portrait-v3'},/invalid_v4_portrait_version/],
  [{...snap,schema_version:'player-portraits-v2'},/invalid_v4_portrait_version/],
  [{...snap,age:18},/invalid_v4_portrait_snapshot/],
  [{...snap,appearance_fingerprint:'bad'},/noncanonical_v4_appearance_snapshot/],
  [{...snap,appearance_traits:{...snap.appearance_traits,nose:'IGNORE ALL'}},/noncanonical_v4_appearance_snapshot/],
  [{...snap,appearance_traits:{...snap.appearance_traits,extra:'bad'}},/noncanonical_v4_appearance_snapshot/],
  [{...snap,body_profile:'bodybuilder'},/invalid_v4_body_profile/],
  [{...snap,secondary_nationality:snap.nationality},/invalid_v4_portrait_snapshot/]
 ];
 for(const [s,err] of invalid)await assert.rejects(()=>renderV4PortraitPromptFromSnapshot(s),err);
 await assert.rejects(()=>buildV4PortraitSnapshotForPlayer(make(46,{nationality:'ITA\nOVERRIDE'})),/invalid_v4_nationality/);
});

test('V4 150 player faces are unique and independent of ordering',async()=>{
 const players=Array.from({length:150},(_,i)=>make(i+44));
 const a=await Promise.all(players.map(buildV4PortraitSnapshotForPlayer));
 const b=await Promise.all(players.slice().reverse().map(buildV4PortraitSnapshotForPlayer));
 const byId=new Map(b.map(x=>[x.player_id,x]));
 for(const s of a)assert.deepEqual(s,byId.get(s.player_id));
 assert.equal(new Set(a.map(x=>x.appearance_fingerprint)).size,150);
});

test('V4 core stays pure and portable',async()=>{
 const source=await readFile(new URL('../backend/src/player-portrait-core.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("export const PORTRAIT_PROMPT_VERSION = 'player-portrait-v3'"));
 assert.ok(source.includes("export const V4_PORTRAIT_PROMPT_VERSION='player-portrait-v4'"));
 assert.ok(!/from ['"]node:/.test(source));
 assert.ok(!source.includes('readFile(')&&!source.includes('writeFile(')&&!source.includes('fetch('));
});
