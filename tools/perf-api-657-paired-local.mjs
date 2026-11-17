// PERF-API #657: paired, read-only browser captures on the same disposable LOCAL D1 snapshot.
// Never uses the default remote-backed dev launcher, hosted Preview, or a production DB.
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {cpSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,relative,dirname,isAbsolute} from 'node:path';
import {createConnection} from 'node:net';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const DEFAULT_MEASURED_ROUTES=Object.freeze([
 '/dashboard','/calendar','/clubs','/clubs/it/1/overview',
 '/clubs/it/1/fixtures','/clubs/it/1/history'
]);
const SHA=/^[0-9a-f]{40}$/i;
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ORIGIN='http://app.localhost:2000';

export function parsePairedOptions(args){
 const options=new Map();
 for(const arg of args){
  const match=arg.match(/^--([a-z-]+)=(.*)$/);
  if(!match||!['before','after','snapshot','routes','runs','playwright','output'].includes(match[1])||
    options.has(match[1]))throw Error('Invalid or repeated PERF-API-657 option');
  options.set(match[1],match[2]);
 }
 const before=options.get('before'),after=options.get('after');
 if(!SHA.test(before||'')||!SHA.test(after||'')||before.toLowerCase()===after.toLowerCase())
  throw Error('Specify distinct exact 40-character --before and --after commit SHAs');
 const snapshot=options.get('snapshot');
 if(!snapshot||!isAbsolute(snapshot))throw Error('--snapshot must be an absolute, already prepared LOCAL D1 snapshot directory');
 const runs=Number(options.get('runs')||'2');
 if(!Number.isInteger(runs)||runs<1||runs>5)throw Error('--runs must be 1..5');
 const routes=options.has('routes')?options.get('routes').split(','):DEFAULT_MEASURED_ROUTES;
 if(!routes.length||routes.some(route=>!route.startsWith('/')||route.startsWith('//')||route.includes('#')||route.includes(',')||
   route.includes('\n'))||new Set(routes).size!==routes.length)
  throw Error('Routes must be distinct same-origin absolute paths');
 const playwright=options.get('playwright')||null;
 if(playwright!==null&&!isAbsolute(playwright))throw Error('--playwright must be an absolute path to playwright/index.mjs');
 const output=options.get('output')||join(ROOT,'int24-browser-artifacts');
 if(!isAbsolute(output))throw Error('--output must be an absolute directory');
 return {before:before.toLowerCase(),after:after.toLowerCase(),snapshot:resolve(snapshot),
  runs,routes,playwright:playwright&&resolve(playwright),output:resolve(output)};
}

