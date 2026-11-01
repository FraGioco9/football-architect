import test from 'node:test';
import assert from 'node:assert/strict';
import {proxyAdminApi} from '../tools/dev-admin-api-proxy.mjs';
const origin='https://preview.example.invalid',token='a'.repeat(64);
const response=()=>({status:0,writeHead(status,headers){this.status=status;this.headers=headers},end(body=''){this.body=body}});
const req=({path='/api/player/session',method='GET',headers={},body=''}={})=>({url:path,method,headers:{host:'app.localhost:2000',...headers},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(body)}});
const context=()=>({status:200,headers:{'content-type':'application/json'},body:Buffer.from(JSON.stringify({schemaVersion:1,pool:'dev-preview',origin,sharedWorld:true,separateSignIn:true}))});
const run=async(r,send,options={})=>{const res=response();await proxyAdminApi(r,res,{target:origin,pool:'dev-preview',send,...options});return res};
test('opt-in bridge handshakes without credentials then narrows cookie/headers and rewrites exact origin',async()=>{
 const seen=[];const send=async(url,options)=>{seen.push({url,options});return seen.length===1?context():{status:200,headers:{'set-cookie':[`__Host-fa_player=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`]},body:Buffer.from('{"authenticated":true}')}};
 const r=await run(req({headers:{cookie:`other=secret; fa_player_local=${token}`,'x-forwarded-for':'evil','cf-connecting-ip':'evil',authorization:'secret'}}),send);
 assert.equal(r.status,200);assert.equal(seen.length,2);assert.equal(seen[0].url.href,origin+'/api/environment');assert.deepEqual(seen[0].options.headers,{'x-fa-expected-pool':'dev-preview'});
 assert.deepEqual(seen[1].options.headers,{'x-fa-expected-pool':'dev-preview',origin,cookie:`__Host-fa_player=${token}`});
 assert.deepEqual(r.headers['set-cookie'],[`fa_player_local=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`]);
});
test('bad target handshake never receives login credentials',async()=>{
 for(const change of [{pool:'production'},{origin:'https://different.invalid'},{sharedWorld:false},{separateSignIn:false},{schemaVersion:2}]){
  let n=0;const res=await run(req({method:'POST',path:'/api/player/login',headers:{origin:'http://app.localhost:2000'},body:'{"password":"secret"}'}),async()=>{n++;const c=context();c.body=Buffer.from(JSON.stringify({...JSON.parse(c.body),...change}));return c});
  assert.equal(res.status,503);assert.equal(n,1);
 }
});
test('local cross-origin requests and malformed session cookies are denied before network',async()=>{
 for(const r of [req({method:'POST',path:'/api/player/login'}),req({headers:{origin:'https://evil.invalid'}}),req({headers:{cookie:`fa_player_local=${token}; fa_player_local=${token}`}}),req({headers:{cookie:'fa_player_local=bad'}}),req({path:'/api/admin/session',headers:{host:'localhost:2000'}})]){
  let n=0;const res=await run(r,async()=>{n++;return context()});assert.equal(res.status,403);assert.equal(n,0);
 }
});
test('HTTPS activation is explicit and rejects ambiguous, local and credentialed targets',async()=>{
 for(const target of ['https://127.0.0.1:8787','https://localhost','https://[::1]','https://user:pass@preview.example.invalid','https://preview.example.invalid/api','https://preview.example.invalid?x=1','https://preview.example.invalid/#x']){
  let n=0;const res=await run(req(),async()=>{n++;return context()},{target});assert.equal(res.status,503,target);assert.equal(n,0);
 }
 const res=await run(req(),()=>{throw Error('must not send')},{pool:undefined});assert.equal(res.status,503);
});
test('public world, seasons, fixtures/results and calendar reads never forward credentials or set cookies',async()=>{
 for(const path of ['/api/world','/api/competitions/IT-1/seasons/1','/api/calendar/seasons/1/days/13']){
  let n=0;const res=await run(req({path,headers:{cookie:`fa_player_local=${token}`,'x-csrf-token':'secret'}}),async(url,options)=>{n++;if(n===1)return context();assert.deepEqual(options.headers,{'x-fa-expected-pool':'dev-preview'});return {status:200,headers:{'set-cookie':['evil=1']},body:Buffer.from('{"world":{}}')}});
  assert.equal(res.status,200);assert.equal(res.headers['set-cookie'],undefined);
 }
});
test('redirects, malformed/oversize context, upstream failures and unsafe cookies fail closed',async()=>{
 for(const bad of [{status:302,headers:{location:'https://evil.invalid'},body:Buffer.from('')},{status:200,headers:{},body:Buffer.from('not json')},{status:200,headers:{},body:Buffer.alloc(2000)}]){
  let n=0;const res=await run(req(),async()=>{n++;return bad});assert.equal(res.status,503);assert.equal(n,1);
 }
 for(const value of [`__Host-fa_player=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Domain=example.invalid`,`__Host-fa_player=${token}; HttpOnly; SameSite=Strict; Path=/`,`other=${token}; Secure; HttpOnly; SameSite=Strict; Path=/`]){
  let n=0;const res=await run(req(),async()=>++n===1?context():{status:200,headers:{'set-cookie':[value]},body:Buffer.from('{}')});assert.equal(res.status,503);
 }
 for(const bad of [{status:307,headers:{},body:Buffer.from('{}')},{status:200,headers:{},body:Buffer.alloc(65537)}]){let n=0;assert.equal((await run(req(),async()=>++n===1?context():bad)).status,503)}
 assert.equal((await run(req(),async()=>{throw Error('network error')})).status,503);
});
test('same-origin commands retain CSRF/idempotency and logout clears only the local session cookie',async()=>{
 let n=0;
 const res=await run(req({path:'/api/player/logout',method:'POST',body:'{}',headers:{origin:'http://app.localhost:2000',cookie:`fa_player_local=${token}`,'content-type':'application/json','x-csrf-token':'csrf','idempotency-key':'key','accept-language':'it'}}),async(url,options)=>{
  if(++n===1)return context();
  assert.equal(options.method,'POST');assert.equal(options.headers.origin,origin);assert.equal(options.headers['x-csrf-token'],'csrf');assert.equal(options.headers['idempotency-key'],'key');assert.equal(options.headers['accept-language'],'it');assert.equal(options.body.toString(),'{}');
  return {status:200,headers:{'set-cookie':['__Host-fa_player=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']},body:Buffer.from('{"signedOut":true}')};
 });
 assert.equal(res.status,200);assert.deepEqual(res.headers['set-cookie'],['fa_player_local=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);
});
test('shared-mode Dev pages use authoritative sporting loaders without fictional season, calendar or stats overlays',async()=>{
 const {createPreviewServer}=await import('../tools/dev-standings-preview.mjs');
 const {request}=await import('node:http');const {once}=await import('node:events');
 const saved=process.env.FA_ADMIN_API_POOL;process.env.FA_ADMIN_API_POOL='dev-preview';
 const server=createPreviewServer({subdomains:true});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  for(const path of ['/calendar','/competitions/it-1/standings','/competitions/it-1/fixtures','/settings','/account/login']){
   const result=await new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{Host:'app.localhost:2000'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}))});req.on('error',reject);req.end()});
   assert.equal(result.status,200,path);
   assert.equal(/window\.faDevPreviewMode\s*=|window\.faDevCalendarClockSnapshot\s*=|dataset\.faDevDefaultSeason\s*=|data-fa-dev-preview|data-fa-dev-stats|data-fa-dev-club-summary/.test(result.body),false,path+' fictional overlay');
   assert.match(result.body,/faDevAppOrigin/,path);
  }
 }finally{if(saved===undefined)delete process.env.FA_ADMIN_API_POOL;else process.env.FA_ADMIN_API_POOL=saved;server.closeAllConnections();await new Promise(r=>server.close(r))}
});
