import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter, once} from 'node:events';
import {createServer, request} from 'node:http';
import {localDevPlan, startLocalDev, validateLanAddress, selectDevMode} from '../tools/dev.mjs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';

function get(port,path,host,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port,path,method,headers:{host}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
  });
  req.on('error',reject);req.end();
 });
}
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

test('default selected mode uses shared remote D1, explicit --local keeps isolated DB',()=>{
 assert.deepEqual(selectDevMode([]),{mode:'remote-d1',lanAddress:null});
 assert.deepEqual(selectDevMode(['--lan','192.168.1.90']),{mode:'remote-d1',lanAddress:'192.168.1.90'});
 assert.equal(selectDevMode(['--local']).mode,'local');
});

test('explicit local DEV plan forces isolated Worker, dedicated origins and no remote/shared pool',()=>{
 for(const platform of ['win32','linux']){
  const [backend,frontend]=localDevPlan({platform,execPath:'/node',env:{FA_ADMIN_API_TARGET:'https://production.example.invalid',FA_ADMIN_API_POOL:'dev-preview',FA_DEV_LAN:'1',EXTRA:'retained'}});
  assert.equal(backend.command,platform==='win32'?'npm.cmd':'npm');
  assert.deepEqual(backend.args,['run','dev','--prefix','backend']);
  assert.equal(backend.options.shell,platform==='win32');
  assert.equal(frontend.command,'/node');
  assert.deepEqual(frontend.args,['tools/dev-app-preview.mjs']);
  for(const item of [backend,frontend]){
   assert.equal(item.options.env.FA_ADMIN_API_TARGET,'http://127.0.0.1:8787');
   assert.equal(item.options.env.FA_ADMIN_API_POOL,'');
   assert.equal(item.options.env.FA_DEV_LAN,'');
   assert.equal(item.options.env.FA_DEV_LAN_HOST,'');
   assert.equal(item.options.env.EXTRA,'retained');
   assert.equal(item.options.stdio,'inherit');
  }
 }
});

test('explicit local DEV starts both children, stops together and rejects extra CLI flags',()=>{
 const proc=new EventEmitter();const out=[];const spawned=[];
 Object.assign(proc,{argv:['node','tools/dev.mjs','--local'],platform:'linux',execPath:'/node',env:{},stdout:{write:s=>out.push(s)},stderr:{write:s=>out.push(s)},exitCode:0});
 const spawnChild=(command,args,options)=>{
  const child=new EventEmitter();Object.assign(child,{pid:123+spawned.length,killed:false,kill(){this.killed=true;return true;}});
  spawned.push({command,args,options,child});return child;
 };
 const {children}=startLocalDev({proc,spawnChild});
 assert.equal(children.length,2);
 assert.ok(out.join('').includes('http://app.localhost:2000'));
 assert.equal(spawned[0].options.env.FA_ADMIN_API_TARGET,'http://127.0.0.1:8787');
 proc.emit('SIGINT');
 assert.ok(children.every(child=>child.killed));
 const bad=new EventEmitter();Object.assign(bad,{argv:['node','tools/dev.mjs','--remote']});
 assert.throws(()=>startLocalDev({proc:bad,spawnChild}),/requires --local/);
});

test('explicit Safari QA LAN binds only an owned RFC1918 interface and never exposes backend LAN',()=>{
 const interfaces={wifi:[{address:'192.168.1.90',family:'IPv4',internal:false}]};
 assert.equal(validateLanAddress('192.168.1.90',interfaces),'192.168.1.90');
 for(const address of ['0.0.0.0','127.0.0.1','8.8.8.8','192.168.1.91','192.168.1.090','192.168.1.256','app.192.168.1.90','::1']){
  assert.throws(()=>validateLanAddress(address,interfaces),/LAN address/);
 }
 const [backend,frontend]=localDevPlan({lanAddress:'192.168.1.90',env:{FA_ADMIN_API_TARGET:'https://production.invalid',FA_ADMIN_API_POOL:'dev-preview',FA_DEV_LAN:'1',FA_DEV_LAN_HOST:'10.0.0.2'}});
 for(const spec of [backend,frontend]){
  assert.equal(spec.options.env.FA_ADMIN_API_TARGET,'http://127.0.0.1:8787');
  assert.equal(spec.options.env.FA_ADMIN_API_POOL,'');
 }
 assert.equal(backend.options.env.FA_DEV_LAN,'');
 assert.equal(backend.options.env.FA_DEV_LAN_HOST,'');
 assert.equal(frontend.options.env.FA_DEV_LAN,'1');
 assert.equal(frontend.options.env.FA_DEV_LAN_HOST,'192.168.1.90');
 const out=[],spawned=[];
 const proc=new EventEmitter();
 Object.assign(proc,{argv:['node','tools/dev.mjs','--local','--lan','192.168.1.90'],platform:'linux',execPath:'/node',env:{},stdout:{write:s=>out.push(s)},stderr:{write:s=>out.push(s)},exitCode:0});
 const spawnChild=(command,args,options)=>{
  const child=new EventEmitter();
  Object.assign(child,{pid:300+spawned.length,killed:false,kill(){this.killed=true;return true;}});
  spawned.push({command,args,options,child});
  return child;
 };
 const start=startLocalDev({proc,spawnChild,interfaces:()=>interfaces});
 assert.equal(start.children.length,2);
 assert.equal(spawned[0].options.env.FA_DEV_LAN,'');
 assert.equal(spawned[1].options.env.FA_DEV_LAN_HOST,'192.168.1.90');
 assert.match(out.join(''),/http:\/\/192\.168\.1\.90:2000\/dashboard/);
 proc.emit('SIGINT');
 assert.ok(start.children.every(child=>child.killed));
});

