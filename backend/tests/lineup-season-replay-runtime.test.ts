import {describe,it,expect} from 'vitest';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {buildInitialSchedule} from '../src/initial-schedule.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {assignLeagueMatchSlots} from '../src/domain/calendar/match-slot-identity.ts';
import {simulateMatchV1,buildCandidateMatchReceiptV1} from '../src/temporary-lineup-v1.mjs';
import {buildLineupDayEvidenceV2} from '../src/lineup-day-evidence-v2.mjs';
import {replayLineupSeasonV1,verifyFrozenLineupMatchV1} from '../src/lineup-season-replay.ts';
import type {WorldV1} from '../src/types.ts';

const generation='11111111-1111-4111-8111-111111111111';
const seed='lineup-read-replay-synthetic-seed-0001';
const sourceHash='a'.repeat(64);
const sha256=async(text:string)=>[...new Uint8Array(
 await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))
)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function season(){
 const snapshot=await loadApprovedSnapshot(),schedule=await buildInitialSchedule(snapshot,seed);
 const calendarHash=await canonicalHash(schedule);
 const firstDay=Math.min(...schedule.fixtures.map(f=>f.day));
 const evidence={snapshot,schedule,season:{generation},
  calendar:{calendar_hash:calendarHash}} as any;
 return {snapshot,schedule,calendarHash,firstDay,evidence};
}
function world(day:number):WorldV1{
 return {schemaVersion:1,generation,seasonNumber:1,revision:17,phase:day?'active':'preparing',day};
}
function fakeDB(days:unknown[],count:number,ties:unknown[]=[]){
 const calls:string[]=[];
 return {
  calls,
  prepare(sql:string){
   const stmt={sql,values:[] as unknown[],bind(...args:unknown[]){this.values=args;return this},
    async first(){
     if(sql.startsWith('SELECT COUNT(*) AS n FROM match_lineup_result_receipts'))
      return {n:count};
     throw new Error('Unexpected first: '+sql);
    },
    async all(){
     if(sql.includes('FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day'))return {results:days};
     if(sql.includes('FROM match_lineup_result_receipts r'))return {results:[]};
     if(sql.includes('FROM season_knockout_ties WHERE season_number=?'))return {results:ties};
     throw new Error('Unexpected all: '+sql);
    }};
   calls.push(sql);return stmt;
  }
 } as any;
}
describe('#613 single-V2 result replay and historical match proofs',()=>{
 it('replays the canonical empty-day prefix with no roster read or new score calculation',async()=>{
  const {evidence,calendarHash,firstDay}=await season();
  // There are no scheduled league/knockout results before the first kickoff.
  const count=Math.min(2,Math.max(0,firstDay-1));
  const days=[];
  for(let day=1;day<=count;day++){
   const frozen=await buildLineupDayEvidenceV2({
    generation,season:1,day,calendarHash,dueFixtures:[],receipts:[]
   });
   days.push({day,generation,calendar_hash:calendarHash,
    simulation_version:'temporary-lineup-v1',outcome_hash:frozen.hash,
    outcome_json:JSON.stringify(frozen.payload)});
  }
  const db=fakeDB(days,0);
  const result=await replayLineupSeasonV1(db,world(count),evidence,count);
  expect(result.progression.lastDay).toBe(count);
  expect(result.progression.results.size).toBe(0);
  expect(result.days).toHaveLength(count);
  expect(db.calls.every((q:string)=>!q.startsWith('INSERT')&&!q.startsWith('UPDATE'))).toBe(true);
 },30000);
 it('fails closed for missing/extra day, wrong version, or an orphan future result',async()=>{
  const {evidence,calendarHash}=await season();
  const one=await buildLineupDayEvidenceV2({
   generation,season:1,day:1,calendarHash,dueFixtures:[],receipts:[]
  });
  const day={day:1,generation,calendar_hash:calendarHash,
   simulation_version:'temporary-lineup-v1',outcome_hash:one.hash,
   outcome_json:JSON.stringify(one.payload)};
  await expect(replayLineupSeasonV1(fakeDB([],0),world(1),evidence,1)).rejects.toMatchObject({status:422});
  await expect(replayLineupSeasonV1(fakeDB([{...day,simulation_version:'temporary-score-v1'}],0),
   world(1),evidence,1)).rejects.toMatchObject({status:422});
  await expect(replayLineupSeasonV1(fakeDB([day],1),world(1),evidence,1)).rejects.toMatchObject({status:422});
  await expect(replayLineupSeasonV1(fakeDB([day],0),world(0),evidence,1)).rejects.toMatchObject({status:422});
 },30000);
 it('proves a frozen published match, scorers and candidate digest without current roster',async()=>{
  const {schedule}=await season();
  const fixture=schedule.fixtures.find(f=>f.competitionId==='IT-1')!;
  const league=await assignLeagueMatchSlots(
   schedule.fixtures.filter(f=>f.competitionId==='IT-1'),generation,1);
  const published=league.find(s=>s.sourceFixtureId===fixture.id)!;
  const match={matchId:57,season:1,day:fixture.day,generation,competitionId:fixture.competitionId,
   fixtureId:fixture.id,homeClubId:fixture.homeClubId,
   awayClubId:fixture.awayClubId,sourceHash};
  const result=await simulateMatchV1({homeRoster:[],awayRoster:[],
   homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,
   matchKey:fixture.id,seed,context:{mode:'regulation'}});
  const candidate=await buildCandidateMatchReceiptV1(match,result);
  const receipt={schemaVersion:1,authority:'official',algorithmVersion:'temporary-lineup-v1',
   rosterSourceDigest:'b'.repeat(64),sourceCandidateDigest:candidate.receiptDigest,
   fixture:candidate.fixture,result:candidate.result};
  const json=JSON.stringify(receipt);
  const row={public_match_id:57,slot_match_id:published.matchId,
   generation,season_number:1,day:fixture.day,fixture_id:fixture.id,
   algorithm_version:'temporary-lineup-v1',receipt_hash:await sha256(json),
   receipt_json:json,published_id:57,published_slot_id:published.matchId,
   published_generation:generation,published_season:1,
   league_slot_id:published.matchId,league_slot_key:published.slotId,
   league_fixture_id:fixture.id,league_competition_id:fixture.competitionId,
   league_day:fixture.day,league_marker:fixture.marker,league_round:fixture.round,
   league_home:fixture.homeClubId,league_away:fixture.awayClubId,
   league_source_hash:sourceHash,
   knockout_slot_id:null} as any;
  const args=[fixture,{mode:'regulation'} as const,null,world(fixture.day),published.slotId] as const;
  const frozen=await verifyFrozenLineupMatchV1(row,...args);
  expect(frozen.matchId).toBe(57);
  expect(frozen.score.algorithmVersion).toBe('temporary-lineup-v1');
  expect(frozen.score.homeGoals).toBe(result.homeGoals);
  expect(frozen.receipt.result.mode).toBe('fallback_vs_fallback');
  // A client cannot replace the canonical published slot or the candidate proof.
  await expect(verifyFrozenLineupMatchV1({...row,league_slot_key:'round:1:match:77'},...args))
   .rejects.toMatchObject({status:422});
  const altered={...receipt,sourceCandidateDigest:'f'.repeat(64)};
  await expect(verifyFrozenLineupMatchV1({
   ...row,receipt_json:JSON.stringify(altered),receipt_hash:await sha256(JSON.stringify(altered))
  },...args)).rejects.toMatchObject({status:422});
  await expect(verifyFrozenLineupMatchV1({...row,league_home:'IT-40'},...args))
   .rejects.toMatchObject({status:422});
  await expect(verifyFrozenLineupMatchV1({...row,receipt_hash:'c'.repeat(64)},...args))
   .rejects.toMatchObject({status:422});
 },30000);
});
