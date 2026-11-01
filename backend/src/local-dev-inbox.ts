import type {VerificationDelivery} from './player-registration.ts';
import {buildAccountDeliveryMessage} from './cloudflare-email-delivery.ts';
import {requireDatabase} from './database.ts';
import {resolveAccountConfiguration} from './environment-pool.ts';

export const LOCAL_INBOX_PATH='/api/local-dev/inbox';
export interface LocalInboxEnv{
 DB?:unknown;
 PLAYER_MODE?:string;
 PLAYER_ORIGIN?:string;
 PLAYER_LOCAL_INBOX_ENABLED?:string;
}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const response=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{status,headers});
function enabled(env:LocalInboxEnv){
 if(env.PLAYER_MODE!=='local'||env.PLAYER_LOCAL_INBOX_ENABLED!=='true')return false;
 try{
  const u=new URL(env.PLAYER_ORIGIN??'');
  return u.protocol==='http:'&&u.origin===env.PLAYER_ORIGIN&&['localhost','127.0.0.1','app.localhost','[::1]'].includes(u.hostname);
 }catch{return false}
}
async function storage(env:LocalInboxEnv){
 const db=requireDatabase(env.DB);
 await db.prepare("CREATE TABLE IF NOT EXISTS local_dev_inbox (id TEXT PRIMARY KEY, kind TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL, link TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)").run();
 return db;
}
export function localInboxDeliveries(env:LocalInboxEnv):{verification?:VerificationDelivery;reset?:VerificationDelivery}{
 if(!enabled(env))return {};
 const make=(kind:'verification'|'reset'):VerificationDelivery=>async(email,token,locale)=>{
  const db=await storage(env);
  const message=buildAccountDeliveryMessage(kind,env.PLAYER_ORIGIN!,'dev@localhost',email,token,locale);
  const now=Math.floor(Date.now()/1000);
  await db.prepare('DELETE FROM local_dev_inbox WHERE expires_at<=?').bind(now).run();
  await db.prepare('INSERT INTO local_dev_inbox(id,kind,recipient,subject,link,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),kind,email,message.subject,message.text.split('\n')[1],now,now+(kind==='verification'?86400:1800)).run();
 };
 return {verification:make('verification'),reset:make('reset')};
}
export async function handleLocalInbox(request:Request,env:LocalInboxEnv){
 if(!enabled(env))return response(404,{error:{code:'not_found'}});
 if(request.method!=='GET')return response(405,{error:{code:'method_not_allowed'}});
 try{
  const url=new URL(request.url);
  if(url.pathname!==LOCAL_INBOX_PATH||url.search)return response(404,{error:{code:'not_found'}});
  await resolveAccountConfiguration(request,env,'local_inbox_unavailable');
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return response(403,{error:{code:'forbidden'}});
  if(request.headers.get('Sec-Fetch-Site')==='cross-site')return response(403,{error:{code:'forbidden'}});
  const db=await storage(env),now=Math.floor(Date.now()/1000);
  await db.prepare('DELETE FROM local_dev_inbox WHERE expires_at<=?').bind(now).run();
  const data=await db.prepare('SELECT kind,recipient,subject,link,created_at AS createdAt,expires_at AS expiresAt FROM local_dev_inbox ORDER BY created_at DESC LIMIT 30').all();
  return response(200,{localOnly:true,messages:data.results});
 }catch{return response(503,{error:{code:'local_inbox_unavailable'}})}
}
