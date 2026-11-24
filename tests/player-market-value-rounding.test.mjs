import test from 'node:test';
import assert from 'node:assert/strict';
import {roundPlayerMarketValueArc as round} from '../backend/src/player-market-value-rounding.mjs';

test('approved ARC rounding examples and magnitude transitions',()=>{
 const fixtures=[[0,0],[Number.MIN_VALUE,1],[42.3,43],[99.9,100],[100,100],[100.1,110],[543,550],[999,1000],[1000,1000],[1000.1,1100],[4148,4200],[5000,5000],[9999,10000],[10000,10000],[10000.1,11000],[25925,26000],[123450,130000],[1234500,1300000]];
 for(const [raw,expected] of fixtures)assert.equal(round(raw),expected,String(raw));
 for(let step=10;step<=1000000000000;step*=10){
  const threshold=step*10;
  const delta=threshold*Number.EPSILON;
  assert.equal(round(threshold-delta),threshold);
  assert.equal(round(threshold),threshold);
  assert.equal(round(threshold+delta),threshold+step);
  const multiple=threshold+3*step;
  assert.equal(round(multiple-multiple*Number.EPSILON),multiple);
  assert.equal(round(multiple),multiple);
  assert.equal(round(multiple+multiple*Number.EPSILON),multiple+step);
 }
});

test('invalid or unrepresentable ARC values stay unavailable, never zero',()=>{
 for(const raw of [-1,NaN,Infinity,-Infinity,null,undefined,'100',Number.MAX_VALUE,Number.MAX_SAFE_INTEGER])assert.equal(round(raw),null);
});
