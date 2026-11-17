import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateAuthoritativeSeason,adaptAuthoritativeSeason,createAuthoritativeLoader,createCompetitionSeasonReadCache} from '../assets/authoritative-season.mjs';
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
const definition=manifest.competitions.find(c=>c.id==='IT-1');
const clubs=manifest.divisions.find(d=>d.id==='IT-1').clubs;
const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:4,seasonNumber:1,phase:'active',day:1};
const empty=()=>({schemaVersion:1,providerId:'authoritative-world',competitionId:'IT-1',selectedSeason:1,world,status:'empty',reason:'calendar-unpublished',provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null});
const ctx=()=>({definition,selectedSeason:1,revision:1});
test('requires exact viewed identity and never treats missing/fictional responses as real data',()=>{
 assert.equal(validateAuthoritativeSeason(empty(),ctx(),manifest).data,null);
 for(const change of [{providerId:'dev-fictional'},{competitionId:'IT-2'},{selectedSeason:2},{world:{...world,day:57}},{status:'available',data:{}}])assert.throws(()=>validateAuthoritativeSeason({...empty(),...change},ctx(),manifest));
});
test('a transport failure clears old supplied data and does not commit an invented response',async()=>{
 let context=ctx(),clears=0,commits=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{clears++;context={...context,revision:context.revision+1}},commit:()=>{commits++},isDev:()=>false,fetchJson:async()=>{throw Error('offline')},manifest});
 await loader.load();assert.equal(clears,1);assert.equal(commits,0);
});
test('does not request or overwrite protected DEV data',async()=>{
 let calls=0;const loader=createAuthoritativeLoader({getContext:ctx,clear:()=>{calls++},commit:()=>{calls++},isDev:()=>true,fetchJson:async()=>{calls++},manifest});
 await loader.load();assert.equal(calls,0);
});
test('a reset during read rejects the obsolete generation before commit',async()=>{
 let context=ctx(),calls=0,commits=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{context={...context,revision:context.revision+1}},commit:()=>{commits++},isDev:()=>false,fetchJson:async path=>path==='/api/world'?{world:++calls===1?world:{...world,generation:'12345678-1234-4123-8123-123456789abc',seasonNumber:0,day:0,revision:0,phase:'unstarted'}}:empty(),manifest});
 await loader.load();assert.equal(commits,0);
});
test('out-of-order requests cannot commit into a newer context',async()=>{
 let context=ctx(),release,commits=0;
 const delayed=new Promise(resolve=>{release=resolve});let calls=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{context={...context,revision:context.revision+1}},commit:()=>{commits++;return true},isDev:()=>false,fetchJson:async path=>path==='/api/world'?{world}:++calls===1?delayed:empty(),manifest});
 const first=loader.load();await Promise.resolve();await Promise.resolve();
 await loader.load();release(empty());await first;
 assert.equal(commits,1);
});
function confirmedEntrants(){
 const ids=clubs.map(c=>c.countryId+'-'+c.clubId);
 return {...empty(),status:'partial',reason:null,
  provenance:{kind:'authoritative',resultAuthority:'confirmed-entrants-v1',
   sourceRef:'world:'+world.generation+':season:1:entrants:'+'b'.repeat(64)},
  data:{entrantsOnly:true,season:1,seasonState:{day:1,phase:'active'},
   rulesVersion:definition.rules.version,participants:ids}};
}
test('confirmed entrants hydrate an unranked zero-stat standings table without a calendar',()=>{
 const raw=confirmedEntrants();
 const confirmed=validateAuthoritativeSeason(raw,ctx(),manifest);
 const data=adaptAuthoritativeSeason(confirmed,ctx(),manifest);
 assert.equal(data.participants.length,16);
 assert.equal(data.entrantsOnly,true);
 assert.equal(data.fixtures,null);
 assert.deepEqual(data.postseason,[]);
 assert.deepEqual(data.results,[]);
 assert.equal(data.currentMatchday,null);
 assert.equal(data.statistics.overview.matchesPlayed,0);
 assert.equal(data.statistics.standings.length,16);
 assert.ok(data.statistics.standings.every(r=>r.played===0&&r.won===0&&r.drawn===0&&
  r.lost===0&&r.gf===0&&r.ga===0&&r.gd===0&&r.pts===0&&r.recent.length===0));
 assert.ok(Object.isFrozen(data));
});
test('confirmed entrants use alphabetical primary names for domestic and international standings',()=>{
 const international=manifest.competitions.find(c=>c.id==='int-1');
 const selections=[[definition,clubs],
  [international,manifest.divisions.filter(d=>d.tier===1).flatMap(d=>d.clubs.slice(0,3))]];
 for(const [competition,members] of selections){
  assert.equal(members.length,competition.capacity);
  const raw=confirmedEntrants();
  raw.competitionId=competition.id;
  raw.data.rulesVersion=competition.rules.version;
  const incoming=members.map(c=>c.countryId+'-'+c.clubId).reverse();
  raw.data.participants=[...incoming];
  const context={definition:competition,selectedSeason:1,revision:1};
  const data=adaptAuthoritativeSeason(validateAuthoritativeSeason(raw,context,manifest),context,manifest);
  const sorted=[...members].sort((a,b)=>a.primaryName.localeCompare(b.primaryName,'en',{sensitivity:'base'})||
   (a.countryId+'-'+a.clubId).localeCompare(b.countryId+'-'+b.clubId,'en'));
  assert.deepEqual(data.participants.map(c=>c.countryId+'-'+c.clubId),
   sorted.map(c=>c.countryId+'-'+c.clubId),competition.id+' sorts by name, not membership ID');
  assert.deepEqual(data.statistics.standings.map(row=>row.club),data.participants,
   competition.id+' desktop and compact standings receive the same row order');
  assert.deepEqual(raw.data.participants,incoming,'canonical transport membership order remains untouched');
 }
});
test('confirmed entrants reject forged schedules, results, provenance and future-season leakage',()=>{
 for(const edit of [
  r=>{r.data.fixtures=[]},
  r=>{r.data.standings={rows:[]}},
  r=>{r.data.participants.pop()},
  r=>{r.data.participants[0]='FR-1'},
  r=>{r.data.seasonState={day:2,phase:'active'}},
  r=>{r.provenance.resultAuthority='temporary-lineup-v1'},
  r=>{r.provenance.sourceRef='world:'+world.generation+':season:1:'+'b'.repeat(64)},
  r=>{r.status='available'},
  r=>{r.world={...world,generation:'12345678-1234-4123-8123-123456789abc'}},
  r=>{r.selectedSeason=2}
 ]){
  const raw=confirmedEntrants();edit(raw);
  assert.throws(()=>validateAuthoritativeSeason(raw,ctx(),manifest));
 }
 const two=confirmedEntrants();two.selectedSeason=2;two.world={...world,seasonNumber:2};
 two.data.season=2;two.data.participants[15]='IT-17';
 two.provenance.sourceRef='world:'+world.generation+':season:2:entrants:'+'b'.repeat(64);
 const c2={...ctx(),selectedSeason:2};
 const view=adaptAuthoritativeSeason(validateAuthoritativeSeason(two,c2,manifest),c2,manifest);
 assert.ok(view.participants.some(c=>c.clubId===17));
 assert.ok(!view.participants.some(c=>c.clubId===16));
});
test('adapts validated empty source without inventing league or player statistics',()=>{
 assert.equal(adaptAuthoritativeSeason(validateAuthoritativeSeason(empty(),ctx(),manifest),ctx(),manifest),null);
 assert.equal(clubs.length,16);
});
function source(){
 const ids=clubs.map(c=>c.countryId+'-'+c.clubId),ring=[...ids],fixtures=[];
 for(let round=1;round<=15;round++){
  for(let i=0;i<8;i++){
   const [home,away]=(round+i)%2?[ring[i],ring[15-i]]:[ring[15-i],ring[i]];
   for(const [r,h,a] of [[round,home,away],[round+15,away,home]])fixtures.push({id:`season:1:IT-1:N${String(r).padStart(2,'0')}:${h}:${a}`,competitionId:'IT-1',day:r+12,round:r,marker:'N'+String(r).padStart(2,'0'),homeClubId:h,awayClubId:a,phaseId:'league',tieId:null,leg:null,neutral:false,result:null});
  }ring.splice(1,0,ring.pop());
 }
 const zero=id=>({clubId:id,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0});
 return {...empty(),status:'partial',reason:null,provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',sourceRef:'world:'+world.generation+':season:1:'+'a'.repeat(64)},data:{season:1,rulesVersion:definition.rules.version,participants:ids,fixtures,
  standings:{complete:false,rows:ids.map((id,i)=>({...zero(id),rank:i+1,points:0}))},statistics:{matchesPlayed:0,totalGoals:0,goalsPerMatch:0,teams:ids.map(id=>({...zero(id),cleanSheets:0})),players:[],playerStatus:'available'},
  calendar:Array.from({length:56},(_,i)=>({day:i+1,fixtureIds:fixtures.filter(f=>f.day===i+1).map(f=>f.id),played:0})),history:null}};
}
test('accepts only real, internally coherent frozen V2 player totals',()=>{
 const raw=source(),fixture=raw.data.fixtures[0],matchDay=fixture.day;
 raw.world={...world,day:matchDay};
 const league=raw.data.fixtures.filter(f=>f.day===matchDay);
 assert.equal(league.length,8);
 for(const f of league){
  const selected=f===fixture;
  f.result={homeGoals:selected?1:0,awayGoals:0,resolution:'regulation',
   extraTime:null,penalties:null,winnerClubId:selected?f.homeClubId:null};
  const home=raw.data.standings.rows.find(t=>t.clubId===f.homeClubId);
  const away=raw.data.standings.rows.find(t=>t.clubId===f.awayClubId);
  const homeStats=raw.data.statistics.teams.find(t=>t.clubId===f.homeClubId);
  const awayStats=raw.data.statistics.teams.find(t=>t.clubId===f.awayClubId);
  for(const row of [home,homeStats]){
   row.played=1;row.won=selected?1:0;row.drawn=selected?0:1;
   row.goalsFor=selected?1:0;row.goalDifference=selected?1:0;
   row.cleanSheets=1;
   if('points' in row)row.points=selected?3:1;
  }
  for(const row of [away,awayStats]){
   row.played=1;row.lost=selected?1:0;row.drawn=selected?0:1;
   row.goalsAgainst=selected?1:0;row.goalDifference=selected?-1:0;
   row.cleanSheets=selected?0:1;
   if('points' in row)row.points=selected?0:1;
  }
 }
 raw.data.statistics.matchesPlayed=8;raw.data.statistics.totalGoals=1;
 raw.data.statistics.goalsPerMatch=1/8;
 raw.data.calendar.find(d=>d.day===matchDay).played=8;
 const player={playerId:58,clubId:fixture.homeClubId,appearances:1,starts:1,minutes:90,goals:1};
 raw.data.statistics.players=[player];
 assert.deepEqual(validateAuthoritativeSeason(raw,ctx(),manifest).data.statistics.players,[player]);
 // Backend lineupTeamStatisticsV1 accepts 1..120 minutes per appearance:
 // an early substitution is valid and must never blank the entire table.
 for(const minutes of [1,60,75,89,90,120]){
  const actual=structuredClone(raw);
  actual.data.statistics.players=[{...player,minutes}];
  const validated=validateAuthoritativeSeason(actual,ctx(),manifest);
  assert.equal(validated.data.statistics.players[0].minutes,minutes);
  const adapted=adaptAuthoritativeSeason(validated,ctx(),manifest);
  assert.equal(adapted.statistics.standings.length,16,'valid substitution retains standings');
  assert.equal(adapted.fixtures.find(f=>f.sourceFixtureId===fixture.id).homeGoals,1,
   'valid substitution retains official fixture scores');
 }
 for(const bad of [
  {...player,goals:2},{...player,starts:0},{...player,minutes:0},
  {...player,minutes:121},{...player,clubId:'FR-1'},
  {...player,appearances:2,starts:2,minutes:180}
 ]){
  const altered=structuredClone(raw);altered.data.statistics.players=[bad];
  assert.throws(()=>validateAuthoritativeSeason(altered,ctx(),manifest));
 }
 const duplicate=structuredClone(raw);duplicate.data.statistics.players=[player,player];
 assert.throws(()=>validateAuthoritativeSeason(duplicate,ctx(),manifest));

 // The backend aggregates all starters of a club: 11 different players
 // each appearing once is valid with only one club match played.
 const eleven=structuredClone(raw);
 eleven.data.statistics.players=Array.from({length:11},(_,i)=>({
  ...player,playerId:100+i,minutes:i===0?75:90,goals:i===0?1:0
 }));
 const season=validateAuthoritativeSeason(eleven,ctx(),manifest);
 assert.equal(season.data.statistics.players.length,11);
 const view=adaptAuthoritativeSeason(season,ctx(),manifest);
 assert.equal(view.statistics.standings.length,16);
 assert.equal(view.fixtures.find(f=>f.sourceFixtureId===fixture.id).homeGoals,1);
 // The per-player bound still rejects two appearances after one club match.
 const impossible=structuredClone(eleven);
 impossible.data.statistics.players[0].appearances=2;
 impossible.data.statistics.players[0].starts=2;
 impossible.data.statistics.players[0].minutes=150;
 assert.throws(()=>validateAuthoritativeSeason(impossible,ctx(),manifest));
 // The team-wide bound still rejects >11 total starts for one match.
 const excess=structuredClone(eleven);
 excess.data.statistics.players.push({...player,playerId:999,goals:0});
 assert.throws(()=>validateAuthoritativeSeason(excess,ctx(),manifest));
});
test('adapts a complete published schedule into existing domestic fixture and table contracts',()=>{
 const raw=source(),data=adaptAuthoritativeSeason(validateAuthoritativeSeason(raw,ctx(),manifest),ctx(),manifest);
 assert.equal(data.fixtures.length,240);assert.equal(data.statistics.standings.length,16);
 assert.equal(data.statistics.players.length,0);assert.equal(data.statistics.teams.length,16);
 assert.equal(typeof data.fixtures[0].homeId,'number');assert.equal(data.fixtures[0].kickoff,null);
 assert.equal(data.provenance.kind,'authoritative');assert.equal(data.currentMatchday,1);
 assert.ok(Object.isFrozen(data));
});
test('published recent form keeps newest-first verified fixture metadata',()=>{
 const raw=source(),id=raw.data.participants[0];
 const matches=raw.data.fixtures.filter(f=>f.phaseId==='league'&&f.round<=3&&[f.homeClubId,f.awayClubId].includes(id))
  .sort((a,b)=>a.round-b.round).slice(0,3);
 assert.equal(matches.length,3);
 raw.world={...world,day:15};
 for(const [i,f] of matches.entries()){
  const home=f.homeClubId===id,own=i===0?2:i===1?1:0,opponent=i===0?0:i===1?1:2;
  f.result={homeGoals:home?own:opponent,awayGoals:home?opponent:own,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:i===1?null:i===0?id:home?f.awayClubId:f.homeClubId};
 }
 const data=adaptAuthoritativeSeason(raw,ctx(),manifest);
 const row=data.statistics.standings.find(item=>item.club.countryId+'-'+item.club.clubId===id);
 assert.deepEqual(row.recent.map(item=>item.result),['L','D','W']);
 assert.deepEqual(row.recent.map(item=>item.round),[3,2,1]);
 assert.ok(row.recent.every(item=>Number.isInteger(item.homeId)&&Number.isInteger(item.awayId)&&item.homeId!==item.awayId));
 assert.ok(row.recent.every(item=>!Object.hasOwn(item,'homeGoals')&&!Object.hasOwn(item,'awayGoals')));
 assert.equal(data.statistics.teams.length,16,'team leaderboards preserve chronological form');
 assert.deepEqual(adaptAuthoritativeSeason(source(),ctx(),manifest).statistics.standings[0].recent,[]);
});

