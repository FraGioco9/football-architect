// Canonical loopback-only local development launcher (site + local Worker/D1).
// Never points at a remote database or the shared Dev/Preview account pool.
import {spawn} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const LOCAL_API='http://127.0.0.1:8787';

export function localDevPlan({platform=process.platform,execPath=process.execPath,env=process.env}={}){
 const localEnv={...env,FA_ADMIN_API_TARGET:LOCAL_API,FA_ADMIN_API_POOL:'',FA_DEV_LAN:''};
 return [
  {name:'backend',command:platform==='win32'?'npm.cmd':'npm',args:['run','dev','--prefix','backend'],options:{cwd:ROOT,env:localEnv,stdio:'inherit',shell:platform==='win32'}},
  {name:'frontend',command:execPath,args:['tools/dev-app-preview.mjs'],options:{cwd:ROOT,env:localEnv,stdio:'inherit'}}
 ];
}

export function startLocalDev({proc=process,spawnChild=spawn}={}){
 if(proc.argv.length!==2)throw Error('Canonical DEV launcher accepts no CLI flags');
 const children=[];
 let stopping=false;
 const stop=()=>{
  if(stopping)return;
  stopping=true;
  for(const child of children)if(child.pid&&!child.killed)child.kill();
 };
 const fail=(name,error)=>{
  if(stopping)return;
  proc.stderr.write('Local DEV '+name+' stopped: '+error+'\n');
  proc.exitCode=1;
  stop();
 };
 proc.on('SIGINT',stop);
 proc.on('SIGTERM',stop);
 try{
  for(const spec of localDevPlan({platform:proc.platform,execPath:proc.execPath,env:proc.env})){
   const child=spawnChild(spec.command,spec.args,spec.options);
   children.push(child);
   child.on('error',error=>fail(spec.name,error.message));
   child.on('exit',(code,signal)=>fail(spec.name,'exit '+(code??signal??'unknown')));
  }
 }catch(error){
  fail('startup',error.message);
  return {children,stop};
 }
 proc.stdout.write('Local-only DEV: Site http://localhost:2000/ | App http://app.localhost:2000/dashboard\n');
 proc.stdout.write('Local Worker/D1: http://127.0.0.1:8787 (GET /api/world through app.localhost:2000)\n');
 proc.stdout.write('Player registration: http://app.localhost:2000/account/register\n');
 proc.stdout.write('Dev inbox: http://app.localhost:2000/api/local-dev/inbox\n');
 proc.stdout.write('Stop with Ctrl+C. No remote D1, shared Preview account pool, deploy or emails.\n');
 return {children,stop};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startLocalDev();
