import {httpJson,httpHeaders,routeMethod} from './http-contract.ts';
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
const headers=httpHeaders('local-inbox');
const response=(status:number,payload:unknown)=>httpJson('local-inbox',status,payload);
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
function htmlInbox(messages:{kind:string;recipient:string;subject:string;link:string;createdAt:number;expiresAt:number}[]){
 const rows=messages.map(message=>{
  const safeLink=new URL(message.link);
  const timestamp=new Date(message.createdAt*1000).toLocaleString('en-GB');
  return '<article><p class="kind">'+escapeHtml(message.kind)+' · '+escapeHtml(timestamp)+'</p><h2>'+escapeHtml(message.subject)+'</h2><p>'+escapeHtml(message.recipient)+'</p><a rel="noreferrer" href="'+escapeHtml(safeLink.pathname+safeLink.search)+'">Open verification / reset link</a></article>';
 }).join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>Football Architect · DEV inbox</title><style>body{font:16px system-ui,sans-serif;max-width:780px;padding:24px;margin:auto;background:#10151c;color:#f3f6fa}a{color:#83c7ff}article{border:1px solid #36404d;border-radius:12px;padding:18px;margin:16px 0}h1{font-size:1.7rem}h2{font-size:1.1rem}.kind{color:#a8b5c5;font-size:.85rem}</style></head><body><h1>Football Architect · Local DEV inbox</h1><p>Only your local development database. Never share verification links.</p><p><a href="/account/register">Register</a> · <a href="/account/login">Sign in</a> · <a href="/account/recover">Password recovery</a></p>'+(rows||'<p>No unexpired messages yet.</p>')+'</body></html>';
}
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
 const denied=routeMethod(request,'GET','local-inbox',false);if(denied)return denied;
 try{
  const url=new URL(request.url);
  if(url.pathname!==LOCAL_INBOX_PATH||url.search)return response(404,{error:{code:'not_found'}});
  await resolveAccountConfiguration(request,env,'local_inbox_unavailable');
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return response(403,{error:{code:'forbidden'}});
  if(request.headers.get('Sec-Fetch-Site')==='cross-site')return response(403,{error:{code:'forbidden'}});
  const db=await storage(env),now=Math.floor(Date.now()/1000);
  await db.prepare('DELETE FROM local_dev_inbox WHERE expires_at<=?').bind(now).run();
  const data=await db.prepare('SELECT kind,recipient,subject,link,created_at AS createdAt,expires_at AS expiresAt FROM local_dev_inbox ORDER BY created_at DESC LIMIT 30').all<{kind:string;recipient:string;subject:string;link:string;createdAt:number;expiresAt:number}>();
  if(request.headers.get('Accept')?.includes('text/html')){
   return new Response(htmlInbox(data.results),{status:200,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
  }
  return response(200,{localOnly:true,messages:data.results});
 }catch{return response(503,{error:{code:'local_inbox_unavailable'}})}
}
