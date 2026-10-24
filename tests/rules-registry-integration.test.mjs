import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import model from '../assets/competition-model.js';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
test('A02: current competition manifest and immutable historical snapshots retain behavior',()=>{
 const catalog=loadCompetitionCatalogue(),manifest=read('competitions/_shared/manifest.json');
 assert.deepEqual(manifest.competitions,catalog);
 for(const def of catalog){
  const copy=JSON.parse(JSON.stringify(def.rules));
  const record={season:1,rulesVersion:def.rules.version,rulesSnapshot:copy,competitionId:def.id};
  assert.deepEqual(model.resolveSeasonRules(def,record),def.rules);
  assert.deepEqual(model.resolveSeasonDefinition(def,record),def);
  assert.equal(model.resolveSeasonRules(def,{season:1,rulesVersion:'unrecognized'}),null);
 }
});
