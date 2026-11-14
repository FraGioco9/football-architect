import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {proxyAdminApi} from '../tools/dev-admin-api-proxy.mjs';
const response=()=>({status:0,body:'',writeHead(status,headers){this.status=status;this.headers=headers},end(body=''){this.body=body}});
const req=(url='/api/world',remoteAddress='127.0.0.1',host='localhost:2000')=>({url,method:'GET',headers:{host},socket:{remoteAddress}});
test('bridge disabled leaves ordinary preview unchanged and ignores non-API paths',async()=>{
 assert.equal(await proxyAdminApi(req(),response(),{}),false);
 assert.equal(await proxyAdminApi(req('/settings'),response(),{target:'http://127.0.0.1:8787'}),false);
});
test('rejects external destinations, unsafe paths, non-loopback clients and unapproved hosts',async()=>{
 for(const target of ['https://127.0.0.1:8787','http://evil.invalid','http://user:pass@127.0.0.1:8787','http://127.0.0.1:8787/path','http://127.1:8787','http://2130706433:8787']){
  const res=response();await proxyAdminApi(req(),res,{target});assert.equal(res.status,503,target);
 }
 for(const r of [req('/api/world','192.168.1.2'),req('/api/world','127.0.0.1','evil.invalid:2000'),req('/api/admin/../world'),req('/api/admin/%2e%2e/world'),req('/api/world?url=http://evil.invalid')]){
  const res=response();await proxyAdminApi(r,res,{target:'http://127.0.0.1:8787'});assert.equal(res.status,403);
 }
});
test('forwards bounded same-origin API requests, Origin and cookies, without redirects or forwarded source trust',async()=>{
 const upstream=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  assert.equal(req.headers.origin,'http://localhost:2000');assert.equal(req.headers.cookie,'fa_admin_local=synthetic');
  assert.equal(req.headers['x-forwarded-for'],undefined);
  assert.deepEqual(JSON.parse(body),{email:'synthetic@example.invalid',password:'test-only-password'});
  res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':['fa_admin_local=synthetic; HttpOnly; SameSite=Strict; Path=/']});res.end('{"ok":true}');
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const bridge=createServer((req,res)=>proxyAdminApi(req,res,{target:'http://127.0.0.1:'+upstream.address().port}));bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 try{
  const result=await new Promise((resolve,reject)=>{
   const r=request({hostname:'127.0.0.1',port:bridge.address().port,path:'/api/admin/login',method:'POST',headers:{Host:'localhost:2000',Origin:'http://localhost:2000','Content-Type':'application/json',Cookie:'fa_admin_local=synthetic','X-Forwarded-For':'evil'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,cookie:res.headers['set-cookie']}))});r.on('error',reject);r.end(JSON.stringify({email:'synthetic@example.invalid',password:'test-only-password'}));
  });assert.equal(result.status,200);assert.equal(result.body,'{"ok":true}');assert.match(result.cookie[0],/HttpOnly/);
 }finally{bridge.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))])}
});
test('public sporting bridge permits only canonical GET paths and strips operator credentials',async()=>{
 const upstream=createServer((req,res)=>{
  assert.ok(['/api/competitions/IT-1/seasons/1','/api/calendar/seasons/1/days/13','/api/clubs/IT-1/seasons/1/overview','/api/clubs/IT-1/history','/api/clubs/IT-1/seasons/1/fixtures','/api/players?page=1','/api/players?ageMin=20&foot=left&nationality=ITA'].includes(req.url));
  for(const key of ['cookie','x-csrf-token','idempotency-key','origin'])assert.equal(req.headers[key],undefined);
  res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':['must-not-cross=1']});res.end(JSON.stringify({data:'x'.repeat(80000)}));
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const target='http://127.0.0.1:'+upstream.address().port;
 const bridge=createServer((req,res)=>proxyAdminApi(req,res,{target}));bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 try{
  for(const path of ['/api/competitions/ZZ-1/seasons/1','/api/competitions/IT-1/seasons/0','/api/competitions/IT-1/seasons/1?url=evil','/api/calendar/seasons/1/days/57','/api/calendar/seasons/0/days/1','/api/clubs/IT-41/seasons/1/overview','/api/clubs/IT-1/seasons/0/overview','/api/clubs/IT-1/seasons/1/overview?unsafe=1','/api/clubs/IT-41/history','/api/clubs/IT-0/history','/api/clubs/IT-1/history?unsafe=1','/api/clubs/IT-1/history/extra','/api/clubs/IT-41/seasons/1/fixtures','/api/clubs/IT-0/seasons/1/fixtures','/api/clubs/IT-01/seasons/1/fixtures','/api/clubs/IT-1/seasons/0/fixtures','/api/clubs/IT-1/seasons/01/fixtures','/api/clubs/IT-1/seasons/9007199254740992/fixtures','/api/clubs/IT-1/seasons/1/fixtures/extra','/api/clubs/IT-1/seasons/1/fixtures?admin=1','/api/clubs/IT-1/seasons/1/fixtures%2Fextra','/api/players/page/0','/api/players/page/1','/api/players/page/1?bad=1','/api/players/page/10000','/api/players?page=0','/api/players?page=-1','/api/players?page=01','/api/players?page=','/api/players?page=10000','/api/players?page=1&sort=unknown','/api/players?page=1&page=2','/api/players?view=overview','/api/players?ageMin=40&ageMax=20','/api/players?position=CF','/api/players?nationality=ZZZ','/api/players?foot=left&foot=right','/api/players?nationality=%49TA']){
   const res=response();await proxyAdminApi(req(path),res,{target});assert.equal(res.status,/[?%]/.test(path)?403:404);
  }
  const denied=response();await proxyAdminApi({...req('/api/competitions/IT-1/seasons/1'),method:'POST'},denied,{target});assert.equal(denied.status,405);
  const deniedClub=response();await proxyAdminApi({...req('/api/clubs/IT-1/seasons/1/overview'),method:'POST'},deniedClub,{target});assert.equal(deniedClub.status,405);
  const deniedHistory=response();await proxyAdminApi({...req('/api/clubs/IT-1/history'),method:'POST'},deniedHistory,{target});assert.equal(deniedHistory.status,405);
  const deniedFixtures=response();await proxyAdminApi({...req('/api/clubs/IT-1/seasons/1/fixtures'),method:'POST'},deniedFixtures,{target});assert.equal(deniedFixtures.status,405);
  for(const path of ['/api/competitions/IT-1/seasons/1','/api/calendar/seasons/1/days/13','/api/clubs/IT-1/seasons/1/overview','/api/clubs/IT-1/history','/api/clubs/IT-1/seasons/1/fixtures','/api/players?page=1','/api/players?ageMin=20&foot=left&nationality=ITA']){
  const result=await new Promise((resolve,reject)=>{
   const r=request({hostname:'127.0.0.1',port:bridge.address().port,path,headers:{Host:'localhost:2000',Cookie:'operator=private','X-CSRF-Token':'private'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,cookie:res.headers['set-cookie']}))});r.on('error',reject);r.end();
  });assert.equal(result.status,200);assert.equal(JSON.parse(result.body).data.length,80000);assert.equal(result.cookie,undefined);
  }
 }finally{bridge.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))])}
});

