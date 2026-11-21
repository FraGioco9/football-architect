// CI-OPT-06: the old surname workflow's source scope guard runs inside Site
// instead of creating a second pull-request workflow and duplicate Node tests.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const allowedCatalog=/^data\/players\/surnames\/(?:countries\/[A-Z]{3}\.json|catalog-v1\.json|README\.md)$/;
const allowedSupport=new Set(['tests/surnames-01-catalog.test.mjs','tools/ci-test-ownership.json']);

export function validateSurnameScope(changed){
 if(!Array.isArray(changed)||changed.some(x=>typeof x!=='string'||!x||x.startsWith('/')||x.includes('..')))
   throw Error('Invalid SURNAMES-01 diff');
 if(!changed.some(x=>x.startsWith('data/players/surnames/')))return false;
 if(changed.some(x=>x.startsWith('data/players/names/')))
   throw Error('SURNAMES-01: PLAYERS-03 names must not change with surname catalog');
 const unrelated=changed.filter(x=>!allowedCatalog.test(x)&&!allowedSupport.has(x));
 if(unrelated.length)throw Error('SURNAMES-01: out-of-scope catalog changes: '+unrelated.join(', '));
 return true;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const base=process.env.PR_BASE_SHA;
 if(process.env.GITHUB_EVENT_NAME!=='pull_request'||!/^[a-f0-9]{40}$/.test(base||''))
   throw Error('SURNAMES-01 guard requires an exact trusted PR base');
 const diff=execFileSync('git',['diff','--no-renames','--name-only','--diff-filter=ACDMRT',base+'...HEAD'],{encoding:'utf8'}).trim();
 const changed=diff?diff.split('\n'):[];
 console.log('SURNAMES-01 scope:',validateSurnameScope(changed)?'checked':'not applicable');
}
