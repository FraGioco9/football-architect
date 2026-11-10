(()=>{
'use strict';
const ui=window.faAccountUI;if(!ui||ui.redirecting)return;
let lang=ui.language;
const translations={
en:['Profile','Change password','Current password','New password','Change password','Sessions','Sign out other devices','Sign out','Delete account','Password','Type DELETE MY ACCOUNT','Delete account','Checking your session…','Please sign in.','Password updated. Sign in again.','Other sessions revoked.','Account deleted.','Action unsuccessful.','Administrator access must be transferred before deletion.','Sign in'],
it:['Profilo','Cambia password','Password attuale','Nuova password','Cambia password','Sessioni','Disconnetti gli altri dispositivi','Esci','Elimina account','Password','Digita DELETE MY ACCOUNT','Elimina account','Verifica della sessione…','Accedi per continuare.','Password cambiata. Accedi nuovamente.','Altre sessioni revocate.','Account eliminato.','Operazione non riuscita.','Trasferisci prima l’accesso amministrativo.','Accedi'],
de:['Profil','Passwort ändern','Aktuelles Passwort','Neues Passwort','Passwort ändern','Sitzungen','Andere Geräte abmelden','Abmelden','Konto löschen','Passwort','DELETE MY ACCOUNT eingeben','Konto löschen','Sitzung wird geprüft…','Bitte anmelden.','Passwort geändert. Bitte erneut anmelden.','Andere Sitzungen beendet.','Konto gelöscht.','Vorgang fehlgeschlagen.','Administratorzugang muss vorher übertragen werden.','Anmelden'],
es:['Perfil','Cambiar contraseña','Contraseña actual','Nueva contraseña','Cambiar contraseña','Sesiones','Cerrar sesión en otros dispositivos','Cerrar sesión','Eliminar cuenta','Contraseña','Escribe DELETE MY ACCOUNT','Eliminar cuenta','Comprobando sesión…','Inicia sesión.','Contraseña cambiada. Vuelve a iniciar sesión.','Otras sesiones cerradas.','Cuenta eliminada.','La operación ha fallado.','Primero debes transferir el acceso de administrador.','Acceder'],
fr:['Profil','Modifier le mot de passe','Mot de passe actuel','Nouveau mot de passe','Modifier le mot de passe','Sessions','Déconnecter les autres appareils','Se déconnecter','Supprimer le compte','Mot de passe','Saisissez DELETE MY ACCOUNT','Supprimer le compte','Vérification de la session…','Veuillez vous connecter.','Mot de passe modifié. Reconnectez-vous.','Autres sessions révoquées.','Compte supprimé.','Opération impossible.','Transférez d’abord les droits administrateur.','Se connecter']};
const profileCopies={
 en:['Email','Security'],it:['Email','Sicurezza'],de:['E-Mail','Sicherheit'],
 es:['Correo electrónico','Seguridad'],fr:['E-mail','Sécurité']
};
const sessionCopies={en:'Active sessions',it:'Sessioni attive',de:'Aktive Sitzungen',es:'Sesiones activas',fr:'Sessions actives'};
let t=translations[lang],sessionsText=sessionCopies[lang];
const ids=['title','change-title','current-label','new-label','change-button','sessions-title','revoke-button','logout-button','delete-title','delete-password-label','confirm-label','delete-button','loading'];
ui.bind(value=>{
 const next=translations[value];ui.translateStatus(t,next);t=next;lang=value;
 ids.forEach((id,i)=>document.getElementById(id).textContent=t[i]);
 ['profile-title','security-title'].forEach((id,i)=>document.getElementById(id).textContent=profileCopies[lang][i]);
 const summary=document.getElementById('sessions-summary');
 if(summary.textContent.startsWith(sessionsText+':'))summary.textContent=sessionCopies[lang]+summary.textContent.slice(sessionsText.length);
 sessionsText=sessionCopies[lang];document.querySelector('#login-link a').textContent=t[19];document.title=t[0]+' — Football Architect';
});
const status=document.getElementById('status'),protectedPanel=document.getElementById('protected'),login=document.getElementById('login-link'),loading=document.getElementById('loading');
let csrf='';
const post=async(path,body)=>{const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});const value=await r.json().catch(()=>({}));if(!r.ok)throw {status:r.status,code:value?.error?.code};return value};
function redirectToLogin(){window.faLoginReturn.remember();location.replace('/account/login')}
function unauthenticated(message){csrf='';protectedPanel.hidden=true;login.hidden=false;loading.hidden=true;ui.feedback(status,message);}
async function init(){try{
 const r=await fetch('/api/player/session',{credentials:'same-origin',cache:'no-store'});if(r.status===401){redirectToLogin();return;}if(!r.ok){unauthenticated(t[17]);return;}
 const value=await r.json();if(!value?.authenticated||typeof value.csrfToken!=='string'||!value.actor||typeof value.actor.email!=='string'){redirectToLogin();return;}
 csrf=value.csrfToken;document.getElementById('identity').textContent=value.actor.email;
 protectedPanel.hidden=false;loading.hidden=true;
}catch{unauthenticated(t[17])}}
async function refreshSessions(){try{const response=await fetch('/api/player/sessions',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;const data=await response.json();const active=Array.isArray(data.sessions)?data.sessions.length:0;document.getElementById('sessions-summary').textContent=sessionsText+': '+active;}catch{/* Session summary is non-authoritative UI only. */}}
async function execute(button,fn){if(button.disabled)return;button.disabled=true;ui.feedback(status,'');try{await fn()}catch(error){if(error?.status===401){redirectToLogin();return;}ui.feedback(status,error?.code==='admin_transfer_required'?t[18]:t[17]);}finally{button.disabled=false}}
document.getElementById('change-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;execute(form.querySelector('[type="submit"]'),async()=>{const fd=new FormData(form);await post('/api/player/account/change-password',{currentPassword:String(fd.get('currentPassword')),newPassword:String(fd.get('newPassword'))});form.reset();unauthenticated(t[14]);redirectToLogin()})});
document.getElementById('revoke-button').addEventListener('click',e=>execute(e.currentTarget,async()=>{await post('/api/player/account/revoke-other-sessions',{});ui.feedback(status,t[15],'success');await refreshSessions()}));
document.getElementById('logout-button').addEventListener('click',e=>execute(e.currentTarget,async()=>{await post('/api/player/logout',{});unauthenticated(t[13]);redirectToLogin()}));
document.getElementById('delete-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;execute(form.querySelector('[type="submit"]'),async()=>{const fd=new FormData(form);await post('/api/player/account/delete',{password:String(fd.get('password')),confirmation:String(fd.get('confirmation'))});form.reset();unauthenticated(t[16]);redirectToLogin()})});
const security=document.getElementById('security');
security.addEventListener('toggle',()=>{
 if(security.open&&csrf)void refreshSessions();
});
init();
})();