import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {roundPlayerMarketValueArc as round} from '../backend/src/player-market-value-rounding.mjs';
import {makeCalibration as cal} from './club-license-calibration.mjs';
import {simulateIndividuals} from './economy-individual-100.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
export function buildIndividualStress(overrides={}){const c={...read('./economy-individual-100-v1.json'),...overrides},base=read('./club-license-calibration-v1.json'),renew=read('./club-license-renewal-v2.json');const reference=cal(read('../data/clubs.json'),read('../backend/catalogues/season-1.participants.json'),{...base,horizon:32,staffArc:{1:0,2:0},aiShare:0,lowRankWeights:renew.lowRankWeights,replacementAnnualArc:{1:0,2:0},payrollShares:{1:1,2:1}},rewards,salary);return {version:c.version,status:'research-only',config:c,runs:c.scenarios.flatMap(opt=>c.seeds.map(seed=>simulateIndividuals(reference,rewards,salary,round,c,opt,seed)))};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const output=new URL('../docs/economy-individual-100-v1-results.json',import.meta.url),summary=new URL('../docs/economy-individual-100-v1-summary.json',import.meta.url),result=buildIndividualStress(),rendered=JSON.stringify(result)+'\n',short=JSON.stringify(result.runs.map(({series,...r})=>r),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered||readFileSync(summary,'utf8')!==short)throw Error('Stale individual stress');}else if(process.argv.includes('--write')){writeFileSync(output,rendered);writeFileSync(summary,short);}else console.log(short);}
