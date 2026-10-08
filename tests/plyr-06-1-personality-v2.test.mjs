import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRAITS,TRAIT_KEYS,PERSONALITY_SCHEMA_VERSION,generatePersonality,readPersonality,createPersonality,validatePersonality,copyWithPersonality} from '../src/addons/domain/player-personality.mjs';
import {makeWorld} from '../src/domain/world.js';
import {LEAGUES} from '../src/leagues.js';
import {toAddonPosition} from '../src/addons/career-bridge.mjs';
import {createYouthWorld,advanceYouthSeason,promoteProspect} from '../src/addons/domain/player-youth.mjs';
import {enableAdvancedCareer} from '../src/domain/advanced-career.js';
import {enableCareerWorld,validateCareerWorld} from '../src/domain/career-world.js';

const keys=['professionalism','ambition','loyalty','determination','temperament','adaptability','leadership'];

test('v2 requires exactly seven immutable trait definitions with IT/EN labels',()=>{
 assert.equal(PERSONALITY_SCHEMA_VERSION,2);
 assert.deepEqual(TRAIT_KEYS,keys);
 assert.equal(TRAITS.length,7);
 for(const t of TRAITS)assert.ok(t.label.it&&t.label.en);
 const p=generatePersonality({id:7,globalId:'IT:7'}, {seed:123,countryId:'IT'});
 assert.equal(p.schemaVersion,2);
 assert.deepEqual(Object.keys(p.traits),keys);
 assert.equal(validatePersonality(p),true);
 assert.ok(keys.every(k=>Number.isInteger(p.traits[k])&&p.traits[k]>=1&&p.traits[k]<=100));
});

test('strict validator rejects v1, missing/extra traits, invalid values and future versions',()=>{
 const p=generatePersonality({id:'IT:42'}, {seed:3,countryId:'IT'});
 const bads=[
  {...p,schemaVersion:1},
  {...p,schemaVersion:3},
  {...p,traits:{...p.traits,leadership:undefined}},
  {...p,traits:{...p.traits,extra:50}},
  {...p,traits:{...p.traits,leadership:0}},
  {...p,traits:{...p.traits,leadership:101}},
  {...p,traits:{...p.traits,leadership:50.5}}
 ];
 for(const bad of bads)assert.throws(()=>validatePersonality(bad),/PLY02_/);
 const old={schemaVersion:1,traits:Object.fromEntries(keys.slice(0,6).map(k=>[k,50]))};
 assert.throws(()=>readPersonality({id:'IT:42',personalityProfile:old},{seed:3,countryId:'IT'}),/UNKNOWN_VERSION/);
 assert.throws(()=>createPersonality({professionalism:50}),/TRAITS/);
});

test('deterministic identity is unaffected by nationality, age, locale, repeat reads and numeric local ID',()=>{
 const seed=6789;
 const p={id:19,globalId:'IT:19',age:18,nationality:'IT'};
 const origin=generatePersonality(p,{seed,countryId:'IT'});
 assert.deepEqual(origin,generatePersonality({...p,id:999,age:37,nationality:'FR'}, {seed,countryId:'IT'}));
 assert.notDeepEqual(origin,generatePersonality(p,{seed:seed+1,countryId:'IT'}));
 assert.notDeepEqual(origin,generatePersonality({...p,globalId:'IT:20'},{seed,countryId:'IT'}));
 const saved={...p,personalityProfile:origin};
 const actual=readPersonality(saved,{seed:seed+9999,countryId:'FR'});
 assert.deepEqual(actual,origin);
 actual.traits.leadership=1;
 assert.deepEqual(readPersonality(saved),origin);
 const transfer={...saved,id:255,clubId:77,age:31};
 assert.deepEqual(readPersonality(transfer),origin);
 const copy=copyWithPersonality(p,{seed,countryId:'IT'});
 assert.deepEqual(copy.personalityProfile,origin);
 assert.equal(p.personalityProfile,undefined);
});

test('all eight countries create valid persistent v2 profiles, deterministic and varied',()=>{
 assert.equal(LEAGUES.length,8);
 for(const league of LEAGUES){
  const a=makeWorld(260126,league.id),b=makeWorld(260126,league.id);
  assert.ok(a.players.length>=400,league.id);
  const seen=new Set();
  for(let i=0;i<a.players.length;i++){
   const p=a.players[i];
   assert.equal(validatePersonality(p.personalityProfile),true,league.id+':'+p.id);
   assert.deepEqual(p.personalityProfile,b.players[i].personalityProfile);
   assert.ok(p.globalId?.startsWith(league.id+':'));
   seen.add(keys.map(k=>p.personalityProfile.traits[k]).join(','));
  }
  assert.ok(seen.size>100,league.id);
 }
});

test('youth intake and promotion preserve same seven traits and player identity',()=>{
 const w=makeWorld(120, 'IT'),t=w.teams[0],members=w.players.filter(p=>p.clubId===t.id).map(p=>({...p,clubId:String(t.id),position:toAddonPosition(p.position)}));
 const model=createYouthWorld({clubs:[{id:String(t.id),countryId:'IT',players:members,squadLimit:32,academyLimit:18,academyQuality:3}],seed:120,season:1});
 const intake=advanceYouthSeason(model,{season:2,intakePerClub:10,minimumPlayers:18});
 assert.ok(intake.clubs[0].academy.length>0);
 for(const kid of intake.clubs[0].academy)assert.equal(validatePersonality(kid.personalityProfile),true);
 const candidate=intake.clubs[0].academy.find(kid=>kid.age>=16);
 assert.ok(candidate,'need an eligible academy prospect');
 const saved=structuredClone(candidate.personalityProfile),oldId=candidate.id;
 const promoted=promoteProspect(intake,{clubId:String(t.id),playerId:oldId,season:2});
 const player=promoted.clubs[0].players.find(p=>p.id===oldId);
 assert.deepEqual(player.personalityProfile,saved);
 assert.equal(validatePersonality(player.personalityProfile),true);
});

test('seven-country NPC league snapshots preserve v2 profiles and reject lost profiles',()=>{
 const w=makeWorld(1234,'IT');
 w.clubId=w.teams[0].id;
 enableAdvancedCareer(w);
 enableCareerWorld(w);
 assert.equal(validateCareerWorld(w),true);
 const others=w.advancedV1.worldV1.leagues.filter(l=>!l.locked);
 assert.equal(others.length,7);
 for(const league of others){
  assert.ok(league.players.length>400);
  for(const p of league.players)assert.equal(validatePersonality(p.personalityProfile),true);
 }
 const former=others[0].players[0].personalityProfile;
 delete others[0].players[0].personalityProfile;
 assert.equal(validateCareerWorld(w),false);
 others[0].players[0].personalityProfile=former;
 assert.equal(validateCareerWorld(w),true);
});

test('cross-league transfer and promotion conversion preserve the stored profile',()=>{
 const market=readFileSync(new URL('../src/domain/career-market.js',import.meta.url),'utf8');
 const divisions=readFileSync(new URL('../src/domain/career-divisions.js',import.meta.url),'utf8');
 const world=readFileSync(new URL('../src/domain/career-world.js',import.meta.url),'utf8');
 assert.match(market,/const external=\{[^\n]*personalityProfile:structuredClone\(p\.personalityProfile\)/);
 assert.match(divisions,/const toForeign=\([^\n]*personalityProfile:readPersonality\(p,/);
 assert.match(world,/p\.personalityProfile=generatePersonality\(p,/);
});
