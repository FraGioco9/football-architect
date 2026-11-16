import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLineupDayEvidenceV2,verifyLineupDayEvidenceV2,LINEUP_DAY_VERSION}
 from '../backend/src/lineup-day-evidence-v2.mjs';
import {simulateMatchV1} from '../backend/src/temporary-lineup-v1.mjs';
import {buildCandidateMatchReceiptV1} from '../backend/src/temporary-lineup-v1.mjs';

const gen='11111111-1111-4111-8111-111111111111';
const calendar='a'.repeat(64);
const match=(fixtureId,matchId)=>({fixtureId,matchId,season:1,day:13,generation:gen,
 competitionId:'IT-1',homeClubId:'IT-1',awayClubId:'IT-2',sourceHash:'b'.repeat(64)});
const makeFixture=(n=1)=>match('season:1:IT-1:N0'+n+':IT-1:IT-2',n);
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))]
 .map(b=>b.toString(16).padStart(2,'0')).join('');
async function entry(fixture){
 const result=await simulateMatchV1({homeRoster:[],awayRoster:[],matchKey:fixture.fixtureId,
  seed:'lineup-evidence-test-seed',homeClubId:fixture.homeClubId,
  awayClubId:fixture.awayClubId,context:{mode:'regulation'}});
 const candidate=await buildCandidateMatchReceiptV1(fixture,result);
 const receipt={schemaVersion:1,authority:'official',algorithmVersion:LINEUP_DAY_VERSION,
  rosterSourceDigest:'c'.repeat(64),sourceCandidateDigest:candidate.receiptDigest,
  fixture:candidate.fixture,result:candidate.result};
 return {fixtureId:fixture.fixtureId,receipt,receiptHash:await hash(JSON.stringify(receipt))};
}
const input=(dueFixtures,receipts)=>({
 generation:gen,season:1,day:13,calendarHash:calendar,dueFixtures,receipts});
test('one format for empty day and for fallback against fallback',async()=>{
 const empty=await buildLineupDayEvidenceV2(input([],[]));
 assert.deepEqual(empty.payload.results,[]);
 assert.equal(empty.payload.schemaVersion,2);
 assert.equal(empty.payload.simulationVersion,LINEUP_DAY_VERSION);
 assert.deepEqual(await verifyLineupDayEvidenceV2({payload:empty.payload,hash:empty.hash,
  dueFixtures:[],receipts:[]}),empty);
 const one=makeFixture();
 const evidence=await buildLineupDayEvidenceV2(input([one],[await entry(one)]));
 assert.equal(evidence.payload.results.length,1);
 assert.equal(evidence.payload.results[0].fixtureId,one.fixtureId);
 assert.equal(evidence.payload.results[0].matchId,one.matchId);
 assert.equal(evidence.payload.results[0].receiptHash.length,64);
 assert.deepEqual(await verifyLineupDayEvidenceV2({payload:evidence.payload,hash:evidence.hash,
  dueFixtures:[one],receipts:[await entry(one)]}),evidence);
});
test('receipt row ordering does not affect the day hash',async()=>{
 const a=makeFixture(1),b=makeFixture(2);
 const ea=await entry(a),eb=await entry(b);
 const one=await buildLineupDayEvidenceV2(input([a,b],[ea,eb]));
 const two=await buildLineupDayEvidenceV2(input([b,a],[eb,ea]));
 assert.deepEqual(one,two);
});
test('refuse missing, duplicate, untrusted, mismatched, or forged receipts',async()=>{
 const a=makeFixture(),e=await entry(a);
 await assert.rejects(()=>buildLineupDayEvidenceV2(input([a],[])),/count/);
 await assert.rejects(()=>buildLineupDayEvidenceV2(input([a,a],[e,e])),/duplicate/);
 await assert.rejects(()=>buildLineupDayEvidenceV2(input([a],[{...e,receiptHash:'f'.repeat(64)}])),/fingerprint/);
 await assert.rejects(()=>buildLineupDayEvidenceV2(input([a],[{...e,fixtureId:'season:1:IT-1:N09:IT-1:IT-2'}])),/unexpected/);
 const altered={...e,receipt:{...e.receipt,fixture:{...e.receipt.fixture,matchId:99}}};
 altered.receiptHash=await hash(JSON.stringify(altered.receipt));
 await assert.rejects(()=>buildLineupDayEvidenceV2(input([a],[altered])),/provenance/);
 const valid=await buildLineupDayEvidenceV2(input([a],[e]));
 await assert.rejects(()=>verifyLineupDayEvidenceV2({payload:{...valid.payload,day:14},hash:valid.hash,dueFixtures:[a],receipts:[e]}),/provenance/);
 await assert.rejects(()=>verifyLineupDayEvidenceV2({payload:{...valid.payload,results:[]},
  hash:valid.hash,dueFixtures:[a],receipts:[e]}),/stored/);
});
test('no player identities or recreated goals for two teams with insufficient lineups',async()=>{
 const f=makeFixture(4),e=await entry(f);
 const row=(await buildLineupDayEvidenceV2(input([f],[e]))).payload.results[0];
 assert.equal(e.receipt.result.mode,'fallback_vs_fallback');
 assert.equal(e.receipt.result.home.appearances.length,0);
 assert.equal(e.receipt.result.away.appearances.length,0);
 assert.equal(e.receipt.result.home.unattributedGoals,row.homeGoals);
 assert.equal(e.receipt.result.away.unattributedGoals,row.awayGoals);
});
