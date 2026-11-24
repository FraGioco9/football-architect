import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES} from '../backend/src/players-generator-core.mjs';
import {MARKET_VALUE_CONFIG,rawPlayerMarketValueArc,calculatePlayerMarketValueArc as value} from '../backend/src/player-market-value.mjs';
const player=(age=24,skill=60)=>({age,career_status:'active',primary_position:'CM',secondary_positions:[],attributes:Object.fromEntries(ATTRIBUTES.map(key=>[key,skill]))});
test('DRAFT #769 benchmark reproduces research age and skill fixtures',()=>{
 assert.equal(MARKET_VALUE_CONFIG.agentPayoutFraction,1);
 assert.equal(MARKET_VALUE_CONFIG.version,'remaining-agent-salary-draft-v4-769');
 for(const [age,skill,raw,rounded] of [[16,50,3982.171631461,4000],[16,60,27320.340704012,28000],[16,70,95945.701072377,96000],[16,80,254718.980133859,260000],[24,50,1791.130241636,1800],[24,60,10341.044310459,11000],[24,70,40618.776200624,41000],[24,80,119988.339321836,120000],[32,50,957.727660281,960],[32,60,2974.661583869,3000],[32,70,12546.063115232,13000],[32,80,37604.113305208,38000],[39,50,209.750399201,210],[39,60,648.175292946,650],[39,70,2677.461509725,2700],[39,80,7944.421924636,8000]]){
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
