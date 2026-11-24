import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES} from '../backend/src/players-generator-core.mjs';
import {rawPlayerMarketValueArc,calculatePlayerMarketValueArc as value} from '../backend/src/player-market-value.mjs';
const player=(age=24,skill=60)=>({age,career_status:'active',primary_position:'CM',secondary_positions:[],attributes:Object.fromEntries(ATTRIBUTES.map(key=>[key,skill]))});
test('DRAFT benchmark matches reference golden values',()=>{
 for(const [age,raw,rounded] of [[16,4147.935618,4200],[24,1879.241387,1900],[32,589.798344,590],[39,122.622355,130]]){
  assert.ok(Math.abs(rawPlayerMarketValueArc(player(age))-raw)<.000001);
  assert.equal(value(player(age)),rounded);
 }
});
test('hidden data never affects the public estimate; duplicate roles do not add value',()=>{
 const p=player();
 assert.equal(value({...p,development_aptitude:1,retirement_age:33}),value({...p,development_aptitude:99,retirement_age:39}));
 assert.equal(value({...p,secondary_positions:['CM','CM']}),value(p));
 assert.ok(rawPlayerMarketValueArc({...p,secondary_positions:['DM']})>rawPlayerMarketValueArc(p));
 assert.equal(value({...p,primary_position:'GK'}),value(p));
});
test('invalid and retired are distinct; current ability and survival are bounded',()=>{
 const p=player();
 assert.equal(value({...p,career_status:'retired'}),0);
 for(const patch of [{age:40},{age:15},{age:NaN},{career_status:'unknown'},{primary_position:'XX'},{secondary_positions:['XX']},{attributes:{}}])assert.equal(value({...p,...patch}),null);
 assert.ok(value(player(16,99))>value(player(39,99)));
});

test('stronger listed secondary role is the reference, not the nominal primary role',()=>{
 const p=player(24,10);
 for(const key of ATTRIBUTES.filter(k=>k.startsWith('gk_')))p.attributes[key]=99;
 assert.ok(value({...p,secondary_positions:['GK']})>value(p));
 assert.equal(value({...p,secondary_positions:['GK']}),value({...p,primary_position:'GK'}));
});

test('all public valuation surfaces share the literal $ARC token and integer grouping',async()=>{
 const {default:formatter}=await import('../assets/market-value-format.js');
 assert.equal(formatter.format(4700,'en'),'4,700 $ARC');
 assert.equal(formatter.format(4700,'it'),'4.700 $ARC');
 assert.equal(formatter.format(0,'en'),'0 $ARC');
 assert.equal(formatter.format(null,'en'),'—');
 for(const locale of ['en','it','de','es','fr']){
  const formatted=formatter.format(9999999,locale);
  assert.equal(formatted,new Intl.NumberFormat(locale,{useGrouping:'always'}).format(9999999)+' $ARC');
  assert.equal(formatted.replace(/[^0-9]/g,''),'9999999');
  assert.equal(Array.from(formatted).length,14);
 }
});
