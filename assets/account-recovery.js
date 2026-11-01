(()=>{
'use strict';
const ui=window.faAccountUI;if(!ui||ui.redirecting)return;
const copy={
 en:['Recover your password','Email','Send recovery email','New password','Reset password','Back to sign in','If an eligible account exists, recovery instructions will be sent.','The password has been changed. Sign in again.','This link is invalid or expired. Request a new one.','This service is not yet available.','Please try again later.','Working…'],
 it:['Recupera la password','Email','Invia email di recupero','Nuova password','Reimposta password','Torna al login','Se esiste un account idoneo, riceverai le istruzioni di recupero.','Password modificata. Accedi nuovamente.','Link non valido o scaduto. Richiedine uno nuovo.','Il servizio non è ancora disponibile.','Riprova più tardi.','Operazione in corso…'],
 de:['Passwort wiederherstellen','E-Mail','Wiederherstellungs-E-Mail senden','Neues Passwort','Passwort zurücksetzen','Zur Anmeldung','Falls ein entsprechendes Konto existiert, werden Anweisungen gesendet.','Passwort geändert. Bitte erneut anmelden.','Link ungültig oder abgelaufen. Fordere einen neuen an.','Der Dienst ist noch nicht verfügbar.','Bitte später erneut versuchen.','Wird verarbeitet…'],
 es:['Recuperar contraseña','Correo electrónico','Enviar correo de recuperación','Nueva contraseña','Restablecer contraseña','Volver al inicio de sesión','Si existe una cuenta válida, se enviarán instrucciones.','Contraseña cambiada. Inicia sesión de nuevo.','Enlace inválido o caducado. Solicita otro.','El servicio todavía no está disponible.','Inténtalo más tarde.','Procesando…'],
 fr:['Récupérer le mot de passe','E-mail','Envoyer un e-mail de récupération','Nouveau mot de passe','Réinitialiser le mot de passe','Retour à la connexion','Si un compte éligible existe, des instructions seront envoyées.','Mot de passe modifié. Reconnectez-vous.','Lien invalide ou expiré. Demandez-en un nouveau.','Le service n’est pas encore disponible.','Veuillez réessayer plus tard.','Traitement…']};
let t=copy[ui.language];
ui.bind(locale=>{
 const next=copy[locale];ui.translateStatus(t,next);t=next;
 for(const [id,n] of [['heading',0],['email-label',1],['request-button',2],['password-label',3],['complete-button',4],['signin-link',5]]){
  const node=document.getElementById(id);node.textContent=node.disabled&&node.tagName==='BUTTON'?t[11]:t[n];
 }
 document.title=t[0]+' — Football Architect';
});
const url=new URL(location.href),token=url.searchParams.get('token'),valid=!!token&&/^[a-f0-9]{64}$/.test(token);
// Remove the one-time secret immediately, even when the link is malformed.
history.replaceState(null,'',location.pathname);
const ask=document.getElementById('request-form'),finish=document.getElementById('complete-form'),message=document.getElementById('message');
finish.hidden=!valid;ask.hidden=valid;
const post=async(path,payload)=>{const res=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept-Language':ui.language},body:JSON.stringify(payload)});return res;};
function showError(res){ui.feedback(message,res.status===400?t[8]:res.status===429?t[10]:t[9]);}
ask.addEventListener('submit',async event=>{event.preventDefault();ui.nextStep(null);const button=document.getElementById('request-button');button.disabled=true;ui.feedback(message,t[11],'pending');try{
 const res=await post('/api/player/password-reset/request',{email:String(new FormData(ask).get('email')||'')});
 ui.feedback(message,res.ok?t[6]:(res.status===429?t[10]:t[9]),res.ok?'success':'error');if(res.ok)ui.nextStep('recovery');
}catch{ui.feedback(message,t[9]);}finally{button.disabled=false;button.textContent=t[2];}});
finish.addEventListener('submit',async event=>{event.preventDefault();ui.nextStep(null);const button=document.getElementById('complete-button');button.disabled=true;ui.feedback(message,t[11],'pending');try{
 const res=await post('/api/player/password-reset/complete',{token,newPassword:String(new FormData(finish).get('newPassword')||'')});
 if(res.ok){ui.feedback(message,t[7],'success');finish.reset();finish.hidden=true;ui.nextStep('reset');}else showError(res);
}catch{ui.feedback(message,t[9]);}finally{button.disabled=false;button.textContent=t[4];}});
})();