test('rejects future scores, wrong rules, standings totals, identities and fabricated player statistics',()=>{
 const changes=[
  r=>{r.data.fixtures[0].result={homeGoals:0,awayGoals:0,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:null}},
  r=>{r.data.rulesVersion='unapproved-v99'},
  r=>{r.data.standings.rows[0].points=3},
  r=>{r.data.participants[0]='FR-40'},
  r=>{r.data.statistics.players=[{playerId:1,clubId:'IT-1',appearances:1,starts:1,minutes:90,goals:1}]},
  r=>{r.data.calendar[0].fixtureIds=['unknown']},
 ];
 for(const change of changes){const raw=source();change(raw);assert.throws(()=>validateAuthoritativeSeason(raw,ctx(),manifest));}
});
test('does not commit when the selected season changes while awaiting sporting data',async()=>{
 let context=ctx(),release;const delayed=new Promise(resolve=>{release=resolve});let commits=0;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{context={...context,revision:context.revision+1}},commit:()=>{commits++},isDev:()=>false,fetchJson:async path=>path==='/api/world'?{world}:delayed,manifest});
 const pending=loader.load();await Promise.resolve();await Promise.resolve();
 context={...context,selectedSeason:2,revision:context.revision+1};release(source());await pending;
 assert.equal(commits,0);
});

