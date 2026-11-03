// Controlled failure-to-green experiment. Never edits application/test source or dispatches CI.
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {diagnose} from './ci-diagnostics.mjs';
const wrapper=fileURLToPath(new URL('./ci-run.mjs',import.meta.url));
const faulty='export function sum(a,b){return a-b+1;}\n';
const repaired='export function sum(a,b){return a+b;}\n';
const hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(root,workFactor){
 mkdirSync(join(root,'tests'),{recursive:true});
 writeFileSync(join(root,'model.mjs'),faulty);
 const names=['01-control-a','02-repair-case','03-control-b','04-control-c','05-control-d','06-control-e'];
 const files=names.map(name=>join(root,'tests',name+'.test.mjs'));
 for(const [i,file] of files.entries())writeFileSync(file,i===1?
  "import test from 'node:test';import assert from 'node:assert/strict';import {sum} from '../model.mjs';test('requested slots [stable]',()=>assert.equal(sum(12,12),24));\n":
  "import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';test('unrelated deterministic CPU workload "+i+"',()=>{let value='fixed';for(let n=0;n<"+workFactor+";n++)value=createHash('sha256').update(value).digest('hex');assert.equal(value.length,64);});\n");
 return files;
}
const testHash=files=>hash(files.map(f=>readFileSync(f,'utf8')).join('\n'));
function execute(args,{reportDir}={}){
 return new Promise((resolve,reject)=>{
  const start=performance.now();let text='',stderr='',detectionMs=null,diagnosisMs=null;
  const env={...process.env,...(reportDir?{FA_CI_REPORT_DIR:reportDir}:{})};
  // Each sample is an independent Node runner, including when the benchmark is itself tested.
  delete env.NODE_TEST_CONTEXT;
  const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});
  const read=(value,isError)=>{
   const part=value.toString();text+=part;if(isError)stderr+=part;
   if(detectionMs===null&&/not ok\s+\d+\s+-/.test(text))detectionMs=performance.now()-start;
   if(diagnosisMs===null){
    // Before: availability of complete raw assertion fields, not a fabricated human diagnosis time.
    // After: the tool's streamed, replay-ready structured record.
    if(reportDir&&/Failure details \(\d+ms\):/.test(stderr))diagnosisMs=performance.now()-start;
    else if(!reportDir){const record=diagnose({text,command:['node',...args]});if(record.testFile&&record.expected!==null&&record.actual!==null)diagnosisMs=performance.now()-start;}
   }
  };
  child.stdout.on('data',v=>read(v,false));child.stderr.on('data',v=>read(v,true));
  child.on('error',reject);
  child.on('close',(code,signal)=>{
   if(signal)return reject(Error('Benchmark cancelled: '+signal));
   const durationMs=performance.now()-start;
   const field=name=>Number([...text.matchAll(new RegExp('^# '+name+' (\\d+)$','gm'))].at(-1)?.[1]??NaN);
   resolve({code,text,stderr,durationMs,detectionMs,diagnosisMs,tests:field('tests'),pass:field('pass'),failed:field('fail'),skipped:field('skipped')});
  });
 });
}
async function sample(kind,root,workFactor){
 const files=fixture(root,workFactor),testsHash=testHash(files),started=performance.now();
 const faultyModelHash=hash(readFileSync(join(root,'model.mjs')));
 const full=['--test','--test-reporter=tap','--test-concurrency=1',...files];
 const reports=join(root,'reports');
 const initial=await execute(kind==='after'?[wrapper,'benchmark-initial','--',process.execPath,...full]:full,kind==='after'?{reportDir:reports}:{});
 if(initial.code!==1||initial.failed!==1||initial.detectionMs===null||initial.diagnosisMs===null)throw Error('Expected one fully diagnosed assertion failure: '+initial.text.slice(-4000));
 let replay=full;
 if(kind==='after'){
  const json=readdirSync(reports).find(f=>f.endsWith('.json'));if(!json)throw Error('Missing diagnostic artifact');
  const record=JSON.parse(readFileSync(join(reports,json),'utf8'));
  if(record.status!=='FAIL'||!record.reproductionCommand||record.expected?.trim()!=='24'||record.actual?.trim()!=='1')throw Error('Wrong failure diagnosis');
  replay=['--test-reporter=tap',...record.reproductionCommand.slice(1)];
  if(!replay.includes(files[1])||files.filter(f=>replay.includes(f)).length!==1)throw Error('Replay did not select the diagnosed file');
 }
 const reproductions=[];
 // Fixed experiment samples of the same known failure, never retry-until-PASS.
 for(let i=0;i<2;i++){
  const run=await execute(replay);
  if(run.code!==1||run.failed!==1)throw Error('Failure did not reproduce exactly once: '+run.text.slice(-4000));
  reproductions.push({durationMs:run.durationMs,files:files.filter(f=>replay.includes(f)).length,failed:run.failed,expectedFailure:true});
 }
 const patchStart=performance.now();writeFileSync(join(root,'model.mjs'),repaired);const patchApplicationMs=performance.now()-patchStart;
 const repairedModelHash=hash(readFileSync(join(root,'model.mjs')));
 const final=await execute(full);
 if(final.code!==0||final.tests!==6||final.pass!==6||final.failed!==0||final.skipped!==0)throw Error('Complete final coverage did not PASS: '+final.text.slice(-4000));
 const validatedTestsHash=testHash(files);if(validatedTestsHash!==testsHash)throw Error('Benchmark changed an assertion');
 return {detectionMs:initial.detectionMs,diagnosisMs:initial.diagnosisMs,initialRunMs:initial.durationMs,reproductions,patchApplicationMs,
  fullValidation:{durationMs:final.durationMs,tests:final.tests,pass:final.pass,skipped:final.skipped},totalCycleMs:performance.now()-started,
  testsHash,validatedTestsHash,faultyModelHash,repairedModelHash};
}
export async function runRepairBenchmark({trials=3,workFactor=50000}={}){
 if(!Number.isSafeInteger(trials)||trials<1||trials>10||!Number.isSafeInteger(workFactor)||workFactor<1||workFactor>1000000)throw Error('Invalid bounded benchmark inputs');
 const root=mkdtempSync(join(tmpdir(),'fa-repair-benchmark-')),results=[];
 try{
  for(let i=0;i<trials;i++){
   const pair={};for(const kind of (i%2?['after','before']:['before','after'])){const dir=join(root,i+'-'+kind);mkdirSync(dir);pair[kind]=await sample(kind,dir,workFactor);}
   if(pair.before.testsHash!==pair.after.testsHash||pair.before.faultyModelHash!==pair.after.faultyModelHash||pair.before.repairedModelHash!==pair.after.repairedModelHash)throw Error('Before/after fixture inputs differ');
   results.push(pair);
  }
  return {node:process.version,platform:process.platform,workFactor,repairMode:'automated known-source patch; no assertion changes',trials:results,
   methodology:'Identical faulty model, six immutable test files and CPU workload per pair. Both strategies initially execute FULL and finish with all six tests PASS, zero skipped. Before replays the available full-suite command; after executes the focused command from the actual streamed diagnostic artifact. Two fixed failing replays per strategy; one known model-source repair; no retries to hide a failure.',
   limitations:'Controlled synthetic tool-assisted repair, not a human repair-time estimate or application performance claim. Raw diagnostic-field availability is compared with a richer structured replay-ready record; wrapper overhead can increase detection/diagnostic latency and is reported. Timing is observational, never a test assertion or SLA.'};
 }finally{rmSync(root,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const result=await runRepairBenchmark();const output=resolve(process.argv[2]||'docs/ci/ci-opt-04-05-repair-benchmark.json');
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
