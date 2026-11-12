import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {sharedDevPlan,startSharedDev,validateSharedPreviewTarget,selectDevMode,localDevPlan,startLocalDev} from '../tools/dev.mjs';
import {readFileSync} from 'node:fs';
import {verifySharedPreviewReadiness} from '../tools/shared-nonproduction-proxy.mjs';

const target='https://preview.football-architect.workers.dev';
function payload(value,status=200){
 return {status,headers:{'content-type':'application/json'},body:Buffer.from(JSON.stringify(value))};
}
function fakeProcess(flags){
 const proc=new EventEmitter(),messages=[];
 Object.assign(proc,{argv:['node','tools/dev.mjs',...flags],platform:'linux',execPath:'/node',
  env:{FA_ADMIN_API_TARGET:'https://production.example.invalid',FA_ADMIN_API_POOL:'production',
   FA_DEV_LAN:'1',FA_DEV_LAN_HOST:'10.0.0.8',SENTINEL:'preserved'},
  stdout:{write:s=>messages.push(s)},stderr:{write:s=>messages.push(s)},exitCode:0});
 return {proc,messages};
}
test('canonical DEV uses local Worker and shared D1 without a Preview deployment, isolated D1 requires --local',()=>{
 assert.deepEqual(selectDevMode([]),{mode:'remote-d1',lanAddress:null});
 assert.deepEqual(selectDevMode(['--lan','192.168.1.90']),{mode:'remote-d1',lanAddress:'192.168.1.90'});
 assert.deepEqual(selectDevMode(['--shared',target]),{mode:'shared',target});
 assert.deepEqual(selectDevMode(['--local']),{mode:'local',lanAddress:null});
 assert.deepEqual(selectDevMode(['--local','--lan','192.168.1.90']),{mode:'local',lanAddress:'192.168.1.90'});
 assert.throws(()=>selectDevMode(['--lan']),/DEV usage/);
 for(const flags of [['--remote'],['--shared'],['--shared','https://example.invalid'],['--local','--shared'],['--local','--lan'],['--local','--lan','192.168.1.90','extra']])
  assert.throws(()=>selectDevMode(flags),/DEV usage|Shared DEV/);
});

test('shared mode requires exact nonproduction HTTPS Worker origin, never Production or arbitrary URLs',()=>{
 assert.equal(validateSharedPreviewTarget(target),target);
 assert.throws(()=>validateSharedPreviewTarget('https://football-architect-preview.example.workers.dev'),/Shared DEV/);
 for(const bad of ['','http://'+target.slice(8),'https://example.com','https://production.example.workers.dev',
  target+'/api/world',target+'/',target+'?x=1',target+'#x',target.replace('https://','https://user@'),
  target+'.evil.invalid','https://localhost','https://127.0.0.1', 'https://preview.example.invalid',
  target.replace('football-architect','another-account')])
  assert.throws(()=>validateSharedPreviewTarget(bad),/Shared DEV/);
});

