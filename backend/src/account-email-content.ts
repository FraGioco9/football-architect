/**
 * Provider-neutral content builder only. No delivery implementation, network call,
 * provider credentials or implicit activation is included.
 */
export type AccountEmailPurpose='verify_email'|'reset_password';
export type AccountEmailLocale='en'|'de'|'es'|'fr'|'it';
const copy:Record<AccountEmailLocale,Record<AccountEmailPurpose,{subject:string;action:string;detail:string}>>={
 en:{verify_email:{subject:'Verify your Football Architect email',action:'Verify email',detail:'This link expires in 24 hours.'},reset_password:{subject:'Reset your Football Architect password',action:'Reset password',detail:'This link expires in 30 minutes.'}},
 de:{verify_email:{subject:'Football Architect: E-Mail bestätigen',action:'E-Mail bestätigen',detail:'Dieser Link ist 24 Stunden gültig.'},reset_password:{subject:'Football Architect: Passwort zurücksetzen',action:'Passwort zurücksetzen',detail:'Dieser Link ist 30 Minuten gültig.'}},
 es:{verify_email:{subject:'Verifica tu correo de Football Architect',action:'Verificar correo',detail:'Este enlace caduca en 24 horas.'},reset_password:{subject:'Restablece tu contraseña de Football Architect',action:'Restablecer contraseña',detail:'Este enlace caduca en 30 minutos.'}},
 fr:{verify_email:{subject:'Vérifiez votre adresse e-mail Football Architect',action:"Vérifier l’adresse e-mail",detail:'Ce lien expire dans 24 heures.'},reset_password:{subject:'Réinitialisez votre mot de passe Football Architect',action:'Réinitialiser le mot de passe',detail:'Ce lien expire dans 30 minutes.'}},
 it:{verify_email:{subject:'Verifica la tua email Football Architect',action:'Verifica email',detail:'Questo link scade tra 24 ore.'},reset_password:{subject:'Reimposta la password Football Architect',action:'Reimposta password',detail:'Questo link scade tra 30 minuti.'}}
};
export function buildAccountEmail(purpose:AccountEmailPurpose,locale:AccountEmailLocale,origin:string,token:string){
 if(purpose!=='verify_email'&&purpose!=='reset_password')throw new TypeError('invalid_purpose');
 if(!Object.prototype.hasOwnProperty.call(copy,locale))throw new TypeError('invalid_locale');
 if(!/^[a-f0-9]{64}$/.test(token))throw new TypeError('invalid_token');
 const base=new URL(origin);
 if(base.origin!==origin||base.pathname!=='/'||base.search||base.hash||base.username||base.password||
   !(base.protocol==='https:'||(base.protocol==='http:'&&['localhost','127.0.0.1','app.localhost','[::1]'].includes(base.hostname))))
  throw new TypeError('invalid_origin');
 const path=purpose==='verify_email'?'/account/verify-email/':'/account/recover/';
 const link=new URL(path,base);link.searchParams.set('token',token);
 const template=copy[locale][purpose];
 return {subject:template.subject,text:`${template.action}: ${link.toString()}\n\n${template.detail}\nIf you did not request this, ignore this message.`};
}
