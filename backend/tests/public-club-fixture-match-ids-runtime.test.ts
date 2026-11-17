import assert from 'node:assert/strict';
import {test} from 'vitest';
import {withOfficialClubMatchIds} from '../src/public-club-fixture-match-ids.ts';
import type {Database} from '../src/database.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const leagueFixture={id:'season:1:IT-1:N01:IT-1:IT-2',competitionId:'IT-1',phaseId:'league',
 tieId:null,leg:null,marker:'N01',day:13,round:1,homeClubId:'IT-1',awayClubId:'IT-2'};
const finalFixture={id:'season:1:IT-1:N32:IT-1:IT-3',competitionId:'IT-1',phaseId:'playout',
 tieId:'tie13',leg:1,marker:'N32',day:53,round:32,homeClubId:'IT-1',awayClubId:'IT-3'};
const league={source_fixture_id:leagueFixture.id,competition_id:'IT-1',marker:'N01',
 scheduled_day:13,round_number:1,home_club_id:'IT-1',away_club_id:'IT-2',public_id:42};
const knockout={competition_id:'IT-1',phase_id:'playout',tie_id:'tie13',leg:1,marker:'N32',
 scheduled_day:53,round_number:null,public_id:43};

function fixtureDb(leagueRows:unknown[]=[],reservedRows:unknown[]=[]){
 const calls:{sql:string;params:unknown[]}[]=[];
 const db={prepare(sql:string){
  const statement=(params:unknown[])=>({
   bind(...values:unknown[]){return statement(values)},
   async all(){
    calls.push({sql,params});
    return {results:sql.includes('FROM season_knockout_match_slots')?reservedRows:leagueRows,meta:{changes:0}};
   },async first(){throw Error('Unexpected query')},
   async run(){throw Error('No writes permitted')}
  });
  return statement([]);
 },async batch(){throw Error('No writes permitted')}} as unknown as Database;
 return {db,calls};
}
const read=(db:Database,fixtures=[leagueFixture,finalFixture])=>
 withOfficialClubMatchIds(db,generation,1,'IT-1',['IT-1'],fixtures);

test('published IDs travel on the club response without public HTTP collection reads',async()=>{
 const {db,calls}=fixtureDb([league],[knockout]);
 const result=await read(db);
 assert.deepEqual(result.map(x=>x.matchId),['42','43']);
 assert.equal(calls.length,2);
 assert.match(calls[0].sql,/JOIN public_match_numbers/);
 assert.match(calls[1].sql,/JOIN public_match_numbers/);
 assert.deepEqual(calls[0].params,[generation,1,'IT-1','IT-1']);
 assert.deepEqual(calls[1].params,[generation,1,'IT-1']);
});

test('missing official mappings and unconfirmed knockout reservations never create IDs',async()=>{
 const {db}=fixtureDb([], [{...knockout,tie_id:'future'}]);
 const result=await read(db);
 assert.deepEqual(result.map(x=>x.matchId),[null,null]);
});

test('mismatched or duplicate persisted identities fail closed',async()=>{
 for(const bad of [
  {...league,public_id:0},{...league,public_id:9007199254740992},
  {...league,source_fixture_id:'season:1:IT-1:OTHER:IT-1:IT-2'},
  {...league,competition_id:'IT-2'}, {...league,home_club_id:'IT-3'},
  {...league,scheduled_day:14}
 ]){
  await assert.rejects(read(fixtureDb([bad]).db),/sporting_data_unavailable/);
 }
 await assert.rejects(read(fixtureDb([league,league]).db),/sporting_data_unavailable/);
 for(const bad of [{...knockout,marker:'N33'},{...knockout,round_number:31},
  {...knockout,public_id:42}]){
  await assert.rejects(read(fixtureDb([league],[bad]).db),/sporting_data_unavailable/);
 }
});
