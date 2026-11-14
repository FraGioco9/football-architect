import assert from 'node:assert/strict';
import test from 'node:test';
import {assignLeagueMatchSlots,isMatchId,matchIdForSlot} from '../src/domain/calendar/match-slot-identity.ts';

const generation='123e4567-e89b-42d3-a456-426614174000';
const secondGeneration='123e4567-e89b-42d3-a456-426614174001';
const base={generation,season:1,competitionId:'IT-1',phaseId:'league',slotId:'round:1:match:1'};

test('canonical public IDs are reproducible and independent of participating clubs/results',async()=>{
  const first=await matchIdForSlot(base);
  assert.equal(first,await matchIdForSlot({...base}));
  assert.equal(first,await matchIdForSlot({...base,generation:generation.toUpperCase()}));
  assert.equal(isMatchId(first),true);
  assert.equal(isMatchId('m1_invalid'),false);
  for(const variant of [{...base,season:2},{...base,generation:secondGeneration},{...base,competitionId:'int-1'},
    {...base,phaseId:'playoff'},{...base,slotId:'round:1:match:2'}])
    assert.notEqual(first,await matchIdForSlot(variant));
});

test('league assignment is unique and independent of source/display ordering',async()=>{
  const sources=Array.from({length:240},(_,i)=>({id:'fixture-'+String(i).padStart(3,'0'),competitionId:i%2?'IT-1':'ENG-1',round:1+Math.floor(i/8)}));
  const a=await assignLeagueMatchSlots(sources,generation,1);
  const b=await assignLeagueMatchSlots([...sources].reverse(),generation,1);
  assert.deepEqual(a,b);
  assert.equal(new Set(a.map(f=>f.matchId)).size,sources.length);
  assert.equal(new Set(a.map(f=>f.sourceFixtureId)).size,sources.length);
  assert.ok(a.every(f=>isMatchId(f.matchId)&&f.slotId==='round:'+f.round+':match:'+f.ordinal));
  const c=await assignLeagueMatchSlots(sources,secondGeneration,1);
  assert.ok(a.every((f,i)=>f.matchId!==c[i].matchId));
});

test('invalid slot keys and ambiguous source identities are rejected',async()=>{
  for(const invalid of [{...base,season:0},{...base,generation:'not-a-generation'},
    {...base,competitionId:'unknown'},{...base,phaseId:''},{...base,slotId:'invalid/../slot'}])
    await assert.rejects(matchIdForSlot(invalid),RangeError);
  await assert.rejects(assignLeagueMatchSlots([{id:'same',competitionId:'IT-1',round:1},
    {id:'same',competitionId:'IT-1',round:1}],generation,1),RangeError);
});
