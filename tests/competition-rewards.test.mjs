import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {competitionRewards,rewardTotals,REWARD_IDS} from '../assets/competition-rewards.mjs';
test('all canonical competitions, no fabricated competition',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
 const definitions=[...read('divisions.json'),...read('international-competitions.json')];
 assert.equal(definitions.length,18);
 assert.deepEqual([...REWARD_IDS].sort(),definitions.map(d=>d.id).sort());
 for(const d of definitions){
  const reward=competitionRewards(d.id);
  assert.equal(reward.capacity,d.capacity);
  assert.equal(reward.pool,reward.participation+reward.points+reward.placement);
  assert.equal(reward.status,'draft-reference');
  assert.equal(reward.shares.reduce((a,b)=>a+b),100);
  assert.equal(competitionRewards(d.id.toLowerCase()).id,d.id);
  for(const key of ['earned','paid','credited','payable'])assert.equal(Object.hasOwn(reward,key),false);
 }
 assert.equal(competitionRewards('IT-3'),null);
 assert.equal(competitionRewards(null),null);
});
test('approved totals and participation references',()=>{
 assert.deepEqual(rewardTotals(),{pool:60000000,participation:33600000,points:9600000,placement:16800000});
 for(const [id,pool,reference] of [['IT-1',4000000,150000],['IT-2',2000000,75000],['int-1',8000000,3200000/24],['int-2',4000000,1600000/24]]){
  const row=competitionRewards(id);
  assert.equal(row.pool,pool);
  assert.equal(row.participationReference,reference);
  assert.equal(row.participationIsAverage,id.startsWith('int-'));
 }
});
