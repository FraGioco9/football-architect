import test from 'node:test';
import assert from 'node:assert/strict';
import {clubHistorySeasons,closedClubHistorySeasons,projectClubCompetitionStats,projectClosedClubCompetition,projectClubOverviewStats,readClubHistory} from '../assets/club-history-source.mjs';

const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:20,seasonNumber:2,day:20,phase:'active'};
const membership=(season,id='IT-1',position=5,points=45)=>({
 competitionId:id,category:id.startsWith('int-')?'international':'domestic',season,
 position,points,cupStatus:id.startsWith('int-')?'quarterfinals':null,nextMatch:null
});
const overview=(season,clubKey='IT-17',memberships=[membership(season)])=>({
 schemaVersion:1,providerId:'authoritative-world',clubKey,selectedSeason:season,world,
 status:season===2?'partial':'available',reason:null,
 provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'club:'+world.generation+':season:'+season+':verified'},
 data:{season,memberships}
});
const stats={clubId:'IT-17',played:32,won:18,drawn:8,lost:6,goalsFor:59,goalsAgainst:31,goalDifference:28,cleanSheets:11};
const competition=(season,id='IT-1',team=stats)=>({
 schemaVersion:1,providerId:'authoritative-world',competitionId:id,selectedSeason:season,world,status:season===2?'partial':'available',reason:null,
 provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'world:'+world.generation+':season:'+season+':verified'},
 data:{season,seasonState:season===2?{day:20,phase:'active'}:{day:56,phase:'closed'},
  participants:['IT-17'],history:season===2?null:{season,archiveHash:'verified'},
  standings:{complete:season!==2,rows:[{clubId:'IT-17',rank:5,played:32,points:45}]},
  statistics:{teams:[team]},fixtures:[]}
});
const liveStats={clubId:'IT-17',played:1,won:1,drawn:0,lost:0,goalsFor:2,goalsAgainst:1,goalDifference:1,cleanSheets:0};
const liveMembership=membership(2,'IT-1',5,3);
const liveCompetition=()=>{
 const sample=competition(2,'IT-1',liveStats);
 sample.data.standings.rows=[{clubId:'IT-17',rank:5,played:1,points:3}];
 sample.data.fixtures=[
  {homeClubId:'IT-17',awayClubId:'IT-3',day:10,result:{homeGoals:2,awayGoals:1}},
  {homeClubId:'IT-17',awayClubId:'IT-4',day:30,result:null}
 ];
 return sample;
};
const pendingCurrent=()=>{
 const current=liveCompetition();
 current.data.standings.rows=[{clubId:'IT-17',rank:5,played:0,points:0}];
 current.data.statistics.teams=[{clubId:'IT-17',played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,cleanSheets:0}];
 current.data.fixtures=[{homeClubId:'IT-17',awayClubId:'IT-4',day:30,result:null}];
 return current;
};

test('CLUB-HISTORY-08: include current season, season zero and reject unsupported future seasons',()=>{
 assert.deepEqual(clubHistorySeasons({...world,seasonNumber:0,day:0,revision:0,phase:'unstarted'}),[]);
 assert.deepEqual(clubHistorySeasons({...world,seasonNumber:1,phase:'active'}),[1]);
 assert.deepEqual(clubHistorySeasons(world),[1,2]);
 assert.deepEqual(closedClubHistorySeasons({...world,phase:'closed',day:56}),[1,2]);
 assert.throws(()=>clubHistorySeasons({...world,seasonNumber:3}),/Unsupported authoritative/);
});

