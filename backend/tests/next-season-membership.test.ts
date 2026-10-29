import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeNextSeasonMembership} from '../src/next-season-membership.ts';
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const divisions=countries.flatMap(countryId=>[1,2].map(tier=>({competitionId:countryId+'-'+tier,rankedClubIds:Array.from({length:16},(_,i)=>countryId+'-'+(i+1+(tier-1)*16))})));
const outcomes=countries.map(countryId=>({countryId,playoutRelegatedClubId:countryId+'-14',playoffPromotedClubId:countryId+'-19'}));
test('projects 16 domestic divisions and 2 cups without modifying approved input',()=>{
 const result=proposeNextSeasonMembership(2,divisions,outcomes);
 assert.equal(result.bindings.length,18);assert.equal(result.status,'provisional-results-derived');
 const it1=result.bindings.find(x=>x.competitionId==='IT-1')!;
 const it2=result.bindings.find(x=>x.competitionId==='IT-2')!;
 assert.equal(it1.clubIds.length,16);assert.equal(it2.clubIds.length,16);
 assert.ok(it1.clubIds.includes('IT-17'));assert.ok(it1.clubIds.includes('IT-18'));assert.ok(it1.clubIds.includes('IT-19'));
 assert.ok(!it1.clubIds.includes('IT-14'));assert.ok(!it1.clubIds.includes('IT-15'));assert.ok(!it1.clubIds.includes('IT-16'));
 assert.deepEqual(result.bindings.find(x=>x.competitionId==='int-1')!.clubIds.slice(0,3),['IT-1','IT-2','IT-3']);
 assert.deepEqual(result.bindings.find(x=>x.competitionId==='int-2')!.clubIds.slice(0,3),['IT-4','IT-5','IT-6']);
 assert.equal(new Set([...it1.clubIds,...it2.clubIds]).size,32);
});
test('rejects absent outcomes, wrong playout loser, duplicate membership or forged playoff promotion',()=>{
 assert.throws(()=>proposeNextSeasonMembership(2,divisions,outcomes.slice(1)));
 assert.throws(()=>proposeNextSeasonMembership(2,divisions,[{...outcomes[0],playoutRelegatedClubId:'IT-12'},...outcomes.slice(1)]));
 assert.throws(()=>proposeNextSeasonMembership(2,divisions,[{...outcomes[0],playoffPromotedClubId:'IT-24'},...outcomes.slice(1)]));
 assert.throws(()=>proposeNextSeasonMembership(2,[{...divisions[0],rankedClubIds:[...divisions[0].rankedClubIds.slice(1),divisions[0].rankedClubIds[1]]},...divisions.slice(1)],outcomes));
});
