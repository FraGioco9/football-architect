// ARCH-CLEAN-02 A04-01: pinned baseline evidence. No runtime provider changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import model from '../assets/competition-model.js';
import rules from '../assets/competition-rules.js';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import {createPreviewStandings} from '../tools/dev-standings-preview-data.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const manifest=JSON.parse(read('../competitions/_shared/manifest.json'));
const catalogue=loadCompetitionCatalogue();
const copy=value=>JSON.parse(JSON.stringify(value));
test('A04-E1: 18 public identities and canonical source cardinality',()=>{
 assert.equal(catalogue.length,18);
 assert.equal(manifest.divisions.length,16);
 assert.equal(new Set(catalogue.map(x=>x.id)).size,18);
 for(const entry of catalogue){
  assert.equal(entry.rules.schemaVersion,1,entry.id);
  assert.ok(entry.rules.phases.length>0,entry.id);
  assert.ok(rules.validateCompetition(entry).valid,entry.id);
 }
 assert.deepEqual(catalogue.filter(x=>x.category==='international').map(x=>x.id).sort(),['int-1','int-2']);
});
test('A04-E2: deterministic fictional DEV fixtures with no future-score leakage',()=>{
 for(const id of ['IT-1','IT-2','ENG-1']){
  const division=manifest.divisions.find(x=>x.id===id);
  assert.ok(division,id);
  for(const md of [0,15,30]){
   const a=createPreviewStandings(division,md,1),b=createPreviewStandings(division,md,1);
   assert.deepEqual(a,b,id+' MD'+md);
   assert.equal(a.rows.length,16,id);
   assert.equal(new Set(a.rows.map(x=>x.club.clubId)).size,16,id);
   assert.ok(a.fixtures.every(x=>x.round>=1&&x.round<=30),id);
  }
 }
});
test('A04-E3: approved historical snapshot wins and corrupt / year-zero input fails closed',()=>{
 const source=catalogue.find(x=>x.id==='IT-1');
 const record={season:1,competitionId:source.id,rulesVersion:source.rules.version,rulesSnapshot:copy(source.rules)};
 assert.deepEqual(model.resolveSeasonRules(source,record),source.rules);
 assert.equal(model.resolveSeasonRules(source,{...record,season:0}),null);
 assert.equal(model.resolveSeasonRules(source,{...record,competitionId:'ENG-1'}),null);
 assert.equal(model.resolveSeasonRules(source,{...record,rulesVersion:'invalid'}),null);
 const corrupt=copy(record);corrupt.rulesSnapshot.phases[0].points.win=-2;
 assert.equal(model.resolveSeasonRules(source,corrupt),null);
});
test('A04-E4: revision-guard source contract remains explicit on both producers',()=>{
 const publicPage=read('../assets/competition-page.js');
 const devClient=read('../tools/dev-standings-preview-client.mjs');
 const stats=read('../tools/dev-competition-stats-client.mjs');
 assert.match(publicPage,/replaceSeasonData/);
 assert.match(devClient,/progressRevision/);
 assert.match(stats,/replaceSeasonData/);
 assert.match(stats,/revision/);
});
test('A04-E5: Stats and History distinguish missing data from approved results',()=>{
 const stats=read('../assets/competition-stats.js');
 const history=read('../assets/competition-history.js');
 assert.match(stats,/unavailable|empty|noData/i);
 assert.match(history,/provenance/);
 assert.match(history,/coverage/);
 assert.match(history,/historyNoData/);
});
test('A04-E6: public artifact tests enforce protected import separation',()=>{
 const publication=read('./publication-gate.test.mjs');
 const debug=read('./g10-public-02-browser.test.mjs');
 assert.match(publication,/assertPublicArtifact/);
 assert.match(publication,/stagePublicArtifact/);
 assert.match(publication,/protected_debug/);
 assert.match(debug,/outgoing mutations|outgoing|mutations/i);
 const preview=read('../tools/dev-standings-preview-data.mjs');
 assert.doesNotMatch(preview,/from ["']\.\.\/data\/international-competitions\.json/);
});
