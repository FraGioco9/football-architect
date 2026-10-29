import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeHolderAllocation} from '../src/international-holder-allocation-proposal.ts';
import type {NextSeasonMembership} from '../src/next-season-membership.ts';
import type {HolderReview} from '../src/international-holder-review.ts';
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const candidate:NextSeasonMembership={season:2,status:'provisional-results-derived',bindings:[
 {competitionId:'int-1',clubIds:countries.flatMap(c=>[1,2,3].map(n=>c+'-'+n))},
 {competitionId:'int-2',clubIds:countries.flatMap(c=>[4,5,6].map(n=>c+'-'+n))}
]};
const holder=(cup:'int-1'|'int-2',championClubId:string):HolderReview=>({
 competitionId:cup,championClubId,countryId:championClubId.split('-')[0],
 allocatedCup:candidate.bindings.find(x=>x.competitionId==='int-1')!.clubIds.includes(championClubId)?'int-1':candidate.bindings[1].clubIds.includes(championClubId)?'int-2':null,
 requiresQualificationPolicyDecision:true
});
test('provisional holder plan swaps cross-cup champion without changing national quotas',()=>{
 const result=proposeHolderAllocation(candidate,[holder('int-1','IT-4'),holder('int-2','BR-7')]);
 const a=result.bindings[0].clubIds,b=result.bindings[1].clubIds;
 assert.ok(a.includes('IT-4'));assert.ok(b.includes('IT-3'));assert.ok(b.includes('BR-7'));
 assert.equal(new Set([...a,...b]).size,48);
 for(const c of countries)for(const cup of result.bindings)assert.equal(cup.clubIds.filter(x=>x.startsWith(c+'-')).length,3);
 assert.equal(result.readyForActivation,false);
 assert.equal(result.status,'approved-holder-policy-applied');
});
test('aligned holders cause no changes and do not confer approval',()=>{
 const result=proposeHolderAllocation(candidate,[holder('int-1','IT-1'),holder('int-2','BR-4')]);
 assert.deepEqual(result.bindings.map(x=>x.clubIds),candidate.bindings.map(x=>x.clubIds));
 assert.ok(result.moves.every(m=>m.removedClubId===null));assert.equal(result.readyForActivation,false);
});
test('invalid duplicate champions and wrong quotas cannot generate a plan',()=>{
 assert.throws(()=>proposeHolderAllocation(candidate,[holder('int-1','IT-4'),holder('int-2','IT-4')]));
 assert.throws(()=>proposeHolderAllocation({...candidate,bindings:[{competitionId:'int-1',clubIds:[]},candidate.bindings[1]]},[holder('int-1','IT-1'),holder('int-2','IT-4')]));
});

test('both cup winners are preserved when their initial cups are reversed',()=>{
 const result=proposeHolderAllocation(candidate,[holder('int-1','IT-4'),holder('int-2','IT-1')]);
 assert.ok(result.bindings[0].clubIds.includes('IT-4'));
 assert.ok(result.bindings[1].clubIds.includes('IT-1'));
 assert.equal(new Set(result.bindings.flatMap(b=>b.clubIds)).size,48);
 assert.ok(result.bindings.every(b=>b.clubIds.filter(id=>id.startsWith('IT-')).length===3));
});
