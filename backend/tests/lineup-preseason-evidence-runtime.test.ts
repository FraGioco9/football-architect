import {describe,it,expect} from 'vitest';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {buildInitialSchedule} from '../src/initial-schedule.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {planEmptyLineupPreseasonV1} from '../src/lineup-preseason-evidence.ts';
import {verifyLineupDayEvidenceV2} from '../src/lineup-day-evidence-v2.mjs';

const generation='11111111-1111-4111-8111-111111111111';
const seed='lineup-preseason-empty-days-seed-0001';
const season=async()=>{
 const snapshot=await loadApprovedSnapshot();
 const schedule=await buildInitialSchedule(snapshot,seed);
 return {snapshot,schedule,calendarHash:await canonicalHash(schedule)};
};
describe('#613 V2-only calendar backfill with NO old or future scores',()=>{
 it('seals exactly 1–12 as immutable empty V2 day evidence',async()=>{
  const {snapshot,schedule,calendarHash}=await season();
  expect(Math.min(...schedule.fixtures.map(f=>f.day))).toBe(13);
  const rows=await planEmptyLineupPreseasonV1({
   snapshot,schedule,generation,throughDay:12,calendarHash
  });
  expect(rows.map(r=>r.day)).toEqual(Array.from({length:12},(_,i)=>i+1));
  for(const row of rows){
   expect(row.payload.schemaVersion).toBe(2);
   expect(row.payload.simulationVersion).toBe('temporary-lineup-v1');
   expect(row.payload.results).toEqual([]);
   expect(JSON.parse(row.json)).toEqual(row.payload);
   await expect(verifyLineupDayEvidenceV2({
    payload:row.payload,hash:row.hash,dueFixtures:[],receipts:[]
   })).resolves.toMatchObject({hash:row.hash});
  }
 },30000);
 it('rejects day 13, changed source hash, bogus generation and stale untrusted schedule',async()=>{
  const {snapshot,schedule,calendarHash}=await season();
  const input={snapshot,schedule,generation,calendarHash,throughDay:3};
  await expect(planEmptyLineupPreseasonV1({...input,throughDay:13}))
   .rejects.toMatchObject({status:422});
  await expect(planEmptyLineupPreseasonV1({...input,calendarHash:'f'.repeat(64)}))
   .rejects.toMatchObject({status:422});
  await expect(planEmptyLineupPreseasonV1({...input,generation:'invalid'}))
   .rejects.toMatchObject({status:422});
  await expect(planEmptyLineupPreseasonV1({...input,schedule:{...schedule}}))
   .rejects.toMatchObject({status:422});
 },30000);
});
