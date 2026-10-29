(()=>{
'use strict';
const lang=(navigator.language||'en').slice(0,2).toLowerCase();
const translations={
en:['Your account','Change password','Current password','New password','Change password','Sessions','Sign out other devices','Sign out','Delete account','Password','Type DELETE MY ACCOUNT','Delete account','Checking your session…','Please sign in.','Password updated. Sign in again.','Other sessions revoked.','Account deleted.','Action unsuccessful.','Administrator access must be transferred before deletion.','Sign in'],
it:['Il tuo account','Cambia password','Password attuale','Nuova password','Cambia password','Sessioni','Disconnetti gli altri dispositivi','Esci','Elimina account','Password','Digita DELETE MY ACCOUNT','Elimina account','Verifica della sessione…','Accedi per continuare.','Password cambiata. Accedi nuovamente.','Altre sessioni revocate.','Account eliminato.','Operazione non riuscita.','Trasferisci prima l’accesso amministrativo.','Accedi'],
de:['Dein Konto','Passwort ändern','Aktuelles Passwort','Neues Passwort','Passwort ändern','Sitzungen','Andere Geräte abmelden','Abmelden','Konto löschen','Passwort','DELETE MY ACCOUNT eingeben','Konto löschen','Sitzung wird geprüft…','Bitte anmelden.','Passwort geändert. Bitte erneut anmelden.','Andere Sitzungen beendet.','Konto gelöscht.','Vorgang fehlgeschlagen.','Administratorzugang muss vorher übertragen werden.','Anmelden'],
es:['Tu cuenta','Cambiar contraseña','Contraseña actual','Nueva contraseña','Cambiar contraseña','Sesiones','Cerrar sesión en otros dispositivos','Cerrar sesión','Eliminar cuenta','Contraseña','Escribe DELETE MY ACCOUNT','Eliminar cuenta','Comprobando sesión…','Inicia sesión.','Contraseña cambiada. Vuelve a iniciar sesión.','Otras sesiones cerradas.','Cuenta eliminada.','La operación ha fallado.','Primero debes transferir el acceso de administrador.','Acceder'],
fr:['Votre compte','Modifier le mot de passe','Mot de passe actuel','Nouveau mot de passe','Modifier le mot de passe','Sessions','Déconnecter les autres appareils','Se déconnecter','Supprimer le compte','Mot de passe','Saisissez DELETE MY ACCOUNT','Supprimer le compte','Vérification de la session…','Veuillez vous connecter.','Mot de passe modifié. Reconnectez-vous.','Autres sessions révoquées.','Compte supprimé.','Opération impossible.','Transférez d’abord les droits administrateur.','Se connecter']};
const t=translations[lang]||translations.en;document.documentElement.lang=translations[lang]?lang:'en';
const ids=['title','change-title','current-label','new-label','change-button','sessions-title','revoke-button','logout-button','delete-title','delete-password-label','confirm-label','delete-button','loading'];
ids.forEach((id,i)=>document.getElementById(id).textContent=t[i]);
document.querySelector('#login-link a').textContent=t[19];
const status=document.getElementById('status'),protectedPanel=document.getElementById('protected'),login=document.getElementById('login-link'),loading=document.getElementById('loading');
let csrf='';
const post=async(path,body)=>{const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});const value=await r.json().catch(()=>({}));if(!r.ok)throw {status:r.status,code:value?.error?.code};return value};
function unauthenticated(message){csrf='';protectedPanel.hidden=true;login.hidden=false;loading.hidden=true;status.textContent=message}
async function init(){try{
 const r=await fetch('/api/player/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok){unauthenticated(t[13]);return;}
 const value=await r.json();if(!value?.authenticated||typeof value.csrfToken!=='string'){unauthenticated(t[13]);return;}
 csrf=value.csrfToken;document.getElementById('identity').textContent=value.actor.email;
 document.getElementById('permissions').textContent=(value.permissions||[]).join(', ');
 protectedPanel.hidden=false;loading.hidden=true;
}catch{unauthenticated(t[17])}}
async function execute(button,fn){button.disabled=true;status.textContent='';try{await fn()}catch(error){status.textContent=error?.code==='admin_transfer_required'?t[18]:error?.status===401?t[13]:t[17]}finally{button.disabled=false}}
document.getElementById('change-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;execute(form.querySelector('button'),async()=>{const fd=new FormData(form);await post('/api/player/account/change-password',{currentPassword:String(fd.get('currentPassword')),newPassword:String(fd.get('newPassword'))});form.reset();unauthenticated(t[14])})});
document.getElementById('revoke-button').addEventListener('click',e=>execute(e.currentTarget,async()=>{await post('/api/player/account/revoke-other-sessions',{});status.textContent=t[15]}));
document.getElementById('logout-button').addEventListener('click',e=>execute(e.currentTarget,async()=>{await post('/api/player/logout',{});unauthenticated(t[13])}));
document.getElementById('delete-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;execute(form.querySelector('button'),async()=>{const fd=new FormData(form);await post('/api/player/account/delete',{password:String(fd.get('password')),confirmation:String(fd.get('confirmation'))});form.reset();unauthenticated(t[16])})});
init();
})();