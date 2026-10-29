(()=>{'use strict';
const lang=(navigator.language||'en').slice(0,2).toLowerCase();
const translations={
en:['Verify your email','Sign in','Checking verification link…','Email verified. You can now sign in.','This verification link is invalid or expired.','Verification unavailable. Please try later.'],
it:['Verifica la tua email','Accedi','Controllo del link di verifica…','Email verificata. Ora puoi accedere.','Il link di verifica non è valido o è scaduto.','Verifica non disponibile. Riprova più tardi.'],
de:['E-Mail bestätigen','Anmelden','Bestätigungslink wird geprüft…','E-Mail bestätigt. Du kannst dich anmelden.','Dieser Bestätigungslink ist ungültig oder abgelaufen.','Bestätigung nicht verfügbar. Bitte später versuchen.'],
es:['Verifica tu correo','Acceder','Comprobando el enlace…','Correo verificado. Ya puedes acceder.','El enlace no es válido o ha caducado.','Verificación no disponible. Inténtalo más tarde.'],
fr:['Vérifiez votre e-mail','Se connecter','Vérification du lien…','E-mail vérifié. Vous pouvez vous connecter.','Lien de vérification invalide ou expiré.','Vérification indisponible. Réessayez plus tard.']};
const t=translations[lang]||translations.en;document.documentElement.lang=translations[lang]?lang:'en';
document.getElementById('title').textContent=t[0];document.getElementById('login-link').textContent=t[1];
const status=document.getElementById('status'),url=new URL(location.href),token=url.searchParams.get('token');
history.replaceState(null,'',location.pathname);
if(!token||!/^[a-f0-9]{64}$/.test(token)){status.textContent=t[4];return;}
status.textContent=t[2];
fetch('/api/player/verify-email',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})})
.then(r=>{status.textContent=r.ok?t[3]:r.status===400||r.status===422?t[4]:t[5]})
.catch(()=>{status.textContent=t[5]});
})();