import test from 'node:test';
import assert from 'node:assert/strict';
import {projectWorldHistoryChampions} from '../src/public-world-history.ts';

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
