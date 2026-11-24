import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {buildRenewal} from './run-club-license-renewal.mjs';
import {quoteYouth,unitEconomics,summarizeDual} from './academy-dual-pricing.mjs';
import {runDualStress} from './academy-dual-stress.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
export function buildDualPricing(){const c=read('./academy-dual-pricing-v1.json'),base=read('./club-finance-stress-v1.json'),ref=buildRenewal().selected;return {version:c.version,status:'research-only',unitEconomics:unitEconomics(c,quoteYouth),conditionalDemandSensitivity:summarizeDual(c,ref,{...base,academyPriceArc:c.referenceDisplayedValuesArc,academyPriceWeights:c.weights},base.scenarios[0],rewards,salary,runDualStress)};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const file=new URL('../docs/academy-dual-pricing-v1-results.json',import.meta.url),rendered=JSON.stringify(buildDualPricing(),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==rendered)throw Error('Stale pricing sensitivity');}else if(process.argv.includes('--write'))writeFileSync(file,rendered);else console.log(rendered);}
