import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {createStandardizedForecast as create} from '../backend/src/player-market-value-forecast.mjs';
import {roundPlayerMarketValueArc as round} from '../backend/src/player-market-value-rounding.mjs';
import {makeCalibration as cal} from './club-license-calibration.mjs';
import {buildJoint} from './economy-joint-calibration.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
export function buildJointCalibration(){return buildJoint(read('../data/clubs.json'),read('../backend/catalogues/season-1.participants.json'),read('./club-license-calibration-v1.json'),read('./club-license-renewal-v2.json'),read('./economy-joint-calibration-v1.json'),rewards,salary,create,round,cal);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const output=new URL('../docs/economy-joint-calibration-v1-results.json',import.meta.url),rendered=JSON.stringify(buildJointCalibration(),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered)throw Error('Stale joint calibration');}else if(process.argv.includes('--write'))writeFileSync(output,rendered);else console.log(rendered);}
