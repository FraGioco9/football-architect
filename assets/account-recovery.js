(()=>{
'use strict';
const locale=(navigator.language||'en').slice(0,2).toLowerCase();
const copy={
 en:['Recover your password','Email','Send recovery email','New password','Reset password','Back to sign in','If an eligible account exists, recovery instructions will be sent.','The password has been changed. Sign in again.','This link is invalid or expired. Request a new one.','This service is not yet available.','Please try again later.','Working…'],
 it:['Recupera la password','Email','Invia email di recupero','Nuova password','Reimposta password','Torna al login','Se esiste un account idoneo, riceverai le istruzioni di recupero.','Password modificata. Accedi nuovamente.','Link non valido o scaduto. Richiedine uno nuovo.','Il servizio non è ancora disponibile.','Riprova più tardi.','Operazione in corso…'],
 de:['Passwort wiederherstellen','E-Mail','Wiederherstellungs-E-Mail senden','Neues Passwort','Passwort zurücksetzen','Zur Anmeldung','Falls ein entsprechendes Konto existiert, werden Anweisungen gesendet.','Passwort geändert. Bitte erneut anmelden.','Link ungültig oder abgelaufen. Fordere einen neuen an.','Der Dienst ist noch nicht verfügbar.','Bitte später erneut versuchen.','Wird verarbeitet…'],
 es:['Recuperar contraseña','Correo electrónico','Enviar correo de recuperación','Nueva contraseña','Restablecer contraseña','Volver al inicio de sesión','Si existe una cuenta válida, se enviarán instrucciones.','Contraseña cambiada. Inicia sesión de nuevo.','Enlace inválido o caducado. Solicita otro.','El servicio todavía no está disponible.','Inténtalo más tarde.','Procesando…'],
 fr:['Récupérer le mot de passe','E-mail','Envoyer un e-mail de récupération','Nouveau mot de passe','Réinitialiser le mot de passe','Retour à la connexion','Si un compte éligible existe, des instructions seront envoyées.','Mot de passe modifié. Reconnectez-vous.','Lien invalide ou expiré. Demandez-en un nouveau.','Le service n’est pas encore disponible.','Veuillez réessayer plus tard.','Traitement…']};
const t=copy[locale]||copy.en;document.documentElement.lang=copy[locale]?locale:'en';
for(const [id,n] of [['heading',0],['email-label',1],['request-button',2],['password-label',3],['complete-button',4],['signin-link',5]])document.getElementById(id).textContent=t[n];
const url=new URL(location.href),token=url.searchParams.get('token'),valid=!!token&&/^[a-f0-9]{64}$/.test(token);
const ask=document.getElementById('request-form'),finish=document.getElementById('complete-form'),message=document.getElementById('message');
finish.hidden=!valid;ask.hidden=valid;
const post=async(path,payload)=>{const res=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return res;};
function showError(res){message.textContent=res.status===400?t[8]:res.status===429?t[10]:t[9];}
ask.addEventListener('submit',async event=>{event.preventDefault();const button=document.getElementById('request-button');button.disabled=true;message.textContent=t[11];try{
 const res=await post('/api/player/password-reset/request',{email:String(new FormData(ask).get('email')||'')});
 message.textContent=res.ok?t[6]:(res.status===429?t[10]:t[9]);
}catch{message.textContent=t[9]}finally{button.disabled=false;}});
finish.addEventListener('submit',async event=>{event.preventDefault();const button=document.getElementById('complete-button');button.disabled=true;message.textContent=t[11];try{
 const res=await post('/api/player/password-reset/complete',{token,newPassword:String(new FormData(finish).get('newPassword')||'')});
 if(res.ok){message.textContent=t[7];finish.hidden=true;history.replaceState(null,'',location.pathname);}else showError(res);
}catch{message.textContent=t[9]}finally{button.disabled=false;}});
})();