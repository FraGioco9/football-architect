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
first.matches=[{scored:3,conceded:0,opponent:'IT-2'},{scored:0,conceded:1,opponent:'IT-3'}];
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
 assert.match(render({search:'?scope=all-time'}),/3–0/);
});
test('season leaders retain ties, career leaders combine spells under the frozen player ID',()=>{
 const season=records.select(snapshot.seasons,'season').players;
 assert.deepEqual(season.map(p=>p.value),[10,6,3,9,4]);
 assert.deepEqual(get(season,'playerGoals').sources.map(p=>[p.id,p.season]),[[1,1],[2,2]]);
 const career=records.select(snapshot.seasons,'verified').players;
 assert.deepEqual(career.map(p=>p.value),[14,7,3,10,4]);
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
});
test('five locales and first paint share the approved cards; MVP waits for official data',()=>{
 for(const language of Object.keys(records.words))for(const search of ['','?scope=all-time']){
  const html=render({language,search});
  assert.equal((html.match(/class="app-competition-stat-card"/g)||[]).length,11);
  assert.doesNotMatch(html,/undefined|MVP|club-records-season-nav/);
 }
 const firstPaint=readFileSync(new URL('../clubs/_shared/index.html',import.meta.url),'utf8');
 assert.equal((firstPaint.match(/class="app-competition-stat-card"/g)||[]).length,11);
 const loading=render({historySnapshot:{source:'loading'}});
 assert.equal((loading.match(/class="app-competition-stat-value"><span class="app-skeleton-bar"/g)||[]).length,11);
 assert.match(render({historySnapshot:{source:'dev'}}),/Verified club records are unavailable/);
});
