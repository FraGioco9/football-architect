import type {VerificationDelivery} from './player-registration.ts';
import {buildAccountDeliveryMessage} from './cloudflare-email-delivery.ts';

/** Opt-in Preview transport only. No OAuth callback, mailbox reading or implicit activation. */
export interface GmailDeliveryEnv {
 PLAYER_MODE?:string;PLAYER_TRUSTED_SOURCE?:string;PLAYER_ORIGIN?:string;
 PLAYER_EMAIL_DELIVERY_ENABLED?:string;PLAYER_EMAIL_FROM?:string;PLAYER_EMAIL_PREVIEW_RECIPIENTS?:string;
 GMAIL_CLIENT_ID?:string;GMAIL_CLIENT_SECRET?:string;GMAIL_REFRESH_TOKEN?:string;
}
const unavailable=()=>Error('email_delivery_unavailable');
const safeAddress=(value:string)=>value.length<=254&&/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(value);
const base64=(value:string)=>btoa(Array.from(new TextEncoder().encode(value),byte=>String.fromCharCode(byte)).join(''));
const lines=(value:string)=>value.match(/.{1,76}/g)!.join('\r\n');
function subjectHeader(subject:string){
 const words:string[]=[];let part='';
 for(const char of subject){
  if(new TextEncoder().encode(part+char).length>40){words.push('=?UTF-8?B?'+base64(part)+'?=');part=''}
  part+=char;
 }
 if(part)words.push('=?UTF-8?B?'+base64(part)+'?=');
 return words.join('\r\n ');
}
function mimeMessage(message:ReturnType<typeof buildAccountDeliveryMessage>){
 const boundary='fa_'+crypto.randomUUID();
 return ['From: '+message.from,'To: '+message.to,'Subject: '+subjectHeader(message.subject),
  'Date: '+new Date().toUTCString(),'MIME-Version: 1.0','Content-Type: multipart/alternative; boundary="'+boundary+'"','',
  '--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',lines(base64(message.text)),
  '--'+boundary,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',lines(base64(message.html)),
  '--'+boundary+'--',''].join('\r\n');
}
async function boundedJson(response:Response){
 if(!response.ok){await response.body?.cancel();throw unavailable()}
 const reader=response.body?.getReader();if(!reader)throw unavailable();
 let text='',bytes=0;const decoder=new TextDecoder();
 try{
  for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;
   if(bytes>16384)throw unavailable();text+=decoder.decode(chunk.value,{stream:true});}
  return JSON.parse(text+decoder.decode()) as Record<string,unknown>;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export function gmailEmailDeliveries(env:GmailDeliveryEnv,transport:typeof fetch=fetch):{verification?:VerificationDelivery;reset?:VerificationDelivery}{
 if(env.PLAYER_MODE!=='preview'||env.PLAYER_TRUSTED_SOURCE!=='cloudflare'||env.PLAYER_EMAIL_DELIVERY_ENABLED!=='gmail-preview')return {};
 let origin:URL;
 try{origin=new URL(env.PLAYER_ORIGIN??'');
  if(origin.origin!==env.PLAYER_ORIGIN||origin.protocol!=='https:'||origin.port||origin.username||origin.password||
   !/^football-architect-preview\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.workers\.dev$/.test(origin.hostname))return {};
 }catch{return {}}
 const from=env.PLAYER_EMAIL_FROM??'',recipients=(env.PLAYER_EMAIL_PREVIEW_RECIPIENTS??'').split(',');
 if(!safeAddress(from)||!/^[a-z0-9._%+-]+@gmail\.com$/.test(from)||recipients.length>10||
  !recipients.every(email=>email===email.trim().toLowerCase()&&safeAddress(email)))return {};
 const secrets=[env.GMAIL_CLIENT_ID,env.GMAIL_CLIENT_SECRET,env.GMAIL_REFRESH_TOKEN];
 if(!secrets.every(secret=>typeof secret==='string'&&secret.length>0&&secret.length<=4096&&!/[\u0000-\u0020\u007f]/.test(secret)))return {};
 const allowlist=new Set(recipients),clientId=env.GMAIL_CLIENT_ID!,clientSecret=env.GMAIL_CLIENT_SECRET!,refreshToken=env.GMAIL_REFRESH_TOKEN!;
 const build=(kind:'verification'|'reset'):VerificationDelivery=>async(email,token,locale)=>{
  try{
   if(!safeAddress(email)||!allowlist.has(email))throw unavailable();
   const message=buildAccountDeliveryMessage(kind,origin.origin,from,email,token,locale);
   // Refresh per delivery; credentials are never stored in D1, logged, or returned.
   const auth=await boundedJson(await transport('https://oauth2.googleapis.com/token',{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})}));
   if(typeof auth.access_token!=='string'||!auth.access_token||auth.access_token.length>8192||/[\u0000-\u0020\u007f]/.test(auth.access_token)||auth.token_type!=='Bearer')throw unavailable();
   const raw=base64(mimeMessage(message)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   // Explicit mailbox path rejects OAuth credentials belonging to another sender.
   const sent=await boundedJson(await transport('https://gmail.googleapis.com/gmail/v1/users/'+encodeURIComponent(from)+'/messages/send',{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
    headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw})}));
   if(typeof sent.id!=='string'||!sent.id)throw unavailable();
  }catch{throw unavailable()} // No provider response, address, secret or one-time link in errors.
 };
 return {verification:build('verification'),reset:build('reset')};
}