test('LAN opt-in serves only anonymous world and competition GETs on a verified local interface',async()=>{
 const upstream=createServer((request,res)=>{
  assert.ok(['/api/world','/api/competitions/int-1/seasons/1','/api/calendar/seasons/1/days/13','/api/clubs/IT-1/seasons/1/overview','/api/clubs/IT-1/history','/api/clubs/IT-1/seasons/1/fixtures','/api/players?page=1'].includes(request.url));
  for(const key of ['cookie','origin','x-csrf-token','idempotency-key'])assert.equal(request.headers[key],undefined,'public LAN read must not forward '+key);
  res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':['private=must-not-leak']});res.end('{"ok":true}');
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const target='http://127.0.0.1:'+upstream.address().port;
 const host='192.168.50.10:2000',remote='192.168.50.22',opts={target,lanEnabled:true,lanHosts:['192.168.50.10']};
 // Synthetic requests must implement the HTTP IncomingMessage body iterator:
 // the bridge accepts an empty body for anonymous GETs and refuses credentials.
 const lanRequest=path=>({...req(path,remote,host),headers:{host,cookie:'operator=secret',origin:'http://192.168.50.10:2000','x-csrf-token':'do-not-forward'},
  async *[Symbol.asyncIterator](){} });
 try{
  for(const path of ['/api/world','/api/competitions/int-1/seasons/1','/api/calendar/seasons/1/days/13','/api/clubs/IT-1/seasons/1/overview','/api/clubs/IT-1/history','/api/clubs/IT-1/seasons/1/fixtures','/api/players?page=1']){
   const res=response();await proxyAdminApi(lanRequest(path),res,opts);
   assert.equal(res.status,200,path);assert.equal(JSON.parse(res.body).ok,true);assert.equal(res.headers['set-cookie'],undefined);
  }
  for(const path of ['/api/admin/world','/api/player/session','/api/local-dev/inbox']){
   const res=response();await proxyAdminApi(lanRequest(path),res,opts);assert.equal(res.status,403,path);
  }
  for(const [reason,request,options] of [
   ['LAN disabled',lanRequest('/api/world'),{...opts,lanEnabled:false}],
   ['unknown Host', {...lanRequest('/api/world'),headers:{host:'192.168.50.99:2000'}},opts],
   ['external client',req('/api/world','8.8.8.8',host),opts],
   ['wrong port',req('/api/world',remote,'192.168.50.10:2001'),opts],
   ['POST denied', {...lanRequest('/api/world'),method:'POST'},opts],
   ['unsafe query',lanRequest('/api/competitions/int-1/seasons/1?admin=1'),opts],
    ['club query rejected',lanRequest('/api/clubs/IT-1/seasons/1/overview?admin=1'),opts],
    ['history query rejected',lanRequest('/api/clubs/IT-1/history?admin=1'),opts],
    ['fixtures query rejected',lanRequest('/api/clubs/IT-1/seasons/1/fixtures?admin=1'),opts],
    ['fixtures POST rejected',{...lanRequest('/api/clubs/IT-1/seasons/1/fixtures'),method:'POST'},opts],
    ['players query rejected',lanRequest('/api/players?page=1&admin=1'),opts],
    ['history POST rejected',{...lanRequest('/api/clubs/IT-1/history'),method:'POST'},opts]
  ]){
   const res=response();await proxyAdminApi(request,res,options);assert.equal(res.status,403,reason);
  }
 }finally{upstream.closeAllConnections();await new Promise(r=>upstream.close(r))}
});

test('protected next-season routes enforce exact method and forward only to the fixed Worker',async()=>{
 const seen=[];
 const upstream=createServer(async(req,res)=>{
  seen.push(req.url);assert.equal(req.method,'POST');
  assert.equal(req.headers['x-csrf-token'],'synthetic-csrf');assert.equal(req.headers['idempotency-key'],'synthetic-command');
  let body='';for await(const part of req)body+=part;assert.equal(JSON.parse(body).expectedRevision,70);
  res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const target='http://127.0.0.1:'+upstream.address().port;
 const bridge=createServer((req,res)=>proxyAdminApi(req,res,{target}));bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 try{
  for(const path of ['/api/admin/seasons/next-approve','/api/admin/seasons/next-prepare']){
   const denied=response();await proxyAdminApi(req(path),denied,{target});assert.equal(denied.status,405);
   const status=await new Promise((resolve,reject)=>{
    const r=request({hostname:'127.0.0.1',port:bridge.address().port,path,method:'POST',headers:{Host:'localhost:2000','Content-Type':'application/json','X-CSRF-Token':'synthetic-csrf','Idempotency-Key':'synthetic-command'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});r.on('error',reject);r.end(JSON.stringify({expectedRevision:70}));
   });assert.equal(status,200);
  }
  const unknown=response();await proxyAdminApi({...req('/api/admin/seasons/next-prepare-extra'),method:'POST'},unknown,{target});assert.equal(unknown.status,404);
  assert.deepEqual(seen,['/api/admin/seasons/next-approve','/api/admin/seasons/next-prepare']);
 }finally{bridge.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))])}
});

test('Player bridge is app-only and enforces exact routes and methods',async()=>{
 const target='http://127.0.0.1:8787';
 for(const [path,method,host,expected] of [
  ['/api/player/login','POST','localhost:2000',403],
  ['/api/player/login','GET','app.localhost:2000',405],
  ['/api/player/unknown','POST','app.localhost:2000',404],
  ['/api/player/register?next=evil','POST','app.localhost:2000',403]
 ]){
  const result=response();await proxyAdminApi({...req(path,'127.0.0.1',host),method},result,{target});assert.equal(result.status,expected);
 }
});
test('Player bridge preserves validated app host and session cookie for Worker origin checks',async()=>{
 const upstream=createServer(async(req,res)=>{
  assert.equal(req.url,'/api/player/session');assert.equal(req.headers.host,'app.localhost:2000');
  assert.equal(req.headers.cookie,'fa_player_local=synthetic');assert.equal(req.headers['x-forwarded-host'],undefined);
  res.writeHead(200,{'Content-Type':'application/json'});res.end('{"authenticated":true}');
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const bridge=createServer((req,res)=>proxyAdminApi(req,res,{target:'http://127.0.0.1:'+upstream.address().port}));bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 try{
  const result=await new Promise((resolve,reject)=>{
   const r=request({hostname:'127.0.0.1',port:bridge.address().port,path:'/api/player/session',headers:{Host:'app.localhost:2000',Cookie:'fa_player_local=synthetic','X-Forwarded-Host':'evil.invalid'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}))});r.on('error',reject);r.end();
  });assert.equal(result.status,200);assert.equal(JSON.parse(result.body).authenticated,true);
 }finally{bridge.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))]);}
});


