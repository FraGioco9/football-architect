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
type Locale='en'|'de'|'es'|'fr'|'it';
const messages:Record<Locale,Record<'verification'|'reset',{subject:string;lead:string;ignore:string}>>={
 en:{verification:{subject:'Verify your Football Architect email',lead:'Confirm your email address',ignore:'If you did not request this, ignore this message.'},reset:{subject:'Reset your Football Architect password',lead:'Use this link to reset your password',ignore:'If you did not request this, ignore this message.'}},
 de:{verification:{subject:'Bestätige deine Football Architect-E-Mail-Adresse',lead:'Bestätige deine E-Mail-Adresse',ignore:'Falls du dies nicht angefordert hast, ignoriere diese Nachricht.'},reset:{subject:'Setze dein Football Architect-Passwort zurück',lead:'Verwende diesen Link, um dein Passwort zurückzusetzen',ignore:'Falls du dies nicht angefordert hast, ignoriere diese Nachricht.'}},
 es:{verification:{subject:'Verifica tu correo de Football Architect',lead:'Confirma tu dirección de correo electrónico',ignore:'Si no has solicitado esto, ignora este mensaje.'},reset:{subject:'Restablece tu contraseña de Football Architect',lead:'Utiliza este enlace para restablecer tu contraseña',ignore:'Si no has solicitado esto, ignora este mensaje.'}},
 fr:{verification:{subject:'Vérifie ton adresse e-mail Football Architect',lead:'Confirme ton adresse e-mail',ignore:'Si tu n’as pas fait cette demande, ignore ce message.'},reset:{subject:'Réinitialise ton mot de passe Football Architect',lead:'Utilise ce lien pour réinitialiser ton mot de passe',ignore:'Si tu n’as pas fait cette demande, ignore ce message.'}},
 it:{verification:{subject:'Verifica la tua email Football Architect',lead:'Conferma il tuo indirizzo email',ignore:'Se non hai richiesto questa operazione, ignora il messaggio.'},reset:{subject:'Reimposta la tua password Football Architect',lead:'Usa questo link per reimpostare la password',ignore:'Se non hai richiesto questa operazione, ignora il messaggio.'}}
};
export function emailLocale(value?:string|null):Locale{
 // Explicit Account UI language has priority. For generic Accept-Language,
 // select the first supported locale with a nonzero q-value.
 for(const item of (value??'').slice(0,256).split(',').slice(0,12)){
  const [tag,...parameters]=item.trim().toLowerCase().split(';');
  const q=parameters.find(p=>p.trim().startsWith('q='));
  if(q){
   const weight=Number(q.trim().slice(2));
   if(!Number.isFinite(weight)||weight<=0||weight>1)continue;
  }
  const primary=tag.trim().split('-')[0];
  if(primary==='en'||primary==='de'||primary==='es'||primary==='fr'||primary==='it')return primary;
 }
 return 'en';
}
export function cloudflareEmailDeliveries(env:CloudflareDeliveryEnv):{verification?:VerificationDelivery;reset?:VerificationDelivery}{
 if(env.PLAYER_EMAIL_DELIVERY_ENABLED!=='cloudflare'||env.PLAYER_MODE!=='production'||!env.EMAIL||typeof env.EMAIL.send!=='function')return {};
 let origin:URL;
 try{
  origin=new URL(env.PLAYER_ORIGIN??'');
  if(origin.protocol!=='https:'||origin.origin!==env.PLAYER_ORIGIN||origin.hostname==='localhost'||origin.username||origin.password) return {};
 }catch{return {}}
 const from=env.PLAYER_EMAIL_FROM??'';
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)||/[\r\n]/.test(from))return {};
 const build=(kind:'verification'|'reset'):VerificationDelivery=>async(email,token,requestedLocale)=>{
  if(!/^[a-f0-9]{64}$/i.test(token))throw Error('invalid_delivery_token');
  const target=new URL(kind==='verification'?'/account/verify-email':'/account/recover',origin);
  target.searchParams.set('token',token);
  const {subject,lead,ignore}=messages[emailLocale(requestedLocale)][kind];
  const url=target.toString();
  await env.EMAIL!.send({to:email,from,subject,
   text:lead+'\n'+url+'\n'+ignore,
   html:'<p>'+escapeHtml(lead)+'</p><p><a href="'+escapeHtml(url)+'">'+escapeHtml(lead)+'</a></p><p>'+escapeHtml(ignore)+'</p>'});
 };
 return {verification:build('verification'),reset:build('reset')};
}
