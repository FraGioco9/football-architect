// Server-only opt-in bridge to the single shared nonproduction account/world DB.
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
// Keep ordinary private responses tightly bounded. Player previews contain up to
// 1000 full player records, so only these exact protected routes get a larger cap.
export const protectedResponseLimit=(path,publicRead=false)=>publicRead?524288:
 (path==='/api/admin/players'||path==='/api/admin/players/preview')?2097152:65536;
const fail=res=>{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":{"code":"environment_unavailable"}}');return true};
const forbidden=res=>{res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":{"code":"forbidden"}}');return true};
export function sendSharedHttps(url,{method='GET',headers={},body=Buffer.alloc(0),limit=65536,timeoutMs=15000}={}){
 return new Promise((resolve,reject)=>{
  const request=httpsRequest(url,{method,headers},response=>{
   const chunks=[];let length=0;
   response.on('data',chunk=>{length+=chunk.length;if(length>limit)request.destroy(new Error('response too large'));else chunks.push(chunk)});
   response.on('error',reject);
   response.on('end',()=>{if(response.complete)resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)});else reject(new Error('incomplete response'))});
  });
  const timer=setTimeout(()=>request.destroy(new Error('upstream timeout')),timeoutMs);
  request.on('close',()=>clearTimeout(timer));request.on('error',reject);request.end(body);
 });
}
function targetOrigin(target){
 const url=new URL(target);
 if(url.protocol!=='https:'||url.origin!==target||url.username||url.password||url.search||url.hash||url.pathname!=='/'||isIP(url.hostname.replace(/^\[|\]$/g,''))||!url.hostname.includes('.')||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local'))throw Error('invalid target');
 return url;
}
function localCookie(value){
 if(value===undefined)return '';
 if(typeof value!=='string')throw Error('invalid cookie');
 const cookies=value.split(';').map(v=>v.trim()).filter(v=>v.startsWith('fa_player_local='));
 if(cookies.length>1||cookies.length===1&&!/^fa_player_local=[a-f0-9]{64}$/.test(cookies[0]))throw Error('invalid cookie');
 return cookies.length?'__Host-fa_player='+cookies[0].slice('fa_player_local='.length):'';
}
function responseCookie(values){
 if(values===undefined)return undefined;
 if(!Array.isArray(values)||values.length!==1)throw Error('unexpected cookie');
 const parts=values[0].split(';').map(v=>v.trim());
 if(parts.length!==6||!/^__Host-fa_player=(?:[a-f0-9]{64})?$/.test(parts[0]))throw Error('invalid cookie');
 const attrs=parts.slice(1);
 if(new Set(attrs).size!==5||!['Secure','HttpOnly','SameSite=Strict','Path=/'].every(v=>attrs.includes(v)))throw Error('unsafe cookie');
 const age=attrs.find(v=>/^Max-Age=(?:0|2592000)$/.test(v));
 if(!age||(parts[0]==='__Host-fa_player=')!==(age==='Max-Age=0'))throw Error('invalid lifetime');
 return [`fa_player_local=${parts[0].slice('__Host-fa_player='.length)}; HttpOnly; SameSite=Strict; Path=/; ${age}`];
}
function validResponse(response,limit){
 if(!response||!Number.isInteger(response.status)||response.status<200||response.status>=300&&response.status<400||response.status>599||!Buffer.isBuffer(response.body)||response.body.length>limit)throw Error('invalid response');
 return response;
}
// The HTML first paint may read only the anonymous public world, with the same
// environment handshake as API proxying. No credential or operator mutation.
export async function readSharedPublicWorld(target,{send=sendSharedHttps,timeoutMs=2500}={}){
 try{
  const url=targetOrigin(target),marker={'x-fa-expected-pool':'dev-preview'};
  const handshake=validResponse(await send(new URL('/api/environment',url),{headers:marker,limit:1024,timeoutMs}),1024);
  if(handshake.status!==200)return null;
  const env=JSON.parse(handshake.body.toString('utf8'));
  if(!env||env.schemaVersion!==1||env.pool!=='dev-preview'||env.origin!==url.origin||env.sharedWorld!==true||env.separateSignIn!==true)return null;
  const response=validResponse(await send(new URL('/api/world',url),{headers:marker,limit:4096,timeoutMs}),4096);
  return response.status===200?JSON.parse(response.body.toString('utf8'))?.world??null:null;
 }catch{return null}
}
/** Read-only preflight used by the opt-in shared DEV launcher: never starts a
 * frontend pointed at an incompatible/missing Players API or an unsafe pool.
 * It sends no cookies, CSRF tokens, credentials or writes. */
export async function verifySharedPreviewReadiness(target,{send=sendSharedHttps,timeoutMs=5000}={}){
 try{
  const url=targetOrigin(target),headers={'x-fa-expected-pool':'dev-preview'};
  const probe=async(path,limit)=>{
   const reply=validResponse(await send(new URL(path,url),{method:'GET',headers,limit,timeoutMs}),limit);
   if(reply.status!==200)return null;
   return JSON.parse(reply.body.toString('utf8'));
  };
  const env=await probe('/api/environment',1024);
  if(!env||env.schemaVersion!==1||env.pool!=='dev-preview'||env.origin!==url.origin||
     env.sharedWorld!==true||env.separateSignIn!==true)
   return {ready:false,reason:'environment_handshake_unavailable'};
  const world=await probe('/api/world',4096);
  if(!world||!world.world||typeof world.world!=='object'||typeof world.world.generation!=='string')
   return {ready:false,reason:'world_api_unavailable'};
  const directory=await probe('/api/players/page/1',524288);
  if(!directory||!Number.isSafeInteger(directory.count)||directory.count<0||
     directory.page!==1||!Array.isArray(directory.players)||
     directory.players.length!==Math.min(directory.count,50)||
     directory.players.some(player=>!Number.isSafeInteger(player?.id)||player.id<1))
   return {ready:false,reason:'players_api_unavailable'};
  return {ready:true,count:directory.count};
 }catch{return {ready:false,reason:'shared_preview_unreachable'}}
}
export async function proxySharedNonproduction(req,res,{target,path,body,publicRead,send=sendSharedHttps}){
 let url,session;
 try{url=targetOrigin(target)}catch{return fail(res)}
 // The caller already validates loopback socket, Host, method, path and body bound.
 // Private endpoints additionally require app.localhost, and POST requires exact Origin.
 const origin=`http://${req.headers.host}`;
 if(!publicRead&&!/^app\.localhost(?::\d{1,5})?$/.test(req.headers.host||''))return forbidden(res);
 if((req.method==='POST'||req.headers.origin!==undefined)&&req.headers.origin!==origin)return forbidden(res);
 try{session=publicRead?'':localCookie(req.headers.cookie)}catch{return forbidden(res)}
 try{
  const marker={'x-fa-expected-pool':'dev-preview'};
  const handshake=validResponse(await send(new URL('/api/environment',url),{headers:{...marker},limit:1024}),1024);
  if(handshake.status!==200)throw Error('handshake rejected');
  const context=JSON.parse(handshake.body.toString('utf8'));
  if(!context||context.schemaVersion!==1||context.pool!=='dev-preview'||context.origin!==url.origin||context.sharedWorld!==true||context.separateSignIn!==true)throw Error('wrong environment');
  const headers={...marker};
  if(!publicRead){
   headers.origin=url.origin;
   for(const key of ['content-type','x-csrf-token','idempotency-key','accept-language'])if(req.headers[key]!==undefined)headers[key]=req.headers[key];
   if(session)headers.cookie=session;
  }
  if(body.length)headers['content-length']=body.length;
  const maxResponseBytes=protectedResponseLimit(path,publicRead);
  const result=validResponse(await send(new URL(path,url),{method:req.method,headers,body,limit:maxResponseBytes}),maxResponseBytes);
  JSON.parse(result.body.toString('utf8'));
  const out={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(!publicRead){
   const cookie=responseCookie(result.headers['set-cookie']);if(cookie)out['set-cookie']=cookie;
   for(const key of ['retry-after','allow'])if(typeof result.headers[key]==='string')out[key]=result.headers[key];
  }
  res.writeHead(result.status,out);res.end(result.body);return true;
 }catch{return fail(res)}
}
