import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const records=require('../assets/club-records.js');
const routes=require('../assets/routes-registry.js');
const selected={countryId:'IT',clubId:17,base:'/clubs/it/17',view:'records'};
const divisions=[{id:'IT-1',name:'Italian First Division'}];
const membership=(competitionId,position,stats)=>({competitionId,category:competitionId.startsWith('int-')?'international':'domestic',name:competitionId,position,stats});
const team=(won,goalsFor,cleanSheets,goalDifference)=>({played:30,won,drawn:5,lost:30-won-5,goalsFor,goalsAgainst:goalsFor-goalDifference,goalDifference,cleanSheets});
const snapshot={
 source:'authoritative',clubKey:'IT-17',coverage:'complete',world:{seasonNumber:2},
 seasons:[
  {season:1,ongoing:false,memberships:[membership('IT-1',4,team(18,57,0,12)),membership('int-1',null,team(3,9,1,2))]},
  {season:2,ongoing:true,memberships:[membership('IT-1',1,team(22,71,12,42))]}
 ]
};
const render=(extra={})=>records.render({selected,historySnapshot:snapshot,language:'en',search:'',divisions,...extra});
test('CLUB-RECORDS-01: Club Stats aliases redirect to Records but Competition Stats is unchanged',()=>{
 assert.deepEqual(routes.clubViews,['overview','roster','fixtures','records','history']);
 assert.equal(routes.parseRoute('/clubs/it/17/stats').canonical,'/clubs/it/17/records');
 assert.equal(routes.parseRoute('/clubs/it/17/stats').redirect,true);
 assert.equal(routes.parseRoute('/clubs/it/17/records').redirect,false);
 assert.equal(routes.buildRoute({kind:'club',country:'it',id:17,view:'records'}),'/clubs/it/17/records');
 assert.throws(()=>routes.buildRoute({kind:'club',country:'it',id:17,view:'stats'}));
 assert.equal(routes.parseRoute('/competitions/it-1/stats').view,'stats');
});
test('CLUB-RECORDS-01: ongoing season cannot set archived records; verified zero displays as zero',()=>{
 const closed=records.select(snapshot.seasons,'verified',2);
 assert.equal(closed.selected.length,1);
 assert.equal(closed.records.find(r=>r.key==='rank').value,4);
 assert.equal(closed.records.find(r=>r.key==='wins').value,18);
 assert.equal(closed.records.find(r=>r.key==='clean').value,1);
 const current=records.select(snapshot.seasons,'season',2);
 assert.equal(current.records.find(r=>r.key==='rank').value,1);
 assert.equal(current.records.find(r=>r.key==='gd').value,42);
 const noCups=records.select([{season:1,ongoing:false,memberships:[snapshot.seasons[0].memberships[0]]}],'verified',2);
 assert.equal(noCups.records.find(r=>r.key==='clean').value,0);
});
test('CLUB-RECORDS-01: source links and coverage refer only to verified completed seasons',()=>{
 const historical=render({search:'?scope=verified'});
 assert.match(historical,/Verified coverage: Season 1/);
 assert.match(historical,/\/competitions\/it-1\/standings\?season=1/);
 assert.match(historical,/\/competitions\/int-1\/standings\?season=1/);
 assert.doesNotMatch(historical, /\/standings\?season=2/);
 const live=render({search:'?season=2'});
 assert.match(live,/Ongoing season/);
 assert.match(live,/\/competitions\/it-1\/standings\?season=2/);
 assert.match(live,/class="club-records-value">1<\/td>/);
});
test('CLUB-RECORDS-01: Season 0, incomplete authority, DEV, no matches and invalid future season never fabricate records',()=>{
 const zero=render({historySnapshot:{source:'authoritative',clubKey:'IT-17',coverage:'empty',world:{seasonNumber:0},seasons:[]}});
 assert.match(zero,/No matches played/);
 assert.doesNotMatch(zero,/\/standings\?/);
 const loading=render({historySnapshot:{source:'loading'}});
 assert.match(loading,/aria-busy="true"/);
 assert.equal((loading.match(/class="club-records-placeholder club-fp-bar"/g)||[]).length,5);
 const dev=render({historySnapshot:{...snapshot,source:'dev'}});
 assert.match(dev,/Verified club records are unavailable/);
 assert.doesNotMatch(dev,/\/standings\?/);
 const future=render({search:'?season=99'});
 assert.match(future,/Ongoing season/);
 const empty=render({historySnapshot:{...snapshot,seasons:[{season:1,ongoing:false,memberships:[]},{season:2,ongoing:true,memberships:[]}]}});
 assert.match(empty,/No matches played/);
});
test('CLUB-RECORDS-01: all five locale copies and static first-paint structure are present',()=>{
 for(const locale of ['en','de','es','fr','it'])assert.ok(records.words[locale]?.verified);
 const html=readFileSync(new URL('../clubs/_shared/index.html',import.meta.url),'utf8');
 assert.match(html,/data-club-first-paint-tab="records"/);
 assert.match(html,/class="club-records club-first-paint-records"/);
 assert.equal((html.match(/data-club-records-first-paint="(?:5|6|7|8|9)"/g)||[]).length,5);
 assert.match(html,/src="\/assets\/club-records\.js" defer/);
});