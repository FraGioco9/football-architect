import {createHash} from 'node:crypto';
export const categories=['Product regression','Test defect','Test data or environment problem','Infrastructure failure','Missing or pending CI evidence','Flaky or non-deterministic test'];
export function diagnose({text='',command=[],exitCode=1,signal=null,category,env=process.env}){
 const clean=text.replace(/\u001b\[[0-9;]*m/g,'');
 let inferred='Product regression';
 if(/BLOCKED:|PENDING|Missing FULL workflow/.test(clean))inferred=categories[4];
 else if(/Unclassified|Stale test ownership|Invalid .* ownership/.test(clean))inferred=categories[1];
 else if(/ENOTFOUND|ECONNRESET|ENOSPC|SIGKILL/.test(clean)||signal)inferred=categories[3];
 else if(/CHROME_BIN|browser.*not.*(?:found|exist)|Executable doesn't exist|ECONNREFUSED|ERR_MODULE_NOT_FOUND|Cannot find package|ENOENT|EACCES/.test(clean))inferred=categories[2];
 const lines=clean.split('\n');
 const primary=lines.findIndex(l=>/not ok|AssertionError|(?:^|\s)Error:|error:|BLOCKED:/.test(l));
 const excerpt=lines.slice(Math.max(primary,0),Math.max(primary,0)+32).join('\n');
 const normalized=excerpt.replace(/^.*duration_ms:.*$/gm,'').replace(/\b\d{4}-\d\d-\d\dT[\d:.]+Z\s*/g,'').replace(/\(\d+(?:\.\d+)?ms\)/g,'(<time>)');
 const scenarioKeys=['FA_TARGET_AREA','FA_BROWSER_ENGINE','FA_AUTH_BROWSER','PR_BASE_SHA'];
 const scenarioEnv=Object.fromEntries(scenarioKeys.filter(k=>env[k]).map(k=>[k,env[k]]));
 const assignments=Object.entries(scenarioEnv).map(([k,v])=>"$env:"+k+"='"+String(v).replaceAll("'","''")+"'");
 const portable=command[0]===process.execPath?['node',...command.slice(1)]:command[0]==='python3'?['py',...command.slice(1)]:command;
 const sourcePattern=/(?:backend\/(?:src|tools|tests)|assets|tools|tests)\/[\w./-]+\.(?:[cm]?[jt]s|py)(?::\d+(?::\d+)?)?/;
 const pathExcerpt=excerpt.replace(/\\+/g,'/');
 const file=pathExcerpt.match(sourcePattern)?.[0]??null;
 const locationFile=pathExcerpt.match(/location:\s*['"]?([^'\r\n]+\.test\.(?:mjs|mts|ts))(?::\d+(?::\d+)?)?/)?.[1]??null;
 const testFile=pathExcerpt.match(/(?:backend\/tests|tests)\/[\w./-]+\.test\.(?:mjs|mts|ts)(?::\d+(?::\d+)?)?/)?.[0]?.replace(/:\d+(?::\d+)?$/,'')??locationFile;
 const failedName=excerpt.match(/^([ \t]*)not ok \d+ - (.+)$/m);
 const testName=failedName?.[2]?.trim();
 const nested=!!failedName?.[1].length;
 const pureNode=command.includes('--test')||command.some(x=>/(?:ci-opt-01-node-runner|ci-selected|run-contracts)\.mjs$/.test(x))||command.includes('test:contracts');
 let reproductionCommand=portable;
 if(pureNode&&testFile&&testName&&!/(?:runtime\.test\.ts|d1-integration\.test\.ts)$/.test(testFile)){
  const path=command.find(x=>x.replace(/\\+/g,'/')===testFile||x.replace(/\\+/g,'/').endsWith('/'+testFile))??testFile;
  // Filtering a nested child alone can skip its parent and falsely replay green.
  // Keep the containing file for nested failures so ancestors actually execute.
  const pattern=testName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  reproductionCommand=['node',...(testFile.endsWith('.ts')||testFile.endsWith('.mts')?['--experimental-strip-types']:[]),'--test',...(!nested?['--test-name-pattern='+pattern]:[]),path];
 }
 const needsPreview=command.some(x=>/tests\/(?:int24-browser-qa|ci-opt-01-browser-smoke|clean-ui-03-)/.test(x));
 const prerequisites=needsPreview?['Install playwright@1.58.2 (and pixelmatch@7.1.0 pngjs@7.0.0 for CSS parity)','npx playwright install chromium webkit','Start node tools/dev-standings-preview.mjs in another PowerShell window; wait for http://app.localhost:2000/competitions']:[];
 const quote=x=>/^[a-zA-Z0-9_./:@=,+-]+$/.test(x)?x:"'"+x.replaceAll("'","''")+"'";
 return {status:signal?'CANCELLED':exitCode===0?'PASS':'FAIL',category:exitCode===0?null:(category??inferred),classification:exitCode===0?null:(category?'confirmed':'provisional'),
  scenario:lines.find(l=>/not ok|AssertionError/.test(l))??command.join(' '),
  file:file??testFile,testFile,
  error:exitCode===0?null:excerpt,expected:clean.match(/(?:expected:|expected\s*=)\s*([^\n]+)/i)?.[1]??null,
  actual:clean.match(/(?:actual:|received:)\s*([^\n]+)/i)?.[1]??null,
  environment:scenarioEnv,prerequisites,reproductionCommand,reproduce:[...assignments,reproductionCommand.map(quote).join(' ')].join('\n'),suiteReproduce:[...assignments,portable.map(quote).join(' ')].join('\n'),signature:createHash('sha256').update((JSON.stringify(scenarioEnv)+'\n'+command.join(' ')+'\n'+normalized).replace(/\b\d+(?:\.\d+)?ms\b/g,'<time>')).digest('hex').slice(0,16)};
}