test('Admin Players preview/commit/list bridge preserves authorization and accepts bounded full cohorts',async()=>{
 const preview=JSON.stringify({draftId:'synthetic-draft',candidates:[{display_name:'A'.repeat(95000)}],summary:{count:1}});
 const stored=JSON.stringify({count:100,players:[{display_name:'B'.repeat(95000)}]});
 const observed=[];
 const upstream=createServer(async(r,res)=>{
  const chunks=[];for await(const chunk of r)chunks.push(chunk);
  observed.push({path:r.url,method:r.method,body:Buffer.concat(chunks).toString()});
  assert.equal(r.headers.host,'app.localhost:2000');
  assert.equal(r.headers.origin,'http://app.localhost:2000');
  assert.equal(r.headers.cookie,'fa_player_local=synthetic');
  assert.equal(r.headers['x-csrf-token'],'synthetic-csrf');
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(r.url==='/api/admin/players/preview'?preview:r.url==='/api/admin/players'?stored:'{"count":1,"alreadyCommitted":false}');
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const bridge=createServer((r,res)=>proxyAdminApi(r,res,{target:'http://127.0.0.1:'+upstream.address().port}));
 bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 const send=(path,method='GET',payload=null)=>new Promise((resolve,reject)=>{
  const r=request({hostname:'127.0.0.1',port:bridge.address().port,path,method,
   headers:{Host:'app.localhost:2000',Origin:'http://app.localhost:2000',Cookie:'fa_player_local=synthetic',
    'X-CSRF-Token':'synthetic-csrf','Content-Type':'application/json'}},res=>{
   const parts=[];res.on('data',part=>parts.push(part));
   res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(parts).toString()}));
  });
  r.on('error',reject);r.end(payload===null?undefined:JSON.stringify(payload));
 });
 try{
  for(const path of ['/api/admin/players','/api/admin/players/preview','/api/admin/players/commit']){
   const badMethod=path==='/api/admin/players'?'POST':'GET';
   const denied=response();await proxyAdminApi({...req(path,'127.0.0.1','app.localhost:2000'),method:badMethod},denied,{target:'http://127.0.0.1:'+upstream.address().port});
   assert.equal(denied.status,405,path);
  }
  assert.equal((await send('/api/admin/players/preview','POST',{options:{count:100}})).body,preview);
  assert.equal((await send('/api/admin/players')).body,stored);
  assert.equal((await send('/api/admin/players/commit','POST',{draftId:'synthetic-draft',confirmation:'GENERATE PLAYERS'})).status,200);
  assert.deepEqual(observed.map(r=>[r.path,r.method]),[
   ['/api/admin/players/preview','POST'],['/api/admin/players','GET'],['/api/admin/players/commit','POST']]);
  assert.deepEqual(JSON.parse(observed[0].body),{options:{count:100}});
  assert.equal((await send('/api/admin/players/preview?unsafe=1','POST',{})).status,403);
  assert.equal((await send('/api/admin/players/unknown')).status,404);
  const blocked=response();await proxyAdminApi({...req('/api/admin/players','192.168.1.30','192.168.1.10:2000'),method:'GET'},blocked,
   {target:'http://127.0.0.1:'+upstream.address().port,lanEnabled:true,lanHosts:['192.168.1.10']});
  assert.equal(blocked.status,403,'Player records must never be public over LAN');
 }finally{
  bridge.closeAllConnections();upstream.closeAllConnections();
  await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))]);
 }
});