test('current-matchday shortcut follows the next canonical event and disappears after closure',()=>{
 const raw=source();raw.world={...world,day:13};
 // The adapter consumes validated source data; isolate shortcut selection from score validation.
 assert.equal(adaptAuthoritativeSeason(raw,ctx(),manifest).currentMatchday,2);
 raw.world={...world,day:56};assert.equal(adaptAuthoritativeSeason(raw,ctx(),manifest).currentMatchday,null);
 raw.world={...world,phase:'closed',day:56};assert.equal(adaptAuthoritativeSeason(raw,ctx(),manifest).currentMatchday,null);
});
test('accepts a Season2 promotion without reusing inaugural division membership',()=>{
 const raw=source(),mapping=new Map();raw.selectedSeason=2;raw.world={...world,seasonNumber:2};raw.data.season=2;raw.data.seasonState={day:1,phase:'active'};
 raw.provenance.sourceRef='world:'+world.generation+':season:2:'+'a'.repeat(64);
 raw.data.participants=raw.data.participants.map(id=>id==='IT-16'?'IT-17':id);
 for(const row of [...raw.data.standings.rows,...raw.data.statistics.teams])if(row.clubId==='IT-16')row.clubId='IT-17';
 for(const f of raw.data.fixtures){const old=f.id;if(f.homeClubId==='IT-16')f.homeClubId='IT-17';if(f.awayClubId==='IT-16')f.awayClubId='IT-17';f.id=`season:2:IT-1:${f.marker}:${f.homeClubId}:${f.awayClubId}`;mapping.set(old,f.id)}
 for(const day of raw.data.calendar)day.fixtureIds=day.fixtureIds.map(id=>mapping.get(id));
 const c={...ctx(),selectedSeason:2};const data=adaptAuthoritativeSeason(validateAuthoritativeSeason(raw,c,manifest),c,manifest);
 assert.ok(data.participants.some(c=>c.clubId===17));assert.equal(data.season,2);
});

