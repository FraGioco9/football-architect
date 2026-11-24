import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES} from '../backend/src/players-generator-core.mjs';
import {MARKET_VALUE_CONFIG,rawPlayerMarketValueArc,calculatePlayerMarketValueArc as value} from '../backend/src/player-market-value.mjs';
const player=(age=24,skill=60)=>({age,career_status:'active',primary_position:'CM',secondary_positions:[],attributes:Object.fromEntries(ATTRIBUTES.map(key=>[key,skill]))});
test('DRAFT #769 benchmark reproduces research age and skill fixtures',()=>{
 assert.equal(MARKET_VALUE_CONFIG.agentPayoutFraction,1);
 assert.equal(MARKET_VALUE_CONFIG.salaryScale,60);
 assert.equal(MARKET_VALUE_CONFIG.rewardBenchmark,10000);
 assert.deepEqual(MARKET_VALUE_CONFIG.divisionFloors,{1:40,2:20});
 assert.equal(MARKET_VALUE_CONFIG.version,'remaining-agent-salary-draft-v5-769');
 for(const [age,skill,raw,rounded] of [[16,50,159.329115122,160],[16,60,1091.534745799,1100],[16,70,3831.523755708,3900],[16,80,10110.472433112,11000],[24,50,71.869795179,72],[24,60,412.712498491,420],[24,70,1627.773770483,1700],[24,80,4773.905230856,4800],[32,50,38.654145957,39],[32,60,118.366321112,120],[32,70,502.384455769,510],[32,80,1501.566971357,1600],[39,50,8.455123898,9],[39,60,25.732988384,26],[39,70,107.130660978,110],[39,80,316.666431323,320]]){
  assert.ok(Math.abs(rawPlayerMarketValueArc(player(age,skill))-raw)<.000001);
  assert.equal(value(player(age,skill)),rounded);
 }
});
test('hidden data never affects the public estimate; duplicate roles do not add value',()=>{
 const p=player();
 assert.equal(rawPlayerMarketValueArc({...p,development_aptitude:1,retirement_age:33,agent_type:'AI',club_id:'A',salary:1}),rawPlayerMarketValueArc({...p,development_aptitude:99,retirement_age:39,agent_type:'human',club_id:'B',salary:99999}));
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