test('Players pagination query is forwarded only for canonical GET pages and strips all secrets',async()=>{
 const seen=[];
 const upstream=createServer((req,res)=>{
  seen.push({url:req.url,method:req.method,cookie:req.headers.cookie,origin:req.headers.origin,csrf:req.headers['x-csrf-token']});
  res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':['secret=must-not-cross']});
  const query=new URL(req.url,'http://localhost').searchParams;
  const page=query.has('offset')?Number(query.get('offset'))/50+1:Number(query.get('page')||1);
  res.end(JSON.stringify({count:51,page,pageSize:50,totalPages:2,players:[]}));
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const target='http://127.0.0.1:'+upstream.address().port;
 const bridge=createServer((req,res)=>proxyAdminApi(req,res,{target}));bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 const send=path=>new Promise((resolve,reject)=>{
  const q=request({hostname:'127.0.0.1',port:bridge.address().port,path,headers:{Host:'app.localhost:2000',Cookie:'operator=private','X-CSRF-Token':'private'}},r=>{
   const chunks=[];r.on('data',c=>chunks.push(c));r.on('end',()=>resolve({status:r.statusCode,payload:Buffer.concat(chunks).toString(),cookie:r.headers['set-cookie']}));
  });q.on('error',reject);q.end();
 });
 try{
  for(const path of ['/api/players','/api/players?page=1','/api/players?page=2','/api/players?page=9999','/api/players?offset=0','/api/players?offset=50','/api/players/42']){
   const r=await send(path);
   assert.equal(r.status,200,path);assert.equal(r.cookie,undefined);
   const params=new URL(path,'http://localhost').searchParams;
   const expected=params.has('offset')?Number(params.get('offset'))/50+1:Number(params.get('page')||1);
   assert.equal(JSON.parse(r.payload).page,expected);
  }
  assert.deepEqual(seen.map(x=>x.url),['/api/players','/api/players?page=1','/api/players?page=2','/api/players?page=9999','/api/players?offset=0','/api/players?offset=50','/api/players/42']);
  // URLSearchParams encodes comma lists, UTF-8 names and attribute lists. The shared
  // parser validates these paths; the bridge must not reject valid percent escapes.
  const encoded=[
   '/api/players?page=1&nationality=ITA%2CENG&nationalityScope=any',
   '/api/players?page=1&position=ST%2CRW&positionScope=any',
   '/api/players?page=1&attributes=passing_70_x%2Cvision_x_90',
   '/api/players?page=1&name=Jo%C3%A3o',
   '/api/players?page=1&name=Andrea+Rossi',
   '/api/players?page=1&sort=age&order=desc',
   '/api/players?page=1&sort=passing&order=asc'
  ];
  for(const path of encoded){
   const response=await send(path);
   assert.equal(response.status,200,path);
   assert.equal(response.cookie,undefined);
  }
  assert.deepEqual(seen.slice(7).map(x=>x.url),encoded,'forward canonical escapes unchanged');
  for(const r of seen){assert.equal(r.method,'GET');assert.equal(r.cookie,undefined);assert.equal(r.origin,undefined);assert.equal(r.csrf,undefined)}
  const before=seen.length;
  for(const path of ['/api/players?offset=1','/api/players?offset=-50','/api/players?offset=50&page=2','/api/players?page=0','/api/players?page=01','/api/players?page=-1','/api/players?page=10000','/api/players?page=1&page=2','/api/players?page=1&sort=unknown','/api/players?nationality=ITA%2CITA','/api/players?name=%25','/api/players?name=Andrea%20Rossi','/api/players?attributes=vision_60_x%2cpassing_20_x']){
   const r=await send(path);assert.equal(r.status,403,path);
  }
  for(const invalid of ['/api/players/page/1','/api/players/0','/api/players/01','/api/players/abc']){
   assert.equal((await send(invalid)).status,404,invalid);
  }
  assert.equal(seen.length,before,'invalid and legacy requests never reach backend');
 }finally{
  bridge.closeAllConnections();upstream.closeAllConnections();
  await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))]);
 }
});