function sqliteEvidence(root){
 let matches=0;
 const scan=(path,depth)=>{
  if(depth>9)return;
  for(const entry of readdirSync(path,{withFileTypes:true})){
   const next=join(path,entry.name);
   if(entry.isSymbolicLink())throw Error('LOCAL D1 snapshot must not contain symlinks');
   if(entry.isDirectory())scan(next,depth+1);
   else if(entry.isFile()&&entry.name.endsWith('.sqlite'))matches++;
  }
 };
 scan(root,0);
 return matches;
}
export function validateLocalSnapshot(snapshot,repositoryRoot=ROOT){
 if(!existsSync(snapshot)||!lstatSync(snapshot).isDirectory())throw Error('Missing LOCAL D1 snapshot directory');
 const rel=relative(repositoryRoot,snapshot);
 if(rel===''||(!rel.startsWith('..')&&!isAbsolute(rel)))
  throw Error('Create a separate disposable D1 snapshot OUTSIDE the working repository first; stop its Worker before copying');
 if(!sqliteEvidence(snapshot))throw Error('Snapshot contains no local Wrangler .sqlite database; do not benchmark empty/static-only data');
 return true;
}
function command(executable,args,{cwd=ROOT,timeout=900000,env=process.env}={}){
 const output=spawnSync(executable,args,{cwd,env,stdio:'inherit',timeout,
  shell:process.platform==='win32'&&executable.toLowerCase().endsWith('.cmd')});
 if(output.error||output.status!==0)throw Error('Command failed: '+executable+' (exit '+(output.status??'unknown')+')'+(output.error?' '+output.error.message:''));
}
function git(args,cwd=ROOT){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function tcpOpen(port){
 return new Promise(done=>{
  const socket=createConnection({host:'127.0.0.1',port});
  socket.setTimeout(900);
  socket.once('connect',()=>{socket.destroy();done(true)});
  socket.once('timeout',()=>{socket.destroy();done(false)});
  socket.once('error',()=>done(false));
 });
}
async function requireUnusedPorts(){
 if(await tcpOpen(2000)||await tcpOpen(8787))
  throw Error('Stop all existing local DEV servers on ports 2000/8787 before paired capture');
}
function stopTree(child){
 if(!child?.pid)return;
 if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',timeout:12000});
 else{try{process.kill(-child.pid,'SIGTERM')}catch{try{child.kill('SIGTERM')}catch{}}}
}
function startIsolatedWorker(checkout){
 const env={...process.env,FA_ADMIN_API_POOL:'',FA_DEV_LAN:'',FA_DEV_LAN_HOST:''};
 for(const name of ['CLOUDFLARE_API_TOKEN','CF_API_TOKEN','CLOUDFLARE_ACCOUNT_ID'])delete env[name];
 const processHandle=spawn(process.execPath,['tools/dev.mjs','--local'],{
  cwd:checkout,env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'
 });
 let last='';
 for(const stream of [processHandle.stdout,processHandle.stderr])
  stream.on('data',data=>{last=(last+String(data)).slice(-3500)});
 return {child:processHandle,logs:()=>last};
}
async function readReadyWorld(runner){
 const start=Date.now();
 while(Date.now()-start<65000){
  if(runner.child.exitCode!==null)throw Error('Isolated Worker exited: '+runner.logs());
  try{
   const controller=AbortSignal.timeout(2000);
   const [worldResponse,permissions]=await Promise.all([
    fetch(ORIGIN+'/api/world',{headers:{Accept:'application/json'},signal:controller}),
    fetch(ORIGIN+'/api/player/permissions',{headers:{Accept:'application/json'},signal:controller})
   ]);
   if(worldResponse.status===200&&[200,401].includes(permissions.status)&&
      worldResponse.headers.get('content-type')?.includes('application/json')){
    const body=await worldResponse.json();
    const world=body?.world;
    if(!world||!Number.isSafeInteger(world.seasonNumber)||world.seasonNumber<1||
       !Number.isSafeInteger(world.revision)||typeof world.generation!=='string')
     throw Error('D1 snapshot must contain an authoritative prepared season (not Season 0)');
    return {generation:world.generation,revision:world.revision,
      seasonNumber:world.seasonNumber,day:world.day,phase:world.phase};
   }
  }catch(error){if(error.message.includes('D1 snapshot must'))throw error}
  await new Promise(ok=>setTimeout(ok,400));
 }
 throw Error('Timed out waiting for LOCAL Worker /api/world and anonymous permissions: '+runner.logs());
}
function preparePlaywright(options,temp){
 if(options.playwright){
  if(!existsSync(options.playwright))throw Error('Specified --playwright module was not found');
  return pathToFileURL(options.playwright).href;
 }
 const deps=join(temp,'browser-deps');
 mkdirSync(deps,{recursive:true});
 command(process.platform==='win32'?'npm.cmd':'npm',
  ['install','--prefix',deps,'--no-package-lock','--no-save','playwright@1.58.2']);
 const packageDir=join(deps,'node_modules','playwright');
 command(process.execPath,[join(packageDir,'cli.js'),'install','chromium']);
 const entry=join(packageDir,'index.mjs');
 if(!existsSync(entry))throw Error('Pinned Playwright entry missing after installation');
 return pathToFileURL(entry).href;
}
function stageCheckout(dir,sha,snapshot,onAdded){
 command('git',['worktree','add','--detach',dir,sha]);
 onAdded(dir);
 if(git(['rev-parse','HEAD'],dir)!==sha)throw Error('Served checkout HEAD mismatches declared SHA');
 cpSync(snapshot,join(dir,'backend','.wrangler','state'),{recursive:true,force:false,errorOnExist:true});
 command(process.platform==='win32'?'npm.cmd':'npm',['ci','--prefix','backend'],{cwd:dir});
 const config=readFileSync(join(dir,'backend','wrangler.toml'),'utf8');
 if(!config.includes('database_name = "fa-admin-world-local"')||
    !config.includes('database_id = "00000000-0000-4000-8000-000000000001"'))
  throw Error('Refuse a checkout whose default local Wrangler binding differs from the isolated D1');
}
async function run(){
 const options=parsePairedOptions(process.argv.slice(2));
 validateLocalSnapshot(options.snapshot);
 if(!existsSync(join(ROOT,'.git'))&&!git(['rev-parse','--is-inside-work-tree']).includes('true'))
  throw Error('Run this command inside the football-architect git repository');
 for(const sha of [options.before,options.after])git(['cat-file','-e',sha+'^{commit}']);
 await requireUnusedPorts();
 const temp=mkdtempSync(join(tmpdir(),'fa-perf-api-657-'));
 const beforeDir=join(temp,'before'),afterDir=join(temp,'after');
 mkdirSync(options.output,{recursive:true});
 let running=null,created=[],worldBefore=null;
 const names={
  before:'perf-api-657-before-'+options.before.slice(0,10)+'.json',
  after:'perf-api-657-after-'+options.after.slice(0,10)+'.json',
  comparison:'perf-api-657-comparison-'+options.before.slice(0,10)+'-'+options.after.slice(0,10)+'.json'
 };
 try{
  stageCheckout(beforeDir,options.before,options.snapshot,dir=>created.push(dir));
  stageCheckout(afterDir,options.after,options.snapshot,dir=>created.push(dir));
  const playwright=preparePlaywright(options,temp);
  for(const [label,servedDir,sha] of [['before',beforeDir,options.before],['after',afterDir,options.after]]){
   await requireUnusedPorts();
   running=startIsolatedWorker(servedDir);
   const observed=await readReadyWorld(running);
   if(worldBefore===null)worldBefore=observed;
   else if(JSON.stringify(observed)!==JSON.stringify(worldBefore))
    throw Error('Worker world generation/revision/season/day differ; paired captures are NOT comparable');
   // Same sampler code executes against both actual served checkouts.
   command(process.execPath,['tools/perf-api-01-requests.mjs',label,
    '--served-head='+sha,'--runs='+options.runs,'--routes='+options.routes.join(',')],{
    cwd:afterDir,env:{...process.env,FA_ACCOUNT_PLAYWRIGHT:playwright}});
   const file=join(afterDir,'int24-browser-artifacts','perf-api-01-'+label+'.json');
   if(!existsSync(file))throw Error('Sampler produced no '+label+' capture');
   const report=JSON.parse(readFileSync(file,'utf8'));
   if(report.head!==sha||report.captureSchemaVersion!==2)
    throw Error('Sampler HEAD/schema mismatch on '+label);
   copyFileSync(file,join(options.output,names[label]));
   stopTree(running.child);running=null;
   const deadline=Date.now()+10000;
   while((await tcpOpen(2000)||await tcpOpen(8787))&&Date.now()<deadline)
    await new Promise(ok=>setTimeout(ok,200));
  }
  await requireUnusedPorts();
  command(process.execPath,['tools/perf-api-01-compare.mjs',
   join(options.output,names.before),join(options.output,names.after),
   join(options.output,names.comparison)],{cwd:afterDir});
  const comparison=JSON.parse(readFileSync(join(options.output,names.comparison),'utf8'));
  if(!comparison.pairs?.countComparable||!comparison.pairs?.wireComparable)
   throw Error('Capture completed but no fully comparable on-wire pairs; inspect the saved reports, do not claim a saving');
  console.log('PERF-API-657 LOCAL paired read audit complete: '+comparison.pairs.wireComparable+
    ' wire-comparable visits. Reports: '+options.output);
 }finally{
  if(running)stopTree(running.child);
  for(const path of created.reverse()){
   try{command('git',['worktree','remove','--force',path],{timeout:120000})}
   catch{console.error('Disposable worktree cleanup needed: '+path)}
  }
  rmSync(temp,{recursive:true,force:true,maxRetries:3,retryDelay:200});
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 run().catch(error=>{console.error('PERF-API-657: '+error.message);process.exitCode=1});
}
