// CI-OPT-06: do not make unrelated, reviewed public-page Draft changes
// pay for full Admin/Worker/account jobs. Exact-head FULL still runs on
// ready-for-review, the approved final-verification marker, and any unsafe diff.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {classifyImpact} from './ci-opt-01-impact.mjs';

// Deliberately allow only *already reviewed* single-area selections. A broad,
// shared, CSS, backend, auth, or CI change keeps the conservative FULL path.
const publicAreas=new Set(['calendar','clubs','competitions','guide']);
export function classifyAdminScope(changed){
  const impact=classifyImpact(changed);
  if(impact.mode==='fast')return 'fast';
  if(impact.mode==='targeted' && publicAreas.has(impact.area))return 'fast';
  if(impact.mode==='targeted' && impact.area==='admin')return 'targeted';
  return 'full';
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  let mode='full';
  try{
    const base=process.env.PR_BASE_SHA;
    if(process.env.GITHUB_EVENT_NAME!=='pull_request' || !/^[a-f0-9]{40}$/.test(base||''))throw Error('Missing exact PR base');
    const changed=execFileSync('git',['diff','--no-renames','--name-only','--diff-filter=ACDMRT',base+'...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
    mode=classifyAdminScope(changed);
  }catch(error){
    // Never turn an incomplete/failed diff into FAST or TARGETED.
    process.stderr.write('Admin selector fallback FULL: '+String(error)+'\n');
  }
  process.stdout.write('mode='+mode+'\n');
}