test('Admin preview draft reload forwards a CSRF-protected POST only on the exact loopback route',async()=>{
 const draftId='11111111-1111-4111-8111-111111111111';
 const upstream=createServer(async(request,res)=>{
  assert.equal(request.url,'/api/admin/players/draft');
  assert.equal(request.method,'POST');
  assert.equal(request.headers.host,'app.localhost:2000');
  assert.equal(request.headers.origin,'http://app.localhost:2000');
  assert.equal(request.headers['x-csrf-token'],'test-csrf');
  assert.equal(request.headers.cookie,'fa_player_local=test-session');
  let body='';for await(const part of request)body+=part;
  assert.deepEqual(JSON.parse(body),{draftId});
  res.writeHead(200,{'Content-Type':'application/json'});res.end('{"candidates":[]}');
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const target='http://127.0.0.1:'+upstream.address().port;
 const bridge=createServer((request,res)=>proxyAdminApi(request,res,{target}));
 bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 try{
  const send=(path,method,body)=>new Promise((resolve,reject)=>{
   const req2=request({hostname:'127.0.0.1',port:bridge.address().port,path,method,
    headers:{Host:'app.localhost:2000',Origin:'http://app.localhost:2000',
     'Content-Type':'application/json','X-CSRF-Token':'test-csrf',Cookie:'fa_player_local=test-session'}},
    res=>{let responseBody='';res.on('data',c=>responseBody+=c);res.on('end',()=>resolve({status:res.statusCode,body:responseBody}))});
   req2.on('error',reject);req2.end(body?JSON.stringify(body):undefined);
  });
  assert.equal((await send('/api/admin/players/draft','GET')).status,405);
  assert.equal((await send('/api/admin/players/draft?draftId='+draftId,'POST',{draftId})).status,403);
  const ok=await send('/api/admin/players/draft','POST',{draftId});
  assert.equal(ok.status,200);assert.deepEqual(JSON.parse(ok.body),{candidates:[]});
 }finally{bridge.closeAllConnections();upstream.closeAllConnections();
  await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))]);}
});

