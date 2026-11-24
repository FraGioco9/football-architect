import {assertArchivedCalibration} from './economy-archive-compare.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as rewards from '../assets/competition-rewards.mjs';
import {MARKET_VALUE_CONFIG as salary} from '../backend/src/player-market-value.mjs';
import {roundPlayerMarketValueArc as round} from '../backend/src/player-market-value-rounding.mjs';
import {makeCalibration as cal} from './club-license-calibration.mjs';
import {buildCareer as build} from './economy-career-recycling.mjs';
import {buildFullPayroll} from './economy-full-payroll.mjs';
import {buildScaleOptions} from './economy-scale-options.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
export function buildScaleResearch(){return buildScaleOptions(read('../data/clubs.json'),read('../backend/catalogues/season-1.participants.json'),read('./club-license-calibration-v1.json'),read('./club-license-renewal-v2.json'),read('./economy-scale-options-v1.json'),rewards,salary,round,cal,build,buildFullPayroll);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const output=new URL('../docs/economy-scale-options-v1-results.json',import.meta.url),rendered=JSON.stringify(buildScaleResearch(),null,2)+'\n';if(process.argv.includes('--check')){assertArchivedCalibration(JSON.parse(rendered),JSON.parse(readFileSync(output,'utf8')));}else if(process.argv.includes('--write'))writeFileSync(output,rendered);else console.log(rendered);}
