import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import registryModule from '../assets/rules-registry.js';
const {createRulesRegistry}=registryModule;
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const require=createRequire(import.meta.url),engine=require('../assets/competition-rules.js');
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const source=()=>[...read('data/divisions.json'),...read('data/international-competitions.json')];
test('A02: three immutable versions and eighteen namespaced bindings',()=>{
 const registry=createRulesRegistry(source(),engine);
 assert.deepEqual(registry.versions,['domestic-top-v1','domestic-second-v1','international-int24-v1']);
 assert.equal(registry.listBindings().length,18);
 assert.equal(registry.listBindings().filter(x=>x.version==='domestic-top-v1').length,8);
 assert.equal(registry.resolveCompetitionRules('int-1').phases.at(-1).calendarEvents[0],'SOVEREIGN-FINAL');
 assert.equal(registry.resolveCompetitionRules('int-2').phases.at(-1).calendarEvents[0],'FEDERATION-FINAL');
 assert.equal(registry.getProfile('unknown'),null);
 assert.equal(registry.resolveCompetitionRules('missing'),null);
 assert.throws(()=>{registry.getProfile('domestic-top-v1').phases[0].points.win=9},TypeError);
});
test('A02: complete normalized 18-rule equivalence against frozen input',()=>{
 const registry=createRulesRegistry(source(),engine);
 const expected=source().map(engine.normalizeCompetition);
 assert.deepEqual(registry.listCompetitions(),expected);
 assert.deepEqual(loadCompetitionCatalogue(),expected);
});
test('A02: invalid profile versions, illicit finals, and mutations fail closed',()=>{
 let list=source();list[0].rules.version='unknown-v9';
 assert.throws(()=>createRulesRegistry(list,engine),/unknown version|binding/);
 list=source();list.find(x=>x.id==='int-1').rules.phases.at(-1).calendarEvents=['FEDERATION-FINAL'];
 assert.throws(()=>createRulesRegistry(list,engine));
 list=source();list[1].rules.phases[0].points.win=4;
 assert.throws(()=>createRulesRegistry(list,engine),/unapproved profile difference/);
 list=source();list.push(list[0]);assert.throws(()=>createRulesRegistry(list,engine),/invalid source/);
});