test('canonical site/app routing, hard refresh, assets and local API bridge remain isolated',async()=>{
 const oldTarget=process.env.FA_ADMIN_API_TARGET,oldPool=process.env.FA_ADMIN_API_POOL;
 const seen=[];
 const worker=createServer((req,res)=>{
  seen.push({url:req.url,method:req.method,host:req.headers.host});
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({path:req.url,kind:req.url==='/api/world'?'local-world':'local-player'}));
 });
 let server;
 try{
  const workerPort=await listen(worker);
  process.env.FA_ADMIN_API_TARGET='http://127.0.0.1:'+workerPort;
  process.env.FA_ADMIN_API_POOL='';
  server=createPreviewServer({subdomains:true});
  const port=await listen(server);
  const site=await get(port,'/','localhost:2000');
  assert.equal(site.status,200);assert.match(site.body,/http:\/\/app\.localhost:2000\/dashboard/);
  const app=await get(port,'/','app.localhost:2000');
  assert.equal(app.status,200);assert.match(app.body,/id="app-dashboard"/);
  assert.match(app.body,/http:\/\/localhost:2000/);
  for(const path of ['/dashboard','/competitions','/competitions/it-1/standings?season=1','/competitions/int-1/fixtures?season=1','/clubs/it/1/overview','/account/login']){
   const first=await get(port,path,'app.localhost:2000');
   const refresh=await get(port,path,'app.localhost:2000');
   assert.equal(first.status,200,path);
   assert.equal(refresh.status,200,path+' hard refresh');
   assert.equal(first.body,refresh.body,path+' stable response');
   assert.equal(first.headers['cache-control'],'no-store');
  }
  for(const path of ['/assets/app.js','/assets/app.css','/assets/competition-tabs.js','/competitions/_shared/manifest.json']){
   assert.equal((await get(port,path,'app.localhost:2000')).status,200,path);
  }
  const head=await get(port,'/assets/app.css','app.localhost:2000','HEAD');
  assert.equal(head.status,200);assert.equal(head.body,'');
  const legacy=await get(port,'/competitions/it-1?season=1&view=standings','app.localhost:2000');
  assert.equal(legacy.status,308);assert.equal(legacy.headers.location,'/competitions/it-1/standings?season=1');
  const world=await get(port,'/api/world','app.localhost:2000');
  assert.equal(world.status,200);assert.equal(JSON.parse(world.body).kind,'local-world');
  assert.equal((await get(port,'/api/world','localhost:2000')).status,200);
  assert.equal((await get(port,'/api/player/session','localhost:2000')).status,403);
  assert.equal((await get(port,'/api/player/session','app.localhost:2000')).status,200);
  assert.equal((await get(port,'/api/world?x=1','app.localhost:2000')).status,403);
  assert.equal((await get(port,'/tools/dev.mjs','app.localhost:2000')).status,404);
  assert.equal((await get(port,'/app/dashboard','app.localhost:2000')).status,404);
  assert.equal((await get(port,'/','other.localhost:2000')).status,403);
  assert.ok(seen.some(call=>call.url==='/api/world'));
  assert.ok(seen.every(call=>call.host==='localhost:2000'||call.host==='app.localhost:2000'));
 }finally{
  if(server)await close(server);await close(worker);
  if(oldTarget===undefined)delete process.env.FA_ADMIN_API_TARGET;else process.env.FA_ADMIN_API_TARGET=oldTarget;
  if(oldPool===undefined)delete process.env.FA_ADMIN_API_POOL;else process.env.FA_ADMIN_API_POOL=oldPool;
 }
});
