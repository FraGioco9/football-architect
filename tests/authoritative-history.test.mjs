import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyViewModel,historyAggregate,mountAuthoritativeHistory} from '../assets/authoritative-history.mjs';
const club={countryId:'IT',clubId:1,primaryName:'Test club'};
const row={club,played:30,won:20,drawn:5,lost:5,gf:60,ga:20,gd:40,pts:65,recent:[]};
const context=()=>({selectedSeason:1,definition:{id:'IT-1',category:'domestic'},seasonData:{season:1,provenance:{kind:'authoritative'},world:{phase:'closed'},participants:[club],history:{season:1,championClubId:'IT-1',archiveHash:'a'.repeat(64),closedAt:100},statistics:{standings:[row]}}});
test('exposes champion and records without a History final table after sealed selected-season closure',()=>{
 const model=historyViewModel(context());assert.equal(model.champion.primaryName,'Test club');assert.equal(Object.hasOwn(model,'table'),false,'History data must not expose a final standings table');assert.equal(model.records.historyBestAttack.value,60);
 for(const alter of [c=>{c.seasonData.world.phase='active'},c=>{c.selectedSeason=2},c=>{c.seasonData.history=null},c=>{c.seasonData.provenance.kind='fictional'}]){const c=context();alter(c);assert.equal(historyViewModel(c),null)}
});
test('refuses unknown historical champion and preserves unavailable player/all-time records',()=>{
 const c=context();c.seasonData.history.championClubId='FR-1';assert.equal(historyViewModel(c),null);
 const data=historyViewModel(context());assert.equal(data.players,null);assert.equal(data.allTime,null);
});
test('keeps selected Season1 history when actual world advances into active Season2',()=>{
 const c=context();c.seasonData.world={phase:'active',seasonNumber:2,day:1};c.seasonData.seasonState={phase:'closed',day:56};assert.equal(historyViewModel(c).season,1);
});