const compact={played:1,won:1,drawn:0,lost:0,goalsFor:2,goalsAgainst:1,goalDifference:1,cleanSheets:0};
const historyBatch=(overviews,at=world)=>({
 schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-17',world:at,
 status:'available',reason:null,
 provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',
  sourceRef:'club-history:'+at.generation+':revision:'+at.revision},
 data:{overviews}
});
test('CLUB-HISTORY-08: closed-season and active-season evidence cannot be confused',()=>{
 const old=membership(1),sealed=competition(1);
 assert.equal(projectClosedClubCompetition(sealed,'IT-17',old,1,world).played,32);
 for(const sample of [
  {...sealed,status:'partial'},
  {...sealed,selectedSeason:2},
  {...sealed,world:{...world,revision:21}},
  {...sealed,data:{...sealed.data,history:null}},
  {...sealed,data:{...sealed.data,seasonState:{day:20,phase:'active'}}},
  {...sealed,data:{...sealed.data,statistics:{teams:[{...stats,played:40}]}}},
  {...sealed,data:{...sealed.data,statistics:{teams:[{...stats,goalsFor:61}]}}},
  {...sealed,data:{...sealed.data,statistics:{teams:[{...stats,cleanSheets:33}]}}},
  {...sealed,data:{...sealed.data,statistics:{teams:[]}}},
  {...sealed,data:{...sealed.data,standings:{complete:true,rows:[{clubId:'IT-17',rank:4,played:32,points:45}]}}}
 ])assert.throws(()=>projectClubCompetitionStats(sample,'IT-17',old,1,world),/Unverified|Invalid verified/);
 const valid=liveCompetition();
 assert.equal(projectClubCompetitionStats(valid,'IT-17',liveMembership,2,world).played,1);
 for(const sample of [
  {...valid,status:'available'},
  {...valid,world:{...world,day:19}},
  {...valid,data:{...valid.data,history:{season:2}}},
  {...valid,data:{...valid.data,seasonState:{day:56,phase:'closed'}}},
  {...valid,data:{...valid.data,fixtures:[]}},
  {...valid,data:{...valid.data,fixtures:valid.data.fixtures.map(f=>({...f,day:30,result:{homeGoals:2,awayGoals:1}}))}},
  {...valid,data:{...valid.data,statistics:{teams:[{...liveStats,won:0,drawn:1}]}}}
 ])assert.throws(()=>projectClubCompetitionStats(sample,'IT-17',liveMembership,2,world),/Unverified|Invalid|Future|disagree/);
});

test('CLUB-HISTORY: ongoing and archived seasons use one verified aggregate read',async()=>{
 const previous=overview(1,'IT-17',[{...membership(1),stats:{
  played:32,won:18,drawn:8,lost:6,goalsFor:59,goalsAgainst:31,goalDifference:28,cleanSheets:11
 }}]);
 const current=overview(2,'IT-17',[{...liveMembership,stats:compact}]);
 const paths=[];
 const result=await readClubHistory({clubKey:'IT-17',world,fetchJson:async path=>{
  paths.push(path);return historyBatch([previous,current]);
 }});
 assert.deepEqual(paths,['/api/clubs/IT-17/history']);
 assert.equal(result.coverage,'complete');
 assert.deepEqual(result.seasons.map(s=>[s.season,s.ongoing,s.memberships.length]),[[1,false,1],[2,true,1]]);
 assert.equal(result.seasons[1].memberships[0].stats.played,1);
 assert.ok(Object.isFrozen(result.seasons[1].memberships[0].stats));
});

test('CLUB-HISTORY: unpublished, zero-game and Season 0 states stay distinct',async()=>{
 const one={...world,seasonNumber:1,revision:20,day:0,phase:'preparing'};
 const unpublished={...overview(1,'IT-17'),world:one,status:'empty',reason:'calendar-unpublished',
  provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null};
 const result=await readClubHistory({clubKey:'IT-17',world:one,
  fetchJson:async()=>historyBatch([unpublished],one)});
 assert.equal(result.coverage,'empty');
 assert.equal(result.seasons[0].ongoing,true);
 assert.deepEqual(result.seasons[0].memberships,[]);
 const before={...one,seasonNumber:0,revision:0,phase:'unstarted'};
 let calls=0;
 const zero=await readClubHistory({clubKey:'IT-17',world:before,fetchJson:async()=>{calls++;throw Error('not expected')}});
 assert.equal(calls,0);
 assert.deepEqual(zero.seasons,[]);
});

