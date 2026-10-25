import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProviderState,selectSeasonData,selectHistoryData,selectSeasonFixtures,selectSeasonStatistics} from '../assets/provider-selectors.mjs';
import {planPublicFiles} from '../tools/publication-guard.mjs';
const base={schemaVersion:1,competitionId:'IT-1',selectedSeason:2,scope:'season',requestId:'req',contextRevision:1,
 providerId:'dev-fictional',status:'partial',reason:null,provenance:{kind:'fictional',sourceRef:'dev-preview',approved:false,coverage:'partial'},
 data:{season:2,status:'partial',fixtures:[],statistics:{overview:{matchesPlayed:0}}}};
test('A04-10: absence is null, never synthetic zero or fixture list',()=>{
 for(const status of ['empty','unavailable']){
  const input={...base,status,data:null,reason:status==='empty'?'no-results':'source-unavailable',provenance:{kind:'fictional',approved:false,coverage:'none',sourceRef:null}};
  assert.equal(selectSeasonData(input,'IT-1',2),null);
  assert.equal(selectSeasonStatistics(input,'IT-1',2),null);
  assert.equal(selectSeasonFixtures(input,'IT-1',2),null);
  assert.equal(selectProviderState(input).status,status);
 }
 assert.equal(selectSeasonStatistics(null,'IT-1',2),null);
 assert.equal(selectProviderState(null).reason,'invalid-data');
});
test('A04-10: preserve real zero values and empty fixture arrays when supplied',()=>{
 assert.equal(selectSeasonData(base,'IT-1',2),base.data);
 assert.equal(selectSeasonStatistics(base,'IT-1',2).overview.matchesPlayed,0);
 assert.deepEqual(selectSeasonFixtures(base,'IT-1',2),[]);
 assert.ok(Object.isFrozen(selectProviderState(base)));
});
test('A04-10: never cross season, competition, scope or source',()=>{
 for(const change of [{competitionId:'FR-1'},{selectedSeason:1},{scope:'history'},{data:{...base.data,season:1}}]){
  assert.equal(selectSeasonData({...base,...change},'IT-1',2),null);
 }
 const history={...base,scope:'history',providerId:'verified-historical',status:'available',
  provenance:{kind:'verified',approved:true,sourceRef:'archive',coverage:'complete'},data:{seasons:[{seasonId:1}]}};
 assert.equal(selectHistoryData(history,'IT-1',2),history.data);
 for(const change of [{providerId:'dev-fictional'},{status:'partial'},{provenance:{...history.provenance,approved:false}},
  {provenance:{...history.provenance,coverage:'partial'}},{selectedSeason:3}]){
  assert.equal(selectHistoryData({...history,...change},'IT-1',2),null);
 }
});
test('A04-10: public selectors are explicitly allowlisted, adapters stay protected',()=>{
 assert.equal(planPublicFiles().includes('assets/provider-selectors.mjs'),true);
 for(const path of ['assets/provider-contract.mjs','assets/static-provider.mjs','assets/verified-history-provider.mjs'])
  assert.equal(planPublicFiles().includes(path),false);
});
