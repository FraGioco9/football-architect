import {readFileSync,writeFileSync} from 'node:fs';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG} from '../backend/src/player-market-value.mjs';
import {makeCalibration} from './club-license-calibration.mjs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const output=new URL('../docs/club-license-calibration-v1-results.json',import.meta.url);
export function buildCalibration(){return makeCalibration(read('../data/clubs.json'),read('../backend/catalogues/season-1.participants.json'),read('../tools/club-license-calibration-v1.json'),rewards,MARKET_VALUE_CONFIG);}
import {pathToFileURL} from 'node:url';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const rendered=JSON.stringify(buildCalibration(),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered)throw Error('Stale club license research results');}else if(process.argv.includes('--write'))writeFileSync(output,rendered);else console.log(rendered);}