test('viewed season state cannot disguise current-world time or unsealed historical data',()=>{
 const changes=[
  r=>{r.data.seasonState={day:2,phase:'active'}},
  r=>{r.world={...world,seasonNumber:2};r.data.seasonState={day:56,phase:'active'}},
  r=>{r.world={...world,seasonNumber:2};delete r.data.seasonState},
 ];
 for(const alter of changes){const raw=source();alter(raw);assert.throws(()=>validateAuthoritativeSeason(raw,ctx(),manifest));}
});
test('same-selection revalidation retains the coherent snapshot until replacement and clears on failure',async()=>{
 const old={world,season:1},context={...ctx(),seasonData:old};let clears=0,fail=false,seen;
 const loader=createAuthoritativeLoader({getContext:()=>context,clear:()=>{clears++;context.seasonData=null},commit:()=>true,isDev:()=>false,
  fetchJson:async path=>{seen=context.seasonData;if(fail)throw Error('offline');return path==='/api/world'?{world}:empty()},manifest});
 assert.equal(await loader.load(),true);assert.equal(seen,old);assert.equal(clears,0);
 fail=true;await loader.load();assert.equal(context.seasonData,null);assert.equal(clears,1);
});

test('CLUB-FIXTURES: selects only club games with stable canonical ordering and away perspective',async()=>{
 const {projectClubFixtures}=await import('../assets/club-fixtures-source.mjs');
 const f=(id,home,away,day,result=null)=>({id,competitionId:'IT-1',homeClubId:home,awayClubId:away,day,round:1,phaseId:'league',neutral:false,result});
 const games=[f('b','IT-2','IT-1',2,{homeGoals:1,awayGoals:2,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:'IT-1'}),f('a','IT-1','IT-3',2),f('z','IT-2','IT-3',1)];
 const rows=projectClubFixtures(games,'IT-1',1,2);
 assert.deepEqual(rows.map(x=>x.id),['a','b']);assert.equal(rows[1].opponentId,'IT-2');assert.equal(rows[1].venue,'away');assert.equal(rows[1].goalsFor,2);assert.equal(rows[1].goalsAgainst,1);
 assert.throws(()=>projectClubFixtures(games,'IT-1',1,1),/Future/);
});
test('CLUB-FIXTURES: Season 0 skips API; an unpublished club performs exactly one read',async()=>{
 const {readClubFixtures}=await import('../assets/club-fixtures-source.mjs');
 const unstarted={...world,revision:0,seasonNumber:0,phase:'unstarted',day:0};let calls=0;
 const zero=await readClubFixtures({clubKey:'IT-1',season:0,world:unstarted,fetchJson:async()=>{calls++},manifest});
 assert.equal(zero.coverage,'unstarted');assert.equal(calls,0);
 const provisional=await readClubFixtures({clubKey:'IT-1',season:1,world:unstarted,fetchJson:async()=>{calls++},manifest});
 assert.equal(provisional.coverage,'unstarted');assert.equal(provisional.season,1);assert.equal(calls,0,'Season 0 offers viewed Season 1 without inventing or fetching a season');
 const unpublished={schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',selectedSeason:1,world,
  status:'empty',reason:'calendar-unpublished',
  provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null};
 const paths=[];
 const result=await readClubFixtures({clubKey:'IT-1',season:1,world,manifest,fetchJson:async path=>{
  paths.push(path);
  if(path==='/api/clubs/IT-1/seasons/1/fixtures')return unpublished;
  throw Error('HTTP 404');
 }});
 assert.equal(result.coverage,'unpublished');
 assert.deepEqual(result.rows,[]);
 assert.deepEqual(paths,['/api/clubs/IT-1/seasons/1/fixtures'],
  'Unpublished club fixtures must never request per-competition APIs');
});

