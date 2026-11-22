import test from 'node:test';
import assert from 'node:assert/strict';
import {projectWorldHistoryChampions,readPublicWorldHistory} from '../src/public-world-history.ts';
import type {Database} from '../src/database.ts';

const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
function sealed(season=1){
 return {schemaVersion:1,sourceSeason:season,
  divisions:countries.flatMap(country=>[1,2].map(tier=>({
   competitionId:country+'-'+tier,
   table:Array.from({length:16},(_,i)=>({clubId:country+'-'+(i+1+(tier-1)*16)}))
  }))),
  cupWinners:[{competitionId:'int-1',championClubId:'IT-1'},
   {competitionId:'int-2',championClubId:'ENG-3'}],
  qualificationCandidate:{private:true},holderReview:{private:true},
  playerStatistics:{private:true}};
}
test('#581 projects exactly 18 verified champions and no internal archive fields',()=>{
 const rows=projectWorldHistoryChampions(sealed(),1);
 assert.equal(rows.length,18);
 assert.deepEqual(rows[0],{competitionId:'IT-1',championClubId:'IT-1'});
 assert.deepEqual(rows[1],{competitionId:'IT-2',championClubId:'IT-17'});
 assert.deepEqual(rows[16],{competitionId:'int-1',championClubId:'IT-1'});
 assert.deepEqual(rows[17],{competitionId:'int-2',championClubId:'ENG-3'});
 assert.doesNotMatch(JSON.stringify(rows),/qualificationCandidate|holderReview|private|playerStatistics/);
});
test('#581 refuses missing, duplicated, forged and cross-country championship records',()=>{
 const cases:any[]=[
  null,
  {...sealed(),sourceSeason:2},
  {...sealed(),divisions:sealed().divisions.slice(1)},
  {...sealed(),cupWinners:[sealed().cupWinners[0],sealed().cupWinners[0]]},
  {...sealed(),cupWinners:[{competitionId:'int-1',championClubId:'IT-41'},sealed().cupWinners[1]]},
  {...sealed(),divisions:sealed().divisions.map((d,i)=>i===0?{...d,table:[{clubId:'ENG-1'},...d.table.slice(1)]}:d)},
  {...sealed(),divisions:sealed().divisions.map((d,i)=>i===0?{...d,table:[d.table[0],...d.table.slice(1,15),d.table[0]]}:d)}
 ];
 for(const value of cases)assert.throws(()=>projectWorldHistoryChampions(value,1),/archive_invalid|archive/i);
});


test('#581 unstarted and first active season return verified empty history, not HTTP 503',async()=>{
 const generation='12345678-1234-4234-9234-123456789012';
 const cases=[
  {seasonNumber:0,day:0,phase:'unstarted'},
  {seasonNumber:1,day:0,phase:'preparing'},
  {seasonNumber:1,day:1,phase:'active'},
  {seasonNumber:1,day:56,phase:'active'}
 ];
 for(const input of cases){
  let reads=0;
  const db={prepare(sql:string){
   assert.match(sql,/FROM world_state/,'no archive tables before first season closure');
   return {first:async()=>{
    reads++;return {schema_version:1,generation,revision:3,season_number:input.seasonNumber,day:input.day,phase:input.phase};
   }};
  }} as unknown as Database;
  const history=await readPublicWorldHistory(db);
  assert.equal(reads,2,'single world read with an exact-world consistency check');
  assert.deepEqual(history.seasons,[]);
  assert.equal(history.status,'empty');
  assert.equal(history.world.seasonNumber,input.seasonNumber);
  assert.equal(history.world.phase,input.phase);
  assert.deepEqual(history.provenance,{kind:'authoritative',source:'closed-season-archive'});
 }
});
