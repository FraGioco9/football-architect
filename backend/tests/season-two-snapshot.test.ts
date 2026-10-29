import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSeasonTwoSnapshot} from '../src/season-two-snapshot.ts';
import type {NextSeasonMembership} from '../src/next-season-membership.ts';
import type {HolderReview} from '../src/international-holder-review.ts';
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const candidate:NextSeasonMembership={season:2,status:'provisional-results-derived',bindings:[
 ...countries.flatMap(c=>[{competitionId:c+'-1',clubIds:Array.from({length:16},(_,i)=>c+'-'+(i+1))},{competitionId:c+'-2',clubIds:Array.from({length:16},(_,i)=>c+'-'+(i+17))}]),
 {competitionId:'int-1',clubIds:countries.flatMap(c=>[1,2,3].map(n=>c+'-'+n))},
 {competitionId:'int-2',clubIds:countries.flatMap(c=>[4,5,6].map(n=>c+'-'+n))}
]};
const holders:HolderReview[]=[
 {competitionId:'int-1',championClubId:'IT-4',countryId:'IT',allocatedCup:'int-2',requiresQualificationPolicyDecision:true},
 {competitionId:'int-2',championClubId:'BR-7',countryId:'BR',allocatedCup:null,requiresQualificationPolicyDecision:true}
];
test('builds identical full 18-competition snapshot with holder slots and deterministic digest',async()=>{
 const a=await buildSeasonTwoSnapshot('a'.repeat(64),candidate,holders);
 const b=await buildSeasonTwoSnapshot('a'.repeat(64),candidate,holders);
 assert.deepEqual(a,b);assert.equal(a.bindings.length,18);assert.match(a.snapshotHash,/^[a-f0-9]{64}$/);
 assert.equal(a.readyForActivation,false);
 assert.ok(a.bindings.find(x=>x.competitionId==='int-1')!.clubIds.includes('IT-4'));
 assert.ok(a.bindings.find(x=>x.competitionId==='int-2')!.clubIds.includes('BR-7'));
 for(const country of countries)for(const cup of ['int-1','int-2'])
  assert.equal(a.bindings.find(x=>x.competitionId===cup)!.clubIds.filter(id=>id.startsWith(country+'-')).length,3);
});
test('refuses missing domestic membership and archive binding',async()=>{
 await assert.rejects(buildSeasonTwoSnapshot('wrong',candidate,holders));
 await assert.rejects(buildSeasonTwoSnapshot('a'.repeat(64),{...candidate,bindings:candidate.bindings.slice(1)},holders));
});
