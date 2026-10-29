import assert from 'node:assert/strict';
import test from 'node:test';
import {qualificationPots,internationalCountries} from '../src/season-qualification-pots.ts';
const countries=[...internationalCountries];
test('draw pots use qualified order, including changed club numbers in Season 2',()=>{
 const clubs=countries.flatMap(country=>[8,3,27].map(n=>country+'-'+n));
 const pots=qualificationPots(clubs,countries);
 assert.deepEqual(pots[0],countries.map(c=>c+'-8'));
 assert.deepEqual(pots[1],countries.map(c=>c+'-3'));
 assert.deepEqual(pots[2],countries.map(c=>c+'-27'));
 assert.equal(new Set(pots.flat()).size,24);
});
test('INT24 rejects missing country quota, repeated club and malformed country cycle',()=>{
 const clubs=countries.flatMap(c=>[1,2,3].map(n=>c+'-'+n));
 assert.throws(()=>qualificationPots(clubs.slice(1),countries));
 assert.throws(()=>qualificationPots([...clubs.slice(1),clubs[1]],countries));
 assert.throws(()=>qualificationPots(clubs,[...countries.slice(1),countries[1]]));
});
