import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeNextSeasonMembership} from '../src/domain/qualification/next-season-membership.ts';

const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const divisions=countries.flatMap(countryId=>[1,2].map(tier=>({
 competitionId:countryId+'-'+tier,
 rankedClubIds:Array.from({length:16},(_,i)=>countryId+'-'+(i+1+(tier-1)*16))
})));
const outcomes=countries.map(countryId=>({
 countryId,playoutRelegatedClubId:countryId+'-14',playoffPromotedClubId:countryId+'-19'
}));

test('projects all eight countries from final tables without mutating evidence or reranking international qualifiers',()=>{
 const input=structuredClone({divisions,outcomes});
 const result=proposeNextSeasonMembership(2,divisions,outcomes);
 assert.equal(result.season,2);
 assert.equal(result.status,'provisional-results-derived');
 assert.equal(result.bindings.length,countries.length*2+2);
 const byId=new Map(result.bindings.map(row=>[row.competitionId,row.clubIds]));
 assert.equal(byId.size,result.bindings.length,'unique competition bindings');
 for(const country of countries){
  const top=divisions.find(d=>d.competitionId===country+'-1')!.rankedClubIds;
  const second=divisions.find(d=>d.competitionId===country+'-2')!.rankedClubIds;
  const outcome=outcomes.find(o=>o.countryId===country)!;
  const relegated=[...top.slice(-2),outcome.playoutRelegatedClubId];
  const promoted=[...second.slice(0,2),outcome.playoffPromotedClubId];
  const nextTop=byId.get(country+'-1')!;
  const nextSecond=byId.get(country+'-2')!;
  assert.deepEqual(nextTop,[...top.filter(id=>!relegated.includes(id)),...promoted],country+' top-tier changes');
  assert.deepEqual(nextSecond,[...second.filter(id=>!promoted.includes(id)),...relegated],country+' second-tier changes');
  assert.equal(new Set([...nextTop,...nextSecond]).size,32,country+' unique memberships');
  assert.deepEqual(new Set([...nextTop,...nextSecond]),new Set([...top,...second]),country+' preserves club universe');
 }
 const topTables=countries.map(country=>divisions.find(d=>d.competitionId===country+'-1')!.rankedClubIds);
 assert.deepEqual(byId.get('int-1'),topTables.flatMap(top=>top.slice(0,3)),'Sovereign qualified from finished tables');
 assert.deepEqual(byId.get('int-2'),topTables.flatMap(top=>top.slice(3,6)),'Federation qualified from finished tables');
 assert.equal(new Set([...byId.get('int-1')!,...byId.get('int-2')!]).size,48);
 assert.deepEqual({divisions,outcomes},input,'pure projection never mutates approved input');
 assert.ok(Object.isFrozen(result)&&result.bindings.every(row=>Object.isFrozen(row)&&Object.isFrozen(row.clubIds)));
});

test('rejects missing or forged sporting evidence before producing any membership proposal',()=>{
 const top=divisions[0],second=divisions[1],outcome=outcomes[0];
 const invalid=[
  {label:'missing postseason result',divisions,outcomes:outcomes.slice(1)},
  {label:'playout loser outside eligible ranks',divisions,outcomes:[{...outcome,playoutRelegatedClubId:top.rankedClubIds[11]},...outcomes.slice(1)]},
  {label:'playoff winner outside eligible ranks',divisions,outcomes:[{...outcome,playoffPromotedClubId:second.rankedClubIds[7]},...outcomes.slice(1)]},
  {label:'duplicate club in a verified table',divisions:[{...top,rankedClubIds:[...top.rankedClubIds.slice(1),top.rankedClubIds[1]]},...divisions.slice(1)],outcomes}
 ];
 for(const row of invalid){
  assert.throws(()=>proposeNextSeasonMembership(2,row.divisions,row.outcomes),
   {status:422,code:'qualification_evidence_invalid'},row.label);
 }
 assert.throws(()=>proposeNextSeasonMembership(1,divisions,outcomes),
  {status:422,code:'qualification_evidence_invalid'},'Season 1 cannot be produced as a next-season proposal');
});