test('CLUB-HISTORY: missing aggregate never calls the retired per-season endpoint',async()=>{
 const paths=[];
 await assert.rejects(readClubHistory({clubKey:'IT-17',world,fetchJson:async path=>{
  paths.push(path);throw Object.assign(Error('not_found'),{status:404});
 }}),/not_found/);
 assert.deepEqual(paths,['/api/clubs/IT-17/history']);
 let calls=0;
 await assert.rejects(readClubHistory({clubKey:'IT-17',world,fetchJson:async()=>{
  calls++;throw Object.assign(Error('backend unavailable'),{status:503});
 }}),/backend unavailable/);
 assert.equal(calls,1);
});

test('CLUB-HISTORY: malformed embedded statistics fail closed without extra requests',async()=>{
 const tampered=overview(2,'IT-17',[{...liveMembership,stats:{...compact,won:2}}]);
 const previous=overview(1,'IT-17',[]);
 let requests=0;
 await assert.rejects(readClubHistory({clubKey:'IT-17',world,fetchJson:async()=>{
  requests++;return historyBatch([previous,tampered]);
 }}),/Invalid verified compact match totals/);
 assert.equal(requests,1);
});

test('CLUB-API-03: single aggregate Club History GET returns every verified season',async()=>{
 const compact={played:32,won:18,drawn:8,lost:6,goalsFor:59,goalsAgainst:31,goalDifference:28,cleanSheets:11};
 const summary1=overview(1,'IT-17',[{...membership(1),stats:compact},{...membership(1,'int-1'),stats:compact}]);
 const summary2=overview(2,'IT-17',[{...liveMembership,stats:{
  played:1,won:1,drawn:0,lost:0,goalsFor:2,goalsAgainst:1,goalDifference:1,cleanSheets:0
 }}]);
 const batch={
  schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-17',world,
  status:'available',reason:null,
  provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',
   sourceRef:'club-history:'+world.generation+':revision:'+world.revision},
  data:{overviews:[summary1,summary2]}
 };
 const paths=[];
 const loaded=await readClubHistory({clubKey:'IT-17',world,fetchJson:async path=>{
  paths.push(path);
  if(path==='/api/clubs/IT-17/history')return batch;
  throw Error('Illegal extra HTTP request '+path);
 }});
 assert.deepEqual(paths,['/api/clubs/IT-17/history']);
 assert.equal(loaded.coverage,'complete');
 assert.deepEqual(loaded.seasons.map(s=>[s.season,s.ongoing,s.memberships.length]),[[1,false,2],[2,true,1]]);
 assert.equal(loaded.seasons[0].memberships[1].stats.played,32);
 assert.equal(loaded.seasons[1].memberships[0].stats.played,1);
 assert.ok(Object.isFrozen(loaded.seasons[1].memberships[0].stats));

 for(const changed of [
  {...batch,world:{...world,day:21}},
  {...batch,clubKey:'IT-18'},
  {...batch,provenance:{...batch.provenance,kind:'none'}},
  {...batch,data:{overviews:[summary2,summary1]}},
  {...batch,data:{overviews:[summary1]}},
  {...batch,data:{overviews:[summary1,{...summary2,data:{...summary2.data,
   memberships:[liveMembership]}}]}}
 ]){
  const seen=[];
  await assert.rejects(()=>readClubHistory({clubKey:'IT-17',world,fetchJson:async path=>{
   seen.push(path);return changed;
  }}),/Unverified|Incomplete|Invalid/);
  assert.deepEqual(seen,['/api/clubs/IT-17/history'],'invalid aggregate cannot trigger competition fan-out');
 }
});

