/** #763: informational DRAFT benchmark, not actual wages, prices or accounting. */
import {ATTRIBUTES,calculatePositionSuitability} from './players-generator-core.mjs';
import {roundPlayerMarketValueArc} from './player-market-value-rounding.mjs';
import {createStandardizedForecast} from './player-market-value-forecast.mjs';
const positions=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
export const MARKET_VALUE_CONFIG=Object.freeze({
 version:'remaining-agent-salary-draft-v5-769',
 salaryScale:60,salaryMultiplier:2,agentPayoutFraction:1,
 rewardBenchmark:10000,divisionFloors:Object.freeze({1:40,2:20}),priorExposure:250,
 forecastVersion:'769-scale25-synthetic-age-skill-v2',
 renewalSeasons:2,discountRate:0,
 retirement:Object.freeze({33:.02,34:.05,35:.12,36:.25,37:.45,38:.7,39:.9,40:1}),
 growth:Object.freeze([.7098,.6808,.651,.6267,.607,.5908,.5618,.5357,.515,.4878,.4666,.4284,.3716,.2786,.1782,.0922,.0403,.0171,.0059,.0023,.0008,.0006,0,0]),
 versatility:Object.freeze([.05,.025,.0125,.0075,.005])
});
// Fail fast if a future edited DRAFT configuration is malformed.
const c=MARKET_VALUE_CONFIG;
const unit=v=>Number.isFinite(v)&&v>=0&&v<=1;
if(!c.version||!Number.isFinite(c.salaryScale)||c.salaryScale<=0||
 !Number.isFinite(c.salaryMultiplier)||c.salaryMultiplier<=1||!unit(c.agentPayoutFraction)||
 !Number.isInteger(c.renewalSeasons)||c.renewalSeasons<1||
 !Number.isFinite(c.rewardBenchmark)||c.rewardBenchmark<=0||!Number.isFinite(c.priorExposure)||c.priorExposure<=0||
 ![1,2].every(t=>Number.isSafeInteger(c.divisionFloors[t])&&c.divisionFloors[t]>0)||
 !Number.isFinite(c.discountRate)||c.discountRate<0||
 c.growth.length!==24||c.growth.some(v=>!Number.isFinite(v)||v<0)||
 c.versatility.length!==5||c.versatility.some(v=>!unit(v))||
 c.retirement[40]!==1||[33,34,35,36,37,38,39,40].some(age=>!unit(c.retirement[age])||c.retirement[age]<(c.retirement[age-1]??0)))
 throw new Error('invalid_market_value_config');
const forecast=createStandardizedForecast(c);
/** Only current public inputs are consulted; synthetic aggregate forecast is fixed by config version. */
export function rawPlayerMarketValueArc(input){
 if(!input||typeof input!=='object')return null;
 const {age,career_status,primary_position,secondary_positions,attributes}=input;
 if(career_status==='retired')return 0;
 if(career_status!=='active'||!Number.isInteger(age)||age<16||age>39||
    !positions.has(primary_position)||!Array.isArray(secondary_positions)||
    secondary_positions.some(role=>!positions.has(role))||!attributes||
    ATTRIBUTES.some(key=>!Number.isInteger(attributes[key])||attributes[key]<1||attributes[key]>99))return null;
 const c=MARKET_VALUE_CONFIG;
 const scores=[...new Set([primary_position,...secondary_positions])].map(role=>calculatePositionSuitability(attributes,role)).sort((a,b)=>b-a);
 let skill=scores[0],bonus=0;
 for(let i=1;i<Math.min(scores.length,6);i++)bonus+=c.versatility[i-1]*Math.max(0,1-(skill-scores[i])/10);
 let value=0,survival=1,wage=0;
 for(let t=0;t<=39-age;t++){
  const renewal=t%c.renewalSeasons===0;
  const expected=forecast(age+t,skill,bonus,renewal);
  if(renewal)wage=expected.wage;
  value+=c.agentPayoutFraction*wage*survival*expected.employment*expected.paid/(1+c.discountRate)**(t+1);
  skill=Math.min(99,skill+c.growth[age+t-16]);
  survival*=1-(c.retirement[age+t+1]??0);
 }
 return Number.isFinite(value)&&value>=0?value:null;
}
export function calculatePlayerMarketValueArc(input){
 return roundPlayerMarketValueArc(rawPlayerMarketValueArc(input));
}