test('Admin Contracts bridge forwards only bounded authenticated list and mutation routes',async()=>{
 const seen=[];
 const upstream=createServer(async(request,res)=>{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);
  const body=Buffer.concat(chunks).toString('utf8');
  seen.push({path:request.url,method:request.method,cookie:request.headers.cookie,origin:request.headers.origin,csrf:request.headers['x-csrf-token'],body});
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({ok:true}));
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const bridge=createServer((request,res)=>proxyAdminApi(request,res,{target:'http://127.0.0.1:'+upstream.address().port}));
 bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 const send=(path,method='GET',body)=>new Promise((resolve,reject)=>{
  const headers={Host:'app.localhost:2000',Cookie:'fa_player_local='+'f'.repeat(64)};
  if(method==='POST'){headers.Origin='http://app.localhost:2000';headers['X-CSRF-Token']='csrf-for-tests';headers['Content-Type']='application/json'}
  const r=request({hostname:'127.0.0.1',port:bridge.address().port,path,method,headers},response=>{
   let data='';response.on('data',part=>data+=part);response.on('end',()=>resolve({status:response.statusCode,body:data}));
  });r.on('error',reject);r.end(body===undefined?undefined:JSON.stringify(body));
 });
 try{
  assert.equal((await send('/api/admin/contracts?page=1')).status,200);
  assert.equal((await send('/api/admin/contracts?page=9999')).status,200);
  assert.equal((await send('/api/admin/contracts?playerId=23')).status,200);
  assert.equal((await send('/api/admin/contracts')).status,200);
  assert.equal((await send('/api/admin/contracts','POST',{playerId:23,clubKey:'IT-1'})).status,200);
  for(const path of ['/api/admin/contracts?page=0','/api/admin/contracts?page=01','/api/admin/contracts?page=1&page=2','/api/admin/contracts?playerId=0','/api/admin/contracts?playerId=01','/api/admin/contracts?playerId=99999999999999999','/api/admin/contracts?unused=1','/api/admin/contracts?playerId=%31','/api/admin/contracts?playerId=23#x']){
   assert.equal((await send(path)).status,403,path);
  }
  assert.equal((await send('/api/admin/contracts?page=1','POST',{})).status,403);
  assert.equal((await send('/api/admin/contracts','DELETE')).status,405);
  assert.deepEqual(seen.map(x=>[x.path,x.method]),[
   ['/api/admin/contracts?page=1','GET'],['/api/admin/contracts?page=9999','GET'],
   ['/api/admin/contracts?playerId=23','GET'],['/api/admin/contracts','GET'],
   ['/api/admin/contracts','POST']]);
  assert.ok(seen.every(x=>x.cookie==='fa_player_local='+'f'.repeat(64)));
  assert.equal(seen[4].csrf,'csrf-for-tests');
  assert.equal(seen[4].origin,'http://app.localhost:2000');
  assert.ok(seen.slice(0,4).every(x=>x.csrf===undefined));
 }finally{bridge.closeAllConnections();upstream.closeAllConnections();
  await Promise.all([new Promise(resolve=>bridge.close(resolve)),new Promise(resolve=>upstream.close(resolve))])}
});
