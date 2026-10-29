import assert from 'node:assert/strict';
import test from 'node:test';
import {buildQualificationReviewPacket} from '../src/qualification-review-packet.ts';
import type {NextSeasonMembership} from '../src/next-season-membership.ts';
import type {HolderReview} from '../src/international-holder-review.ts';
const candidate={season:2,status:'provisional-results-derived',bindings:Array.from({length:18},(_,i)=>({competitionId:'competition-'+i,clubIds:['club-'+i]}))} as NextSeasonMembership;
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
});
test('no archive or incomplete holder review cannot produce a packet',async()=>{
 await assert.rejects(buildQualificationReviewPacket('bad',candidate,holders));
 await assert.rejects(buildQualificationReviewPacket('a'.repeat(64),candidate,holders.slice(0,1)));
});
