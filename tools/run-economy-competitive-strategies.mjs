import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {roundPlayerMarketValueArc as round} from '../backend/src/player-market-value-rounding.mjs';
import {makeCalibration as cal} from './club-license-calibration.mjs';
import {simulateIndividuals} from './economy-individual-100.mjs';
import {buildCompetitive} from './economy-competitive-strategies.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
export function buildCompetitiveStress(overrides={}){const c={...read('./economy-competitive-strategies-v1.json'),...overrides},base=read('./club-license-calibration-v1.json'),renew=read('./club-license-renewal-v2.json');const reference=cal(read('../data/clubs.json'),read('../backend/catalogues/season-1.participants.json'),{...base,horizon:32,staffArc:{1:0,2:0},aiShare:0,lowRankWeights:renew.lowRankWeights,replacementAnnualArc:{1:0,2:0},payrollShares:{1:1,2:1}},rewards,salary);return buildCompetitive(reference,rewards,salary,round,c,simulateIndividuals);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const c=read('./economy-competitive-strategies-v1.json'),disciplined=process.argv.includes('--disciplined'),result=buildCompetitiveStress({variants:disciplined?c.variants.slice(2):c.variants.slice(0,2)}),suffix=disciplined?'-disciplined':'',output=new URL('../docs/economy-competitive-strategies-v1'+suffix+'-results.json',import.meta.url),summary=new URL('../docs/economy-competitive-strategies-v1'+suffix+'-summary.json',import.meta.url),rendered=JSON.stringify(result)+'\n',short=JSON.stringify(result.runs.map(({trace,agents,clubs,...r})=>r),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered||readFileSync(summary,'utf8')!==short)throw Error('Stale competitive stress');}else if(process.argv.includes('--write')){writeFileSync(output,rendered);writeFileSync(summary,short);}else console.log(short);}
