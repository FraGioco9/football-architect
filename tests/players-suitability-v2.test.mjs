import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES,generateTrial,calculatePositionSuitability} from '../tools/players-generation-trial.mjs';

const POSITIONS='GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' ');
const close=(actual,expected)=>Math.abs(actual-expected)<1e-9;

test('Suitability 2.0 uses 65/25/10 across 12 distinct role-relevant attributes',()=>{
 for(const position of POSITIONS){
  const base=Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,50]));
  assert.ok(close(calculatePositionSuitability(base,position),50));
  const impacts=ATTRIBUTES.map(attribute=>{
   const changed={...base,[attribute]:70};
   return Math.round((calculatePositionSuitability(changed,position)-50)*100)/100;
  }).sort((a,b)=>a-b);
  assert.deepEqual(impacts,[
   ...Array(8).fill(0),...Array(4).fill(.5),
   ...Array(4).fill(1.25),...Array(4).fill(3.25)
  ],position);
 }
});

test('Target-first suitability stays bounded across positions and ability tiers',()=>{
 for(const position of POSITIONS){
  for(const target of [30,50,70,85,90]){
   const sample=generateTrial({
    count:3,seed:'suitability-v2:'+position+':'+target,
    primaryPosition:position,secondaryCount:0,primarySuitability:target
   });
   for(const player of sample.candidates){
    const actual=calculatePositionSuitability(player.attributes,position);
    assert.ok(Math.abs(actual-target)<=.500001,`${position}: ${actual} vs ${target}`);
    assert.equal(Object.keys(player.attributes).length,20);
    assert.ok(Object.values(player.attributes).every(x=>Number.isInteger(x)&&x>=1&&x<=99));
   }
  }
 }
});

test('Development aptitude never contributes to suitability or other generated skills',()=>{
 for(const position of POSITIONS){
  const base={count:2,seed:'suitability-v2-independent:'+position,primaryPosition:position};
  const low=generateTrial({...base,developmentAptitude:1});
  const high=generateTrial({...base,developmentAptitude:99});
  for(let i=0;i<2;i++){
   assert.deepEqual(low.candidates[i].attributes,high.candidates[i].attributes);
   assert.equal(
    calculatePositionSuitability(low.candidates[i].attributes,position),
    calculatePositionSuitability(high.candidates[i].attributes,position)
   );
  }
 }
});