test('CLUB-FIXTURES: viewed Season 0 remains unstarted after world advancement',async()=>{
 const {readClubFixtures}=await import('../assets/club-fixtures-source.mjs');let reads=0;
 const result=await readClubFixtures({clubKey:'IT-1',season:0,world,manifest,fetchJson:async()=>{reads++}});
 assert.equal(result.coverage,'unstarted');assert.equal(reads,0);
});
test('CLUB-FIXTURES: neutral final and extra-time/shootout retain club perspective',async()=>{
 const {projectClubFixtures}=await import('../assets/club-fixtures-source.mjs');
 const fixture={id:'final',competitionId:'int-1',homeClubId:'ENG-2',awayClubId:'IT-1',day:54,round:13,phaseId:'final',neutral:true,
  result:{homeGoals:2,awayGoals:2,resolution:'penalties',extraTime:{home:1,away:1},penalties:{home:4,away:5},winnerClubId:'IT-1'}};
 const [row]=projectClubFixtures([fixture],'IT-1',1,54);
 assert.equal(row.venue,'neutral');assert.equal(row.goalsFor,2);assert.equal(row.goalsAgainst,2);assert.deepEqual(row.penalties,{for:5,against:4});
});

test('PERF-API-657 returning to a previously loaded season reuses its exact-world verified snapshot',()=>{
 const cache=createCompetitionSeasonReadCache({limit:3});
 const currentWorld={...world,seasonNumber:2,revision:19,day:15};
 const snapshot={source:'authoritative',worldStatus:'ready',sourceRevision:3,world:currentWorld};
 const one={season:1,world:currentWorld,provenance:{kind:'authoritative'},participants:['IT-1']};
 const two={season:2,world:currentWorld,provenance:{kind:'authoritative'},participants:['IT-2']};
 const key=season=>({competitionId:'IT-1',season,snapshot});
 assert.equal(cache.remember({...key(1),data:one}),true);
 assert.equal(cache.remember({...key(2),data:two}),true);
 assert.equal(cache.size(),2);
 one.participants.push('IT-3');
 assert.deepEqual(cache.find(key(1)).data.participants,['IT-1'],
  'cache is an immutable copy, not a reference to mutable live data');
 assert.ok(Object.isFrozen(cache.find(key(2)).data));
 assert.equal(cache.find(key(1)).data.season,1,'1→2→1 returns cached Season 1 without network');
 assert.equal(cache.find(key(2)).data.season,2,'both seasons remain reusable');
 assert.equal(cache.find({...key(1),snapshot:{...snapshot,world:{...currentWorld,revision:20}}}),null,
  'world progress invalidates previous snapshots');
 assert.equal(cache.find({...key(1),snapshot:{...snapshot,world:{...currentWorld,generation:'12345678-1234-4123-8123-123456789abc'}}}),null,
  'reset generation invalidates previous snapshots');
 assert.equal(cache.find({...key(1),snapshot:{...snapshot,sourceRevision:4}}),null,
  'source rotation invalidates previous snapshots');
 assert.equal(cache.find({...key(1),snapshot:{...snapshot,source:'dev'}}),null,
  'protected DEV cannot use public sporting cache');
 assert.equal(cache.find({...key(1),snapshot:{...snapshot,worldStatus:'pending'}}),null,
  'no cache restores before authoritative world clock is ready');
 assert.equal(cache.remember({...key(1),data:{...one,world:{...currentWorld,revision:5}}}),false,
  'unverified world payload cannot enter cache');
 assert.equal(cache.remember({...key(1),data:{...one,provenance:{kind:'dev'}}}),false,
  'fictional data never enters public season cache');
});
test('PERF-API-657 confirmed empty seasons reuse the same world but failures do not cache',()=>{
 const cache=createCompetitionSeasonReadCache({limit:2});
 const currentWorld={...world,seasonNumber:2,revision:23,day:16};
 const snapshot={source:'authoritative',worldStatus:'ready',sourceRevision:0,world:currentWorld};
 const key=(season)=>({competitionId:'int-1',season,snapshot});
 assert.equal(cache.find(key(1)),null);
 assert.equal(cache.remember({...key(1),data:null}),true);
 assert.deepEqual(cache.find(key(1)),{data:null},
  'verified empty is distinct from a failed/missing request');
 assert.equal(cache.remember({...key(2),data:{season:2,world:currentWorld,provenance:{kind:'authoritative'}}}),true);
 assert.equal(cache.size(),2);
 assert.equal(cache.remember({...key(1),data:{season:1,world:currentWorld,provenance:{kind:'authoritative'}}}),true);
 cache.clear();assert.equal(cache.size(),0);assert.equal(cache.find(key(1)),null);
});
test('PERF-API-657 competition controller restores cached season before starting the API loader',()=>{
 const page=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 assert.match(page,/createCompetitionSeasonReadCache/);
 assert.match(page,/if\(cached\)\{[\s\S]*?loader\.cancel\(\);[\s\S]*?acceptSeasonData\(cached\.data,c\.revision,true\)/);
 assert.match(page,/lastSuccessfulRead=worldReadKey\(window\.faCompetitionContext,snapshot\)/);
 assert.match(page,/seasonReadCache\.clear\(\)/,'DEV source toggles must invalidate the season cache');
});
