import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {aggregatePreviewStats} from '../tools/dev-competition-stats-data.mjs';
import {createPreviewStandings,readPreviewProgress,previewSeasonMatchdays} from '../tools/dev-standings-preview-data.mjs';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url)));
function fixture(id='IT-1'){
 const source=readFileSync(new URL('../tools/dev-competition-stats-client.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function createStatsPreviewProvider()'),end=source.indexOf('// Start the protected competition provider');
 assert.ok(start>=0&&end>start,'protected Stats provider must be separate from public presentation');
 const division=manifest.divisions.find(d=>d.id==='IT-1'),definition=loadCompetitionCatalogue().find(d=>d.id===id);
 const results=createPreviewStandings(division,15).fixtures;
 const stored=new Map([['football-architect:standings-dev-season','1'],['football-architect:standings-dev-matchdays','15'],['football-architect:standings-dev-preview','on']]);
 const sessionStorage={getItem:key=>stored.get(key)??null};
 const window={faCompetitionDivision:division,events:{},faCompetitionContext:{definition,selectedSeason:1,revision:1,seasonData:{season:1,rulesVersion:definition.rules.version,participants:division.clubs,fixtures:null,results,statistics:{standings:[]},status:'partial'}},
  addEventListener(name,fn){this.events[name]=fn},removeEventListener(name){delete this.events[name]}};
 let publications=0;
 window.faCompetitionContextApi={replaceSeasonData(data,expected){assert.equal(expected,window.faCompetitionContext.revision);publications++;window.faCompetitionContext={...window.faCompetitionContext,revision:expected+1,seasonData:data};return true}};
 const make=runInNewContext(source.slice(start,end)+';createStatsPreviewProvider',{window,sessionStorage,aggregatePreviewStats,readPreviewProgress,previewSeasonMatchdays,document:{documentElement:{dataset:{faDevCurrentSeason:'1'}}}});
 return {provider:make(),window,stored,publications:()=>publications};
}
test('STATS-PROVIDER: protected domestic adapter publishes actual aggregates and preserves other statistics',async()=>{
 const r=fixture();assert.equal(await r.provider.refresh(),true);
 const data=r.window.faCompetitionContext.seasonData;
 assert.equal(data.statistics.overview.matchesPlayed,120);assert.equal(data.statistics.teams.length,16);
 assert.equal(data.statistics.teams[0].clubKey.startsWith('IT-'),true);
 assert.deepEqual(Array.from(data.statistics.standings),[]);
 assert.equal(await r.provider.refresh(),false,'own publication must not recurse');assert.equal(r.publications(),1);
});
test('STATS-PROVIDER: late Season 1 aggregation cannot repopulate a newer season or inactive Debug state',async()=>{
 for(const inactive of [false,true]){
  const r=fixture(),pending=r.provider.refresh();
  r.window.faCompetitionContext={...r.window.faCompetitionContext,revision:2,selectedSeason:inactive?1:2,seasonData:null};
  if(inactive)r.stored.set('football-architect:standings-dev-season','0');
  assert.equal(await pending,false);assert.equal(r.window.faCompetitionContext.seasonData,null);assert.equal(r.publications(),0);
 }
});
test('STATS-PROVIDER: public cups, disabled DEV and unmatched progress never invoke domestic generation',async()=>{
 for(const mode of ['cup','disabled','progress']){
  const r=fixture(mode==='cup'?'sovereign-cup':'IT-1');
  if(mode==='disabled')r.stored.set('football-architect:standings-dev-preview','off');
  if(mode==='progress')r.stored.set('football-architect:standings-dev-matchdays','16');
  assert.equal(await r.provider.refresh(),false);assert.equal(r.publications(),0);
 }
});
test('STATS-PROVIDER-POINTS: protected aggregation follows configured points without changing scores',()=>{
 const division=manifest.divisions.find(d=>d.id==='IT-1'),definition=structuredClone(loadCompetitionCatalogue().find(d=>d.id===division.id));
 definition.rules.phases[0].points.win=2;
 const stats=aggregatePreviewStats({...division,rules:definition.rules},15);
 for(const team of stats.teams){assert.equal(team.points,2*team.w+team.d);assert.equal(team.ppg,team.points/15)}
});
test('STATS-PROVIDER-SEASONS: Stats consumes the selected shared season for all four DEV seasons',async()=>{
 for(const season of [1,2,3,4]){
  const r=fixture();r.stored.set('football-architect:standings-dev-season',String(season));
  const context=r.window.faCompetitionContext;context.selectedSeason=season;context.seasonData.season=season;
  context.seasonData.results=createPreviewStandings(r.window.faCompetitionDivision,15,season).fixtures;
  assert.equal(await r.provider.refresh(),true);assert.equal(r.window.faCompetitionContext.seasonData.season,season);
  assert.equal(r.window.faCompetitionContext.seasonData.statistics.overview.matchesPlayed,120);
 }
});
