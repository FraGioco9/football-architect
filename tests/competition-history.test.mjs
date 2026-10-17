import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createPreviewStandings} from '../tools/dev-standings-preview-data.mjs';
const client=readFileSync(new URL('../tools/dev-standings-preview-client.mjs',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../app/competitions/_shared/manifest.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
function records(seasons){
 const start=client.indexOf('function historyRecords('),end=client.indexOf('\nfunction historyNode',start);
 assert.ok(start>=0&&end>start,'History record calculator exists');
 return plain(runInNewContext(client.slice(start,end)+';historyRecords(seasons)',{seasons}));
}
const club=id=>({countryId:'IT',clubId:id,primaryName:'Club '+id});
const table=(season,ids)=>({season,rows:ids.map(id=>({club:club(id)}))});
test('History records count titles, podium ties and consecutive seasons by club identity',()=>{
 const result=records([table(1,[1,2,3,4]),table(2,[1,3,2,4]),table(3,[2,1,4,3]),table(4,[2,4,3,1])]);
 assert.deepEqual(result.titles,{value:2,clubs:[club(1),club(2)]});
 assert.deepEqual(result.podiums,{value:4,clubs:[club(2)]});
 assert.deepEqual(records([table(1,[1,2,3]),table(2,[3,1,2])]).podiums,{value:2,clubs:[club(1),club(2),club(3)]});
 assert.deepEqual(result.streak,{value:2,clubs:[club(1),club(2)]});
});
test('History record streaks break across missing seasons and club names do not merge identities',()=>{
 const seasons=[table(1,[1,2,3]),table(3,[1,2,3])];
 seasons.forEach(s=>s.rows.forEach(r=>r.club.primaryName='Same name'));
 const result=records(seasons);
 assert.equal(result.streak.value,1);
 assert.equal(result.titles.clubs.length,1);
 assert.equal(result.podiums.clubs.length,3);
});
test('History totals reconcile with all 16 deterministic four-season final tables',()=>{
 for(const division of manifest.divisions){
  const seasons=[1,2,3,4].map(season=>({season,rows:createPreviewStandings(division,30,season).rows}));
  const actual=records(seasons);
  const titles=new Map(),podiums=new Map();
  for(const {rows} of seasons){
   assert.equal(rows.length,16);assert.ok(rows.every(r=>r.played===30));
   titles.set(rows[0].club.clubId,(titles.get(rows[0].club.clubId)||0)+1);
   for(const row of rows.slice(0,3))podiums.set(row.club.clubId,(podiums.get(row.club.clubId)||0)+1);
  }
  for(const [key,counts] of [['titles',titles],['podiums',podiums]]){
   const max=Math.max(...counts.values());assert.equal(actual[key].value,max,division.id);
   assert.deepEqual(actual[key].clubs.map(c=>c.clubId).sort((a,b)=>a-b),[...counts].filter(([,n])=>n===max).map(([id])=>id).sort((a,b)=>a-b));
  }
 }
});
test('DEV selected season preserves deep links and router selections for seasons 1 through 4',()=>{
 const start=client.indexOf('function availablePreviewSeasons('),end=client.indexOf('\nasync function setMatchdays',start);
 assert.ok(start>=0,'Shared season availability reader exists');
 for(const season of [1,2,3,4]){
  const context={document:{documentElement:{dataset:{faDevSeasons:'1,2,3,4'}}},window:{location:{href:'http://app.localhost:2000/competitions/it-1?season='+season},faCompetitionRoute:{get:()=>({season:'1'})}},URL,routeSeasonOverride:null};
  assert.equal(runInNewContext(client.slice(start,end)+';selectedSeason()',context),season);
  context.routeSeasonOverride=season;context.window.location.href='http://app.localhost:2000/competitions/it-1?season=1';
  assert.equal(runInNewContext(client.slice(start,end)+';selectedSeason()',context),season);
 }
});
test('DEV Stats reads seasons 3 and 4 consistently with History and Standings',()=>{
 const source=readFileSync(new URL('../tools/dev-competition-stats-client.mjs',import.meta.url),'utf8');
 const start=source.indexOf('  function selectedSeason()'),end=source.indexOf('  function selectedMatchdays()',start);
 for(const season of [1,2,3,4]){
  assert.equal(runInNewContext(source.slice(start,end)+';selectedSeason()',{
   document:{documentElement:{dataset:{faDevSeasons:'1,2,3,4'}}},URLSearchParams,location:{search:'?season='+season}
  }),season);
 }
});
test('History discards a pending render after debug is disabled and restores the localized empty state',async()=>{
 const start=client.indexOf('let historyRenderVersion=0;'),end=client.indexOf('\nlet transition=',start);
 let resolveFetch,enabled=true,renders=0,generated=0;
 const status={dataset:{appI18n:'competitionHistoryEmpty'},hidden:false,setAttribute(){}};
 const error={hidden:true};
 const panel={querySelector(selector){return selector==='[data-history-empty]'?status:selector==='[data-history-error]'?error:null}};
 const context={
  window:{faCompetitionRoute:{get:()=>({view:'history',season:'4'})},faAppRenderLanguage(){renders++}},
  document:{getElementById:()=>panel,createElement(){generated++;throw Error('Stale render constructed DOM')}},
  isPreviewEnabled:()=>enabled,fetch:()=>new Promise(resolve=>{resolveFetch=resolve}),console
 };
 const api=runInNewContext(client.slice(start,end)+';({renderHistoryPreview,clearHistoryPreview})',context);
 const pending=api.renderHistoryPreview();
 assert.equal(status.hidden,true,'History stays silent while data is loading');
 assert.equal(status.dataset.appI18n,'competitionHistoryEmpty');
 enabled=false;api.clearHistoryPreview();
 assert.equal(status.dataset.appI18n,'competitionHistoryEmpty');assert.equal(status.hidden,false);assert.ok(renders>=1);
 resolveFetch({ok:true,json:async()=>manifest});await pending;
 assert.equal(generated,0,'Disabled preview must not construct or commit a stale result');
});

test('Selecting a History season opens the shared Standings view with that exact season',()=>{
 const start=client.indexOf('function openHistorySeason('),end=client.indexOf('\nasync function renderHistoryPreview',start);
 assert.ok(start>=0&&end>start,'History season navigation exists');
 for(const season of [1,2,3,4]){
  const calls=[];const window={faCompetitionRoute:{set:(patch,options)=>calls.push([plain(patch),plain(options)])}};
  runInNewContext(client.slice(start,end)+';openHistorySeason(season)',{window,season});
  assert.deepEqual(calls,[[{season:String(season),view:'standings'},{focus:true}]]);
 }
});
