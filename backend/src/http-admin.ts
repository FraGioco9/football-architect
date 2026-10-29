import {ApiError} from './errors.ts';
import {requireDatabase} from './database.ts';
import {adminCookiePolicy,requireMutationOrigin} from './origin-policy.ts';
import {authenticate,csrfFor,login,requireCsrf} from './auth.ts';
import {readWorld} from './world-repository.ts';
import {parsePrepareRequest,parseIdempotencyKey} from './command-contract.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {prepareSeason} from './commands.ts';
import {generateSeasonCalendar} from './calendar-command.ts';
import {executeLifecycle} from './lifecycle-command.ts';
import {rescheduleSeasonEvent} from './admin-calendar-command.ts';
import {initializeAdministrativeEvents} from './admin-calendar-initialize.ts';
import {completeConfirmationEvent} from './admin-calendar-confirm.ts';
import {advanceAdministrativeClock} from './admin-calendar-clock.ts';
import {readAdministrativeCalendar} from './admin-calendar-read.ts';
import {stageDomesticCalendar} from './admin-domestic-stage.ts';
import {executeInternationalDraw} from './admin-international-draw.ts';
import {publishInternationalCalendar} from './admin-calendar-publish.ts';
import {closeSeason} from './season-close-command.ts';
import {archiveSeason} from './season-archive-command.ts';
import {resetWorld} from './reset-world-command.ts';
import {readSeasonArchives,readClosedSeasonHistory} from './season-archive-read.ts';
import {readSeasonTwoCandidate} from './season-two-candidate-read.ts';
import {prepareSeasonTwo} from './season-two-prepare-command.ts';
import {approveSeasonTwoSnapshot} from './season-two-approval-command.ts';
export interface AdminEnv {DB?:unknown;ADMIN_MODE?:string;ADMIN_ORIGIN?:string;ADMIN_TRUSTED_SOURCE?:string}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status:number,body:unknown,extra:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const known=new Map([['/api/admin/login','POST'],['/api/admin/session','GET'],['/api/admin/world','GET'],['/api/admin/seasons/events','GET'],['/api/admin/seasons/archives','GET'],['/api/admin/seasons/history','GET'],['/api/admin/seasons/next-candidate','GET'],['/api/admin/seasons/next-approve','POST'],['/api/admin/seasons/next-prepare','POST'],['/api/admin/logout','POST'],['/api/admin/seasons/prepare','POST'],['/api/admin/seasons/calendar','POST'],['/api/admin/seasons/start','POST'],['/api/admin/seasons/advance','POST'],['/api/admin/seasons/events/reschedule','POST'],['/api/admin/seasons/events/initialize','POST'],['/api/admin/seasons/events/confirm','POST'],['/api/admin/seasons/events/start','POST'],['/api/admin/seasons/events/advance','POST'],['/api/admin/seasons/events/domestic-calendar','POST'],['/api/admin/seasons/events/international-draw','POST'],['/api/admin/seasons/events/international-calendar','POST'],['/api/admin/seasons/archive','POST'],['/api/admin/seasons/close','POST'],['/api/admin/world/reset','POST']]);
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
  if(path==='/api/admin/seasons/next-candidate')return json(200,await readSeasonTwoCandidate(db));
  if(path==='/api/admin/seasons/archives')return json(200,await readSeasonArchives(db));
  if(path==='/api/admin/seasons/history'){
   const raw=new URL(request.url).searchParams.get('season');
   if(!raw||!/^[1-9][0-9]{0,8}$/.test(raw))throw new ApiError(422,'archive_invalid');
   return json(200,await readClosedSeasonHistory(db,Number(raw)));
  }
  if(path==='/api/admin/seasons/events')return json(200,await readAdministrativeCalendar(db));
  await requireCsrf(session,request.headers.get('X-CSRF-Token'));
  const rawCommand=await input(request),key=parseIdempotencyKey(request.headers.get('Idempotency-Key'));
  if(path==='/api/admin/seasons/next-prepare')return json(200,await prepareSeasonTwo(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/next-approve')return json(200,await approveSeasonTwoSnapshot(db,session,rawCommand,key,now));
  if(path==='/api/admin/world/reset')return json(200,await resetWorld(db,session,rawCommand as Parameters<typeof resetWorld>[2],key,now));
  if(path==='/api/admin/seasons/archive')return json(200,await archiveSeason(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/close')return json(200,await closeSeason(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/initialize')return json(200,await initializeAdministrativeEvents(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/start'||path==='/api/admin/seasons/events/advance')return json(200,await advanceAdministrativeClock(db,session,path.endsWith('/start')?'start':'advance',parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/international-calendar')return json(200,await publishInternationalCalendar(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/international-draw')return json(200,await executeInternationalDraw(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/domestic-calendar')return json(200,await stageDomesticCalendar(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/confirm')return json(200,await completeConfirmationEvent(db,session,rawCommand,key,now));
  if(path==='/api/admin/seasons/events/reschedule')return json(200,await rescheduleSeasonEvent(db,session,rawCommand,key,now));
  const command=parsePrepareRequest(rawCommand);
  if(path==='/api/admin/seasons/start'||path==='/api/admin/seasons/advance')return json(200,await executeLifecycle(db,session,path.endsWith('/start')?'start':'advance',command,key,now));
  if(path==='/api/admin/seasons/calendar')return json(200,await generateSeasonCalendar(db,session,command,key,now));
  return json(200,await prepareSeason(db,session,command,key,await loadApprovedSnapshot(),now));
 }catch(error){
  if(error instanceof ApiError)return json(error.status,{error:{code:error.code}},error.status===429?{'Retry-After':'900'}:{});
  return json(503,{error:{code:'admin_unavailable'}});
 }
}
