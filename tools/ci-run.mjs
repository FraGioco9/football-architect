// Streaming subprocess evidence, without retry or exit-status masking.
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {diagnose} from './ci-diagnostics.mjs';
const divider=process.argv.indexOf('--');
if(divider<0||!process.argv[divider+1])throw Error('Usage: node tools/ci-run.mjs LABEL -- COMMAND [ARG ...]');
const label=(process.argv[2]||'suite').replace(/[^a-zA-Z0-9_-]/g,'-');
const command=process.argv.slice(divider+1),start=performance.now();
const dir=process.env.FA_CI_REPORT_DIR||join(process.env.RUNNER_TEMP||tmpdir(),'fa-ci-artifacts');mkdirSync(dir,{recursive:true});
const stem=dir+'/'+label+'-'+Date.now();let text='',firstFailureMs=null;
writeFileSync(stem+'.log','');
let executable=command[0],args=command.slice(1);
// npm's JS entrypoint avoids .cmd shell quoting and preserves PowerShell parity.
if(process.platform==='win32'&&executable==='npm'){
 const npm=execFileSync('where.exe',['npm'],{encoding:'utf8'}).split(/\r?\n/).find(p=>p.endsWith('npm.cmd'));
 if(!npm)throw Error('npm.cmd not found on PATH');
 executable=process.execPath;args=[npm.replace(/npm\.cmd$/,'node_modules/npm/bin/npm-cli.js'),...args];
}
const child=spawn(executable,args,{stdio:['inherit','pipe','pipe'],env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
function receive(chunk,stream){
 const value=chunk.toString();stream.write(value);appendFileSync(stem+'.log',value);text+=value;
 if(firstFailureMs===null&&/not ok|AssertionError|(?:^|\n)Error:|error:/.test(text)){
  firstFailureMs=Math.round(performance.now()-start);
  const record=diagnose({text,command});
  process.stderr.write('\nFirst actionable failure ('+firstFailureMs+'ms): '+JSON.stringify(record)+'\n');
 }
}
child.stdout.on('data',c=>receive(c,process.stdout));child.stderr.on('data',c=>receive(c,process.stderr));
child.on('error',e=>receive(String(e)+'\n',process.stderr));
child.on('close',(code,signal)=>{
 const result={...diagnose({text,command,exitCode:code??1,signal}),durationMs:Math.round(performance.now()-start),firstFailureMs,
  trackedChanges:execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),
  head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),attempt:process.env.GITHUB_RUN_ATTEMPT??null,
  log:stem+'.log',run:process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null};
 writeFileSync(stem+'.json',JSON.stringify(result,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n### '+label+' — '+result.status+'\n\n```json\n'+JSON.stringify(result,null,2).replaceAll('```','` ` `')+'\n```\n\n[Logs and artifacts]('+result.run+'#artifacts)\n');
 process.exitCode=code??1;
});
