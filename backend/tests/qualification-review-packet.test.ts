import assert from 'node:assert/strict';
import test from 'node:test';
import {buildQualificationReviewPacket} from '../src/qualification-review-packet.ts';
import type {NextSeasonMembership} from '../src/next-season-membership.ts';
import type {HolderReview} from '../src/international-holder-review.ts';
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const candidate:NextSeasonMembership={season:2,status:'provisional-results-derived',bindings:[
 ...countries.flatMap(c=>[1,2].map(tier=>({competitionId:c+'-'+tier,clubIds:Array.from({length:16},(_,i)=>c+'-'+(i+1+(tier-1)*16))}))),
 ...[1,2].map(cup=>({competitionId:'int-'+cup,clubIds:countries.flatMap(c=>Array.from({length:3},(_,i)=>c+'-'+(i+1+(cup-1)*3)))}))
]};
const holders:HolderReview[]=[
 {competitionId:'int-1',championClubId:'IT-9',countryId:'IT',allocatedCup:null,requiresQualificationPolicyDecision:true},
 {competitionId:'int-2',championClubId:'FR-4',countryId:'FR',allocatedCup:'int-2',requiresQualificationPolicyDecision:false}
];
test('review packet is stable, archive-bound and never an activation authorization',async()=>{
 const a=await buildQualificationReviewPacket('a'.repeat(64),candidate,holders);
 const b=await buildQualificationReviewPacket('a'.repeat(64),candidate,holders);
 assert.deepEqual(a,b);
 assert.equal(a.readyForActivation,false);
 assert.equal(a.status,'requires-owner-approval');
 assert.ok(a.blockingReasons.includes('int-1:holder-conflict'));
 assert.ok(!a.blockingReasons.includes('int-2:holder-conflict'));
 assert.match(a.candidateHash,/^[a-f0-9]{64}$/);
 assert.equal(Object.isFrozen(a),true);
 const changed={...candidate,bindings:candidate.bindings.map(b=>b.competitionId==='IT-1'?{...b,clubIds:[...b.clubIds].reverse()}:b)} as NextSeasonMembership;
 assert.notEqual((await buildQualificationReviewPacket('a'.repeat(64),changed,holders)).candidateHash,a.candidateHash);
});
test('no archive or incomplete holder review cannot produce a packet',async()=>{
 await assert.rejects(buildQualificationReviewPacket('bad',candidate,holders));
 await assert.rejects(buildQualificationReviewPacket('a'.repeat(64),candidate,holders.slice(0,1)));
});

test('refuses duplicate cups and invalid holder-state flags',async()=>{
 const bad={...candidate,bindings:candidate.bindings.map(b=>b.competitionId==='int-2'?{...b,clubIds:[candidate.bindings.find(x=>x.competitionId==='int-1')!.clubIds[0],...b.clubIds.slice(1)]}:b)} as NextSeasonMembership;
 await assert.rejects(buildQualificationReviewPacket('a'.repeat(64),bad,holders));
 await assert.rejects(buildQualificationReviewPacket('a'.repeat(64),candidate,[{...holders[0],requiresQualificationPolicyDecision:false},holders[1]]));
});
