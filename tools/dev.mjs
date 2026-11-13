// DEV launcher: local Worker code with a verified remote DEV/Preview D1 by default.
// Isolated local Worker/D1 remains available only through explicit --local.
import {spawn} from 'node:child_process';
import {networkInterfaces} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifySharedPreviewReadiness} from './shared-nonproduction-proxy.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const LOCAL_API='http://127.0.0.1:8787';

// Only explicitly selected, owned RFC1918 Wi-Fi/LAN interfaces are eligible.
// Never infer LAN exposure from inherited environment variables.
export function validateLanAddress(value,interfaces=networkInterfaces()){
 const parts=typeof value==='string'?value.split('.'):[];
 if(parts.length!==4||parts.some(part=>!/^(0|[1-9][0-9]{0,2})$/.test(part)||Number(part)>255))
  throw Error('LAN address must be an IPv4 literal, e.g. 192.168.1.90');
 const [first,second]=parts.map(Number);
 if(!(first===10||(first===172&&second>=16&&second<=31)||(first===192&&second===168)))
  throw Error('LAN address must be a private RFC1918 IPv4 address');
 const owned=Object.values(interfaces||{}).flatMap(entries=>entries||[])
  .some(entry=>entry.family==='IPv4'&&!entry.internal&&entry.address===value);
 if(!owned)throw Error('LAN address must be assigned to an active non-loopback interface on this PC');
 return value;
}

export function localDevPlan({platform=process.platform,execPath=process.execPath,env=process.env,lanAddress=null,sharedD1=false}={}){
 const localEnv={...env,FA_ADMIN_API_TARGET:LOCAL_API,FA_ADMIN_API_POOL:'',FA_DEV_LAN:'',FA_DEV_LAN_HOST:''};
 const frontendEnv=lanAddress?{...localEnv,FA_DEV_LAN:'1',FA_DEV_LAN_HOST:lanAddress}:localEnv;
 return [
  {name:'backend',command:platform==='win32'?'npm.cmd':'npm',args:['run',sharedD1?'dev:shared':'dev','--prefix','backend'],options:{cwd:ROOT,env:localEnv,stdio:'inherit',shell:platform==='win32'}},
  {name:'frontend',command:execPath,args:['tools/dev-app-preview.mjs'],options:{cwd:ROOT,env:frontendEnv,stdio:'inherit'}}
 ];
}

/** The approved, read-only verified Preview Worker. Never relay account cookies to
 * other .workers.dev tenants: a self-declared pool handshake is not ownership proof. */
export const SHARED_PREVIEW_TARGET='https://preview.football-architect.workers.dev';
/** Parse before starting any children; never fall back to a different database. */
export function selectDevMode(flags=[]){
 if(flags.length===0)return {mode:'remote-d1',lanAddress:null};
 if(flags.length===2&&flags[0]==='--lan')return {mode:'remote-d1',lanAddress:flags[1]};
 if(flags.length===2&&flags[0]==='--shared')return {mode:'shared',target:validateSharedPreviewTarget(flags[1])};
 if(flags.length===1&&flags[0]==='--local')return {mode:'local',lanAddress:null};
 if(flags.length===3&&flags[0]==='--local'&&flags[1]==='--lan')return {mode:'local',lanAddress:flags[2]};
 throw Error('DEV usage: node tools/dev.mjs [--lan <private IPv4> | --local [--lan <private IPv4>] | --shared '+SHARED_PREVIEW_TARGET+']');
}
export function validateSharedPreviewTarget(target){
 if(target!==SHARED_PREVIEW_TARGET)
  throw Error('Shared DEV requires the exact approved nonproduction Workers Preview HTTPS origin');
 const url=new URL(target);
 if(url.origin!==target||url.pathname!=='/'||url.search||url.hash||url.username||url.password)
  throw Error('Shared DEV target must be an exact HTTPS origin without credentials, paths or parameters');
 return target;
}

export function sharedDevPlan({target,execPath=process.execPath,env=process.env}={}){
 const origin=validateSharedPreviewTarget(target);
 const sharedEnv={...env,FA_ADMIN_API_TARGET:origin,FA_ADMIN_API_POOL:'dev-preview',
  FA_DEV_LAN:'',FA_DEV_LAN_HOST:''};
 return [{name:'frontend',command:execPath,args:['tools/dev-app-preview.mjs'],
  options:{cwd:ROOT,env:sharedEnv,stdio:'inherit'}}];
}

/** Handshake before spawning anything: incompatible Preview must never fall back
 * to local D1 or accidentally proxy private operations to another environment. */
