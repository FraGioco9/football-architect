import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaticProvider} from '../assets/static-provider.mjs';
import {loadWorldCatalog} from '../tools/load-world-catalog.mjs';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import registryModule from '../assets/rules-registry.js';
import rulesEngine from '../assets/competition-rules.js';
import {planPublicFiles} from '../tools/publication-guard.mjs';

const catalog=loadWorldCatalog();
const definitions=loadCompetitionCatalogue();
const registry=registryModule.createRulesRegistry(definitions,rulesEngine);
const provider=()=>createStaticProvider({catalog,rulesRegistry:registry});
const request=(competitionId,scope='season',selectedSeason=1)=>({
 competitionId,scope,selectedSeason,requestId:'static-1',contextRevision:1
});

test('A04-07: all 18 canonical Static identities resolve A02 rules but never invent results',async()=>{
 const staticProvider=provider();
 assert.equal(staticProvider.id,'static');
 assert.ok(Object.isFrozen(staticProvider));
 for(const item of catalog.competitions){
  const current=registry.getCompetition(item.id);
  assert.equal(current.id,item.id);
  assert.equal(current.rules.version,item.rules.version);
  for(const scope of ['season','history']){
   const result=await staticProvider.read(request(item.id,scope,3));
   assert.equal(result.status,'empty');
   assert.equal(result.reason,'no-results');
   assert.equal(result.data,null);
   assert.deepEqual(result.provenance,{kind:'none',sourceRef:null,approved:false,coverage:'none'});
   assert.equal(result.selectedSeason,3);
   assert.equal(result.scope,scope);
   assert.ok(Object.isFrozen(result));
  }
 }
});
test('A04-07: invalid identity/season rejected before any result handling',async()=>{
 const p=provider();
 for(const input of [request('IT-99'),request('it-1'),request('IT-1','season',0)]){
  await assert.rejects(p.read(input),TypeError);
 }
});
test('A04-07: missing or changed canonical Rules binding fails closed',()=>{
 assert.throws(()=>createStaticProvider({catalog,rulesRegistry:{}}),TypeError);
 const registryDrift={...registry,getCompetition:id=>{
  const original=registry.getCompetition(id);
  return id==='IT-1'?{...original,capacity:24}:original;
 }};
 assert.throws(()=>createStaticProvider({catalog,rulesRegistry:registryDrift}),/binding/);
 const versionDrift={...registry,resolveCompetitionRules:id=>{
  const original=registry.resolveCompetitionRules(id);
  return id==='IT-1'?{...original,version:'unknown'}:original;
 }};
 assert.throws(()=>createStaticProvider({catalog,rulesRegistry:versionDrift}),/binding/);
});
test('A04-07: Static adapter remains unpublished, with no runtime I/O',async()=>{
 assert.equal(planPublicFiles().includes('assets/static-provider.mjs'),false);
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../assets/static-provider.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:fetch|document|sessionStorage|localStorage)\s*[.(]/);
});
