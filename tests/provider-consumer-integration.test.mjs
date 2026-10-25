import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planPublicFiles} from '../tools/publication-guard.mjs';
import {selectSeasonData,selectHistoryData} from '../assets/provider-selectors.mjs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('A04-10 public consumer boundary loads only pure selector module',()=>{
 const publicFiles=planPublicFiles();
 assert.ok(publicFiles.includes('assets/provider-selectors.mjs'));
 for(const path of ['assets/provider-contract.mjs','assets/static-provider.mjs','assets/verified-history-provider.mjs','tools/dev-fictional-provider.mjs'])
  assert.equal(publicFiles.includes(path),false);
 for(const path of ['assets/competition-page.js','assets/club-page.js'])
  assert.match(source(path),/import\('\/assets\/provider-selectors\.mjs'\)/);
 assert.match(source('assets/competition-stats.js'),/selectors\.selectSeasonData/);
 assert.match(source('assets/club-page.js'),/selectors\.selectHistoryData/);
});
test('A04-10 legacy season projection never invents data and validates season',()=>{
 const data={season:2,status:'partial',statistics:{overview:{matchesPlayed:0}}};
 const make=season=>({schemaVersion:1,competitionId:'IT-1',selectedSeason:2,scope:'season',
  providerId:'dev-fictional',status:'partial',provenance:{kind:'fictional',approved:false,coverage:'partial',sourceRef:'dev-competition-context'},
  data:{...data,season}});
 assert.equal(selectSeasonData(make(2),'IT-1',2).statistics.overview.matchesPlayed,0);
 assert.equal(selectSeasonData(make(1),'IT-1',2),null);
 assert.equal(selectHistoryData(make(2),'IT-1',2),null);
});