test('verified History populates records without mounting a Hall or hiding Season archive',()=>{
 const source=readFileSync(new URL('../assets/authoritative-history.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/historyHallOfChampions|authoritativeHistory|placeholder\.hidden|section\.append\(/);
 assert.match(source,/panel\.querySelectorAll\('\[data-history-team-records\] \[data-history-scope="season"\]'\)/);
 assert.match(source,/refreshRecords\(\)/);

});


test('QA-12: an active Season 2 has a completed Season 1 archive instead of treating active Season 2 as empty history',()=>{
 const previous=context(),closed=historyViewModel(previous);
 const current=context();current.selectedSeason=2;current.seasonData={season:2,provenance:{kind:'authoritative'},world:{generation:'g',seasonNumber:2,phase:'active',day:4},history:null};
 assert.equal(historyViewModel(current),null,'active Season 2 is not awarded a false champion');
 const compiled=historyAggregate([closed]);
 assert.equal(compiled.season.historyBestAttack.value,60);
 assert.equal(compiled['all-time'].historyMostTitles.value,1);
 assert.equal(compiled['all-time'].historyMostTotalWins.value,20);
 assert.equal(closed.podium[0].primaryName,'Test club');
});
test('QA-12: closed seasonal archives produce cumulative all-time records without double-counting',()=>{
 const season1=historyViewModel(context()),season2={...season1,season:2};
 const results=historyAggregate([season1,season2]);
 assert.equal(results['all-time'].historyMostTitles.value,2);
 assert.equal(results['all-time'].historyLongestTitleStreak.value,2);
 assert.equal(results['all-time'].historyMostTotalWins.value,40);
 assert.equal(results['all-time'].historyMostTotalGoals.value,120);
 assert.equal(results['all-time'].historyMostTotalPoints.value,130);
 assert.equal(results.season.historyBestAttack.entries.length,2,'ties preserve source season for the record links');
});
test('QA-12: international History distinguishes verified final winner and runner-up from the league phase',()=>{
 const a={countryId:'IT',clubId:1,primaryName:'Cup A'},b={countryId:'ENG',clubId:1,primaryName:'Cup B'};
 const eliminated=[{countryId:'PT',clubId:1,primaryName:'Cup C'},{countryId:'DE',clubId:1,primaryName:'Cup D'}];
 const semiLegs=[
  {phaseId:'semifinals',tieId:'s1',homeId:'IT-1',awayId:'PT-1'},
  {phaseId:'semifinals',tieId:'s1',homeId:'PT-1',awayId:'IT-1'},
  {phaseId:'semifinals',tieId:'s2',homeId:'DE-1',awayId:'ENG-1'},
  {phaseId:'semifinals',tieId:'s2',homeId:'ENG-1',awayId:'DE-1'}
 ];
 const c={selectedSeason:1,definition:{id:'int-1',category:'international'},seasonData:{
  season:1,provenance:{kind:'authoritative'},seasonState:{phase:'closed',day:56},world:{phase:'closed',seasonNumber:1},
  participants:[a,b,...eliminated],fixtures:[...semiLegs,{phaseId:'final',homeId:'IT-1',awayId:'ENG-1'}],
  history:{season:1,championClubId:'ENG-1',archiveHash:'a'.repeat(64),closedAt:123},
  statistics:{standings:[
   {club:a,won:3,gf:5,ga:3,gd:2,pts:9},
   {club:b,won:2,gf:4,ga:4,gd:0,pts:6},
   ...eliminated.map(club=>({club,won:1,gf:3,ga:4,gd:-1,pts:3}))
  ],teams:[
   {clubKey:'IT-1',w:4,gf:6,ga:5,gd:1},
   {clubKey:'ENG-1',w:5,gf:12,ga:6,gd:6},
   ...eliminated.map(club=>({clubKey:club.countryId+'-'+club.clubId,w:1,gf:3,ga:4,gd:-1}))
  ]}
 }};
 const model=historyViewModel(c);
 assert.equal(model.champion.primaryName,'Cup B');
 assert.equal(model.podium[0].primaryName,'Cup B');
 assert.equal(model.podium[1].primaryName,'Cup A');
 assert.deepEqual(model.semifinalLosers,eliminated,'both semifinal losers share the archive third-place cell');
 assert.equal(model.records.historyBestAttack.value,12,'cup season records include verified knockout goals');
 assert.equal(model.records.historyBestAttack.clubs[0].primaryName,'Cup B');
 assert.equal(model.records.historyMostSeasonWins.value,5,'cup wins include knockout victories');
 assert.equal(model.records.historyMostSeasonPoints.value,9,'points remain the verified league-phase value');
 assert.equal(historyAggregate([model])['all-time'].historyMostTotalGoals.value,12);
 assert.equal(model.players,null,'player records do not yet have an approved source');
 assert.equal(model.records.historyLargestTitleMargin,undefined);
 assert.equal(historyAggregate([model])['all-time'].historyMostPodiums,undefined);
 c.seasonData.fixtures=c.seasonData.fixtures.filter(f=>f.tieId!=='s2');
 assert.deepEqual(historyViewModel(c).semifinalLosers,[],'an incomplete bracket does not assign a shared third place');
});
test('QA-12: shared public History reads sealed prior seasons through anonymous competition projections, not Admin endpoints',()=>{
 const history=readFileSync(new URL('../assets/authoritative-history.mjs',import.meta.url),'utf8');
 const page=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 assert.match(history,/\/api\/competitions\//);
 assert.match(history,/validateAuthoritativeSeason\(input,target,manifest\)/);
 assert.match(history,/adaptAuthoritativeSeason\(checked,target,manifest\)/);
 assert.match(history,/const last=world\.seasonNumber-\(world\.phase==='closed'\?0:1\)/);
 assert.match(history,/credentials:'omit'/);
 assert.doesNotMatch(history,/\/api\/admin\//);
 assert.match(page,/manifest,isDev:\(\)=>activeDebugSeason!==null/);
 assert.match(page,/fa:competition-route-change',history\.render/);
});

test('QA-12: History fetches previous closed season from the canonical world even while the selected current season has no payload',async()=>{
 const before=globalThis.window,requests=[],readiness=[];
 let listener;
 const clock={generation:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',seasonNumber:2,phase:'active',revision:2};
 globalThis.window={
  faWorldState:{get:()=>({source:'authoritative',sourceRevision:0,world:clock}),
   subscribe(fn){listener=fn;return ()=>{listener=null}}},
  faCompetitionRoute:{get:()=>({view:'history',season:'2'})},
  faStandingsLoading:{beginView:()=>()=>{}},
  faHistorySetReady(value){readiness.push(value)}
 };
 try{
  const panel={querySelectorAll:()=>[],querySelector:()=>null};
  const mounted=mountAuthoritativeHistory(panel,{
   getContext:()=>({definition:{id:'IT-1',category:'domestic'},currentDefinition:{id:'IT-1'},selectedSeason:2,seasonData:null}),
   manifest:{},document:{},
   fetchJson:async path=>{requests.push(path);throw Error('Deliberate request failure after observing attempted closed-season read')}
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests,['/api/competitions/IT-1/seasons/1'],'missing Season2 data must not block the closed Season1 history request');
  assert.ok(readiness.includes(false),'History remains pending until its own provider settles');
  assert.equal(readiness.at(-1),true,'a failed verified read ends in an explicit provider error rather than pretending no season completed');
  assert.equal(typeof listener,'function','History listens to the canonical world clock directly');
  mounted.destroy();assert.equal(listener,null);
 }finally{if(before===undefined)delete globalThis.window;else globalThis.window=before}
});

test('QA-12: History settles a missing public world without claiming zero completed seasons',()=>{
 const before=globalThis.window,readiness=[];
 globalThis.window={
  faWorldState:{get:()=>({source:'authoritative',world:null}),subscribe:()=>()=>{}},
  faCompetitionRoute:{get:()=>({view:'history'})},
  faHistorySetReady(value){readiness.push(value)}
 };
 try{
  const mounted=mountAuthoritativeHistory({querySelectorAll:()=>[],querySelector:()=>null},{
   getContext:()=>({definition:{id:'IT-1'},selectedSeason:2,seasonData:null}),
   manifest:{},document:{}
  });
  assert.equal(readiness.at(-1),false,'missing world initially holds the History loading shell');
  mounted.settleUnavailable();
  assert.equal(readiness.at(-1),true,'terminal source unavailability releases the loading shell');
  mounted.destroy();
 }finally{if(before===undefined)delete globalThis.window;else globalThis.window=before}
});

test('QA-12: canonical world unavailability releases History only on a confirmed terminal source failure',()=>{
 const original=globalThis.window,readiness=[];
 let worldStatus='pending',subscriber;
 globalThis.window={
  faWorldState:{get:()=>({source:'authoritative',world:null,worldStatus}),subscribe(fn){subscriber=fn;return()=>{subscriber=null}}},
  faCompetitionRoute:{get:()=>({view:'history',season:'2'})},
  faHistorySetReady:ready=>readiness.push(ready)
 };
 try{
  const component=mountAuthoritativeHistory({querySelectorAll:()=>[],querySelector:()=>null},{
   getContext:()=>({definition:{id:'IT-1'},selectedSeason:2,seasonData:null}),
   manifest:{},document:{}
  });
  assert.equal(readiness.at(-1),false,'before the public clock responds, History remains in its first-paint skeleton');
  worldStatus='unavailable';subscriber();
  assert.equal(readiness.at(-1),true,'a verified terminal unavailable clock releases the shell');
  component.destroy();
 }finally{if(original===undefined)delete globalThis.window;else globalThis.window=original}
});

test('QA-12: a changed current-world revision restarts the prior-season record request, not a stale error',async()=>{
 const before=globalThis.window,requests=[],controllers=[];
 const world={generation:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',seasonNumber:2,phase:'active',revision:4};
 let listener;
 globalThis.window={
  faWorldState:{get:()=>({source:'authoritative',world}),subscribe(fn){listener=fn;return()=>{listener=null}}},
  faCompetitionRoute:{get:()=>({view:'history',season:'2'})},
  faHistorySetReady(){},
  faStandingsLoading:{beginView:()=>()=>{}}
 };
 try{
  const mounted=mountAuthoritativeHistory({querySelectorAll:()=>[],querySelector:()=>null,dataset:{}},{
   getContext:()=>({definition:{id:'IT-1',category:'domestic'},currentDefinition:{id:'IT-1'},selectedSeason:2,seasonData:null}),
   manifest:{},document:{},
   fetchJson:async (url,{signal})=>{requests.push({url,signal});return new Promise(()=>{})}
  });
  assert.equal(requests.length,1,'Season1 history read starts on canonical world revision 4');
  world.revision=5;listener();
  assert.equal(requests.length,2,'a new world revision starts a separate historical read');
  assert.equal(requests[0].signal.aborted,true,'stale History read is explicitly aborted');
  assert.equal(requests[1].signal.aborted,false);
  mounted.destroy();
  assert.equal(requests[1].signal.aborted,true);
 }finally{if(before===undefined)delete globalThis.window;else globalThis.window=before}
});
