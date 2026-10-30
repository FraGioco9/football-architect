import type {VerificationDelivery} from './player-registration.ts';

// Native Cloudflare Email Service adapter. No send_email binding or activation vars
// are shipped in wrangler.toml. Only an explicitly provisioned production environment
// can enable it; local/Preview and incomplete configurations fail closed.
type EmailBinding={send(message:{to:string;from:string;subject:string;text:string;html:string}):Promise<unknown>};
export interface CloudflareDeliveryEnv{
 PLAYER_MODE?:string;
 PLAYER_ORIGIN?:string;
 PLAYER_EMAIL_DELIVERY_ENABLED?:string;
 PLAYER_EMAIL_FROM?:string;
 EMAIL?:EmailBinding;
}
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function cloudflareEmailDeliveries(env:CloudflareDeliveryEnv):{verification?:VerificationDelivery;reset?:VerificationDelivery}{
 if(env.PLAYER_EMAIL_DELIVERY_ENABLED!=='cloudflare'||env.PLAYER_MODE!=='production'||!env.EMAIL||typeof env.EMAIL.send!=='function')return {};
 let origin:URL;
 try{
  origin=new URL(env.PLAYER_ORIGIN??'');
  if(origin.protocol!=='https:'||origin.origin!==env.PLAYER_ORIGIN||origin.hostname==='localhost'||origin.username||origin.password) return {};
 }catch{return {}}
 const from=env.PLAYER_EMAIL_FROM??'';
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)||/[\r\n]/.test(from))return {};
 const build=(kind:'verification'|'reset'):VerificationDelivery=>async(email,token)=>{
  if(!/^[a-f0-9]{64}$/i.test(token))throw Error('invalid_delivery_token');
  const target=new URL(kind==='verification'?'/account/verify-email':'/account/recover',origin);
  target.searchParams.set('token',token);
  const title=kind==='verification'?'Verify your Football Architect email':'Reset your Football Architect password';
  const lead=kind==='verification'?'Confirm your email address':'Use this link to reset your password';
  const url=target.toString();
  await env.EMAIL!.send({to:email,from,subject:title,
   text:lead+'\n'+url+'\nIf you did not request this, ignore this message.',
   html:'<p>'+escapeHtml(lead)+'</p><p><a href="'+escapeHtml(url)+'">'+escapeHtml(lead)+'</a></p><p>If you did not request this, ignore this message.</p>'});
 };
 return {verification:build('verification'),reset:build('reset')};
}
