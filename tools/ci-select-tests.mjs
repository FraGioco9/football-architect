// CI-OPT-03: conservative shared selector. Unknown or cross-area changes require FULL.
import {execFileSync} from 'node:child_process';
import {classifyImpact} from './ci-opt-01-impact.mjs';

const sha=/^[a-f0-9]{40}$/;
const critical=/^(?:\.github\/|tools\/ci-|tests\/ci-|backend\/|account\/|data\/|history\/|generator\/|generators\/|scripts\/|assets\/(?:account-|profile-|debug-|authoritative-|app\.|theme\.|sidebar-|competition-tabs\.|competition-rules\.|club-crests\.)|tools\/(?:generate-|render-|dev-|shared-)|tests\/(?:account-|profile-|player-|admin-world-|debug-|backend-))/;
const docs=/^(?:docs\/|README\.md$|\.github\/ISSUE_TEMPLATE\/)/;
export function selectTests(paths){
 if(!Array.isArray(paths)||!paths.length||paths.some(p=>typeof p!=='string'||!p||p.startsWith('/')||p.includes('..')||p.includes('\\')))return {mode:'full',area:null,tests:[],reason:'invalid-or-empty-diff'};
 if(paths.some(p=>critical.test(p)))return {mode:'full',area:null,tests:[],reason:'critical-or-shared-dependency'};
 if(paths.every(p=>docs.test(p)))return {mode:'fast',area:null,tests:[],reason:'documentation-only'};
 const result=classifyImpact(paths);
 return {...result,reason:result.mode==='full'?'unknown-cross-area-or-shared':'mapped-'+(result.area||result.mode)};
}
export function selectFromGit(base,head){
 if(!sha.test(base||'')||!sha.test(head||''))throw Error('Missing trusted base/head SHA');
 const run=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 if(run('rev-parse','HEAD')!==head)throw Error('Checkout is not the exact expected HEAD');
 const mergeBase=run('merge-base',base,head);
 if(!sha.test(mergeBase))throw Error('Untrustworthy merge-base');
 const names=run('diff','--name-only','--diff-filter=ACDMRT',mergeBase,head).split('\n').filter(Boolean);
 return {...selectTests(names),base,head,mergeBase,paths:names};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 let selection;
 try{
  if(process.env.GITHUB_EVENT_NAME!=='pull_request')throw Error('Non-PR requires FULL');
  selection=selectFromGit(process.env.PR_BASE_SHA,process.env.EXPECTED_HEAD_SHA);
 }catch(error){selection={mode:'full',area:null,tests:[],reason:'fail-closed: '+error.message};}
 const report=JSON.stringify(selection);
 process.stderr.write('[CI-OPT-03] '+report+'\n');
 if(process.argv.includes('--json'))process.stdout.write(report+'\n');
 else process.stdout.write('mode='+selection.mode+'\narea='+(selection.area||'')+'\ntests='+selection.tests.join(' ')+'\n');
}
