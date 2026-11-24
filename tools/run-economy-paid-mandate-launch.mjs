import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {roundPlayerMarketValueArc as round} from '../backend/src/player-market-value-rounding.mjs';
import {makeCalibration as cal} from './club-license-calibration.mjs';
import {simulateIndividuals} from './economy-individual-100.mjs';
import {buildPaidLaunch} from './economy-paid-mandate-launch.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
export function buildPaidMandateStress(overrides={}){const c={...read('./economy-paid-mandate-launch-v1.json'),...overrides},base=read('./club-license-calibration-v1.json'),renew=read('./club-license-renewal-v2.json');const reference=cal(read('../data/clubs.json'),read('../backend/catalogues/season-1.participants.json'),{...base,horizon:32,staffArc:{1:0,2:0},aiShare:0,lowRankWeights:renew.lowRankWeights,replacementAnnualArc:{1:0,2:0},payrollShares:{1:1,2:1}},rewards,salary);return buildPaidLaunch(reference,rewards,salary,round,c,simulateIndividuals);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const c=read('./economy-paid-mandate-launch-v1.json'),group=process.argv.includes('--alternatives')?'alternatives':'dual',result=buildPaidMandateStress({primaryPolicies:group==='dual'?c.primaryPolicies.slice(0,1):c.primaryPolicies.slice(1)}),output=new URL('../docs/economy-paid-mandate-launch-v1-'+group+'-results.json',import.meta.url),summary=new URL('../docs/economy-paid-mandate-launch-v1-'+group+'-summary.json',import.meta.url),rendered=JSON.stringify(result)+'\n',short=JSON.stringify(result.runs.map(({trace,...r})=>r),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered||readFileSync(summary,'utf8')!==short)throw Error('Stale paid mandate launch stress');}else if(process.argv.includes('--write')){writeFileSync(output,rendered);writeFileSync(summary,short);}else console.log(short);}
