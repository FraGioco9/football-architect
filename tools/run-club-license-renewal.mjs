import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {makeCalibration} from './club-license-calibration.mjs';
import {buildRenewalCalibration} from './club-license-renewal.mjs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
export function buildRenewal(){return buildRenewalCalibration(read('../data/clubs.json'),read('../backend/catalogues/season-1.participants.json'),read('./club-license-calibration-v1.json'),read('./club-license-renewal-v2.json'),rewards,salary,makeCalibration);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const output=new URL('../docs/club-license-renewal-v2-results.json',import.meta.url),rendered=JSON.stringify(buildRenewal(),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered)throw Error('Stale renewal results');}else if(process.argv.includes('--write'))writeFileSync(output,rendered);else console.log(rendered);}
