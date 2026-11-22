import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const records=require('../assets/club-records.js');
const routes=require('../assets/routes-registry.js');
const selected={countryId:'IT',clubId:17,base:'/clubs/it/17',view:'records'};
const {ordinal}=require('../assets/club-model.js');
const membership=(competitionId,position,stats)=>({competitionId,category:competitionId.startsWith('int-')?'international':'domestic',name:competitionId,position,stats});
const team=(won,goalsFor,cleanSheets,goalDifference)=>({played:30,won,drawn:5,lost:30-won-5,goalsFor,goalsAgainst:goalsFor-goalDifference,goalDifference,cleanSheets});
const snapshot={
 source:'authoritative',clubKey:'IT-17',coverage:'complete',world:{seasonNumber:2},
 seasons:[
  {season:1,ongoing:false,memberships:[membership('IT-1',4,team(18,57,0,12)),membership('int-1',null,team(3,9,1,2))]},
  {season:2,ongoing:true,memberships:[membership('IT-1',1,team(22,71,12,42))]}
 ]
};
const render=(extra={})=>records.render({selected,historySnapshot:snapshot,language:'en',search:'',ordinal,...extra});
test('CLUB-RECORDS-01: Club Stats aliases redirect to Records but Competition Stats is unchanged',()=>{
 assert.deepEqual(routes.clubViews,['overview','roster','fixtures','records','history']);
 assert.equal(routes.parseRoute('/clubs/it/17/stats').canonical,'/clubs/it/17/records');
 assert.equal(routes.parseRoute('/clubs/it/17/stats').redirect,true);
 assert.equal(routes.parseRoute('/clubs/it/17/records').redirect,false);
 assert.equal(routes.buildRoute({kind:'club',country:'it',id:17,view:'records'}),'/clubs/it/17/records');
 assert.throws(()=>routes.buildRoute({kind:'club',country:'it',id:17,view:'stats'}));
 assert.equal(routes.parseRoute('/competitions/it-1/stats').view,'stats');
});
const [first,last]=snapshot.seasons;
first.memberships[0].leagueGoalsAgainst=19;
first.matches=[{matchId:15,venue:'away',scored:3,conceded:0,opponent:'IT-2'},{scored:0,conceded:1,opponent:'IT-3'}];
last.matches=[{scored:1,conceded:0,opponent:'IT-4'},{scored:2,conceded:2,opponent:'IT-5'}];
first.players=[{id:1,name:'One',appearances:9,goals:6,assists:2,clean:null}];
last.players=[{id:1,name:'One',appearances:5,goals:1,assists:1,clean:null},
 {id:2,name:'Two',appearances:10,goals:6,assists:3,clean:4}];
