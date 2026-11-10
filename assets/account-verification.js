(()=>{'use strict';
const ui=window.faAccountUI;if(!ui||ui.redirecting)return;
const translations={
en:['Verify your email','Sign in','Checking verification link…','Email verified. You can now sign in.','This verification link is invalid or expired.','Verification unavailable. Please try later.'],
it:['Verifica la tua email','Accedi','Controllo del link di verifica…','Email verificata. Ora puoi accedere.','Il link di verifica non è valido o è scaduto.','Verifica non disponibile. Riprova più tardi.'],
de:['E-Mail bestätigen','Anmelden','Bestätigungslink wird geprüft…','E-Mail bestätigt. Du kannst dich anmelden.','Dieser Bestätigungslink ist ungültig oder abgelaufen.','Bestätigung nicht verfügbar. Bitte später versuchen.'],
es:['Verifica tu correo','Acceder','Comprobando el enlace…','Correo verificado. Ya puedes acceder.','El enlace no es válido o ha caducado.','Verificación no disponible. Inténtalo más tarde.'],
fr:['Vérifiez votre e-mail','Se connecter','Vérification du lien…','E-mail vérifié. Vous pouvez vous connecter.','Lien de vérification invalide ou expiré.','Vérification indisponible. Réessayez plus tard.']};
const remaining={
 en:'Link confirmed. Confirm the link in your other inbox to finish changing your email.',
 it:'Link confermato. Apri il link nell’altra casella per completare il cambio email.',
 de:'Link bestätigt. Bestätige den Link im anderen Postfach, um die E-Mail zu ändern.',
 es:'Enlace confirmado. Confirma el enlace en el otro buzón para cambiar el correo.',
 fr:'Lien confirmé. Confirmez le lien dans l’autre boîte pour terminer la modification.'
};
let t=translations[ui.language],locale=ui.language;
ui.bind(lang=>{const next=translations[lang];ui.translateStatus(t,next);ui.translateStatus([remaining[locale]],[remaining[lang]]);t=next;locale=lang;document.getElementById('title').textContent=t[0];document.getElementById('login-link').textContent=t[1];document.title=t[0]+' — Football Architect';});
const status=document.getElementById('status'),url=new URL(location.href),token=url.searchParams.get('token');
history.replaceState(null,'',location.pathname);
if(!token||!/^[a-f0-9]{64}$/.test(token)){ui.feedback(status,t[4]);return;}
ui.feedback(status,t[2],'pending');
fetch('/api/player/verify-email',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})})
.then(async r=>{
 const result=r.ok?await r.json().catch(()=>null):null;
 ui.feedback(status,r.ok?(result?.remainingConfirmation?remaining[locale]:t[3]):r.status===400||r.status===422?t[4]:t[5],r.ok?'success':'error');
})
.catch(()=>{ui.feedback(status,t[5],'error');});
})();