(()=>{
'use strict';
const ui=window.faAccountUI;if(!ui||ui.redirecting)return;
const translations={
en:["Profile","Change password","Current password","New password","Change password","Sign out","Checking your session…","Please sign in.","Password updated. Sign in again.","Action unsuccessful.","Sign in"],
it:["Profilo","Cambia password","Password attuale","Nuova password","Cambia password","Esci","Verifica della sessione…","Accedi per continuare.","Password cambiata. Accedi nuovamente.","Operazione non riuscita.","Accedi"],
de:["Profil","Passwort ändern","Aktuelles Passwort","Neues Passwort","Passwort ändern","Abmelden","Sitzung wird geprüft…","Bitte anmelden.","Passwort geändert. Bitte erneut anmelden.","Vorgang fehlgeschlagen.","Anmelden"],
es:["Perfil","Cambiar contraseña","Contraseña actual","Nueva contraseña","Cambiar contraseña","Cerrar sesión","Comprobando sesión…","Inicia sesión.","Contraseña cambiada. Vuelve a iniciar sesión.","La operación ha fallado.","Acceder"],
fr:["Profil","Modifier le mot de passe","Mot de passe actuel","Nouveau mot de passe","Modifier le mot de passe","Se déconnecter","Vérification de la session…","Veuillez vous connecter.","Mot de passe modifié. Reconnectez-vous.","Opération impossible.","Se connecter"]};
const emailLabels={en:'Email',it:'Email',de:'E-Mail',es:'Correo electrónico',fr:'E-mail'};
let t=translations[ui.language];
const ids=['title','change-title','current-label','new-label','change-button','logout-button','loading'];
ui.bind(value=>{
 const next=translations[value];ui.translateStatus(t,next);t=next;
 ids.forEach((id,i)=>document.getElementById(id).textContent=t[i]);
 document.getElementById('profile-title').textContent=emailLabels[value];
 document.querySelector('#login-link a').textContent=t[10];document.title=t[0]+' — Football Architect';
});
const status=document.getElementById('status'),protectedPanel=document.getElementById('protected'),login=document.getElementById('login-link'),loading=document.getElementById('loading');
let csrf='';
const post=async(path,body)=>{const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});if(!r.ok)throw {status:r.status}};
function redirectToLogin(){window.faLoginReturn.remember();location.replace('/account/login')}
function unauthenticated(message){csrf='';protectedPanel.hidden=true;login.hidden=false;loading.hidden=true;ui.feedback(status,message);}
async function init(){try{
 const r=await fetch('/api/player/session',{credentials:'same-origin',cache:'no-store'});if(r.status===401){redirectToLogin();return;}if(!r.ok){unauthenticated(t[9]);return;}
 const value=await r.json();if(!value?.authenticated||typeof value.csrfToken!=='string'||!value.actor||typeof value.actor.email!=='string'){redirectToLogin();return;}
 csrf=value.csrfToken;document.getElementById('identity').textContent=value.actor.email;
 protectedPanel.hidden=false;loading.hidden=true;
}catch{unauthenticated(t[9])}}
async function execute(button,fn){if(button.disabled)return;button.disabled=true;ui.feedback(status,'');try{await fn()}catch(error){if(error?.status===401){redirectToLogin();return;}ui.feedback(status,t[9]);}finally{button.disabled=false}}
document.getElementById('change-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;execute(form.querySelector('[type="submit"]'),async()=>{const fd=new FormData(form);await post('/api/player/account/change-password',{currentPassword:String(fd.get('currentPassword')),newPassword:String(fd.get('newPassword'))});form.reset();unauthenticated(t[8]);redirectToLogin()})});
document.getElementById('logout-button').addEventListener('click',e=>execute(e.currentTarget,async()=>{await post('/api/player/logout',{});unauthenticated(t[7]);redirectToLogin()}));
init();
})();