const get=(rows,key)=>rows.find(row=>row.key===key);
test('season team records compare seasons and restrict fewest conceded to final league totals',()=>{
 const {records:team}=records.select(snapshot.seasons,'season');
 assert.deepEqual(team.map(r=>r.key),['wins','goals','fewest','clean','gd','streak']);
 assert.deepEqual(team.map(r=>r.value),[22,71,19,12,42,2]);
 assert.deepEqual(get(team,'streak').sources.map(s=>s.season),[2]);
});
test('career team records use final league tier, match margin and cumulative totals',()=>{
 const {records:team}=records.select(snapshot.seasons,'verified');
 assert.deepEqual(team.map(r=>r.value),[4,3,90,43,137,13]);
 assert.equal(get(team,'largest').sources[0].opponent,'IT-2');
 const lower={...last,ongoing:false,memberships:[{...last.memberships[0],competitionId:'IT-2'}]};
 assert.equal(records.select([first,lower],'verified').records[0].value,4);
 const winning=render({search:'?scope=all-time'});
 assert.match(winning,/href="\/matches\/15">3–0<\/a>/);
 assert.match(winning,/@ IT-2/);
 const tied={...last,matches:[{matchId:28,venue:'home',scored:4,conceded:1,opponent:'IT-3'}]};
 const ties=render({search:'?scope=all-time',historySnapshot:{...snapshot,seasons:[first,tied]}});
 assert.match(ties,/href="\/matches\/28">4–1<\/a>/);
 assert.match(ties,/vs IT-3/);
});
test('season leaders retain ties, career leaders combine spells under the frozen player ID',()=>{
 const season=records.select(snapshot.seasons,'season').players;
 assert.deepEqual(season.map(p=>p.value),[10,6,3,9,4,null]);
 assert.deepEqual(get(season,'playerGoals').sources.map(p=>[p.id,p.season]),[[1,1],[2,2]]);
 const career=records.select(snapshot.seasons,'verified').players;
 assert.deepEqual(career.map(p=>p.value),[14,7,3,10,4,null]);
 assert.match(render(),/href="\/players\/1"/);
 assert.match(render(),/aria-haspopup="dialog" data-club-record-detail="playerGoals"[^>]*>\+1<\/button>/);
 assert.match(render(),/data-club-record-portrait="1"/);
 assert.equal(records.playerHolders([{id:1,name:'One',season:1},{id:1,name:'One',season:2}], 'IT-17')[0].clubs.length,2);
});
test('incomplete player and fixture coverage cannot produce a partial historical record',()=>{
 const legacy=[first,{...last,players:null,matches:undefined}];
 assert.ok(records.select(legacy,'verified').players.every(p=>p.value===null));
 assert.equal(get(records.select(legacy,'season').records,'streak').value,null);
 assert.equal(get(records.select(legacy,'verified').records,'largest').value,null);
 const incomplete=[{...first,players:[{...first.players[0],assists:null}]}];
 assert.equal(get(records.select(incomplete,'season').players,'combined').value,null);
 assert.equal(get(records.select(snapshot.seasons,'verified').players,'mvpAwards').value,null,'legacy coverage stays unknown');
 const verified=[{...first,players:first.players.map(p=>({...p,mvpAwards:2,mvpCoveredAppearances:p.appearances}))},
  {...last,players:last.players.map(p=>({...p,mvpAwards:p.id===1?1:3,mvpCoveredAppearances:p.appearances}))}];
 assert.equal(get(records.select(verified,'verified').players,'mvpAwards').value,3);
 assert.equal(get(records.select(verified,'season').players,'mvpAwards').value,3);
 const partial=[...verified,{...last,season:3,players:[{...last.players[0],mvpAwards:null,mvpCoveredAppearances:0}]}];
 assert.equal(get(records.select(partial,'verified').players,'mvpAwards').value,null);
 assert.equal(get(records.select(partial,'season').players,'mvpAwards').value,null);
 const partialWinner=[...verified,{...last,season:3,players:[{...last.players[0],mvpAwards:1,mvpCoveredAppearances:1}]}];
 assert.equal(get(records.select(partialWinner,'verified').players,'mvpAwards').value,null,
  'an award from a partially covered player cannot be an all-time record');
});
test('five locales and first paint reserve official MVP records even for legacy unavailable',()=>{
 for(const language of Object.keys(records.words))for(const search of ['','?scope=all-time']){
  const html=render({language,search});
  assert.equal((html.match(/class="app-competition-stat-card"/g)||[]).length,12);
  assert.doesNotMatch(html,/undefined|club-records-season-nav/);
  assert.match(html,/data-record-label="mvpAwards"/);
 }
 const firstPaint=readFileSync(new URL('../clubs/_shared/index.html',import.meta.url),'utf8');
 assert.equal((firstPaint.match(/class="app-competition-stat-card"/g)||[]).length,12);
 const loading=render({historySnapshot:{source:'loading'}});
 assert.equal((loading.match(/class="app-competition-stat-value"><span class="app-skeleton-bar"/g)||[]).length,12);
 assert.equal((loading.match(/class="app-history-player-name club-record-name-placeholder"/g)||[]).length,6);
 assert.equal((loading.match(/class="fa-dev-stats-player-portrait club-record-portrait-placeholder"/g)||[]).length,6);
 assert.match(render({search:'?scope=all-time',historySnapshot:{source:'loading'}}),/data-record-period="verified"/);
 assert.doesNotMatch(render({historySnapshot:{source:'dev'}}),/club-records-note|Verified club records are unavailable/);
});

