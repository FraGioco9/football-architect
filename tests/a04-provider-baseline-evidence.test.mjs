// ARCH-CLEAN-02 A04-01: pinned baseline evidence. No runtime provider changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {planPublicFiles} from '../tools/publication-guard.mjs';
import {aggregatePreviewStats} from '../tools/dev-competition-stats-data.mjs';
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
test('A04-E4: actual context revision lease rejects late historical responses',()=>{
 const source=read('../assets/competition-page.js');
 const start=source.indexOf('  const freeze=value=>'),end=source.indexOf('  async function start()',start);
 assert.ok(start>=0&&end>start);
 const input=catalogue.find(x=>x.id==='IT-1'),projection=manifest.divisions.find(x=>x.id==='IT-1');
 const window={dispatchEvent(){}};
 const api=runInNewContext(source.slice(start,end)+';definition=input;division=projection;activeDebugSeason=null;({replaceSeasonData,clearSeasonData,createContext})',{
  model,window,input,projection,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}
 });
 window.faCompetitionContext=api.createContext(input,1,null,1);
 const data={season:1,rulesVersion:input.rules.version,rulesSnapshot:copy(input.rules),participants:projection.clubs,fixtures:[],results:[],statistics:null,status:'partial'};
 assert.equal(api.replaceSeasonData(data,1),true);
 const staleRevision=window.faCompetitionContext.revision;
 api.clearSeasonData();
 assert.equal(api.replaceSeasonData(data,staleRevision),false);
 assert.equal(window.faCompetitionContext.seasonData,null);
 assert.equal(api.replaceSeasonData({...data,season:0},window.faCompetitionContext.revision),false);
 assert.equal(window.faCompetitionContext.seasonData,null);
});
test('A04-E5: no-data stats differ from actual completed-match aggregates',()=>{
 const division=manifest.divisions.find(x=>x.id==='IT-1');
 const zero=aggregatePreviewStats(division,0);
 const played=aggregatePreviewStats(division,15);
 assert.equal(zero.overview.matchesPlayed,0);
 assert.equal(played.overview.matchesPlayed,120);
 assert.equal(played.teams.length,16);
 assert.equal(zero.teams.length,16);
 const history=read('../assets/competition-history.js');
 assert.match(history,/provenance/);
 assert.match(history,/coverage/);
});
test('A04-E6: actual public artifact manifest excludes all protected DEV files',()=>{
 const files=planPublicFiles();
 assert.ok(files.includes('assets/competition-model.js'));
 assert.ok(files.includes('assets/competition-history.js'));
 assert.equal(files.filter(path=>path.startsWith('tools/dev-')).length,0);
 assert.equal(files.filter(path=>path.startsWith('tests/')).length,0);
 assert.ok(files.includes('data/divisions.json'));
 assert.ok(!files.includes('data/international-competitions.json'),'protected international source must not be published');
 const preview=read('../tools/dev-standings-preview-data.mjs');
 assert.doesNotMatch(preview,/from ["']\\.\\.\\/data\\/international-competitions\\.json/);
});
