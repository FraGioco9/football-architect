import assert from 'node:assert/strict';
import test from 'node:test';
import {reviewInternationalHolders} from '../src/international-holder-review.ts';
import type {Progression} from '../src/knockout-progression.ts';
import type {NextSeasonMembership} from '../src/next-season-membership.ts';
const candidate:NextSeasonMembership={season:2,status:'provisional-results-derived',bindings:[
 {competitionId:'int-1',clubIds:['IT-1','IT-2','IT-3',...Array.from({length:21},(_,i)=>'ENG-'+(i+1))]},
 {competitionId:'int-2',clubIds:['IT-4','IT-5','IT-6',...Array.from({length:21},(_,i)=>'FR-'+(i+1))]}
]};
function state(a:string,b:string):Progression {
 const tie=(cup:string,clubId:string)=>({fixtures:[{fixture:{id:cup+':final',homeClubId:clubId,awayClubId:'BR-30'}}]});
 return {lastDay:56,results:new Map<string,{winnerClubId:string}>([['int-1:final',{winnerClubId:a}],['int-2:final',{winnerClubId:b}],...Array.from({length:4080},(_,i):[string,{winnerClubId:string}]=>['played:'+i,{winnerClubId:'BR-30'}])]),
 ties:new Map<string,ReturnType<typeof tie>>([['int-1:final:final',tie('int-1',a)],['int-2:final:final',tie('int-2',b)],...Array.from({length:52},(_,i):[string,ReturnType<typeof tie>]=>['other:'+i,tie('int-1',a)])]),
 } as unknown as Progression;
}
test('holders already allocated to their own cup require no displacement decision',()=>{
 const rows=reviewInternationalHolders(state('IT-1','IT-4'),candidate);
 assert.equal(rows.length,2);
 assert.ok(rows.every(x=>!x.requiresQualificationPolicyDecision));
});
test('holder in wrong tier or outside both lists remains a visible qualification blocker',()=>{
 const rows=reviewInternationalHolders(state('IT-4','BR-30'),candidate);
 assert.equal(rows[0].allocatedCup,'int-2');
 assert.equal(rows[1].allocatedCup,null);
 assert.ok(rows.every(x=>x.requiresQualificationPolicyDecision));
});
test('rejects partial final evidence',()=>{
 assert.throws(()=>reviewInternationalHolders(state('IT-1',''),candidate));
});
