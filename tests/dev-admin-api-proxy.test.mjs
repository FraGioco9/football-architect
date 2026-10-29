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
  assert.ok(['/api/competitions/IT-1/seasons/1','/api/calendar/seasons/1/days/13'].includes(req.url));
  for(const key of ['cookie','x-csrf-token','idempotency-key','origin'])assert.equal(req.headers[key],undefined);
  res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':['must-not-cross=1']});res.end(JSON.stringify({data:'x'.repeat(80000)}));
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const target='http://127.0.0.1:'+upstream.address().port;
 const bridge=createServer((req,res)=>proxyAdminApi(req,res,{target}));bridge.listen(0,'127.0.0.1');await once(bridge,'listening');
 try{
  for(const path of ['/api/competitions/ZZ-1/seasons/1','/api/competitions/IT-1/seasons/0','/api/competitions/IT-1/seasons/1?url=evil','/api/calendar/seasons/1/days/57','/api/calendar/seasons/0/days/1']){
   const res=response();await proxyAdminApi(req(path),res,{target});assert.equal(res.status,path.includes('?')?403:404);
  }
  const denied=response();await proxyAdminApi({...req('/api/competitions/IT-1/seasons/1'),method:'POST'},denied,{target});assert.equal(denied.status,405);
  for(const path of ['/api/competitions/IT-1/seasons/1','/api/calendar/seasons/1/days/13']){
  const result=await new Promise((resolve,reject)=>{
   const r=request({hostname:'127.0.0.1',port:bridge.address().port,path,headers:{Host:'localhost:2000',Cookie:'operator=private','X-CSRF-Token':'private'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,cookie:res.headers['set-cookie']}))});r.on('error',reject);r.end();
  });assert.equal(result.status,200);assert.equal(JSON.parse(result.body).data.length,80000);assert.equal(result.cookie,undefined);
  }
 }finally{bridge.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>bridge.close(r)),new Promise(r=>upstream.close(r))])}
});