export async function startSharedDev({proc=process,spawnChild=spawn,verify=verifySharedPreviewReadiness}={}){
 const choice=selectDevMode(proc.argv.slice(2));
 if(choice.mode!=='shared')throw Error('Shared DEV requires the default invocation or explicit --shared URL');
 const target=validateSharedPreviewTarget(choice.target);
 const readiness=await verify(target);
 if(!readiness||readiness.ready!==true){
  const reason=readiness?.reason??'unavailable';
  const hint=reason==='players_api_unavailable'
   ? ' (Preview needs the current GET /api/players?page=1 endpoint; publish an approved Preview build first)'
   : '';
  throw Error('Shared DEV refused: '+reason+hint+'; no local server started and no D1 was changed');
 }
 const [spec]=sharedDevPlan({target,execPath:proc.execPath,env:proc.env});
 const child=spawnChild(spec.command,spec.args,spec.options);
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;if(child.pid&&!child.killed)child.kill()};
 const fail=error=>{if(stopping)return;proc.stderr.write('Shared DEV frontend stopped: '+error+'\n');proc.exitCode=1;stop()};
 proc.on('SIGINT',stop);proc.on('SIGTERM',stop);
 child.on('error',error=>fail(error.message));
 child.on('exit',(code,signal)=>fail('exit '+(code??signal??'unknown')));
 proc.stdout.write('Shared DEV frontend: http://app.localhost:2000/players\n');
 proc.stdout.write('API source: verified DEV/Preview Worker '+target+' (D1 online; no local Worker/D1)\n');
 proc.stdout.write('Existing online players: '+readiness.count+'; remote writes require separately authorized operations.\n');
 return {children:[child],stop};
}

export function startLocalDev({proc=process,spawnChild=spawn,interfaces=networkInterfaces,sharedD1=false}={}){
 const flags=proc.argv.slice(2);
 // The canonical dev.mjs CLI defaults to local Worker + shared remote D1.
 // The legacy --lan flag is safe: public frontend only; no private LAN APIs.
 const legacyLan=flags.length===2&&flags[0]==='--lan';
 const explicitLocal=flags.length===1&&flags[0]==='--local';
 const explicitLan=flags.length===3&&flags[0]==='--local'&&flags[1]==='--lan';
 if(sharedD1&&flags.length&&!legacyLan)throw Error('Shared D1 DEV accepts only --lan <private IPv4>');
 if(!sharedD1&&flags.length&&!(legacyLan||explicitLocal||explicitLan))
  throw Error('Isolated local DEV requires --local [--lan <private IPv4>]');
 const lanAddress=legacyLan||explicitLan?validateLanAddress(flags[flags.length-1],interfaces()):null;
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
  for(const spec of localDevPlan({platform:proc.platform,execPath:proc.execPath,env:proc.env,lanAddress,sharedD1})){
   const child=spawnChild(spec.command,spec.args,spec.options);
   children.push(child);
   child.on('error',error=>fail(spec.name,error.message));
   child.on('exit',(code,signal)=>fail(spec.name,'exit '+(code??signal??'unknown')));
  }
 }catch(error){
  fail('startup',error.message);
  return {children,stop};
 }
 proc.stdout.write('Local DEV: Site http://localhost:2000/ | App http://app.localhost:2000/dashboard\n');
 if(lanAddress)proc.stdout.write('LAN Safari QA frontend: http://'+lanAddress+':2000/dashboard (landing at /; backend/API unavailable over LAN)\n');
 if(sharedD1){
  proc.stdout.write('Local Worker: http://127.0.0.1:8787; remote binding: football-architect-dev D1 (shared with Preview)\n');
  proc.stdout.write('Account sign-in: http://app.localhost:2000/account/login (separate session from hosted Preview)\n');
  proc.stdout.write('No deploy, schema migrations or database copy. Actions on this DEV may write to shared D1.\n');
 }else{
  proc.stdout.write('Local Worker/D1: http://127.0.0.1:8787 (GET /api/world through app.localhost:2000)\n');
  proc.stdout.write('Player registration: http://app.localhost:2000/account/register\n');
  proc.stdout.write('Dev inbox: http://app.localhost:2000/api/local-dev/inbox\n');
  proc.stdout.write('Stop with Ctrl+C. No remote D1, shared Preview account pool, deploy or emails.\n');
 }
 return {children,stop};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const choice=selectDevMode(process.argv.slice(2));
  if(choice.mode==='shared')startSharedDev().catch(error=>{
   process.stderr.write('Hosted Preview bridge denied: '+error.message+'\n');
   process.exitCode=1;
  });
  else startLocalDev({sharedD1:choice.mode==='remote-d1'});
 }catch(error){
  process.stderr.write('DEV startup denied: '+error.message+'\n');
  process.exitCode=1;
 }
}
