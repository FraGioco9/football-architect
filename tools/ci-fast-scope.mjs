// CI-FAST-01. Strict opt-in for unpublished provider-only PRs.
import {execFileSync} from 'node:child_process';
const allowed=new Set([
 'assets/provider-contract.mjs','assets/static-provider.mjs',
 'assets/verified-history-provider.mjs','assets/provider-selectors.mjs',
 'tools/dev-fictional-provider.mjs',
 'tests/provider-contract.test.mjs','tests/static-provider.test.mjs',
 'tests/dev-fictional-provider.test.mjs','tests/verified-history-provider.test.mjs',
 'tests/provider-selectors.test.mjs',
 'docs/architecture/provider-contract.md'
]);
const source=new Set([...allowed].filter(p=>!p.startsWith('docs/')));
export function classify(changed){
 if(!Array.isArray(changed)||changed.length===0||changed.some(p=>typeof p!=='string'||!p||!allowed.has(p)))
  return 'full';
 return changed.some(p=>source.has(p))?'fast':'full';
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  if(process.env.GITHUB_EVENT_NAME!=='pull_request')throw Error('Non-PR uses full');
  const base=process.env.PR_BASE_SHA;
  if(!/^[0-9a-f]{40}$/.test(base||''))throw Error('Missing trusted PR base');
  const changed=execFileSync('git',['diff','--name-only','--diff-filter=ACDMRT',base+'...HEAD'],{encoding:'utf8'}).trim().split('\n');
  process.stdout.write(classify(changed)+'\n');
 }catch{process.stdout.write('full\n')}
}
