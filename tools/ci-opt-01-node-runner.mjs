// Bounded file-process concurrency. Every unreviewed or changed test stays serial.
import {readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import review from './ci-opt-01-node-review.json' with {type:'json'};

export function buildPlan({read=readFileSync,list=readdirSync}={}){
 const files=list('tests').filter(x=>x.endsWith('.test.mjs')).sort().map(x=>'tests/'+x);
 if(!files.length)throw Error('No Node test files discovered; refusing a false FULL pass');
 const valid=Object.entries(review.fingerprints).every(([path,hash])=>{
  try{return createHash('sha256').update(read(path)).digest('hex')===hash}catch{return false}
 });
 const parallel=valid?files.filter(x=>review.tests.includes(x)):[];
 return {total:files.length,parallel,serial:files.filter(x=>!parallel.includes(x)),reviewValid:valid};
}
function run(files,concurrency,{capture=false}={}){
 if(!files.length)return {milliseconds:0,tests:0};
 const start=performance.now();
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency='+concurrency,...files],{
  stdio:capture?'pipe':'inherit',encoding:'utf8',maxBuffer:32*1024*1024
 });
 if(result.error||result.status!==0){
  if(capture)process.stderr.write((result.stdout||'')+(result.stderr||''));
  throw Error('Node lane failed: '+(result.error?.message||result.status));
 }
 const tests=capture?Number(result.stdout.match(/^# tests (\d+)$/m)?.[1]):null;
 if(capture&&(!tests||!/^# fail 0$/m.test(result.stdout)))throw Error('Missing complete passing TAP summary');
 return {milliseconds:Math.round(performance.now()-start),tests};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const plan=buildPlan();
 console.log('Node partition: '+JSON.stringify(plan));
 if(process.argv.includes('--benchmark')){
  if(!plan.parallel.length)throw Error('Audit fingerprints changed; re-audit before a controlled parallel trial');
  const trials=[];
  for(let i=0;i<3;i++){
   // Alternate order to reduce warm-cache bias; never run overlapping lanes.
   const pair={};
   for(const n of (i%2?[2,1]:[1,2]))pair[n]=run(plan.parallel,n,{capture:true});
   if(pair[1].tests!==pair[2].tests)throw Error('Serial/parallel coverage mismatch');
   trials.push({serial:pair[1],parallel:pair[2]});
  }
  console.log('CI-OPT-01 controlled trials: '+JSON.stringify(trials));
 }else{
  run(plan.parallel,2);
  run(plan.serial,1);
  console.log('FULL Node partition PASS: '+plan.total+' files; no files excluded.');
 }
}