test('CLUB-RECORDS-01 linked evidence preserves season, all-time and tie contexts',()=>{
 const season=render();
 assert.match(season,/href="\/clubs\/it\/17\/history#club-history-season-2">Season 2<\/a>/);
 assert.match(season,/href="\/players\/2\?view=stats#player-stats-season-2">Season 2<\/a>/);
 const verified=render({search:'?scope=all-time'});
 assert.match(verified,/href="\/competitions\/it-1\/standings\?season=1">4th<\/a>/);
 assert.match(verified,/href="\/competitions\/it-1\/standings\?season=1">IT-1<\/a>/);
 assert.match(verified,/href="\/clubs\/it\/17\/history">Season 1, 2<\/a>/);
 assert.match(verified,/href="\/players\/1\?view=stats">Season 1, 2<\/a>/);
 assert.match(verified,/href="\/matches\/15">3–0<\/a>/);
 const holders=records.playerHolders(records.select(snapshot.seasons,'verified').players[0].sources,'IT-17');
 assert.deepEqual(holders[0].clubs,[{clubId:'IT-17',season:1},{clubId:'IT-17',season:2}]);
 const clubModel=readFileSync(new URL('../assets/club-model.js',import.meta.url),'utf8');
 const clubController=readFileSync(new URL('../assets/club-page.js',import.meta.url),'utf8');
 const playerStats=readFileSync(new URL('../assets/player-stats.mjs',import.meta.url),'utf8');
 const dialog=readFileSync(new URL('../assets/competition-history.js',import.meta.url),'utf8');
 assert.match(clubModel,/id="club-history-season-/);
 assert.match(clubController,/target\.scrollIntoView\(\{block:'center'\}\)/);
 assert.match(playerStats,/summary\.id='player-stats-season-'\+season\.season/);
 assert.match(playerStats,/target\.scrollIntoView\(\{block:'center'\}\)/);
 assert.match(dialog,/seasonHref\(holder\.id,season\)/);
});

test('CLUB-RECORDS-01: Season links share one text-only underline style across records and ties',()=>{
 const season=render(),career=render({search:'?scope=all-time'});
 assert.match(season,/class="app-world-standing-club-link app-history-season app-records-season-link"/);
 assert.match(season,/class="app-history-season app-world-standing-club-link app-records-season-link"/);
 assert.match(career,/class="app-world-standing-club-link app-records-season-link" href="\/clubs\/it\/17\/history"/);
 const css=readFileSync(new URL('../assets/club-page.css',import.meta.url),'utf8');
 const dialog=readFileSync(new URL('../assets/competition-history.js',import.meta.url),'utf8');
 assert.match(css,/:is\(\.club-records,\.app-history-player-dialog\) a\.app-records-season-link:is\(:hover,:focus-visible\)/);
 assert.match(css,/text-decoration-thickness:1px;text-underline-offset:3px/);
 assert.match(dialog,/app-world-standing-club-link app-history-season app-records-season-link/);
 for(const locale of Object.keys(records.words))
  assert.doesNotMatch(render({language:locale,historySnapshot:{source:'unavailable'}}),/club-records-note/);
});

test('CLUB-RECORDS-01: loading bars use hydrated value and season centerlines on desktop/mobile',()=>{
 const css=readFileSync(new URL('../assets/club-page.css',import.meta.url),'utf8');
 const markup=readFileSync(new URL('../clubs/_shared/index.html',import.meta.url),'utf8');
 for(const search of ['', '?scope=all-time']){
  const pending=render({search,historySnapshot:{source:'loading'}});
  assert.equal((pending.match(/class="app-competition-stat-card"/g)||[]).length,12);
  assert.equal((pending.match(/class="app-history-season club-record-season-placeholder" data-record-placeholder="season"/g)||[]).length,6,
   'player season placeholder is the same direct grid item as the hydrated season link');
  assert.equal((pending.match(/data-record-placeholder="season"/g)||[]).length,10,
   'all ten season-source slots remain reserved in both periods');
  assert.doesNotMatch(pending,/<span data-record-placeholder="season"><span/);
 }
 assert.equal((markup.match(/class="app-history-season club-record-season-placeholder" data-record-placeholder="season"/g)||[]).length,6);
 assert.doesNotMatch(markup,/<span data-record-placeholder="season"><span class="app-history-season/);
 assert.doesNotMatch(css,/\[data-record-period="verified"\] \[data-record-placeholder="season"\]\{display:none\}/,
  'all-time season sources must retain their loading skeletons');
 assert.match(css,/\.club-record-context-placeholder::before\{content:"Division";visibility:hidden\}/);
 assert.match(css,/\.club-records \.app-history-player-footer>\.club-record-season-placeholder\{[\s\S]*?justify-self:end;align-self:center/);
 assert.match(css,/\.club-records \.app-competition-stat-value:has\(>\.app-skeleton-bar\)::before\{content:"00";visibility:hidden\}/);
});
