import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {sharedDevPlan,startSharedDev,validateSharedPreviewTarget} from '../tools/dev.mjs';
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
test('shared mode requires exact nonproduction HTTPS Worker origin, never Production or arbitrary URLs',()=>{
 assert.equal(validateSharedPreviewTarget(target),target);
 assert.throws(()=>validateSharedPreviewTarget('https://football-architect-preview.example.workers.dev'),/Shared DEV/);
 for(const bad of ['','http://'+target.slice(8),'https://example.com','https://production.example.workers.dev',
  target+'/api/world',target+'/',target+'?x=1',target+'#x',target.replace('https://','https://user@'),
  target+'.evil.invalid','https://localhost','https://127.0.0.1', 'https://preview.example.invalid',
  target.replace('football-architect','another-account')])
  assert.throws(()=>validateSharedPreviewTarget(bad),/Shared DEV/);
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
  calls.push({path:url.pathname,options});
  if(url.pathname==='/api/environment')
   return payload({schemaVersion:1,pool:'dev-preview',origin:target,sharedWorld:true,separateSignIn:true});
  if(url.pathname==='/api/world')return payload({world:{generation:'world-id',seasonNumber:0}});
  if(url.pathname==='/api/players/page/1')
   return payload({count:11,page:1,totalPages:1,players:Array.from({length:11},(_,i)=>({id:i+1}))});
  throw Error('unexpected request');
 }});
 assert.deepEqual(ready,{ready:true,count:11});
 assert.deepEqual(calls.map(c=>c.path),['/api/environment','/api/world','/api/players/page/1']);
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
 await assert.rejects(()=>startSharedDev({proc,spawnChild:(...x)=>{spawned.push(x)},verify:async()=>({ready:false,reason:'players_api_unavailable'})}),/players_api_unavailable/);
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
 await assert.rejects(()=>startSharedDev({proc:invalid,spawnChild}),/Shared DEV requires/);
});
