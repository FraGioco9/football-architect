import {ApiError} from './errors.ts';
import {requireDatabase} from './database.ts';
import {adminCookiePolicy,requireMutationOrigin} from './origin-policy.ts';
import {authenticate,csrfFor,login,requireCsrf} from './auth.ts';
import {readWorld} from './world-repository.ts';
import {parsePrepareRequest,parseIdempotencyKey} from './command-contract.ts';
import {loadApprovedSnapshot} from './catalogue-snapshot.ts';
import {prepareSeason} from './commands.ts';
export interface AdminEnv {DB?:unknown;ADMIN_MODE?:string;ADMIN_ORIGIN?:string;ADMIN_TRUSTED_SOURCE?:string}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status:number,body:unknown,extra:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const known=new Map([['/api/admin/login','POST'],['/api/admin/session','GET'],['/api/admin/world','GET'],['/api/admin/logout','POST'],['/api/admin/seasons/prepare','POST']]);
function readCookie(request:Request,name:string){
 const values=(request.headers.get('Cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
 if(values.length>1)throw new ApiError(401,'unauthorized');
 return values[0]?.slice(name.length+1)??'';
}
async function input(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ApiError(415,'json_required');
 const limit=4096,reader=request.body?.getReader();if(!reader)throw new ApiError(400,'invalid_json');
 const chunks:Uint8Array[]=[];let total=0;
 try{
  for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new ApiError(413,'request_too_large')}chunks.push(value)}
 }finally{reader.releaseLock()}
 const data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as unknown}catch{throw new ApiError(400,'invalid_json')}
}
function configuration(request:Request,env:AdminEnv){
 const origin=env.ADMIN_ORIGIN??'',mode=env.ADMIN_MODE??'';
 requireMutationOrigin(origin,origin);
 const policy=adminCookiePolicy(mode,origin);
 const url=new URL(request.url);
 let source:string;
 if(mode==='local'){
  if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]','app.localhost'].includes(url.hostname))throw new ApiError(503,'admin_unavailable');
  source='local-loopback'; // Do not trust caller-supplied forwarded client addresses.
 }else{
  if(mode!=='production'||env.ADMIN_TRUSTED_SOURCE!=='cloudflare'||url.origin!==origin||url.protocol!=='https:')throw new ApiError(503,'admin_unavailable');
  const ip=request.headers.get('CF-Connecting-IP');if(!ip||ip.length>45||!/^[0-9a-fA-F:.]+$/.test(ip))throw new ApiError(503,'admin_unavailable');
  source=ip;
 }
 return {origin,policy,source,name:policy.split(';')[0]};
}
export async function handleAdmin(request:Request,env:AdminEnv):Promise<Response>{
 const path=new URL(request.url).pathname,method=known.get(path);
 if(!method)return json(404,{error:{code:'not_found'}});
 if(request.method!==method)return json(405,{error:{code:'method_not_allowed'}},{Allow:method});
 try{
  const config=configuration(request,env),db=requireDatabase(env.DB),now=Math.floor(Date.now()/1000);
  if(request.method==='POST'||request.headers.has('Origin'))requireMutationOrigin(request.headers.get('Origin'),config.origin);
  const token=readCookie(request,config.name);
  const setCookie=(value:string,expires=false)=>config.policy.replace(config.name,config.name+'='+value)+(expires?'; Max-Age=0':'; Max-Age=28800');
  if(path==='/api/admin/login'){
   const result=await login(db,await input(request),config.source,now,token);
   return json(200,{actor:result.actor,csrfToken:result.csrfToken,expiresAt:result.expiresAt},{'Set-Cookie':setCookie(result.token)});
  }
  if(path==='/api/admin/logout'){
   await input(request);
   try{
    const session=await authenticate(db,token,now);await requireCsrf(session,request.headers.get('X-CSRF-Token'));
    await db.prepare('DELETE FROM admin_sessions WHERE token_digest=?').bind(session.digest).run();
   }catch(error){if(!(error instanceof ApiError&&error.status===401))throw error}
   return json(200,{signedOut:true},{'Set-Cookie':setCookie('',true)});
  }
  const session=await authenticate(db,token,now);
  if(path==='/api/admin/session')return json(200,{actor:session.actor,csrfToken:await csrfFor(token)});
  if(path==='/api/admin/world')return json(200,{world:await readWorld(db)});
  await requireCsrf(session,request.headers.get('X-CSRF-Token'));
  const command=parsePrepareRequest(await input(request)),key=parseIdempotencyKey(request.headers.get('Idempotency-Key'));
  return json(200,await prepareSeason(db,session,command,key,loadApprovedSnapshot(),now));
 }catch(error){
  if(error instanceof ApiError)return json(error.status,{error:{code:error.code}},error.status===429?{'Retry-After':'900'}:{});
  return json(503,{error:{code:'admin_unavailable'}});
 }
}
