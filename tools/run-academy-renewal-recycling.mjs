import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {renewalRecycling} from './academy-renewal-recycling.mjs';
const config=JSON.parse(readFileSync(new URL('./academy-renewal-recycling-v2.json',import.meta.url),'utf8'));
export function buildRenewalRecycling(){return renewalRecycling(config);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const output=new URL('../docs/academy-renewal-recycling-v2-results.json',import.meta.url),rendered=JSON.stringify(buildRenewalRecycling(),null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(output,'utf8')!==rendered)throw Error('Stale recycling sensitivity');}else if(process.argv.includes('--write'))writeFileSync(output,rendered);else console.log(rendered);}