test('remote D1 local Worker configuration targets the approved nonproduction resource only',()=>{
 const config=readFileSync(new URL('../backend/wrangler.shared-dev.toml',import.meta.url),'utf8');
 assert.match(config,/database_name = "football-architect-dev"/);
 assert.match(config,/database_id = "6a6c7803-56d3-4e7f-bd01-752d06a32341"/);
 assert.match(config,/remote = true/);
 assert.match(config,/PLAYER_MODE = "local"/);
 assert.match(config,/PLAYER_ORIGIN = "http:\/\/app.localhost:2000"/);
 assert.match(config,/PLAYER_LOCAL_INBOX_ENABLED = "false"/);
 assert.doesNotMatch(config,/PLAYER_MODE = "production"|football-architect-prod"/);
});

test('default shared D1 executes Worker code locally; explicit offline --local isolates storage',()=>{
 const env={FA_ADMIN_API_TARGET:'https://production.invalid',FA_ADMIN_API_POOL:'production',FA_DEV_LAN:'1'};
 for(const sharedD1 of [true,false]){
  const [backend,frontend]=localDevPlan({platform:'linux',execPath:'/node',env,sharedD1});
  assert.deepEqual(backend.args,['run',sharedD1?'dev:shared':'dev','--prefix','backend']);
  assert.equal(frontend.command,'/node');
  assert.deepEqual(frontend.args,['tools/dev-app-preview.mjs']);
  assert.equal(frontend.options.env.FA_ADMIN_API_TARGET,'http://127.0.0.1:8787');
  assert.equal(frontend.options.env.FA_ADMIN_API_POOL,'');
 }
 const {proc,messages}=fakeProcess([]),spawned=[];
 const spawnChild=(command,args,options)=>{
  const child=new EventEmitter();Object.assign(child,{pid:100+spawned.length,killed:false,kill(){this.killed=true}});
  spawned.push({command,args,options,child});return child;
 };
 const dev=startLocalDev({proc,spawnChild,sharedD1:true});
 assert.equal(spawned.length,2);
 assert.deepEqual(spawned[0].args,['run','dev:shared','--prefix','backend']);
 assert.ok(messages.join('').includes('remote binding: football-architect-dev D1'));
 assert.equal(spawned[1].options.env.FA_ADMIN_API_POOL,'');
 proc.emit('SIGINT');
 assert.ok(dev.children.every(c=>c.killed));
});

test('shared plan starts frontend only, never a local Worker or inherited production/LAN settings',()=>{
 const plan=sharedDevPlan({target,execPath:'/node',env:{FA_ADMIN_API_POOL:'production',
  FA_ADMIN_API_TARGET:'https://production.invalid',FA_DEV_LAN:'1',FA_DEV_LAN_HOST:'10.0.0.2',FOO:'value'}});
 assert.equal(plan.length,1);
 assert.equal(plan[0].command,'/node');
 assert.deepEqual(plan[0].args,['tools/dev-app-preview.mjs']);
 assert.equal(plan[0].options.env.FA_ADMIN_API_TARGET,target);
 assert.equal(plan[0].options.env.FA_ADMIN_API_POOL,'dev-preview');
 assert.equal(plan[0].options.env.FA_DEV_LAN,'');
 assert.equal(plan[0].options.env.FA_DEV_LAN_HOST,'');
 assert.equal(plan[0].options.env.FOO,'value');
});

test('readiness checks environment, world and Players API anonymously, without any POST or cookies',async()=>{
 const calls=[];
 const ready=await verifySharedPreviewReadiness(target,{send:async(url,options)=>{
  calls.push({path:url.pathname+url.search,options});
  if(url.pathname==='/api/environment')
   return payload({schemaVersion:1,pool:'dev-preview',origin:target,sharedWorld:true,separateSignIn:true});
  if(url.pathname==='/api/world')return payload({world:{generation:'world-id',seasonNumber:0}});
  if(url.pathname+url.search==='/api/players?page=1')
   return payload({count:11,page:1,totalPages:1,players:Array.from({length:11},(_,i)=>({id:i+1}))});
  throw Error('unexpected request');
 }});
 assert.deepEqual(ready,{ready:true,count:11});
 assert.deepEqual(calls.map(c=>c.path),['/api/environment','/api/world','/api/players?page=1']);
 for(const c of calls){
  assert.equal(c.options.method,'GET');
  assert.deepEqual(c.options.headers,{'x-fa-expected-pool':'dev-preview'});
  assert.ok(!('body' in c.options));
 }
});

test('missing tables, stale Worker and wrong pool fail closed before launching any DEV process',async()=>{
 for(const bad of [
  {step:0,value:{schemaVersion:1,pool:'production',origin:target,sharedWorld:true,separateSignIn:true}},
  {step:1,value:{error:{code:'world_unavailable'}}},
  {step:2,value:{error:{code:'not_found'}}},
  {step:2,value:{count:11,page:1,players:[]}},
  {step:2,value:{count:1,page:1,players:[{id:'legacy-uuid'}]}}
 ]){
  let n=0;
  const readiness=await verifySharedPreviewReadiness(target,{send:async(url)=>{
   if(n++===bad.step)return payload(bad.value);
   if(url.pathname==='/api/environment')return payload({schemaVersion:1,pool:'dev-preview',origin:target,sharedWorld:true,separateSignIn:true});
   if(url.pathname==='/api/world')return payload({world:{generation:'world-id'}});
   return payload({count:0,page:1,players:[]});
  }});
  assert.equal(readiness.ready,false);
 }
 const {proc}=fakeProcess(['--shared',target]),spawned=[];
 await assert.rejects(()=>startSharedDev({proc,spawnChild:(...x)=>{spawned.push(x)},verify:async()=>({ready:false,reason:'players_api_unavailable'})}),/players_api_unavailable.*publish an approved Preview build first/);
 assert.equal(spawned.length,0);
});

test('explicit shared mode performs a successful read-only preflight then launches exactly one frontend',async()=>{
 const {proc,messages}=fakeProcess(['--shared',target]),spawned=[],seen=[];
 const spawnChild=(command,args,options)=>{
  const child=new EventEmitter();
  Object.assign(child,{pid:100,killed:false,kill(){this.killed=true}});
  spawned.push({command,args,options,child});
  return child;
 };
 const result=await startSharedDev({proc,spawnChild,verify:async origin=>{
  seen.push(origin);return {ready:true,count:11};
 }});
 assert.deepEqual(seen,[target]);
 assert.equal(spawned.length,1);
 assert.ok(messages.join('').includes('Existing online players: 11'));
 assert.equal(spawned[0].options.env.FA_ADMIN_API_POOL,'dev-preview');
 assert.equal(spawned[0].options.env.FA_ADMIN_API_TARGET,target);
 proc.emit('SIGINT');
 assert.equal(result.children[0].killed,true);
 result.children[0].emit('exit',0,null);
 assert.equal(proc.exitCode,0,'normal Ctrl+C is not a shared DEV failure');
 const {proc:invalid}=fakeProcess(['--shared',target,'--lan']);
 await assert.rejects(()=>startSharedDev({proc:invalid,spawnChild}),/DEV usage/);
 const {proc:local}=fakeProcess(['--local']);
 await assert.rejects(()=>startSharedDev({proc:local,spawnChild}),/Shared DEV requires/);
});
