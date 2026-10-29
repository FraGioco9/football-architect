import assert from 'node:assert/strict';
import test from 'node:test';
import {sportingDayPayload} from '../src/sporting-day-payload.ts';
const gen='123e4567-e89b-42d3-a456-426614174000',hash='a'.repeat(64);
test('versioned day payload retains its canonical Season 1 wire shape',()=>{
 assert.deepEqual(sportingDayPayload(1,gen,3,hash,[]),{schemaVersion:1,season:1,generation:gen,day:3,calendarHash:hash,simulationVersion:'temporary-score-v1',results:[]});
});
test('envelope supports explicit future season without granting execution authority',()=>{
 assert.equal(sportingDayPayload(2,gen,1,hash,[]).season,2);
 for(const season of [0,-1,1.5])assert.throws(()=>sportingDayPayload(season,gen,1,hash,[]));
 assert.throws(()=>sportingDayPayload(2,gen,57,hash,[]));
 assert.throws(()=>sportingDayPayload(2,gen,1,'invalid',[]));
});
