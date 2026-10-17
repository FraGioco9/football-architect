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
test('Every History route offers exactly three seasonal and four all-time player records without invented data',()=>{
 const routes=['_shared',...manifest.divisions.map(d=>d.id.toLowerCase())];
 for(const route of routes){
  const html=readFileSync(new URL('../app/competitions/'+route+'/index.html',import.meta.url),'utf8');
  const section=html.match(/<section[^>]*data-history-player-records[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section,route+' has player records');
  const cards=[...section.matchAll(/<article([^>]*)>([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length,7,route);
  assert.equal(cards.filter(c=>c[1].includes('data-history-scope="season"')).length,3);
  assert.equal(cards.filter(c=>c[1].includes('data-history-scope="all-time"')&&c[1].includes(' hidden')).length,4);
  assert.equal(new Set(cards.map(c=>c[1].match(/data-history-player-record="([^"]+)"/)[1])).size,7);
  assert.ok(cards.every(c=>c[2].includes('data-app-i18n="historyPlayerNoData"')&&!/<strong|data-club-crest/.test(c[2])));
 }
});
test('History goal difference displays positive and negative signs without signing other records',()=>{
 const start=client.indexOf('function historyRecordValue('),end=client.indexOf('\nfunction historyNode',start);
 assert.ok(start>=0&&end>start);
 const format=runInNewContext(client.slice(start,end)+';historyRecordValue');
 assert.equal(format('goalDifference',12),'+12');
 assert.equal(format('goalDifference',-12),'−12');
 assert.equal(format('goalDifference',0),'0');
 assert.equal(format('points',12),'12');
});
test('Points, goal difference and champion margin records preserve seasonal ties and cumulative points',()=>{
 const seasons=[
  {season:2,rows:[{club:club(2),pts:80,gd:40},{club:club(1),pts:70,gd:30},{club:club(3),pts:20,gd:-20}]},
  {season:1,rows:[{club:club(1),pts:80,gd:40},{club:club(2),pts:70,gd:35},{club:club(3),pts:10,gd:-30}]}
 ];
 const result=records(seasons),tied=[{club:club(1),season:1},{club:club(2),season:2}];
 assert.deepEqual(result.points,{value:80,entries:tied});
 assert.deepEqual(result.goalDifference,{value:40,entries:tied});
 assert.deepEqual(result.margin,{value:10,entries:tied});
 assert.deepEqual(result.totalPoints,{value:150,clubs:[club(1),club(2)]});
 assert.deepEqual(records([{season:1,rows:[{club:club(1),pts:50,gd:-2},{club:club(2),pts:50,gd:-3}]}]).margin,{value:0,entries:[{club:club(1),season:1}]});
 assert.equal(records([{season:1,rows:[{club:club(1),gd:-2},{club:club(2),gd:-3}]}]).goalDifference.value,-2);
 assert.deepEqual(records([table(1,[1])]).margin,{value:null,entries:[]});
});
test('Seasonal wins and all-time wins and goals keep distinct winners and tied identities',()=>{
 const result=records([
  {season:1,rows:[{club:club(1),won:25,gf:90},{club:club(2),won:20,gf:80},{club:club(3),won:20,gf:80}]},
  {season:2,rows:[{club:club(1),won:10,gf:10},{club:club(2),won:20,gf:80},{club:club(3),won:20,gf:80}]}
 ]);
 assert.deepEqual(result.wins,{value:25,entries:[{club:club(1),season:1}]});
 assert.deepEqual(result.totalWins,{value:40,clubs:[club(2),club(3)]});
 assert.deepEqual(result.totalGoals,{value:160,clubs:[club(2),club(3)]});
});
test('History scope switch updates all matching controls and cards without changing the route',()=>{
 const source=readFileSync(new URL('../assets/competition-tabs.js',import.meta.url),'utf8');
 const start=source.indexOf('// History record scope');assert.ok(start>=0);
 const controls=['season','all-time','season','all-time'].map(scope=>({dataset:{historyRecordScope:scope},attrs:{},setAttribute(k,v){this.attrs[k]=v}}));
 const cards=['season','all-time','season','all-time'].map(scope=>({dataset:{historyScope:scope},hidden:false}));
 const events={};const panel={dataset:{},querySelectorAll:s=>s==='[data-history-record-scope]'?controls:s==='[data-history-scope]'?cards:[],addEventListener:(key,fn)=>events[key]=fn,contains:()=>true};
 const window={};runInNewContext(source.slice(start,source.indexOf('/* HISTORY-UI-11',start)),{document:{getElementById:()=>panel},window});
 assert.equal(panel.dataset.historyRecordScope,'season');
 assert.deepEqual(cards.map(c=>c.hidden),[false,true,false,true]);
 events.click({target:{closest:()=>controls[1]}});
 assert.equal(panel.dataset.historyRecordScope,'all-time');
 assert.deepEqual(controls.map(c=>c.attrs['aria-pressed']),['false','true','false','true']);
 assert.deepEqual(cards.map(c=>c.hidden),[true,false,true,false]);
 const added={dataset:{historyScope:'season'},hidden:false};cards.push(added);
 window.faSyncHistoryRecords();assert.equal(added.hidden,true,'A refreshed preview retains the chosen scope');
 events.click({target:{closest:()=>controls[0]}});assert.equal(added.hidden,false);
});
test('History scope does not retain the previous grid height and preserves available scroll',()=>{
  const source=readFileSync(new URL('../assets/competition-tabs.js',import.meta.url),'utf8');
  const start=source.indexOf('// History record scope');
  const scroller={scrollTop:250,scrollLeft:3};
  const grid={style:{},getBoundingClientRect:()=>({height:400})};
  const controls=['season','all-time'].map(scope=>({dataset:{historyRecordScope:scope},setAttribute(){}}));
  let armed=false;
  const cards=['season','all-time'].map(scope=>({dataset:{historyScope:scope},
    get hidden(){return this.value},set hidden(value){this.value=value;if(armed&&value)scroller.scrollTop=0}}));
  const events={};const panel={dataset:{},closest:()=>scroller,querySelectorAll:s=>
    s==='[data-history-record-scope]'?controls:s==='[data-history-scope]'?cards:[grid],
    addEventListener:(key,fn)=>events[key]=fn,contains:()=>true};
  runInNewContext(source.slice(start,source.indexOf('/* HISTORY-UI-11',start)),
    {document:{getElementById:()=>panel},window:{}});
  armed=true;
  for(const index of [1,0,1,0]){
    events.click({target:{closest:()=>controls[index]}});
    assert.equal(scroller.scrollTop,250);
    assert.equal(scroller.scrollLeft,3);
    assert.equal(grid.style.minHeight,undefined,'No retained minimum height');
  }
});
test('History Team and Player empty states use the same Stats-style title/content grid',()=>{
  const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
  assert.match(css,/\.app-history-record-group \.app-competition-stat-card\{[^}]*display:grid;grid-template-rows:30px auto/);
  assert.match(css,/\.app-history-record-group \.app-competition-stat-card>\.app-competition-empty\{[^}]*text-align:left/);
  assert.match(css,/\.app-history-player-card\{[^}]*height:128px/);
  assert.match(css,/\.app-history-player-card\[data-history-filled="true"\]\{[^}]*height:160px/);
  assert.doesNotMatch(css,/\.app-history-player-card[^{]*\{[^}]*justify-content:space-between/);
  assert.doesNotMatch(css,/\.app-history-player-card \.app-competition-empty\{[^}]*text-align:center/);
});
test('Stats Overview and Players have identical fixed 88px cards; only Teams can expand',()=>{
  const source=readFileSync(new URL('../tools/dev-competition-stats-client.mjs',import.meta.url),'utf8');
  assert.match(source,/\.fa-dev-stats-card\{[^}]*height:88px;min-height:88px;max-height:88px/);
  assert.match(source,/\.fa-dev-stats-leader-card\{[^}]*height:88px;min-height:88px;max-height:88px/);
  assert.match(source,/\.fa-dev-stats-leader-card\.fa-dev-stats-team-card\{[^}]*height:auto;min-height:88px;max-height:none/);
  assert.match(source,/const card=create\("section",undefined,"fa-dev-stats-leader-card fa-dev-stats-team-card"\)/);
  assert.match(source,/\.fa-dev-stats-empty\{[^}]*padding:0!important/);
  assert.match(source,/\.fa-dev-stats-top li\{[^}]*padding:4px 0/);
  assert.doesNotMatch(source,/app-competition-empty-row fa-dev-stats-player-empty/);
});

test('Seasonal attack and defence records retain every tied club and season, including zero conceded',()=>{
 const seasons=[
  {season:2,rows:[{club:club(1),gf:90,ga:0},{club:club(2),gf:70,ga:20}]},
  {season:1,rows:[{club:club(1),gf:90,ga:10},{club:club(2),gf:90,ga:0}]}
 ];
 const result=records(seasons);
 assert.deepEqual(result.attack,{value:90,entries:[{club:club(1),season:1},{club:club(2),season:1},{club:club(1),season:2}]});
 assert.deepEqual(result.defence,{value:0,entries:[{club:club(2),season:1},{club:club(1),season:2}]});
 assert.deepEqual(records([]).attack,{value:null,entries:[]});
 assert.deepEqual(records([table(1,[1,2,3])]).defence,{value:null,entries:[]});
});
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
  for(const [metric,field,extreme] of [['attack','gf',Math.max],['defence','ga',Math.min],['wins','won',Math.max],['points','pts',Math.max],['goalDifference','gd',Math.max]]){
   const value=extreme(...seasons.flatMap(s=>s.rows.map(row=>row[field])));
   assert.equal(actual[metric].value,value,division.id+' '+metric);
   assert.deepEqual(actual[metric].entries,seasons.flatMap(s=>s.rows.filter(row=>row[field]===value).map(row=>({club:row.club,season:s.season}))));
  }
  const margin=Math.max(...seasons.map(s=>s.rows[0].pts-s.rows[1].pts));
  assert.deepEqual(actual.margin,{value:margin,entries:seasons.filter(s=>s.rows[0].pts-s.rows[1].pts===margin).map(s=>({club:s.rows[0].club,season:s.season}))});
  for(const [metric,field] of [['totalWins','won'],['totalGoals','gf'],['totalPoints','pts']]){
   const totals=new Map();for(const {rows} of seasons)for(const row of rows)totals.set(row.club.clubId,(totals.get(row.club.clubId)||0)+row[field]);
   const value=Math.max(...totals.values());assert.equal(actual[metric].value,value);
   assert.deepEqual(actual[metric].clubs.map(c=>c.clubId),[...totals].filter(([,n])=>n===value).map(([id])=>id));
  }
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

test('Restoring debug waits for History before completing the first-paint release',async()=>{
 const start=client.indexOf('let transition=Promise.resolve();'),end=client.indexOf('\nif(validPath){',start);
 let finishHistory,settled=false;
 const historyReady=new Promise(resolve=>{finishHistory=resolve});
 const context={previewState:'OFF',activePreview:null,validPath:['/competitions/it-1','it-1'],
  boot:async()=>()=>{},widgetRoot:{syncVisibility(){}},syncHistoryPreview:()=>historyReady,
  FLAG:'preview',sessionStorage:{setItem(){}},window:{dispatchEvent(){}},CustomEvent:class{},console};
 const toggle=runInNewContext(client.slice(start,end)+';setPreviewEnabled',context);
 const pending=toggle(true).then(value=>{settled=true;return value});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(settled,false,'The preview must not reveal the shorter empty History before its populated layout is ready');
 finishHistory();assert.equal(await pending,true);
});
