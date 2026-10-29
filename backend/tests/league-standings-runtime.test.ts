import {describe,it,expect} from 'vitest';
import {rankLeagueTable} from '../src/league-standings.ts';
import {buildInitialSchedule,type Fixture} from '../src/initial-schedule.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
const seed='standings-synthetic-seed-0001';
const clubs=['IT-1','IT-2','IT-3','IT-4'];
const fixture=(home:string,away:string,i:number):Fixture=>({id:'table-fixture-'+i,competitionId:'IT-1',homeClubId:home,awayClubId:away,day:i+1,round:i+1,marker:'N'+String(i+1).padStart(2,'0')});
const cases=[['IT-1','IT-2',0,1],['IT-2','IT-1',0,0],['IT-1','IT-3',2,1],['IT-3','IT-1',1,2],['IT-2','IT-3',3,0],['IT-3','IT-2',3,0],['IT-1','IT-4',2,2],['IT-4','IT-1',2,2],['IT-2','IT-4',0,0],['IT-4','IT-2',0,0],['IT-3','IT-4',2,0],['IT-4','IT-3',0,2]] as const;
const fixtures=cases.map((g,i)=>fixture(g[0],g[1],i));
const scores=new Map<string,{homeGoals:number;awayGoals:number}>(cases.map((g,i)=>[fixtures[i].id,{homeGoals:g[2],awayGoals:g[3]}]));
describe('canonical final league standings',()=>{
 it('reapplies H2H to the remaining subgroup before considering global goal difference/goals',async()=>{
  const table=await rankLeagueTable('IT-1',clubs,fixtures,scores,seed);
  expect(table.map(r=>r.clubId)).toEqual(['IT-2','IT-1','IT-3','IT-4']);
  expect(table.slice(0,3).map(r=>r.points)).toEqual([9,9,9]);
  expect(table.find(r=>r.clubId==='IT-3')!.goalDifference).toBeGreaterThan(table[0].goalDifference);
  expect(table[1].goalsFor).toBeGreaterThan(table[0].goalsFor);
  expect(table.map(r=>r.rank)).toEqual([1,2,3,4]);
 });
 it('uses seeded domestic draw only after equal sporting metrics and never request order',async()=>{
  const equal=new Map(fixtures.map(f=>[f.id,{homeGoals:0,awayGoals:0}]));
  const a=await rankLeagueTable('IT-1',clubs,fixtures,equal,seed),b=await rankLeagueTable('IT-1',[...clubs].reverse(),[...fixtures].reverse(),equal,seed);
  expect(a).toEqual(b);expect(a.every(r=>r.played===6&&r.points===6)).toBe(true);
  expect(a.map(r=>r.drawKey)).toEqual([...a.map(r=>r.drawKey)].sort());
 });
 it('computes INT24 opponent statistics and uses stable composite IDs for all-equal six-round tables',async()=>{
  const snapshot=await loadApprovedSnapshot(),schedule=await buildInitialSchedule(snapshot,seed),binding=snapshot.bindings.find(b=>b.competitionId==='int-1')!;
  const games=schedule.fixtures.filter(f=>f.competitionId==='int-1'),equal=new Map(games.map(f=>[f.id,{homeGoals:0,awayGoals:0}]));
  const table=await rankLeagueTable('int-1',binding.clubIds,games,equal,seed);
  expect(table.map(r=>r.clubId)).toEqual([...binding.clubIds].sort());
  expect(table.every(r=>r.played===6&&r.points===6&&r.opponentsPoints===36&&r.opponentsGoalDifference===0&&r.opponentsGoalsFor===0)).toBe(true);
 });
 it('rejects missing,duplicate,foreign,negative or incomplete score evidence',async()=>{
  const missing=new Map(scores);missing.delete(fixtures[0].id);
  await expect(rankLeagueTable('IT-1',clubs,fixtures,missing,seed)).rejects.toMatchObject({status:422});
  await expect(rankLeagueTable('IT-1',clubs,[...fixtures,fixtures[0]],scores,seed)).rejects.toMatchObject({status:422});
  await expect(rankLeagueTable('IT-1',clubs,fixtures.slice(1),scores,seed)).rejects.toMatchObject({status:422});
  await expect(rankLeagueTable('IT-1',clubs,[{...fixtures[0],awayClubId:'IT-40'},...fixtures.slice(1)],scores,seed)).rejects.toMatchObject({status:422});
  const wrong=new Map(scores);wrong.set(fixtures[0].id,{homeGoals:-1,awayGoals:0});await expect(rankLeagueTable('IT-1',clubs,fixtures,wrong,seed)).rejects.toMatchObject({status:422});
 });
});
