import {describe,it,expect} from 'vitest';
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
describe('#581 minimal verified world championship projection',()=>{
 it('derives exactly 18 champions and never exposes sensitive archive fields',()=>{
  const rows=projectWorldHistoryChampions(sealed(),1);
  expect(rows).toHaveLength(18);
  expect(rows[0]).toEqual({competitionId:'IT-1',championClubId:'IT-1'});
  expect(rows[1]).toEqual({competitionId:'IT-2',championClubId:'IT-17'});
  expect(rows[16]).toEqual({competitionId:'int-1',championClubId:'IT-1'});
  expect(rows[17]).toEqual({competitionId:'int-2',championClubId:'ENG-3'});
  expect(JSON.stringify(rows)).not.toMatch(/qualificationCandidate|holderReview|private|playerStatistics/);
 });
 it('rejects missing, duplicated, forged and cross-country records',()=>{
  const cases:any[]=[
   null,
   {...sealed(),sourceSeason:2},
   {...sealed(),divisions:sealed().divisions.slice(1)},
   {...sealed(),cupWinners:[sealed().cupWinners[0],sealed().cupWinners[0]]},
   {...sealed(),cupWinners:[{competitionId:'int-1',championClubId:'IT-41'},sealed().cupWinners[1]]},
   {...sealed(),divisions:sealed().divisions.map((d,i)=>i===0?{...d,table:[{clubId:'ENG-1'},...d.table.slice(1)]}:d)},
   {...sealed(),divisions:sealed().divisions.map((d,i)=>i===0?{...d,table:[d.table[0],...d.table.slice(1,15),d.table[0]]}:d)}
  ];
  for(const value of cases)expect(()=>projectWorldHistoryChampions(value,1)).toThrow();
 });
});
