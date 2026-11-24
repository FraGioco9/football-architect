import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {makeCalibration} from './club-license-calibration.mjs';
import {runStress} from './club-finance-stress.mjs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
export function buildStress(){
 const clubs=read('../data/clubs.json'),selection=read('../backend/catalogues/season-1.participants.json'),cfg=read('./club-license-calibration-v1.json'),config=read('./club-finance-stress-v1.json');
 const reference=makeCalibration(clubs,selection,cfg,rewards,salary);
 const results=config.scenarios.flatMap(o=>config.seeds.map(seed=>runStress(reference,rewards,salary,config,o,seed)));
 const summaries=config.scenarios.map(o=>{const rows=results.filter(r=>r.scenario===o.name),mean=k=>Math.round(rows.reduce((s,r)=>s+r[k],0)/rows.length);return {scenario:o.name,completed:rows.map(r=>r.completed),peak28:Math.max(...rows.map(r=>r.peakUnpaid28)),peak56:Math.max(...rows.map(r=>r.peakUnpaid56)),peakArrears56:Math.max(...rows.map(r=>r.peakArrears56)),lastArrears:mean("lastArrears56"),issuanceLast10:mean("averageIssuedLast10"),reserve:mean("closingReserveArc"),clubs:mean("closingClubArc"),wallets:mean("closingWalletArc"),arcBuys:mean("averageAcademyArcLast10"),eurBuys:mean("averageAcademyEurLast10"),capitalIssued:mean("capitalIssuedArc"),licenseGrossCents:mean("licenseGrossCents")};});
 const horizons=[5,10,20,32].map(horizon=>{const v=makeCalibration(clubs,selection,{...cfg,horizon},rewards,salary);return {horizon,topBaseCents:v.topReference.baseLicenseCents,groups:v.groups};});
 return {version:config.version,status:'research-only',summaries,horizons,runs:results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const output=new URL('../docs/club-finance-stress-v1-results.json',import.meta.url),rendered=JSON.stringify(buildStress(),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered)throw Error('Stale stress results');}else if(process.argv.includes('--write'))writeFileSync(output,rendered);else console.log(rendered);}
